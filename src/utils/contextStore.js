/**
 * @file contextStore.js
 * The ONLY code path that reads from and writes to `lumi.context.v1` in localStorage.
 * All other files that need context data must go through this module.
 * Enforces atomicity, validation, and migration on every read/write.
 */

import { createDefaultContext } from '@/utils/contextDefaults.js'

/** @typedef {import('@/types/context.js').UserContext} UserContext */

const CONTEXT_KEY = 'lumi.context.v1'
const SIGNALS_KEY = 'lumi.signals.v1'
const CURRENT_SCHEMA_VERSION = '1.0.0'

// HH:MM validation — 00:00 to 23:59
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/

// ISO 8601 date — YYYY-MM-DD
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/** Valid ActivityKey values */
const VALID_ACTIVITY_KEYS = new Set([
    'running', 'cycling', 'hiking', 'gardening', 'photography',
    'golf', 'outdoor-dining', 'dog-walking', 'swimming', 'sailing'
])

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function isValidTime(value) {
    return value === null || (typeof value === 'string' && TIME_PATTERN.test(value))
}

function isTimeAfter(start, end) {
    if (!start || !end) return true
    return end > start
}

function isValidISODate(value) {
    if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return false
    const d = new Date(value)
    return !isNaN(d.getTime())
}

function isDateInFuture(dateStr) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const d = new Date(dateStr)
    return d >= today
}

function isValidLat(v) {
    return typeof v === 'number' && isFinite(v) && v >= -90 && v <= 90
}

function isValidLon(v) {
    return typeof v === 'number' && isFinite(v) && v >= -180 && v <= 180
}

/**
 * Deep-merges `source` into `target`. Arrays from source replace arrays in target.
 * Only plain objects are merged recursively; everything else is overwritten.
 * @param {object} target
 * @param {object} source
 * @returns {object}
 */
function deepMerge(target, source) {
    if (source === null || typeof source !== 'object') return source
    const result = Array.isArray(target) ? [...target] : { ...target }
    for (const key of Object.keys(source)) {
        const srcVal = source[key]
        const tgtVal = result[key]
        if (
            srcVal !== null &&
            typeof srcVal === 'object' &&
            !Array.isArray(srcVal) &&
            tgtVal !== null &&
            typeof tgtVal === 'object' &&
            !Array.isArray(tgtVal)
        ) {
            result[key] = deepMerge(tgtVal, srcVal)
        } else {
            result[key] = srcVal
        }
    }
    return result
}

// ---------------------------------------------------------------------------
// computeContextQuality
// ---------------------------------------------------------------------------

/**
 * Derives contextQuality from the current state of the context object.
 * @param {UserContext} ctx
 * @returns {'full'|'partial'|'minimal'|'none'}
 */
function computeContextQuality(ctx) {
    if (!ctx.location?.primary) return 'none'

    const hasRoutine = !!ctx.routines?.weekday?.departureTime
    const hasActivities = (ctx.activities?.declared?.length ?? 0) > 0
    const hasSensitivities = Object.values(ctx.sensitivities ?? {}).some(Boolean)

    if (hasRoutine && hasActivities && hasSensitivities) return 'full'
    if (hasRoutine || hasActivities) return 'partial'
    return 'minimal'
}

/**
 * Derives the completeness flags from the current context.
 * @param {UserContext} ctx
 * @returns {import('@/types/context.js').ContextCompleteness}
 */
function computeCompleteness(ctx) {
    return {
        hasLocation: !!ctx.location?.primary,
        hasRoutine: !!ctx.routines?.weekday?.departureTime ||
            (ctx.routines?.weekday?.outdoorWindows?.length ?? 0) > 0,
        hasActivities: (ctx.activities?.declared?.length ?? 0) > 0,
        hasSensitivities: Object.values(ctx.sensitivities ?? {}).some(Boolean),
        hasPreferences: ctx.preferences?.temperatureUnit != null
    }
}

// ---------------------------------------------------------------------------
// validateContext
// ---------------------------------------------------------------------------

/**
 * Validates all context fields against defined rules.
 * Invalid fields are reset to their defaults — valid fields are preserved.
 * Never throws.
 *
 * @param {UserContext} ctx
 * @returns {{ valid: boolean, context: UserContext }}
 */
export function validateContext(ctx) {
    let valid = true
    // Clone to avoid mutating input
    const c = JSON.parse(JSON.stringify(ctx))
    const def = createDefaultContext()

    // --- location.primary ---
    if (c.location?.primary !== null && c.location?.primary !== undefined) {
        const p = c.location.primary
        if (!isValidLat(p.lat)) { p.lat = null; valid = false }
        if (!isValidLon(p.lon)) { p.lon = null; valid = false }
        if (!p.timezone || typeof p.timezone !== 'string') {
            p.timezone = null; valid = false
        }
    }

    // --- routines.weekday.departureTime ---
    if (c.routines?.weekday) {
        if (!isValidTime(c.routines.weekday.departureTime)) {
            c.routines.weekday.departureTime = null; valid = false
        }
        if (!isValidTime(c.routines.weekday.returnTime)) {
            c.routines.weekday.returnTime = null; valid = false
        }
    }

    // --- outdoor windows ---
    for (const period of ['weekday', 'weekend']) {
        if (Array.isArray(c.routines?.[period]?.outdoorWindows)) {
            c.routines[period].outdoorWindows = c.routines[period].outdoorWindows.filter(w => {
                if (!isValidTime(w.startTime) || !w.startTime) return false
                if (!isValidTime(w.endTime) || !w.endTime) return false
                if (!isTimeAfter(w.startTime, w.endTime)) return false
                return true
            })
        }
    }

    // --- activities ---
    if (Array.isArray(c.activities?.declared)) {
        c.activities.declared = c.activities.declared.map(a => {
            if (!VALID_ACTIVITY_KEYS.has(a.activityKey)) {
                valid = false
                return { ...a, activityKey: null }
            }
            return a
        })
    }

    // --- schedule.manualEvents dates ---
    if (Array.isArray(c.schedule?.manualEvents)) {
        c.schedule.manualEvents = c.schedule.manualEvents.filter(e => {
            return isValidISODate(e.date)
        })
    }

    // --- preferences.temperatureUnit ---
    if (c.preferences?.temperatureUnit !== 'C' && c.preferences?.temperatureUnit !== 'F') {
        c.preferences = c.preferences ?? {}
        c.preferences.temperatureUnit = def.preferences.temperatureUnit
        valid = false
    }

    // --- sensitivities: must all be boolean ---
    if (c.sensitivities) {
        for (const key of Object.keys(c.sensitivities)) {
            if (typeof c.sensitivities[key] !== 'boolean') {
                c.sensitivities[key] = false; valid = false
            }
        }
    }

    return { valid, context: c }
}

// ---------------------------------------------------------------------------
// readContext
// ---------------------------------------------------------------------------

/**
 * Reads `lumi.context.v1` from localStorage.
 * Runs migration check, validation, and past-event pruning.
 * Returns a valid UserContext. Falls back to createDefaultContext() on any error.
 *
 * @returns {UserContext}
 */
export function readContext() {
    try {
        const raw = localStorage.getItem(CONTEXT_KEY)
        if (!raw) return createDefaultContext()

        let parsed
        try {
            parsed = JSON.parse(raw)
        } catch {
            return createDefaultContext()
        }

        if (!parsed || typeof parsed !== 'object') return createDefaultContext()

        // Migration check — import lazily to avoid circular dependency at module load
        const { needsMigration, migrateContext } = _getMigrationModule()
        if (needsMigration(parsed)) {
            parsed = migrateContext(parsed)
        }

        // Merge with defaults to ensure all fields exist (handles partial stored objects)
        const merged = deepMerge(createDefaultContext(), parsed)

        // Validate
        const { context } = validateContext(merged)

        // Prune past manual events
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        if (Array.isArray(context.schedule?.manualEvents)) {
            context.schedule.manualEvents = context.schedule.manualEvents.filter(e => {
                if (!isValidISODate(e.date)) return false
                return isDateInFuture(e.date)
            })
        }

        return context
    } catch (err) {
        console.error('[contextStore] readContext failed, returning default', err)
        return createDefaultContext()
    }
}

// Lazy migration module accessor — breaks potential circular dependency
let _migrationModuleCache = null
function _getMigrationModule() {
    if (_migrationModuleCache) return _migrationModuleCache
    // Dynamic import not needed here because contextMigration imports contextStore
    // and contextStore imports contextMigration. We break the cycle by
    // providing a lazy accessor that is only invoked at call time (not at module init).
    // The actual import is done via a module-level variable set by contextMigration.
    return _migrationModuleCache ?? {
        needsMigration: (ctx) => ctx?.meta?.schemaVersion !== CURRENT_SCHEMA_VERSION,
        migrateContext: (ctx) => ctx
    }
}

/**
 * Called by contextMigration.js to register itself and break the circular
 * dependency between contextStore ↔ contextMigration.
 * @param {{ needsMigration: Function, migrateContext: Function }} mod
 */
export function registerMigrationModule(mod) {
    _migrationModuleCache = mod
}

// ---------------------------------------------------------------------------
// writeContext
// ---------------------------------------------------------------------------

/**
 * Merges `partialContext` into the currently stored context, validates,
 * then writes the full merged object atomically to `lumi.context.v1`.
 * Updates meta timestamps, completeness, and contextQuality.
 *
 * @param {Partial<UserContext>} partialContext
 * @returns {UserContext} the written context
 */
export function writeContext(partialContext) {
    const current = readContext()
    const merged = deepMerge(current, partialContext)

    // Recompute meta fields
    merged.meta = merged.meta ?? {}
    merged.meta.lastModifiedAt = Date.now()
    merged.meta.schemaVersion = CURRENT_SCHEMA_VERSION
    merged.meta.completeness = computeCompleteness(merged)
    merged.meta.contextQuality = computeContextQuality(merged)

    // Validate — resets invalid fields, preserves valid ones
    const { context } = validateContext(merged)

    // Recompute after validation (validation may have reset fields)
    context.meta.completeness = computeCompleteness(context)
    context.meta.contextQuality = computeContextQuality(context)

    try {
        localStorage.setItem(CONTEXT_KEY, JSON.stringify(context))
    } catch (err) {
        console.error('[contextStore] writeContext failed', err)
    }

    return context
}

// ---------------------------------------------------------------------------
// clearContext
// ---------------------------------------------------------------------------

/**
 * Removes both `lumi.context.v1` and `lumi.signals.v1` from localStorage.
 * Returns a fresh default context.
 *
 * @returns {UserContext}
 */
export function clearContext() {
    localStorage.removeItem(CONTEXT_KEY)
    localStorage.removeItem(SIGNALS_KEY)
    return createDefaultContext()
}

// ---------------------------------------------------------------------------
// initSignalStore
// ---------------------------------------------------------------------------

/**
 * Ensures `lumi.signals.v1` exists in localStorage with a valid empty schema.
 * Safe to call multiple times — idempotent.
 * Called by useUserContext on initialization.
 */
export function initSignalStore() {
    try {
        const raw = localStorage.getItem(SIGNALS_KEY)
        if (raw) {
            try {
                const parsed = JSON.parse(raw)
                if (parsed && typeof parsed === 'object' && Array.isArray(parsed.signals)) {
                    return // valid — leave it alone
                }
            } catch {
                // fall through to reset
            }
        }
        // Initialize empty schema
        localStorage.setItem(SIGNALS_KEY, JSON.stringify({
            schemaVersion: '1.0.0',
            signals: []
        }))
    } catch (err) {
        console.error('[contextStore] initSignalStore failed', err)
    }
}

// ---------------------------------------------------------------------------
// Signal store read / write / prune
// ---------------------------------------------------------------------------

/** 90-day retention window in milliseconds */
const SIGNAL_RETENTION_MS = 90 * 24 * 60 * 60 * 1000

/**
 * Reads the raw signal store from localStorage.
 * Returns { schemaVersion, signals } or a fresh empty store on failure.
 *
 * @returns {{ schemaVersion: string, signals: import('@/types/context.js').BehavioralSignal[] }}
 */
export function readSignalStore() {
    try {
        const raw = localStorage.getItem(SIGNALS_KEY)
        if (!raw) return { schemaVersion: '1.0.0', signals: [] }
        const parsed = JSON.parse(raw)
        if (parsed && typeof parsed === 'object' && Array.isArray(parsed.signals)) {
            return parsed
        }
        return { schemaVersion: '1.0.0', signals: [] }
    } catch {
        return { schemaVersion: '1.0.0', signals: [] }
    }
}

/**
 * Appends a signal to `lumi.signals.v1` and prunes signals older than
 * SIGNAL_RETENTION_MS (90 days). Enforces 90-day rolling window on every write.
 *
 * @param {import('@/types/context.js').BehavioralSignal} signal
 */
export function appendSignal(signal) {
    try {
        const store = readSignalStore()
        const cutoff = Date.now() - SIGNAL_RETENTION_MS
        const pruned = store.signals.filter(s => s.timestamp >= cutoff)
        pruned.push(signal)
        localStorage.setItem(SIGNALS_KEY, JSON.stringify({
            schemaVersion: store.schemaVersion ?? '1.0.0',
            signals: pruned
        }))
    } catch (err) {
        console.error('[contextStore] appendSignal failed', err)
    }
}

/**
 * Removes all signals from `lumi.signals.v1`.
 * Called from the signal audit UI (user-initiated).
 */
export function clearSignalStore() {
    try {
        localStorage.setItem(SIGNALS_KEY, JSON.stringify({
            schemaVersion: '1.0.0',
            signals: []
        }))
    } catch (err) {
        console.error('[contextStore] clearSignalStore failed', err)
    }
}
