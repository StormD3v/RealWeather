/**
 * @file moduleContract.js
 * Defines the interface contract that every intelligence module must satisfy.
 *
 * Each module is a pure function:
 *   (WeatherData, UserContext) → Insight | null
 *
 * Rules (from LUMI_INTELLIGENCE_PHILOSOPHY.md §8):
 *   1. No side effects
 *   2. No direct store access
 *   3. No network requests
 *   4. Independently testable with mock data
 *   5. Returns null when no insight is warranted (valid, intentional output)
 *   6. Every non-null return passes the mandatory gate (non-empty actionPath)
 *
 * Phase 3.1 ships this contract only — no module implementations.
 * Phase 3.2 implements: dailyPlanningModule, comfortModule, commuteModule,
 *   activityModule, routineModule.
 * Phase 3.5 adds: airQualityModule, uvModule, pollenModule.
 *
 * --- Null Context Fallback ---
 * When context is absent or incomplete, modules should fall back to
 * Layer 2 (Environmental Context) quality output: still action-connected,
 * still human-meaningful — just not personalized.
 * The fallback is never "no insight" for conditions that warrant one.
 */

/** @typedef {import('@/types/context.js').Insight} Insight */
/** @typedef {import('@/types/context.js').WeatherData} WeatherData */
/** @typedef {import('@/types/context.js').UserContext} UserContext */

// ---------------------------------------------------------------------------
// Type definitions for module interface
// ---------------------------------------------------------------------------

/**
 * The signature every intelligence module must implement.
 *
 * @callback IntelligenceModule
 * @param {WeatherData} weatherData — normalized weather data from the adapter
 * @param {UserContext}  userContext — from useUserContext() composable
 * @returns {Insight | Insight[] | null}
 */

/**
 * Registry of all known module names.
 * Used by the coordinator to enumerate which modules to run.
 *
 * Phase 3.1: names registered, implementations pending (Phase 3.2).
 * Phase 3.2: all entries populated with actual module functions.
 *
 * @readonly
 * @enum {string}
 */
export const MODULE_NAMES = Object.freeze({
    DAILY_PLANNING: 'dailyPlanning',
    COMFORT: 'comfort',
    COMMUTE: 'commute',
    ACTIVITY: 'activity',
    ROUTINE_ADAPT: 'routineAdaptation',
    // Phase 3.5 additions (registered now, implemented later):
    AIR_QUALITY: 'airQuality',
    UV: 'uv',
    POLLEN: 'pollen'
})

/**
 * Null module — used as a placeholder when a module has not yet been
 * implemented. Always returns null, never throws.
 *
 * @type {IntelligenceModule}
 */
export function nullModule(_weatherData, _userContext) {
    return null
}

/**
 * Validates that a module function satisfies the interface contract.
 * Throws in development mode if the contract is violated.
 * No-op in production — the contract is a development-time guarantee.
 *
 * @param {IntelligenceModule} moduleFn
 * @param {string} moduleName
 */
export function assertModuleContract(moduleFn, moduleName) {
    if (typeof moduleFn !== 'function') {
        throw new TypeError(
            `[moduleContract] "${moduleName}" must be a function, got ${typeof moduleFn}`
        )
    }
    if (moduleFn.length !== 2) {
        throw new TypeError(
            `[moduleContract] "${moduleName}" must accept exactly 2 parameters ` +
            `(weatherData, userContext), got ${moduleFn.length}`
        )
    }
}
