/**
 * @file useUserContext.js
 * The single interface to user context for ALL consumers in the application.
 *
 * Singleton pattern: reactive state is created once at module level.
 * Every call to useUserContext() returns the same reactive refs — so a
 * context change in the profile UI is immediately visible to every card
 * or composable that imports this module.
 *
 * Merges:
 *   persistentContext (from contextStore → localStorage)
 *   + session fields (from stores/context.js → in-memory only)
 *   → userContext (readonly computed, used by all consumers)
 *
 * IMPORTANT: This module imports contextMigration.js which registers itself
 * with contextStore. The import must be at module level so the registration
 * happens before any readContext() call.
 */

// ⚠️ Must be first — registers migration module with contextStore
import '@/utils/contextMigration.js'

import { ref, computed, watch } from 'vue'
import {
    readContext,
    writeContext,
    clearContext as storeClearContext,
    initSignalStore
} from '@/utils/contextStore.js'
import { migrateFromLegacySavedLocations } from '@/utils/contextMigration.js'
import { setUnitFromContext } from '@/composables/useWeatherFormatters.js'
import { createDefaultContext } from '@/utils/contextDefaults.js'

/** @typedef {import('@/types/context.js').UserContext} UserContext */
/** @typedef {import('@/types/context.js').ContextQuality} ContextQuality */

// ---------------------------------------------------------------------------
// Module-level singleton state
// ---------------------------------------------------------------------------

/** @type {import('vue').Ref<UserContext>} */
const _persistentContext = ref(createDefaultContext())

/** Whether lumi.context.v1 existed at initialization */
let _wasFirstRun = true

/** Prevent double-initialization */
let _initialized = false

// ---------------------------------------------------------------------------
// Initialization — runs once at module load
// ---------------------------------------------------------------------------

function _initialize() {
    if (_initialized) return
    _initialized = true

    // First-run detection: check before reading
    try {
        _wasFirstRun = !localStorage.getItem('lumi.context.v1')
    } catch {
        _wasFirstRun = true
    }

    // Read persistent context (migration registration already happened above)
    _persistentContext.value = readContext()

    // One-time legacy migration — re-read if it wrote anything
    try {
        migrateFromLegacySavedLocations()
        _persistentContext.value = readContext()
    } catch {
        // Migration failure is non-fatal
    }

    // Ensure signal store schema exists
    initSignalStore()
}

_initialize()

// ---------------------------------------------------------------------------
// Write-back watcher (debounced 200ms)
// ---------------------------------------------------------------------------

let _writeTimer = null

watch(
    _persistentContext,
    () => {
        if (_writeTimer) clearTimeout(_writeTimer)
        _writeTimer = setTimeout(() => {
            // Direct write without triggering another watch cycle
            try {
                writeContext(_persistentContext.value)
            } catch {
                // Storage errors are non-fatal
            }
        }, 200)
    },
    { deep: true }
)

// Sync temperature unit into useWeatherFormatters whenever preference changes
watch(
    () => _persistentContext.value.preferences?.temperatureUnit,
    (unit) => {
        if (unit === 'C' || unit === 'F') {
            setUnitFromContext(unit)
        }
    },
    { immediate: true }
)

// ---------------------------------------------------------------------------
// Session store accessor
// Session store is imported lazily to keep module initialization safe.
// stores/context.js imports readContext from contextStore — importing it
// at module level here would create an init-time circular dependency.
// ---------------------------------------------------------------------------

/** @type {import('@/stores/context.js').useContextStore | null} */
let _useContextStore = null

async function _loadContextStore() {
    if (_useContextStore) return _useContextStore
    try {
        const mod = await import('@/stores/context.js')
        _useContextStore = mod.useContextStore
    } catch {
        _useContextStore = null
    }
    return _useContextStore
}

// Eagerly kick off the import (non-blocking)
_loadContextStore()

function _getSessionState() {
    if (!_useContextStore) return { gpsPosition: null, isAtPrimary: null }
    try {
        const store = _useContextStore()
        return {
            gpsPosition: store.gpsPosition,
            isAtPrimary: store.isAtPrimary
        }
    } catch {
        return { gpsPosition: null, isAtPrimary: null }
    }
}

// ---------------------------------------------------------------------------
// Exported composable
// ---------------------------------------------------------------------------

export function useUserContext() {
    /** Merged context: persistent + session overlay */
    const userContext = computed(() => {
        const persistent = _persistentContext.value
        const session = _getSessionState()

        return {
            ...persistent,
            location: {
                ...persistent.location,
                current: session.gpsPosition
                    ? {
                        lat: session.gpsPosition.lat,
                        lon: session.gpsPosition.lon,
                        isAtPrimary: session.isAtPrimary ?? false,
                        permissionState: session.gpsPosition.permissionState ?? 'granted'
                    }
                    : null
            }
        }
    })

    /** Shorthand computed for contextQuality */
    const contextQuality = computed(() => _persistentContext.value.meta.contextQuality)

    /** true if quality is not 'none' */
    const hasContext = computed(() => contextQuality.value !== 'none')

    /** true if no context existed when the app loaded this session */
    const isFirstRun = computed(() => _wasFirstRun)

    /**
     * Merges a partial update into persistentContext and writes immediately.
     * @param {Partial<UserContext>} partial
     */
    function setContext(partial) {
        const updated = writeContext(partial)
        _persistentContext.value = updated
        // Update first-run flag if context now has data
        if (updated.meta.contextQuality !== 'none') {
            _wasFirstRun = false
        }
    }

    /** Clears all context and resets to default state. */
    function clearContext() {
        const defaultCtx = storeClearContext()
        _persistentContext.value = defaultCtx
        _wasFirstRun = true
        try {
            if (_useContextStore) _useContextStore().clearSession()
        } catch {
            // Store may not be initialized in test environment
        }
    }

    return {
        /** @type {import('vue').ComputedRef<UserContext>} */
        userContext,
        /** @type {import('vue').ComputedRef<UserContext>} */
        persistentContext: computed(() => _persistentContext.value),
        setContext,
        clearContext,
        contextQuality,
        hasContext,
        isFirstRun
    }
}
