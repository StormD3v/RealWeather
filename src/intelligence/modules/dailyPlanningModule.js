/**
 * @file dailyPlanningModule.js
 * Phase 3.2 — Decision Engine
 *
 * Daily Planning intelligence module.
 *
 * Answers the user's core morning question:
 *   "What should I know or do differently because of today's weather?"
 *
 * This module operates at Layer 4 (Recommendation) of the Intelligence Hierarchy.
 * It does NOT repeat raw data. Every insight it produces names a decision.
 *
 * Philosophy constraints (LUMI_INTELLIGENCE_PHILOSOPHY.md):
 *   - No generic summaries ("it will be sunny today")
 *   - No chatbot language
 *   - Every insight answers: "What should the user do because of this?"
 *   - Specificity over comprehensiveness — one precise insight beats five vague ones
 *   - Timing precision: "before noon", "after 3 PM", not "later"
 *
 * Null fallback rule (LUMI_CONTEXT_ARCHITECTURE.md):
 *   When context is absent or sparse, module falls back to Layer 2
 *   (Environmental Context quality) — still action-connected, just not personal.
 *   Returns null only when no insight is warranted (benign conditions, no action needed).
 *
 * Scenarios handled:
 *   1. Rain incoming — best outdoor window before rain
 *   2. Rain already active — wait-and-check advice
 *   3. Heat peak — outdoor planning window before peak
 *   4. Cold start + warm day — timing advice
 *   5. Benign, clear day — positive confirmation (ambient tier)
 *   6. High wind — plan adjustment needed
 *
 * Self-registration:
 *   Imports useInsightEngine.registerModule and calls it at module load.
 *   useInsightEngine.js must import this file to activate it.
 */

import { createInsight } from '@/utils/insightValidator.js'
import { URGENCY, escalateHeat, escalateCold, escalateWind, escalateRain } from '@/utils/urgencyEngine.js'
import { MODULE_NAMES } from '@/services/intelligenceModules/moduleContract.js'

/** @typedef {import('@/types/context.js').WeatherData} WeatherData */
/** @typedef {import('@/types/context.js').UserContext} UserContext */
/** @typedef {import('@/types/context.js').HourlyPoint} HourlyPoint */
/** @typedef {import('@/types/context.js').Insight} Insight */

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Extracts wall-clock hour (0–23) from a HourlyPoint.
 * Returns -1 for unparseable slots.
 * @param {HourlyPoint} slot
 * @returns {number}
 */
function slotHour(slot) {
    if (slot?.dt_txt) {
        const d = new Date(String(slot.dt_txt).replace(' ', 'T'))
        if (!isNaN(d.getTime())) return d.getHours()
    }
    if (typeof slot?.dt === 'number') {
        const d = new Date(slot.dt > 1e10 ? slot.dt : slot.dt * 1000)
        if (!isNaN(d.getTime())) return d.getHours()
    }
    return -1
}

/**
 * Formats an hour number into a readable time string.
 * 7 → "7 AM", 14 → "2 PM", 0 → "midnight"
 * @param {number} hour - 0–23
 * @returns {string}
 */
function formatHour(hour) {
    if (hour === 0) return 'midnight'
    if (hour === 12) return 'noon'
    if (hour < 12) return `${hour} AM`
    return `${hour - 12} PM`
}

/**
 * Precipitation probability from a HourlyPoint, as 0–100.
 * Handles both 0–1 and 0–100 source values.
 * @param {HourlyPoint} slot
 * @returns {number}
 */
function popPercent(slot) {
    const raw = Number(slot?.pop ?? 0)
    if (!Number.isFinite(raw)) return 0
    return raw <= 1 ? raw * 100 : raw
}

/**
 * Temperature from a HourlyPoint in Celsius.
 * @param {HourlyPoint} slot
 * @returns {number}
 */
function slotTemp(slot) {
    return Number(slot?.main?.temp ?? slot?.temp ?? 0)
}

/**
 * Finds the index of the first future slot where rain probability exceeds the threshold.
 * Returns -1 if no such slot exists.
 * @param {HourlyPoint[]} hourly
 * @param {number} thresholdPct - 0–100
 * @returns {number}
 */
function firstRainIndex(hourly, thresholdPct = 55) {
    const now = Date.now()
    return hourly.findIndex(slot => {
        const ts = typeof slot.dt === 'number'
            ? (slot.dt > 1e10 ? slot.dt : slot.dt * 1000)
            : NaN
        if (!isNaN(ts) && ts <= now) return false // skip past slots
        return popPercent(slot) >= thresholdPct
    })
}

/**
 * Finds the hour of peak temperature in the next N slots.
 * Returns { hour, temp } or null.
 * @param {HourlyPoint[]} hourly
 * @param {number} lookAhead - number of slots to consider
 * @returns {{ hour: number, temp: number }|null}
 */
function findHeatPeak(hourly, lookAhead = 8) {
    const window = hourly.slice(0, lookAhead)
    if (!window.length) return null

    let peakSlot = window[0]
    let peakTemp = slotTemp(window[0])

    for (const slot of window.slice(1)) {
        const t = slotTemp(slot)
        if (t > peakTemp) { peakTemp = t; peakSlot = slot }
    }

    const hour = slotHour(peakSlot)
    if (hour < 0) return null
    return { hour, temp: peakTemp }
}

/**
 * Returns true if the current condition string indicates active rain/storm.
 * @param {string} condition
 * @returns {boolean}
 */
function isRainingNow(condition) {
    const c = String(condition ?? '').toLowerCase()
    return c.includes('rain') || c.includes('drizzle') || c.includes('thunder') || c.includes('storm')
}

// ---------------------------------------------------------------------------
// Module logic
// ---------------------------------------------------------------------------

/**
 * Daily planning intelligence module.
 * Pure function — no side effects, no store access.
 *
 * @param {WeatherData} weatherData
 * @param {UserContext} userContext
 * @returns {Insight|null}
 */
export function dailyPlanningModule(weatherData, userContext) {
    if (!weatherData?.current) return null

    const { current, hourly = [] } = weatherData
    const sensitivities = userContext?.sensitivities ?? null
    const hasLocation = !!userContext?.location?.primary

    // ── 1. Active thunderstorm or severe storm ───────────────────────────────
    const condLower = String(current.condition ?? '').toLowerCase()
    if (condLower.includes('thunderstorm')) {
        return createInsight({
            type: 'daily-planning',
            urgency: URGENCY.ALERT,
            content: 'Thunderstorm conditions are active. Outdoor plans carry real risk right now.',
            actionPath: 'Stay indoors until the storm clears. Check conditions again before heading out.',
            confidence: 'high',
            notify: true,
            usedLocation: hasLocation,
            usedSensitivity: false
        })
    }

    // ── 2. Currently raining — no outdoor window available now ───────────────
    if (isRainingNow(current.condition)) {
        // Find when it clears — first slot where rain drops below 35%
        const clearIndex = hourly.findIndex((slot, i) => {
            // Only look at future slots
            const ts = typeof slot.dt === 'number'
                ? (slot.dt > 1e10 ? slot.dt : slot.dt * 1000)
                : NaN
            if (!isNaN(ts) && ts <= Date.now()) return false
            return popPercent(slot) < 35
        })

        if (clearIndex !== -1) {
            const clearHour = slotHour(hourly[clearIndex])
            const clearStr = clearHour >= 0 ? ` — likely around ${formatHour(clearHour)}` : ''
            return createInsight({
                type: 'daily-planning',
                urgency: URGENCY.HEADS_UP,
                content: `It's raining now. Conditions should improve later${clearStr}.`,
                actionPath: `Reschedule outdoor plans for after the rain passes${clearStr}. Check back closer to that time.`,
                confidence: clearIndex <= 2 ? 'high' : 'medium',
                windowStart: clearIndex !== -1 ? null : null,
                notify: true,
                usedLocation: hasLocation
            })
        }

        // No clear window found in forecast — general rain advice
        return createInsight({
            type: 'daily-planning',
            urgency: URGENCY.HEADS_UP,
            content: 'Rain is active and the forecast shows continued wet conditions.',
            actionPath: 'Plan for indoor activities today. Check conditions again later for any clearing windows.',
            confidence: 'medium',
            notify: true,
            usedLocation: hasLocation
        })
    }

    // ── 3. Rain incoming — best outdoor window before it arrives ────────────
    const rainIdx = firstRainIndex(hourly, 55)
    if (rainIdx !== -1 && rainIdx <= 6) {
        const rainSlot = hourly[rainIdx]
        const rainHour = slotHour(rainSlot)
        const rainStr = rainHour >= 0 ? formatHour(rainHour) : 'later today'
        const urgency = escalateRain(popPercent(rainSlot), sensitivities) ?? URGENCY.USEFUL
        const confidence = rainIdx <= 2 ? 'high' : 'medium'

        // Is there a good outdoor window before the rain?
        const slotsBeforeRain = hourly.slice(0, rainIdx)
        const hasGoodWindowBefore = slotsBeforeRain.some(slot =>
            popPercent(slot) < 30 &&
            slotTemp(slot) >= 10 &&
            slotTemp(slot) <= 35
        )

        if (hasGoodWindowBefore) {
            return createInsight({
                type: 'daily-planning',
                urgency,
                content: `Rain arrives around ${rainStr}. There's a good outdoor window before it.`,
                actionPath: `Do any outdoor activity before ${rainStr}. After that, expect wet conditions.`,
                confidence,
                notify: true,
                usedLocation: hasLocation
            })
        }

        return createInsight({
            type: 'daily-planning',
            urgency,
            content: `Rain expected around ${rainStr}.`,
            actionPath: `Wrap up outdoor plans before ${rainStr} or bring waterproof gear.`,
            confidence,
            notify: true,
            usedLocation: hasLocation
        })
    }

    // ── 4. Heat peak planning ────────────────────────────────────────────────
    const heatUrgency = escalateHeat(current.feelsLike, sensitivities)
    if (heatUrgency) {
        const peak = findHeatPeak(hourly, 8)
        const peakStr = peak ? ` — peaks around ${formatHour(peak.hour)}` : ''

        if (heatUrgency === URGENCY.ALERT) {
            return createInsight({
                type: 'daily-planning',
                urgency: URGENCY.ALERT,
                content: `Dangerous heat conditions${peakStr}. This is a risk to wellbeing, not just comfort.`,
                actionPath: 'Avoid prolonged outdoor exposure. Stay hydrated, stay in shade or indoors, and check on anyone vulnerable.',
                confidence: 'high',
                notify: true,
                usedSensitivity: !!sensitivities?.heat,
                usedLocation: hasLocation
            })
        }

        if (heatUrgency === URGENCY.HEADS_UP) {
            // Is there a cooler window in the morning or evening?
            const coolSlot = hourly.find(slot => slotTemp(slot) < current.feelsLike - 4)
            const coolWindow = coolSlot ? ` Plan outdoor activity before ${formatHour(slotHour(coolSlot))} or after the heat eases.` : ''

            return createInsight({
                type: 'daily-planning',
                urgency: URGENCY.HEADS_UP,
                content: `Feels very hot today${peakStr}.${coolWindow}`,
                actionPath: `Limit outdoor time during peak heat${peak ? ` around ${formatHour(peak.hour)}` : ''}. Dress light and keep water close.`,
                confidence: 'high',
                notify: true,
                usedSensitivity: !!sensitivities?.heat,
                usedLocation: hasLocation
            })
        }

        // USEFUL heat — just a note
        return createInsight({
            type: 'daily-planning',
            urgency: URGENCY.USEFUL,
            content: `It feels warm today${peakStr}.`,
            actionPath: 'Stay hydrated if you\'re spending time outside. Morning hours are the most comfortable.',
            confidence: 'medium',
            notify: false,
            usedSensitivity: !!sensitivities?.heat,
            usedLocation: hasLocation
        })
    }

    // ── 5. Cold conditions ───────────────────────────────────────────────────
    const coldUrgency = escalateCold(current.feelsLike, sensitivities)
    if (coldUrgency) {
        if (coldUrgency === URGENCY.ALERT) {
            return createInsight({
                type: 'daily-planning',
                urgency: URGENCY.ALERT,
                content: 'Extreme cold conditions. Prolonged outdoor exposure is dangerous.',
                actionPath: 'Minimize outdoor time. Wear full thermal layers and cover exposed skin.',
                confidence: 'high',
                notify: true,
                usedSensitivity: !!sensitivities?.cold,
                usedLocation: hasLocation
            })
        }

        // Check if it warms up later
        const warmerSlot = hourly.find(slot => slotTemp(slot) > current.feelsLike + 5)
        const warmerStr = warmerSlot ? ` Warmer around ${formatHour(slotHour(warmerSlot))}.` : ''

        return createInsight({
            type: 'daily-planning',
            urgency: coldUrgency,
            content: `Cold conditions today.${warmerStr}`,
            actionPath: `Dress in layers${warmerStr ? ' and plan outdoor activity for later when temperatures improve.' : ' before heading out.'}`,
            confidence: warmerSlot ? 'high' : 'medium',
            notify: coldUrgency === URGENCY.HEADS_UP,
            usedSensitivity: !!sensitivities?.cold,
            usedLocation: hasLocation
        })
    }

    // ── 6. High wind ─────────────────────────────────────────────────────────
    const windUrgency = escalateWind(current.windSpeed, sensitivities)
    if (windUrgency === URGENCY.ALERT || windUrgency === URGENCY.HEADS_UP) {
        return createInsight({
            type: 'daily-planning',
            urgency: windUrgency,
            content: `Strong winds today (${Math.round(current.windSpeed)} km/h).`,
            actionPath: 'Avoid cycling or activities that require stability in wind. Secure any loose items outdoors.',
            confidence: 'high',
            notify: true,
            usedLocation: hasLocation
        })
    }

    // ── 7. Rain only further ahead (> 6 slots, ~18+ hours) ──────────────────
    if (rainIdx !== -1) {
        const rainSlot = hourly[rainIdx]
        const rainHour = slotHour(rainSlot)
        const rainStr = rainHour >= 0 ? formatHour(rainHour) : 'tomorrow'

        return createInsight({
            type: 'daily-planning',
            urgency: URGENCY.USEFUL,
            content: `Rain expected later — around ${rainStr}.`,
            actionPath: `Today looks clear for outdoor plans. Keep an eye on conditions if you're planning for ${rainStr} or later.`,
            confidence: 'medium',
            notify: false,
            usedLocation: hasLocation
        })
    }

    // ── 8. Benign conditions — positive confirmation ─────────────────────────
    // Only surface this if conditions are genuinely good, not just "not bad"
    const tempOk = current.feelsLike >= 12 && current.feelsLike <= 28
    const lowRain = current.precipProb < 0.2
    const lowWind = current.windSpeed < 25

    if (tempOk && lowRain && lowWind) {
        return createInsight({
            type: 'daily-planning',
            urgency: URGENCY.AMBIENT,
            content: 'Conditions look good today — no weather concerns for your plans.',
            actionPath: 'No adjustments needed. Good conditions for outdoor activity.',
            confidence: 'high',
            notify: false,
            usedLocation: hasLocation
        })
    }

    // ── 9. Mixed / no specific action warranted ──────────────────────────────
    // Return null — absence of insight is a valid output. Don't manufacture guidance.
    return null
}

// ---------------------------------------------------------------------------
// Module name export — used by useInsightEngine.js for registration
// ---------------------------------------------------------------------------
// This module does NOT self-register to avoid a circular dependency:
//   dailyPlanningModule → useInsightEngine → dailyPlanningModule
//
// Instead, useInsightEngine.js imports this module and calls:
//   registerModule(MODULE_NAMES.DAILY_PLANNING, dailyPlanningModule)
//
// The MODULE_NAMES constant is re-exported here as a convenience so
// the coordinator doesn't need a separate moduleContract import for it.
export { MODULE_NAMES }
