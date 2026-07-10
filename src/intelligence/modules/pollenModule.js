/**
 * @file pollenModule.js
 * Phase 3.5 — Environmental Intelligence
 *
 * Pollen environmental module.
 *
 * Answers: "Should I take allergy precautions before going outside today?"
 *
 * Gate: Returns null immediately when weatherData.current.pollenLevel is null.
 * Pollen data requires a dedicated data source (not included in the Open-Meteo
 * forecast endpoint). This module activates automatically once pollenLevel flows
 * through weatherDataAdapter — no code change required.
 *
 * Pollen is a PREVENTION signal, not a danger signal. Thresholds are intentionally
 * conservative to avoid notification fatigue:
 *
 *   Standard user:
 *     null    low      — no output
 *     null    moderate — silent (too common to be actionable for most people)
 *     heads-up high    — meaningful for outdoor plans
 *     alert   very-high — real disruption for most people
 *
 *   pollen-sensitive user:
 *     null    low      — still silent
 *     heads-up moderate — threshold shifts down
 *     heads-up high    — same level, personalized actionPath
 *     alert   very-high
 *
 * No useful-tier output — pollen has no "light advisory" tier.
 * Either it warrants preparation guidance or it doesn't.
 *
 * Registration:
 *   useInsightEngine.js imports and registers this module explicitly.
 *   This module does NOT self-register (avoids circular imports).
 */

import { createInsight } from '@/utils/insightValidator.js'
import { URGENCY, escalatePollen } from '@/utils/urgencyEngine.js'

/** @typedef {import('@/types/context.js').WeatherData} WeatherData */
/** @typedef {import('@/types/context.js').UserContext} UserContext */
/** @typedef {import('@/types/context.js').Insight} Insight */

// ---------------------------------------------------------------------------
// Module logic
// ---------------------------------------------------------------------------

/**
 * Pollen environmental intelligence module.
 * Pure function — no side effects, no store access.
 *
 * @param {WeatherData} weatherData
 * @param {UserContext} userContext
 * @returns {Insight|null}
 */
export function pollenModule(weatherData, userContext) {
    if (!weatherData?.current) return null

    const { pollenLevel } = weatherData.current

    // Gate: only active when pollen data is available
    if (pollenLevel === null || pollenLevel === undefined) return null

    const sensitivities = userContext?.sensitivities ?? null
    const hasLocation = !!userContext?.location?.primary
    const isSensitive = !!sensitivities?.pollen

    const urgency = escalatePollen(pollenLevel, sensitivities)
    if (!urgency) return null

    // Normalize display label
    const levelLabel = pollenLevel === 'very-high' ? 'very high' : pollenLevel

    // ── 1. Alert — very-high pollen (all users) ──────────────────────────────
    if (urgency === URGENCY.ALERT) {
        return createInsight({
            type: 'environmental',
            subtype: 'pollen',
            urgency: URGENCY.ALERT,
            content: `Pollen levels are very high today. This affects most people who spend time outdoors.`,
            actionPath: isSensitive
                ? 'Take prescribed allergy medication before going outside. Keep windows closed and shower after extended outdoor time to remove pollen from hair and skin.'
                : 'Pollen is very high — consider limiting extended time outdoors. Antihistamines may help if you\'re prone to hay fever.',
            confidence: 'high',
            notify: true,
            usedSensitivity: isSensitive,
            usedLocation: hasLocation
        })
    }

    // ── 2. Heads-up — high pollen (standard) or moderate pollen (sensitive) ─
    return createInsight({
        type: 'environmental',
        subtype: 'pollen',
        urgency: URGENCY.HEADS_UP,
        content: `Pollen count is ${levelLabel} today. Outdoor time may trigger allergy symptoms.`,
        actionPath: isSensitive
            ? 'Take antihistamines before going outside. Check counts before exercise and avoid peak pollen hours (morning). Keep windows closed indoors.'
            : 'Take antihistamines before extended outdoor time if you\'re prone to allergies. Avoid dense vegetation and stay aware of symptoms.',
        confidence: 'medium',
        notify: isSensitive,
        usedSensitivity: isSensitive,
        usedLocation: hasLocation
    })
}
