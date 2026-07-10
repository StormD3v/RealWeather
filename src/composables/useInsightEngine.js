/**
 * @file useInsightEngine.js
 * The insight coordinator — the central reactive hub that runs all
 * intelligence modules and returns an ordered InsightSet.
 *
 * Phase 3.1 state: coordinator infrastructure is live; all modules
 * are wired to nullModule placeholders. The coordinator itself is
 * functional — it runs, collects, deduplicates, and sorts.
 * Phase 3.2 replaces nullModules with real implementations.
 *
 * Architecture (from LUMI_INTELLIGENCE_ROADMAP.md §4):
 *   1. Receives WeatherData + UserContext as inputs
 *   2. Runs all applicable modules
 *   3. Filters null outputs
 *   4. Deduplicates overlapping insights
 *   5. Sorts by urgency DESC, then confidence DESC
 *   6. Returns ordered InsightSet
 *
 * The coordinator is reactive — it re-evaluates when weather data or
 * context changes. Each module run is synchronous.
 */

import { computed, ref } from 'vue'
import { useWeatherStore } from '@/stores/weather'
import { useUserContext } from '@/composables/useUserContext'
import { buildWeatherData, isWeatherDataReady } from '@/utils/weatherDataAdapter'
import { filterValidInsights } from '@/utils/insightValidator'
import { sortByUrgency, URGENCY_RANK } from '@/utils/urgencyEngine'
import { nullModule, MODULE_NAMES, assertModuleContract } from '@/services/intelligenceModules/moduleContract'
import { useBehavioralSignals } from '@/composables/useBehavioralSignals'

// ---------------------------------------------------------------------------
// Phase 3.2 module registrations
// Each module is imported and registered explicitly.
// Explicit registration avoids circular dependencies.
// ---------------------------------------------------------------------------
import { dailyPlanningModule } from '@/intelligence/modules/dailyPlanningModule.js'
import { comfortModule } from '@/intelligence/modules/comfortModule.js'
import { commuteModule } from '@/intelligence/modules/commuteModule.js'
import { activityModule } from '@/intelligence/modules/activityModule.js'
import { routineModule } from '@/intelligence/modules/routineModule.js'
// Phase 3.5 environmental modules
import { uvModule } from '@/intelligence/modules/uvModule.js'
import { airQualityModule } from '@/intelligence/modules/airQualityModule.js'
import { pollenModule } from '@/intelligence/modules/pollenModule.js'

/** @typedef {import('@/types/context.js').Insight} Insight */
/** @typedef {import('@/types/context.js').WeatherData} WeatherData */
/** @typedef {import('@/types/context.js').UserContext} UserContext */

// ---------------------------------------------------------------------------
// Module registry
// ---------------------------------------------------------------------------
// Phase 3.1: all modules are nullModule placeholders.
// Phase 3.2 replaces these with real implementations by importing
// and registering them here via registerModule().

/** @type {Map<string, import('@/services/intelligenceModules/moduleContract').IntelligenceModule>} */
const _moduleRegistry = new Map([
    [MODULE_NAMES.DAILY_PLANNING, dailyPlanningModule],
    [MODULE_NAMES.COMFORT, comfortModule],
    [MODULE_NAMES.COMMUTE, commuteModule],
    [MODULE_NAMES.ACTIVITY, activityModule],
    [MODULE_NAMES.ROUTINE_ADAPT, routineModule],
    [MODULE_NAMES.AIR_QUALITY, airQualityModule],
    [MODULE_NAMES.UV, uvModule],
    [MODULE_NAMES.POLLEN, pollenModule]
])

/**
 * Registers a module implementation.
 * Called by Phase 3.2 module files to inject their implementation.
 *
 * @param {string} moduleName — from MODULE_NAMES enum
 * @param {import('@/services/intelligenceModules/moduleContract').IntelligenceModule} fn
 */
export function registerModule(moduleName, fn) {
    assertModuleContract(fn, moduleName)
    _moduleRegistry.set(moduleName, fn)
}

// ---------------------------------------------------------------------------
// Deduplication
// ---------------------------------------------------------------------------

/**
 * Deduplicates insights by type+subtype composite key.
 *
 * For insights without a subtype, the key is just the type (e.g. 'comfort').
 * For insights with a subtype, the key is 'type:subtype' (e.g. 'environmental:uv').
 * This allows multiple environmental modules (UV, air quality, pollen) to coexist
 * in the same InsightSet without one deleting another.
 *
 * When multiple insights share the same key, only the highest-urgency one is kept.
 *
 * @param {Insight[]} insights
 * @returns {Insight[]}
 */
function deduplicateInsights(insights) {
    const byKey = new Map()

    for (const insight of insights) {
        // Use subtype as part of the key when present — prevents environmental
        // modules from incorrectly overwriting each other
        const key = insight.subtype
            ? `${insight.type}:${insight.subtype}`
            : insight.type

        const existing = byKey.get(key)
        if (!existing || URGENCY_RANK[insight.urgency] > URGENCY_RANK[existing.urgency]) {
            byKey.set(key, insight)
        }
    }

    return Array.from(byKey.values())
}

// ---------------------------------------------------------------------------
// Module runner
// ---------------------------------------------------------------------------

/**
 * Runs all registered modules with the given inputs.
 * Collects non-null results. Handles per-module errors gracefully.
 *
 * @param {WeatherData} weatherData
 * @param {UserContext} userContext
 * @returns {Insight[]}
 */
function runModules(weatherData, userContext) {
    const raw = []

    for (const [name, moduleFn] of _moduleRegistry) {
        if (moduleFn === nullModule) continue // skip unimplemented modules

        try {
            const result = moduleFn(weatherData, userContext)
            if (result === null || result === undefined) continue

            if (Array.isArray(result)) {
                raw.push(...result)
            } else {
                raw.push(result)
            }
        } catch (err) {
            console.error(`[useInsightEngine] Module "${name}" threw an error`, err)
            // A module error must never crash the coordinator
        }
    }

    return raw
}

// ---------------------------------------------------------------------------
// Signal-weighted ranking
// ---------------------------------------------------------------------------

/**
 * Applies behavioral signal weights to re-order insights WITHIN each urgency
 * tier. Urgency ordering is NEVER altered — alert always precedes heads-up,
 * heads-up always precedes useful, etc. Signal weights only break ties within
 * the same urgency level.
 *
 * Algorithm:
 *   1. Group insights by urgency tier (preserving the urgency sort order)
 *   2. Within each group, sort by descending signal weight
 *      (ties are resolved by original index — stable sort)
 *   3. Flatten back to a single array
 *
 * Invariants guaranteed:
 *   - No insight is removed or suppressed
 *   - No insight's urgency field is changed
 *   - An empty or missing weights Map produces the original order unchanged
 *
 * @param {Insight[]} sortedInsights - already sorted by urgency DESC
 * @param {Map<string, number>} weights - insightType → 0–1 weight
 * @returns {Insight[]}
 */
function applySignalWeights(sortedInsights, weights) {
    if (!weights || weights.size === 0) return sortedInsights

    // Group by urgency tier, preserving order of tiers
    const tierOrder = []
    /** @type {Map<string, Insight[]>} */
    const tiers = new Map()

    for (const insight of sortedInsights) {
        const tier = insight.urgency
        if (!tiers.has(tier)) {
            tiers.set(tier, [])
            tierOrder.push(tier)
        }
        tiers.get(tier).push(insight)
    }

    // Within each tier, stable-sort by signal weight descending
    const result = []
    for (const tier of tierOrder) {
        const group = tiers.get(tier)
        // Attach original index for stable tiebreaking
        const indexed = group.map((insight, i) => ({ insight, i }))
        indexed.sort((a, b) => {
            const wA = weights.get(a.insight.type) ?? 0
            const wB = weights.get(b.insight.type) ?? 0
            if (wB !== wA) return wB - wA   // higher weight first
            return a.i - b.i                // stable: preserve original order on tie
        })
        result.push(...indexed.map(x => x.insight))
    }

    return result
}

// ---------------------------------------------------------------------------
// Singleton state
// ---------------------------------------------------------------------------

let _initialized = false
const _insightSet = ref(/** @type {Insight[]} */([]))
const _isRunning = ref(false)
const _lastRunAt = ref(0)

// ---------------------------------------------------------------------------
// Exported composable
// ---------------------------------------------------------------------------

export function useInsightEngine() {
    const weatherStore = useWeatherStore()
    const { userContext } = useUserContext()
    const { getSignalWeights, recordInsightEngage } = useBehavioralSignals()

    /**
     * Builds the WeatherData from the store and runs the full pipeline.
     * Called reactively when weather or context changes.
     */
    function compute() {
        const weatherData = buildWeatherData({
            currentWeather: weatherStore.currentWeather,
            hourlyForecast: weatherStore.hourlyForecast,
            forecast: weatherStore.forecast,
            lastUpdatedAt: weatherStore.lastUpdatedAt
        })

        if (!isWeatherDataReady(weatherData)) {
            _insightSet.value = []
            return
        }

        _isRunning.value = true

        try {
            const raw = runModules(weatherData, userContext.value)
            const valid = filterValidInsights(raw)
            const deduped = deduplicateInsights(valid)
            const sorted = sortByUrgency(deduped)

            // Phase 3.4: apply within-tier signal weight ranking
            const weights = getSignalWeights()
            _insightSet.value = applySignalWeights(sorted, weights)

            _lastRunAt.value = Date.now()
        } finally {
            _isRunning.value = false
        }
    }

    // Derived views — computed from the reactive insight set

    /** All insights, ordered urgency DESC */
    const insights = computed(() => _insightSet.value)

    /** The single highest-urgency insight (lead morning briefing insight) */
    const leadInsight = computed(() => _insightSet.value[0] ?? null)

    /** Insights at Heads-up or Alert level */
    const alertInsights = computed(() =>
        _insightSet.value.filter(i => i.urgency === 'heads-up' || i.urgency === 'alert')
    )

    /** Insights of a specific type */
    function insightsByType(type) {
        return computed(() => _insightSet.value.filter(i => i.type === type))
    }

    /** Whether the engine has produced any insights */
    const hasInsights = computed(() => _insightSet.value.length > 0)

    /** Whether the engine is currently running (always false in Phase 3.1) */
    const isRunning = computed(() => _isRunning.value)

    return {
        /** Full ordered insight set */
        insights,
        /** Lead (most urgent) insight */
        leadInsight,
        /** Alert and Heads-up tier insights */
        alertInsights,
        /** Filter insights by type */
        insightsByType,
        /** True when at least one insight is available */
        hasInsights,
        /** True while the engine is computing */
        isRunning,
        /** Unix timestamp of last successful run */
        lastRunAt: computed(() => _lastRunAt.value),
        /**
         * Manually trigger a compute run.
         * Called by WeatherDashboard when weather data loads or context changes.
         */
        compute,
        /**
         * Record that the user engaged with an insight.
         * Passed through from useBehavioralSignals — callers don't need to
         * import the signals composable separately.
         *
         * @param {string} insightType
         * @param {string} [urgency]
         */
        recordInsightEngage
    }
}
