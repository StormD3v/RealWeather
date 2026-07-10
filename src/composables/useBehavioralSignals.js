/**
 * @file useBehavioralSignals.js
 * Phase 3.4 — Adaptive Intelligence
 *
 * Composable for recording, reading, and clearing behavioral signals.
 * Signals are stored locally in `lumi.signals.v1` via contextStore helpers.
 *
 * PRIVACY CONTRACT:
 *   - All data stays on-device — nothing is transmitted.
 *   - Signal recording is gated behind preferences.intelligence.behavioralLearning.
 *   - This preference is INDEPENDENT of notifications.enabled.
 *     Users who opt out of notifications still benefit from behavioral learning
 *     (better insight ordering), and users who want privacy can opt out of
 *     learning without losing notifications.
 *   - The 90-day rolling window is enforced automatically on every write.
 *   - Users can delete all signals at any time from the profile screen.
 *
 * Signal types:
 *   'app-open'      — user opened the app (no content, only timestamp)
 *   'insight-engage' — user acted on / tapped an insight
 *                      metadata.insightType: InsightType string
 *                      metadata.urgency:     UrgencyLevel string
 *
 * Derived output:
 *   getSignalWeights() → Map<InsightType, number (0–1)>
 *     Normalized engagement count over the last 30 days.
 *     Used by useInsightEngine to apply within-tier ranking.
 *     Returns equal weights (empty Map) when learning is disabled or no data.
 *
 * Signal collection does NOT:
 *   - Track location, weather conditions, or specific insight content
 *   - Track any personally identifiable information
 *   - Count negative signals (swipe-away, ignore) — only positive engagement
 *   - Change urgency levels — only relative ordering within a tier
 */

import { computed } from 'vue'
import {
    readSignalStore,
    appendSignal,
    clearSignalStore
} from '@/utils/contextStore.js'
import { useUserContext } from '@/composables/useUserContext.js'

/** @typedef {import('@/types/context.js').BehavioralSignal} BehavioralSignal */
/** @typedef {import('@/types/context.js').InsightType} InsightType */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Window used for weight calculation (30 days in ms) */
const WEIGHT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000

/** All valid signal types */
export const SIGNAL_TYPES = Object.freeze({
    APP_OPEN: 'app-open',
    INSIGHT_ENGAGE: 'insight-engage'
})

/** All valid insight types (mirrors InsightType typedef) */
const INSIGHT_TYPES = new Set([
    'daily-planning', 'comfort', 'commute', 'activity',
    'routine-adapt', 'risk-alert', 'environmental', 'ambient'
])

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Returns true if behavioral learning is enabled for this user.
 * Reads from preferences.intelligence.behavioralLearning.
 * Defaults to true when the field is not set (opt-out model).
 *
 * @param {import('@/types/context.js').UserContext} ctx
 * @returns {boolean}
 */
function isBehavioralLearningEnabled(ctx) {
    const pref = ctx?.preferences?.intelligence?.behavioralLearning
    // Default true — undefined/null means not opted out
    return pref !== false
}

// ---------------------------------------------------------------------------
// Exported composable
// ---------------------------------------------------------------------------

export function useBehavioralSignals() {
    const { userContext } = useUserContext()

    /**
     * Whether behavioral learning is currently enabled for this user.
     * Reactive — updates when preference changes.
     */
    const learningEnabled = computed(() =>
        isBehavioralLearningEnabled(userContext.value)
    )

    /**
     * Records an app-open signal.
     * No-op when learning is disabled.
     * Should be called once per session on app mount.
     */
    function recordAppOpen() {
        if (!learningEnabled.value) return

        /** @type {BehavioralSignal} */
        const signal = {
            type: SIGNAL_TYPES.APP_OPEN,
            timestamp: Date.now(),
            metadata: {}
        }
        appendSignal(signal)
    }

    /**
     * Records that the user engaged with a specific insight.
     * No-op when learning is disabled or insightType is invalid.
     *
     * @param {InsightType} insightType
     * @param {string} [urgency] - urgency level of the insight
     */
    function recordInsightEngage(insightType, urgency = '') {
        if (!learningEnabled.value) return
        if (!INSIGHT_TYPES.has(insightType)) return

        /** @type {BehavioralSignal} */
        const signal = {
            type: SIGNAL_TYPES.INSIGHT_ENGAGE,
            timestamp: Date.now(),
            metadata: {
                insightType,
                urgency: urgency || ''
            }
        }
        appendSignal(signal)
    }

    /**
     * Returns a Map<InsightType, number> of normalized engagement weights
     * based on insight-engage signals from the last 30 days.
     *
     * Weight = engagements_for_type / max_engagements_across_types
     * Results in a 0–1 scale. All weights 0 when no engagement data exists.
     *
     * Returns an empty Map when learning is disabled — the coordinator
     * treats an empty Map as "no preference signal, keep original order."
     *
     * @returns {Map<InsightType, number>}
     */
    function getSignalWeights() {
        if (!learningEnabled.value) return new Map()

        const store = readSignalStore()
        const cutoff = Date.now() - WEIGHT_WINDOW_MS

        // Count engagements per insightType within the 30-day window
        /** @type {Map<string, number>} */
        const counts = new Map()

        for (const signal of store.signals) {
            if (signal.type !== SIGNAL_TYPES.INSIGHT_ENGAGE) continue
            if (signal.timestamp < cutoff) continue
            const type = signal.metadata?.insightType
            if (!type || !INSIGHT_TYPES.has(type)) continue
            counts.set(type, (counts.get(type) ?? 0) + 1)
        }

        if (counts.size === 0) return new Map()

        // Normalize to 0–1 scale
        const maxCount = Math.max(...counts.values())
        const weights = new Map()
        for (const [type, count] of counts) {
            weights.set(type, maxCount > 0 ? count / maxCount : 0)
        }
        return weights
    }

    /**
     * Returns all signals recorded within the given lookback window.
     * Used by the signal audit UI to show the user what was recorded.
     *
     * @param {number} [windowMs=WEIGHT_WINDOW_MS] lookback in ms (default 30 days)
     * @returns {BehavioralSignal[]}
     */
    function getRecentSignals(windowMs = WEIGHT_WINDOW_MS) {
        const store = readSignalStore()
        const cutoff = Date.now() - windowMs
        return store.signals.filter(s => s.timestamp >= cutoff)
    }

    /**
     * Summary counts for the signal audit UI.
     * Returns { appOpens, insightEngagements, totalSignals } for the last 30 days.
     *
     * @returns {{ appOpens: number, insightEngagements: number, totalSignals: number }}
     */
    function getSignalSummary() {
        const recent = getRecentSignals()
        const appOpens = recent.filter(s => s.type === SIGNAL_TYPES.APP_OPEN).length
        const insightEngagements = recent.filter(s => s.type === SIGNAL_TYPES.INSIGHT_ENGAGE).length
        return {
            appOpens,
            insightEngagements,
            totalSignals: recent.length
        }
    }

    /**
     * Deletes all behavioral signals from the signal store.
     * User-initiated only — called from the signal audit section in the profile UI.
     * Does not affect context or notification preferences.
     */
    function clearSignals() {
        clearSignalStore()
    }

    return {
        /** Whether behavioral learning is currently enabled */
        learningEnabled,
        /** Record app-open event (call once per session on mount) */
        recordAppOpen,
        /** Record insight engagement */
        recordInsightEngage,
        /** Get normalized engagement weights for insight ranking */
        getSignalWeights,
        /** Get raw signals for the audit UI */
        getRecentSignals,
        /** Summary counts for the audit UI */
        getSignalSummary,
        /** Delete all signals (user-initiated) */
        clearSignals
    }
}
