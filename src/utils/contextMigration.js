/**
 * @file contextMigration.js
 * Safe, versioned migration harness for the context store schema.
 *
 * Design:
 * - MIGRATIONS is an ordered array of { from, to, migrate } steps
 * - migrateContext iterates the array until stored version reaches CURRENT
 * - Each migration is additive — adds missing fields, never removes
 * - Any failure returns createDefaultContext() and logs a warning
 *
 * IMPORTANT: This module calls writeContext from contextStore.
 * To avoid circular dependency at module init time, it registers itself
 * with contextStore via registerMigrationModule at the bottom of this file.
 */

import { createDefaultContext } from '@/utils/contextDefaults.js'
import { writeContext, readContext, registerMigrationModule } from '@/utils/contextStore.js'

/** @typedef {import('@/types/context.js').UserContext} UserContext */
/** @typedef {import('@/types/context.js').SavedLocation} SavedLocation */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const CURRENT_SCHEMA_VERSION = '1.0.0'

const LEGACY_SAVED_LOCATIONS_KEY = 'lumicast-saved-locations'

// ---------------------------------------------------------------------------
// Migration pipeline
// ---------------------------------------------------------------------------

/**
 * Ordered array of migration steps.
 * Each step: { from: string, to: string, migrate: (context) => context }
 * Phase 3.1 starts at 1.0.0 — no migrations exist yet. The array is empty
 * but the harness is in place for Phase 3.4 and 3.5 additions.
 */
const MIGRATIONS = [
    // Future migrations added here, e.g.:
    // { from: '1.0.0', to: '1.1.0', migrate: (ctx) => ({ ...ctx, newField: default }) }
]

// ---------------------------------------------------------------------------
// needsMigration
// ---------------------------------------------------------------------------

/**
 * Returns true if the stored context schema version differs from CURRENT.
 * @param {UserContext|null|undefined} storedContext
 * @returns {boolean}
 */
export function needsMigration(storedContext) {
    if (!storedContext || typeof storedContext !== 'object') return false
    return storedContext?.meta?.schemaVersion !== CURRENT_SCHEMA_VERSION
}

// ---------------------------------------------------------------------------
// migrateContext
// ---------------------------------------------------------------------------

/**
 * Runs the stored context through the ordered migration pipeline.
 * Returns the migrated context, or createDefaultContext() on any failure.
 *
 * @param {UserContext} storedContext
 * @returns {UserContext}
 */
export function migrateContext(storedContext) {
    try {
        let ctx = JSON.parse(JSON.stringify(storedContext)) // deep clone
        let currentVersion = ctx?.meta?.schemaVersion ?? '0.0.0'

        for (const step of MIGRATIONS) {
            if (currentVersion === step.from) {
                ctx = step.migrate(ctx)
                currentVersion = step.to
            }
        }

        // Stamp with current schema version
        ctx.meta = ctx.meta ?? {}
        ctx.meta.schemaVersion = CURRENT_SCHEMA_VERSION

        return ctx
    } catch (err) {
        console.warn('[contextMigration] migrateContext failed, returning default', err)
        return createDefaultContext()
    }
}

// ---------------------------------------------------------------------------
// migrateFromLegacySavedLocations
// ---------------------------------------------------------------------------

/**
 * One-time migration from the old `lumicast-saved-locations` format.
 *
 * Old format: { home: string|null, school: string|null, work: string|null }
 * New format: UserContext.location.saved[] (SavedLocation objects)
 *
 * Rules:
 * - Idempotent: safe to call multiple times
 * - Does not throw
 * - Removes old key after successful write
 * - Name-only limitation: migrated entries have lat/lon = null (coords restored on next use)
 * - Does NOT overwrite entries that already exist in location.saved with the same id
 */
export function migrateFromLegacySavedLocations() {
    try {
        const raw = localStorage.getItem(LEGACY_SAVED_LOCATIONS_KEY)
        if (!raw) return // nothing to migrate

        let parsed
        try {
            parsed = JSON.parse(raw)
        } catch {
            console.warn('[contextMigration] legacy saved-locations JSON invalid, skipping migration')
            return
        }

        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return

        const SLOTS = ['home', 'school', 'work']
        /** @type {SavedLocation[]} */
        const migrated = []

        for (const slot of SLOTS) {
            const name = parsed[slot]
            if (!name || typeof name !== 'string' || !name.trim()) continue

            migrated.push({
                id: `saved-${slot}`,
                name: name.trim(),
                lat: null,
                lon: null,
                timezone: null,
                locationType: 'urban'
            })
        }

        if (migrated.length === 0) {
            // Nothing worth migrating — remove old key anyway
            localStorage.removeItem(LEGACY_SAVED_LOCATIONS_KEY)
            return
        }

        // Read current saved list and avoid duplicating entries with the same id
        const current = readContext()
        const existingIds = new Set((current.location?.saved ?? []).map(s => s.id))
        const toAdd = migrated.filter(m => !existingIds.has(m.id))

        if (toAdd.length > 0) {
            const existing = current.location?.saved ?? []
            writeContext({ location: { saved: [...existing, ...toAdd] } })
        }

        localStorage.removeItem(LEGACY_SAVED_LOCATIONS_KEY)
    } catch (err) {
        console.warn('[contextMigration] migrateFromLegacySavedLocations failed', err)
    }
}

// ---------------------------------------------------------------------------
// Register with contextStore to break circular dependency
// ---------------------------------------------------------------------------

// This registration call injects the migration functions into contextStore
// so contextStore can call them at runtime without a static circular import.
registerMigrationModule({ needsMigration, migrateContext })
