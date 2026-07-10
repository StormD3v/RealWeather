/**
 * @file airQualityModule.js
 * Phase 3.5 — Environmental Intelligence
 *
 * Air quality environmental module.
 *
 * Answers: "Is today's air quality safe for outdoor activity?"
 *
 * Gate: Returns null immediately when weatherData.current.airQuality is null.
 * This keeps the module production-safe when the enrichment API is unavailable.
 *
 * Urgency logic (via escalateAirQuality from urgencyEngine):
 *   Standard user:
 *     null     AQI < 51   — good, no guidance needed
 *     useful   AQI 51–99  — moderate, informational
 *     heads-up AQI 100–149 — unhealthy for sensitive groups
 *     alert    AQI ≥ 150  — unhealthy for all
 *
 *   airQuality-sensitive user:
 *     null     AQI < 51
 *     heads-up AQI 51–99  — earlier warning
 *     alert    AQI ≥ 100  — earlier alert, respiratory-specific guidance
 *
 * AQI values are normalized from EU AQI (×2.5 factor applied in weatherApi.js).
 *
 * Registration:
 *   useInsightEngine.js imports and registers this module explicitly.
 *   This module does NOT self-register (avoids circular imports).
 */

import { createInsight } from '@/utils/insightValidator.js'
import { URGENCY, escalateAirQuality } from '@/utils/urgencyEngine.js'

/** @typedef {import('@/types/context.js').WeatherData} WeatherData */
/** @typedef {import('@/types/context.js').UserContext} UserContext */
/** @typedef {import('@/types/context.js').Insight} Insight */

// ---------------------------------------------------------------------------
// Module logic
// ---------------------------------------------------------------------------

/**
 * Air quality environmental intelligence module.
 * Pure function — no side effects, no store access.
 *
 * @param {WeatherData} weatherData
 * @param {UserContext} userContext
 * @returns {Insight|null}
 */
export function airQualityModule(weatherData, userContext) {
    if (!weatherData?.current) return null

    const { airQuality } = weatherData.current

    // Gate: only active when AQI data is available
    if (airQuality === null || airQuality === undefined) return null

    const sensitivities = userContext?.sensitivities ?? null
    const hasLocation = !!userContext?.location?.primary
    const isSensitive = !!sensitivities?.airQuality
    const aqiStr = Math.round(airQuality)

    const urgency = escalateAirQuality(airQuality, sensitivities)
    if (!urgency) return null

    // ── 1. Alert — AQI ≥ 150 (default) or ≥ 100 (sensitive) ────────────────
    if (urgency === URGENCY.ALERT) {
        return createInsight({
            type: 'environmental',
            subtype: 'air-quality',
            urgency: URGENCY.ALERT,
            content: `Air quality is poor today (AQI ${aqiStr}). Outdoor activity carries a real health risk.`,
            actionPath: isSensitive
                ? 'Avoid outdoor activity today. Keep windows closed and use air purification if available. Wear an N95 mask if you must go outside.'
                : 'Limit outdoor activity, especially vigorous exercise. Those with respiratory conditions should stay indoors.',
            confidence: 'high',
            notify: true,
            usedSensitivity: isSensitive,
            usedLocation: hasLocation
        })
    }

    // ── 2. Heads-up — AQI 100–149 (default) or 51–99 (sensitive) ───────────
    if (urgency === URGENCY.HEADS_UP) {
        return createInsight({
            type: 'environmental',
            subtype: 'air-quality',
            urgency: URGENCY.HEADS_UP,
            content: `Air quality is reduced today (AQI ${aqiStr}). Sensitive individuals may notice discomfort outdoors.`,
            actionPath: isSensitive
                ? 'Consider postponing prolonged outdoor activity. If going out, keep sessions short and avoid high-traffic areas.'
                : 'Reduce intensity for outdoor exercise. If you have respiratory sensitivities, limit extended outdoor time.',
            confidence: 'high',
            notify: isSensitive,
            usedSensitivity: isSensitive,
            usedLocation: hasLocation
        })
    }

    // ── 3. Useful — AQI 51–99 (default only; sensitive gets heads-up above) ─
    return createInsight({
        type: 'environmental',
        subtype: 'air-quality',
        urgency: URGENCY.USEFUL,
        content: `Air quality is moderate today (AQI ${aqiStr}). Conditions are acceptable for most outdoor activity.`,
        actionPath: 'No major adjustments needed. Those with respiratory conditions may want to check conditions before extended outdoor exercise.',
        confidence: 'medium',
        usedSensitivity: isSensitive,
        usedLocation: hasLocation
    })
}
