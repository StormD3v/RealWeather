/**
 * @file commuteModule.js
 * Phase 3.2 — Decision Engine
 *
 * Commute intelligence module.
 *
 * Answers: "What should I know before leaving?"
 *
 * Scope (distinct from dailyPlanningModule):
 *   dailyPlanningModule → plans the whole day (rain windows, heat peaks)
 *   commuteModule       → departure-specific reasoning, anchored to the user's
 *                         declared departure time
 *
 * This module is SILENT when:
 *   - No departure time is declared (returns null immediately)
 *   - Commute conditions are benign (returns null)
 *   - Current time is past the departure window (returns null)
 *
 * Active range:
 *   The module is meaningful within a look-ahead window around departure time.
 *   It inspects the 3-hour window centred on departure (1 hour before to 2 hours
 *   after) to assess what the user will encounter when they leave.
 *
 * Scenarios handled (in priority order):
 *   1. Thunderstorm at or near departure → alert
 *   2. Rain during departure window → heads-up or alert (sensitivity-adjusted)
 *   3. Extreme heat during departure → heads-up
 *   4. Extreme cold/wind during departure → heads-up
 *   5. Benign or no departure time → null
 *
 * Philosophy (LUMI_INTELLIGENCE_PHILOSOPHY.md):
 *   - Speaks in departure-specific terms: "around your departure time", "when you leave"
 *   - Never restates what dailyPlanningModule already says generally
 *   - Returns null for clear commutes — absence of alert is itself information
 *   - Timing is always anchored to the declared departure time
 *
 * Registration:
 *   useInsightEngine.js imports this module and wires it into the registry.
 *   This module does NOT self-register (avoids circular imports).
 */

import { createInsight } from '@/utils/insightValidator.js'
import { URGENCY, escalateHeat, escalateCold, escalateRain, escalateWind } from '@/utils/urgencyEngine.js'

/** @typedef {import('@/types/context.js').WeatherData} WeatherData */
/** @typedef {import('@/types/context.js').UserContext} UserContext */
/** @typedef {import('@/types/context.js').HourlyPoint} HourlyPoint */
/** @typedef {import('@/types/context.js').Insight} Insight */

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Parses an "HH:MM" string into { hours, minutes } or null.
 * @param {string|null|undefined} timeStr
 * @returns {{ hours: number, minutes: number }|null}
 */
function parseTime(timeStr) {
    if (!timeStr || typeof timeStr !== 'string') return null
    const m = timeStr.match(/^(\d{1,2}):(\d{2})$/)
    if (!m) return null
    const hours = parseInt(m[1], 10)
    const minutes = parseInt(m[2], 10)
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null
    return { hours, minutes }
}

/**
 * Given a departure time as { hours, minutes }, returns the Unix timestamp
 * for that time today.  If the departure time is in the past (more than
 * 15 minutes ago), returns null — the commute window has passed.
 * @param {{ hours: number, minutes: number }} departure
 * @returns {number|null}
 */
function departureTodayMs(departure) {
    const now = new Date()
    const d = new Date(now)
    d.setHours(departure.hours, departure.minutes, 0, 0)
    const ms = d.getTime()
    // Consider the module relevant if we're within 15 min before or any time before departure
    if (ms < now.getTime() - 15 * 60 * 1000) return null
    return ms
}

/**
 * Extracts the Unix timestamp from a HourlyPoint (milliseconds).
 * @param {HourlyPoint} slot
 * @returns {number}
 */
function slotMs(slot) {
    if (typeof slot?.dt === 'number') {
        return slot.dt > 1e10 ? slot.dt : slot.dt * 1000
    }
    if (slot?.dt_txt) {
        const d = new Date(String(slot.dt_txt).replace(' ', 'T'))
        if (!isNaN(d.getTime())) return d.getTime()
    }
    return 0
}

/**
 * Precipitation probability from a HourlyPoint, as 0–100.
 * @param {HourlyPoint} slot
 * @returns {number}
 */
function popPercent(slot) {
    const raw = Number(slot?.pop ?? 0)
    if (!Number.isFinite(raw)) return 0
    return raw <= 1 ? raw * 100 : raw
}

/**
 * Returns the slots that overlap the commute window.
 * Window = [departureMs - 1h, departureMs + 2h]
 *
 * We use a 3-hour window (1h before to 2h after departure) to capture:
 *   - Pre-departure conditions (should I change plans?)
 *   - En-route conditions (what will I encounter?)
 *
 * @param {HourlyPoint[]} hourly
 * @param {number} departureMs
 * @returns {HourlyPoint[]}
 */
function commuteWindowSlots(hourly, departureMs) {
    const windowStart = departureMs - 60 * 60 * 1000  // 1 hour before
    const windowEnd = departureMs + 2 * 60 * 60 * 1000 // 2 hours after

    return hourly.filter(slot => {
        const ts = slotMs(slot)
        return ts >= windowStart && ts <= windowEnd
    })
}

/**
 * Formats a departure time for display.
 * @param {{ hours: number, minutes: number }} dep
 * @returns {string} e.g. "8:30 AM", "noon"
 */
function formatDeparture(dep) {
    const { hours, minutes } = dep
    if (hours === 0 && minutes === 0) return 'midnight'
    if (hours === 12 && minutes === 0) return 'noon'
    const period = hours < 12 ? 'AM' : 'PM'
    const h = hours % 12 || 12
    const m = minutes === 0 ? '' : `:${String(minutes).padStart(2, '0')}`
    return `${h}${m} ${period}`
}

/**
 * Returns the highest precipitation probability across a set of slots.
 * @param {HourlyPoint[]} slots
 * @returns {number} 0–100
 */
function maxRainProb(slots) {
    if (!slots.length) return 0
    return Math.max(...slots.map(popPercent))
}

/**
 * Returns true if any slot condition string indicates a storm.
 * @param {HourlyPoint[]} slots
 * @returns {boolean}
 */
function hasThunderstorm(slots) {
    return slots.some(slot => {
        const cond = String(slot?.weather?.[0]?.main ?? '').toLowerCase()
        return cond.includes('thunder') || cond.includes('storm')
    })
}

/**
 * Returns the peak feels-like temperature across a set of slots.
 * @param {HourlyPoint[]} slots
 * @returns {number}
 */
function peakFeelsLike(slots) {
    if (!slots.length) return 0
    return Math.max(...slots.map(s => Number(s?.main?.feels_like ?? s?.main?.temp ?? 0)))
}

/**
 * Returns the minimum feels-like temperature across a set of slots.
 * @param {HourlyPoint[]} slots
 * @returns {number}
 */
function minFeelsLike(slots) {
    if (!slots.length) return 0
    return Math.min(...slots.map(s => Number(s?.main?.feels_like ?? s?.main?.temp ?? 0)))
}

/**
 * Returns the peak wind speed across a set of slots.
 * @param {HourlyPoint[]} slots
 * @returns {number}
 */
function peakWind(slots) {
    if (!slots.length) return 0
    return Math.max(...slots.map(s => Number(s?.wind?.speed ?? 0)))
}

// ---------------------------------------------------------------------------
// Module logic
// ---------------------------------------------------------------------------

/**
 * Commute intelligence module.
 * Pure function — no side effects, no store access.
 *
 * @param {WeatherData} weatherData
 * @param {UserContext} userContext
 * @returns {Insight|null}
 */
export function commuteModule(weatherData, userContext) {
    if (!weatherData?.current) return null

    // ── Gate: only active when departure time is declared ───────────────────
    const departureStr = userContext?.routines?.weekday?.departureTime ?? null
    const departure = parseTime(departureStr)
    if (!departure) return null

    // ── Gate: commute window must not have passed ────────────────────────────
    const departureMs = departureTodayMs(departure)
    if (!departureMs) return null

    const departureLabel = formatDeparture(departure)
    const { hourly = [] } = weatherData
    const sensitivities = userContext?.sensitivities ?? null
    const hasLocation = !!userContext?.location?.primary

    // ── Find hourly slots overlapping the commute window ────────────────────
    const commuteSlots = commuteWindowSlots(hourly, departureMs)

    // Fall back to current conditions if no hourly data covers the window
    const hasForecast = commuteSlots.length > 0

    // ── 1. Thunderstorm at departure ─────────────────────────────────────────
    const currentCondLower = String(weatherData.current.condition ?? '').toLowerCase()
    const stormNow = currentCondLower.includes('thunderstorm')
    const stormAtDeparture = stormNow || (hasForecast && hasThunderstorm(commuteSlots))

    if (stormAtDeparture) {
        return createInsight({
            type: 'commute',
            urgency: URGENCY.ALERT,
            content: `Thunderstorm conditions around your ${departureLabel} departure. This is a significant risk for travel.`,
            actionPath: 'Consider delaying departure until the storm passes, or arrange covered transport. Check conditions again closer to the time.',
            confidence: 'high',
            notify: true,
            usedRoutine: true,
            usedLocation: hasLocation,
            usedSensitivity: false
        })
    }

    // ── 2. Rain during commute window ─────────────────────────────────────────
    const rainProbAtDeparture = hasForecast
        ? maxRainProb(commuteSlots)
        : weatherData.current.precipProb * 100

    const rainUrgency = escalateRain(rainProbAtDeparture, sensitivities)

    if (rainUrgency === URGENCY.ALERT || rainUrgency === URGENCY.HEADS_UP) {
        const isSensitive = !!sensitivities?.precipitation
        const probStr = Math.round(rainProbAtDeparture)
        const confidence = hasForecast ? 'high' : 'medium'

        if (rainUrgency === URGENCY.ALERT) {
            return createInsight({
                type: 'commute',
                urgency: URGENCY.ALERT,
                content: `Heavy rain is likely around your ${departureLabel} departure (${probStr}% chance).`,
                actionPath: isSensitive
                    ? 'Allow extra travel time and bring waterproof gear. Consider covered transport if possible.'
                    : 'Bring waterproof gear and allow extra travel time for wet conditions.',
                confidence,
                notify: true,
                usedRoutine: true,
                usedLocation: hasLocation,
                usedSensitivity: isSensitive
            })
        }

        return createInsight({
            type: 'commute',
            urgency: URGENCY.HEADS_UP,
            content: `Rain is possible around your ${departureLabel} departure (${probStr}% chance).`,
            actionPath: 'Bring an umbrella or rain jacket. Wet surfaces may slow your journey slightly.',
            confidence,
            notify: true,
            usedRoutine: true,
            usedLocation: hasLocation,
            usedSensitivity: isSensitive
        })
    }

    // ── 3. Extreme heat during commute ────────────────────────────────────────
    const peakHeat = hasForecast
        ? peakFeelsLike(commuteSlots)
        : weatherData.current.feelsLike

    const heatUrgency = escalateHeat(peakHeat, sensitivities)

    if (heatUrgency === URGENCY.ALERT || heatUrgency === URGENCY.HEADS_UP) {
        const isSensitive = !!sensitivities?.heat
        const tempStr = Math.round(peakHeat)
        const urgency = heatUrgency === URGENCY.ALERT ? URGENCY.ALERT : URGENCY.HEADS_UP

        return createInsight({
            type: 'commute',
            urgency,
            content: `It will feel like ${tempStr}°C around your ${departureLabel} departure — very hot for travelling.`,
            actionPath: isSensitive
                ? 'Leave early to avoid peak heat, carry water, and avoid prolonged exposure between transit stops.'
                : 'Carry water and wear light clothing. If possible, use shaded routes or air-conditioned transport.',
            confidence: hasForecast ? 'high' : 'medium',
            notify: true,
            usedRoutine: true,
            usedLocation: hasLocation,
            usedSensitivity: isSensitive
        })
    }

    // ── 4. Cold + wind during commute ─────────────────────────────────────────
    const minCold = hasForecast
        ? minFeelsLike(commuteSlots)
        : weatherData.current.feelsLike

    const coldUrgency = escalateCold(minCold, sensitivities)
    const windAtDeparture = hasForecast
        ? peakWind(commuteSlots)
        : weatherData.current.windSpeed

    const windUrgency = escalateWind(windAtDeparture, sensitivities)
    const mostUrgentColdWind = (coldUrgency && windUrgency)
        ? ([URGENCY.ALERT, URGENCY.HEADS_UP].includes(coldUrgency) ? coldUrgency : windUrgency)
        : (coldUrgency || windUrgency)

    if (mostUrgentColdWind === URGENCY.ALERT || mostUrgentColdWind === URGENCY.HEADS_UP) {
        const isSensitive = !!sensitivities?.cold
        const coldStr = Math.round(minCold)
        const windStr = Math.round(windAtDeparture)
        const windNote = windUrgency ? ` with wind at ${windStr} km/h` : ''

        return createInsight({
            type: 'commute',
            urgency: mostUrgentColdWind,
            content: `Cold conditions around your ${departureLabel} departure — feels like ${coldStr}°C${windNote}.`,
            actionPath: isSensitive
                ? 'Dress in full thermal layers before leaving. Cover ears and hands — wind chill will make it feel colder than expected.'
                : 'Dress in warm layers before heading out. A wind-resistant outer layer helps significantly.',
            confidence: hasForecast ? 'high' : 'medium',
            notify: true,
            usedRoutine: true,
            usedLocation: hasLocation,
            usedSensitivity: isSensitive
        })
    }

    // ── 5. Benign commute — return null ──────────────────────────────────────
    // Clear conditions at departure time need no commute-specific guidance.
    // The positive confirmation comes from dailyPlanningModule at the day level.
    return null
}
