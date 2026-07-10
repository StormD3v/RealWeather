/**
 * @file comfortModule.js
 * Phase 3.2 — Decision Engine
 *
 * Comfort Optimization intelligence module.
 *
 * Answers: "What should I know about how today's conditions will feel on my body?"
 *
 * Scope (distinct from dailyPlanningModule):
 *   dailyPlanningModule → plans the day (rain windows, heat peaks, wind disruption)
 *   comfortModule       → advises on felt experience (humidity oppression, UV skin
 *                         risk, wind-chill dressing, clothing layer decisions)
 *
 * The distinction matters: daily planning is about scheduling decisions.
 * Comfort is about preparation and physical experience.
 *
 * Philosophy (LUMI_INTELLIGENCE_PHILOSOPHY.md):
 *   - No raw data repetition ("UV index is 7" → not an insight)
 *   - Every insight names a preparation or behavior adjustment
 *   - Honest about uncertainty — near-term is high-confidence, further out is medium
 *   - Specificity: "midday hours" not "today", "the next 3 hours" not "soon"
 *
 * Scenarios handled (in priority order):
 *   1. Heat + humidity combined → heat-index oppressiveness
 *   2. Extreme UV → skin protection preparation
 *   3. Wind chill (cold + wind) → feels colder than temperature suggests
 *   4. High humidity alone (no extreme heat) → muggy discomfort note
 *   5. Very dry conditions → dehydration awareness
 *   6. Benign / no comfort concern → null (no noise)
 *
 * Deduplication note:
 *   The coordinator deduplicates across modules by insight type.
 *   dailyPlanningModule uses type 'daily-planning'.
 *   comfortModule uses type 'comfort'.
 *   They can coexist in the same InsightSet — they answer different questions.
 *
 * Registration:
 *   useInsightEngine.js imports this module and wires it into the registry.
 *   This module does NOT self-register to avoid circular dependencies.
 */

import { createInsight } from '@/utils/insightValidator.js'
import { URGENCY, escalateHeat, escalateCold, escalateUV, escalateWind } from '@/utils/urgencyEngine.js'

/** @typedef {import('@/types/context.js').WeatherData} WeatherData */
/** @typedef {import('@/types/context.js').UserContext} UserContext */
/** @typedef {import('@/types/context.js').Insight} Insight */
/** @typedef {import('@/types/context.js').SensitivityContext} SensitivityContext */

// ---------------------------------------------------------------------------
// Comfort-specific thresholds
// ---------------------------------------------------------------------------

/**
 * Heat index feels oppressive when both temperature AND humidity are elevated.
 * These thresholds are distinct from urgencyEngine's feelsLike thresholds —
 * they capture the compound effect of humid heat.
 *
 * Humidity scale: anything above 65% combined with heat becomes uncomfortable.
 * Above 80% even at moderate temps (24–28°C) produces noticeable oppressiveness.
 */
const HUMIDITY_THRESHOLDS = Object.freeze({
    muggy: { humidity: 70, minTemp: 20 },  // warm + humid → muggy
    oppressive: { humidity: 80, minTemp: 24 },  // hot + very humid → oppressive
    extreme: { humidity: 85, minTemp: 28 }   // extreme heat-index effect
})

/**
 * Very dry air — can cause dehydration and discomfort.
 * Only surfaced when temps are moderate or warm (not as a cold-day note).
 */
const DRY_AIR_THRESHOLDS = Object.freeze({
    humidity: 30,
    minTemp: 15
})

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Computes a simplified heat index (°C) from temperature and relative humidity.
 * Uses the Steadman approximation, valid for temps ≥ 27°C and humidity ≥ 40%.
 * Returns feelsLike as-is for conditions outside the valid range.
 *
 * @param {number} tempC - dry-bulb temperature in Celsius
 * @param {number} humidity - relative humidity 0–100
 * @returns {number} apparent temperature in Celsius
 */
function computeHeatIndex(tempC, humidity) {
    if (tempC < 27 || humidity < 40) return tempC

    // Rothfusz regression (simplified, °C)
    const T = tempC
    const H = humidity
    const hi =
        -8.78469475556 +
        1.61139411 * T +
        2.33854883889 * H +
        -0.14611605 * T * H +
        -0.012308094 * T * T +
        -0.0164248277778 * H * H +
        0.002211732 * T * T * H +
        0.00072546 * T * H * H +
        -0.000003582 * T * T * H * H

    return Math.round(hi * 10) / 10
}

/**
 * Wind chill temperature (°C) using the Environment Canada formula.
 * Only valid for temps ≤ 10°C and wind ≥ 5 km/h.
 * Returns temp as-is outside valid range.
 *
 * @param {number} tempC
 * @param {number} windKmh
 * @returns {number}
 */
function computeWindChill(tempC, windKmh) {
    if (tempC > 10 || windKmh < 5) return tempC
    return Math.round(
        (13.12 + 0.6215 * tempC - 11.37 * Math.pow(windKmh, 0.16) + 0.3965 * tempC * Math.pow(windKmh, 0.16)) * 10
    ) / 10
}

/**
 * Describes wind speed as a natural phrase.
 * @param {number} kmh
 * @returns {string}
 */
function windDescription(kmh) {
    if (kmh >= 60) return 'very strong winds'
    if (kmh >= 40) return 'strong winds'
    if (kmh >= 25) return 'brisk winds'
    return 'a noticeable breeze'
}

// ---------------------------------------------------------------------------
// Module logic
// ---------------------------------------------------------------------------

/**
 * Comfort optimization intelligence module.
 * Pure function — no side effects, no store access.
 *
 * @param {WeatherData} weatherData
 * @param {UserContext} userContext
 * @returns {Insight|null}
 */
export function comfortModule(weatherData, userContext) {
    if (!weatherData?.current) return null

    const { current } = weatherData
    const sensitivities = userContext?.sensitivities ?? null
    const hasLocation = !!userContext?.location?.primary

    const { temp, feelsLike, humidity, windSpeed, uvIndex } = current

    // ── 1. Heat + humidity compound effect ───────────────────────────────────
    // This is distinct from dailyPlanningModule's heat scenarios.
    // dailyPlanningModule focuses on scheduling (avoid midday).
    // comfortModule focuses on the felt experience (how bad does it feel).

    const heatIndex = computeHeatIndex(temp, humidity)
    const heatUrgency = escalateHeat(feelsLike, sensitivities)

    if (heatUrgency && humidity >= HUMIDITY_THRESHOLDS.muggy.humidity) {
        const indexDelta = heatIndex - temp // how much hotter it feels due to humidity
        const isOpressive = humidity >= HUMIDITY_THRESHOLDS.oppressive.humidity && temp >= HUMIDITY_THRESHOLDS.oppressive.minTemp
        const isExtreme = humidity >= HUMIDITY_THRESHOLDS.extreme.humidity && temp >= HUMIDITY_THRESHOLDS.extreme.minTemp

        if (isExtreme || heatUrgency === URGENCY.ALERT) {
            return createInsight({
                type: 'comfort',
                urgency: URGENCY.ALERT,
                content: `Extreme heat-humidity combination. The air feels oppressive — physical exertion outdoors carries real risk.`,
                actionPath: 'Stay in cool, air-conditioned spaces. If you must go outside, keep exposure short, move slowly, and drink water before you feel thirsty.',
                confidence: 'high',
                notify: true,
                usedSensitivity: !!sensitivities?.heat,
                usedLocation: hasLocation
            })
        }

        if (isOpressive || heatUrgency === URGENCY.HEADS_UP) {
            return createInsight({
                type: 'comfort',
                urgency: URGENCY.HEADS_UP,
                content: `High humidity makes the heat feel harder to tolerate — feels closer to ${Math.round(heatIndex)}°C.`,
                actionPath: 'Wear breathable, light-coloured clothing. Prioritize shade and hydration for any outdoor time. Reduce pace for physical activity.',
                confidence: 'high',
                usedSensitivity: !!sensitivities?.heat,
                usedLocation: hasLocation
            })
        }

        // Useful tier — warm + muggy, not dangerous but notable
        return createInsight({
            type: 'comfort',
            urgency: URGENCY.USEFUL,
            content: `It feels warm and humid today — conditions may feel stickier than the temperature suggests.`,
            actionPath: 'Light, breathable clothing helps. Keep water nearby if you\'re outside for more than 20 minutes.',
            confidence: 'medium',
            usedSensitivity: !!sensitivities?.heat,
            usedLocation: hasLocation
        })
    }

    // ── 2. Heat without high humidity — comfort note from urgencyEngine ───────
    // Only surface this when heat urgency exists but humidity isn't the driver.
    // Avoids duplicating dailyPlanningModule's heat messaging — comfort angle only.
    if (heatUrgency === URGENCY.ALERT && humidity < HUMIDITY_THRESHOLDS.muggy.humidity) {
        return createInsight({
            type: 'comfort',
            urgency: URGENCY.ALERT,
            content: `Dangerous heat today — even in dry conditions, this level of heat stresses the body quickly.`,
            actionPath: 'Limit time in direct sun. Seek shade or air conditioning. Drink water consistently, not just when thirsty.',
            confidence: 'high',
            notify: true,
            usedSensitivity: !!sensitivities?.heat,
            usedLocation: hasLocation
        })
    }

    // ── 3. UV exposure risk ───────────────────────────────────────────────────
    const uvUrgency = escalateUV(uvIndex, sensitivities)
    if (uvUrgency === URGENCY.ALERT || uvUrgency === URGENCY.HEADS_UP) {
        const isSensitive = !!sensitivities?.uv
        const uvStr = Math.round(uvIndex)

        if (uvUrgency === URGENCY.ALERT) {
            return createInsight({
                type: 'comfort',
                urgency: URGENCY.ALERT,
                content: `UV index is very high (${uvStr}). Skin can burn in under 15 minutes without protection.`,
                actionPath: isSensitive
                    ? 'Apply SPF 50+ sunscreen before going outside. Wear a hat and UV-blocking sunglasses. Limit direct sun exposure between 10 AM and 3 PM.'
                    : 'Apply SPF 30+ sunscreen before going outside. A hat and sunglasses help significantly during midday hours.',
                confidence: 'high',
                notify: true,
                usedSensitivity: isSensitive,
                usedLocation: hasLocation
            })
        }

        return createInsight({
            type: 'comfort',
            urgency: URGENCY.HEADS_UP,
            content: `UV levels are elevated today (index ${uvStr}). Worth protecting skin for extended outdoor time.`,
            actionPath: isSensitive
                ? 'Apply sunscreen before heading out, even for short trips. Reapply after 90 minutes outdoors.'
                : 'Apply sunscreen for any outdoor activity lasting over 30 minutes, especially around midday.',
            confidence: 'high',
            usedSensitivity: isSensitive,
            usedLocation: hasLocation
        })
    }

    // ── 4. Wind chill effect ─────────────────────────────────────────────────
    // Surface when wind makes cold conditions feel meaningfully worse.
    // Only when cold baseline exists — this supplements cold, not replaces it.
    const coldUrgency = escalateCold(feelsLike, sensitivities)
    if (coldUrgency && windSpeed >= 15) {
        const windChill = computeWindChill(temp, windSpeed)
        const chillDelta = Math.abs(temp - windChill)

        if (chillDelta >= 4) {
            // The wind is making a meaningful difference
            const windDesc = windDescription(windSpeed)
            return createInsight({
                type: 'comfort',
                urgency: coldUrgency,
                content: `${windDesc.charAt(0).toUpperCase() + windDesc.slice(1)} are making it feel around ${Math.round(windChill)}°C — significantly colder than the air temperature.`,
                actionPath: 'Cover exposed skin, especially ears and hands. A wind-resistant outer layer makes a noticeable difference today.',
                confidence: 'high',
                usedSensitivity: !!sensitivities?.cold,
                usedLocation: hasLocation
            })
        }
    }

    // ── 5. High humidity without heat (muggy but not hot) ────────────────────
    // When humidity is high but temperature is moderate, the air still feels heavy.
    // Only surface as a useful note — not a heads-up.
    if (humidity >= 80 && temp >= 18 && temp < HUMIDITY_THRESHOLDS.oppressive.minTemp) {
        return createInsight({
            type: 'comfort',
            urgency: URGENCY.USEFUL,
            content: `The air feels muggy today — high humidity can make moderate temperatures feel more draining.`,
            actionPath: 'Wear moisture-wicking clothing for outdoor activity. Take regular breaks in shaded or cooler areas.',
            confidence: 'medium',
            usedLocation: hasLocation
        })
    }

    // ── 6. Very dry air ───────────────────────────────────────────────────────
    // Low humidity with warm temperatures causes rapid dehydration.
    // Only worth surfacing if it's actually warm enough to matter.
    if (humidity <= DRY_AIR_THRESHOLDS.humidity && temp >= DRY_AIR_THRESHOLDS.minTemp) {
        return createInsight({
            type: 'comfort',
            urgency: URGENCY.USEFUL,
            content: `The air is very dry today. You may dehydrate faster than usual without noticing.`,
            actionPath: 'Drink water proactively — don\'t wait until you feel thirsty. Lip balm and moisturiser help if you\'re outdoors for extended periods.',
            confidence: 'medium',
            usedLocation: hasLocation
        })
    }

    // ── 7. No meaningful comfort concern — return null ───────────────────────
    // Comfortable conditions don't need a comfort insight.
    // The coordinator handles benign-day confirmation via dailyPlanningModule.
    return null
}
