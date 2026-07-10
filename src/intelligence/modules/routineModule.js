/**
 * @file routineModule.js
 * Phase 3.2 — Decision Engine
 *
 * Routine Adaptation intelligence module.
 *
 * Answers: "Will weather disrupt my planned outdoor windows today,
 *           and what should I adjust?"
 *
 * Scope (distinct from other modules):
 *   dailyPlanningModule → general day-level planning (rain windows, heat peaks)
 *   commuteModule       → departure-specific travel advice
 *   activityModule      → declared activity go/no-go recommendations
 *   routineModule       → declared outdoor TIME WINDOWS — tells the user if
 *                         their specific routine window (e.g. "Morning walk
 *                         7–8 AM") will be affected and what to do
 *
 * This module is SILENT when:
 *   - No outdoor windows are declared
 *   - All declared windows have benign conditions
 *   - The window has already passed today
 *
 * What it evaluates per window:
 *   1. Thunderstorm → ALERT — skip or seek shelter
 *   2. Rain during window → HEADS_UP or ALERT (sensitivity-adjusted)
 *   3. Extreme heat → HEADS_UP
 *   4. Extreme cold / wind → HEADS_UP
 *   5. Benign → silent (return null for that window)
 *
 * Multiple windows: emits one insight per affected window.
 * The coordinator deduplicates by type — only the highest urgency
 * routine-adapt insight reaches the final InsightSet.
 *
 * Day-of-week filtering:
 *   TimeWindow.daysOfWeek is an array 0–6 (0=Sunday).
 *   Empty array means all days. The module checks today's day-of-week.
 *
 * Philosophy (LUMI_INTELLIGENCE_PHILOSOPHY.md):
 *   - Speak in window-specific terms: "during your Morning walk", "around 7 AM"
 *   - Never restate what dailyPlanningModule already covers at the day level
 *   - Absence of insight = window looks clear — that's information too
 *   - Timing is always anchored to the declared window
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
/** @typedef {import('@/types/context.js').TimeWindow} TimeWindow */
/** @typedef {import('@/types/context.js').Insight} Insight */

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Parses an "HH:MM" string into total minutes from midnight.
 * Returns -1 for invalid input.
 *
 * @param {string|null|undefined} timeStr
 * @returns {number}
 */
function parseMinutes(timeStr) {
    if (!timeStr || typeof timeStr !== 'string') return -1
    const m = timeStr.match(/^(\d{1,2}):(\d{2})$/)
    if (!m) return -1
    const h = parseInt(m[1], 10)
    const min = parseInt(m[2], 10)
    if (h < 0 || h > 23 || min < 0 || min > 59) return -1
    return h * 60 + min
}

/**
 * Returns today's Unix timestamp for a given "HH:MM" time string.
 * Returns null for invalid input.
 *
 * @param {string} timeStr
 * @returns {number|null}
 */
function todayMs(timeStr) {
    const mins = parseMinutes(timeStr)
    if (mins < 0) return null
    const d = new Date()
    d.setHours(Math.floor(mins / 60), mins % 60, 0, 0)
    return d.getTime()
}

/**
 * Returns true if a TimeWindow applies to today's day-of-week.
 * Empty daysOfWeek array means every day.
 *
 * @param {TimeWindow} window
 * @returns {boolean}
 */
function appliesToday(window) {
    const { daysOfWeek } = window
    if (!Array.isArray(daysOfWeek) || daysOfWeek.length === 0) return true
    const today = new Date().getDay() // 0=Sunday
    return daysOfWeek.includes(today)
}

/**
 * Returns true if the window's end time has already passed today.
 * Windows that end within the next 5 minutes are still considered relevant.
 *
 * @param {TimeWindow} window
 * @returns {boolean}
 */
function windowHasPassed(window) {
    const endMs = todayMs(window.endTime)
    if (endMs === null) return false
    return endMs < Date.now() - 5 * 60 * 1000
}

/**
 * Extracts the Unix timestamp from a HourlyPoint (milliseconds).
 *
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
 * Returns hourly slots that overlap with the given window.
 * Uses a ±30-min buffer to capture the nearest slot even if it doesn't
 * fall exactly on the window boundary.
 *
 * @param {HourlyPoint[]} hourly
 * @param {TimeWindow} window
 * @returns {HourlyPoint[]}
 */
function windowSlots(hourly, window) {
    const startMs = todayMs(window.startTime)
    const endMs = todayMs(window.endTime)
    if (startMs === null || endMs === null) return []

    const buffer = 30 * 60 * 1000
    return hourly.filter(slot => {
        const ts = slotMs(slot)
        return ts >= startMs - buffer && ts <= endMs + buffer
    })
}

/**
 * Returns precipitation probability from a HourlyPoint as 0–100.
 *
 * @param {HourlyPoint} slot
 * @returns {number}
 */
function popPercent(slot) {
    const raw = Number(slot?.pop ?? 0)
    if (!Number.isFinite(raw)) return 0
    return raw <= 1 ? raw * 100 : raw
}

/**
 * Returns the maximum precipitation probability across a set of slots.
 *
 * @param {HourlyPoint[]} slots
 * @returns {number}
 */
function maxRainProb(slots) {
    if (!slots.length) return 0
    return Math.max(...slots.map(popPercent))
}

/**
 * Returns true if any slot in the set indicates a thunderstorm.
 *
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
 *
 * @param {HourlyPoint[]} slots
 * @returns {number}
 */
function peakFeelsLike(slots) {
    if (!slots.length) return 0
    return Math.max(...slots.map(s => Number(s?.main?.feels_like ?? s?.main?.temp ?? 0)))
}

/**
 * Returns the minimum feels-like temperature across a set of slots.
 *
 * @param {HourlyPoint[]} slots
 * @returns {number}
 */
function minFeelsLike(slots) {
    if (!slots.length) return 999
    return Math.min(...slots.map(s => Number(s?.main?.feels_like ?? s?.main?.temp ?? 0)))
}

/**
 * Returns the peak wind speed across a set of slots (km/h).
 *
 * @param {HourlyPoint[]} slots
 * @returns {number}
 */
function peakWind(slots) {
    if (!slots.length) return 0
    return Math.max(...slots.map(s => Number(s?.wind?.speed ?? 0)))
}

/**
 * Formats a window's time range for display.
 * e.g. "7:00–8:00 AM" or "Evening walk (6:30–7:30 PM)"
 *
 * @param {TimeWindow} window
 * @returns {string}
 */
function windowLabel(window) {
    const label = window.label?.trim()
    if (label) return label
    // Fall back to time range
    return `${window.startTime}–${window.endTime}`
}

/**
 * Formats an "HH:MM" string as a human-readable time.
 * "08:00" → "8 AM", "13:30" → "1:30 PM"
 *
 * @param {string} timeStr
 * @returns {string}
 */
function formatTime(timeStr) {
    const mins = parseMinutes(timeStr)
    if (mins < 0) return timeStr
    const h = Math.floor(mins / 60)
    const m = mins % 60
    if (h === 0 && m === 0) return 'midnight'
    if (h === 12 && m === 0) return 'noon'
    const period = h < 12 ? 'AM' : 'PM'
    const h12 = h % 12 || 12
    const mStr = m === 0 ? '' : `:${String(m).padStart(2, '0')}`
    return `${h12}${mStr} ${period}`
}

// ---------------------------------------------------------------------------
// Single-window insight builder
// ---------------------------------------------------------------------------

/**
 * Evaluates weather conditions for one TimeWindow and returns an Insight
 * if conditions warrant it, or null if the window looks clear.
 *
 * @param {TimeWindow} window
 * @param {import('@/types/context.js').CurrentWeatherData} current
 * @param {HourlyPoint[]} hourly
 * @param {import('@/types/context.js').SensitivityContext|null} sensitivities
 * @param {boolean} hasLocation
 * @returns {Insight|null}
 */
function buildWindowInsight(window, current, hourly, sensitivities, hasLocation) {
    const slots = windowSlots(hourly, window)
    const hasForecast = slots.length > 0
    const label = windowLabel(window)
    const startStr = formatTime(window.startTime)

    // ── 1. Thunderstorm ──────────────────────────────────────────────────────
    const currentCondLower = String(current.condition ?? '').toLowerCase()
    const stormNow = currentCondLower.includes('thunderstorm')
    const stormInWindow = stormNow || (hasForecast && hasThunderstorm(slots))

    if (stormInWindow) {
        return createInsight({
            type: 'routine-adapt',
            urgency: URGENCY.ALERT,
            content: `Thunderstorm conditions during your ${label}. This is a safety risk for any outdoor activity.`,
            actionPath: `Skip the ${label} or move it indoors. Check conditions again if the storm passes before ${startStr}.`,
            confidence: 'high',
            notify: true,
            usedRoutine: true,
            usedLocation: hasLocation,
            usedSensitivity: false
        })
    }

    // ── 2. Rain during window ────────────────────────────────────────────────
    const rainProb = hasForecast
        ? maxRainProb(slots)
        : current.precipProb * 100

    const rainUrgency = escalateRain(rainProb, sensitivities)

    if (rainUrgency === URGENCY.ALERT || rainUrgency === URGENCY.HEADS_UP) {
        const isSensitive = !!sensitivities?.precipitation
        const probStr = Math.round(rainProb)
        const confidence = hasForecast ? 'high' : 'medium'

        if (rainUrgency === URGENCY.ALERT) {
            return createInsight({
                type: 'routine-adapt',
                urgency: URGENCY.ALERT,
                content: `Heavy rain is likely during your ${label} (${probStr}% chance).`,
                actionPath: isSensitive
                    ? `Reschedule the ${label} or move indoors. Bring full waterproof gear if you must go out.`
                    : `Consider rescheduling the ${label}. If you go ahead, bring waterproof gear.`,
                confidence,
                notify: true,
                usedRoutine: true,
                usedLocation: hasLocation,
                usedSensitivity: isSensitive
            })
        }

        return createInsight({
            type: 'routine-adapt',
            urgency: URGENCY.HEADS_UP,
            content: `Rain is possible during your ${label} (${probStr}% chance around ${startStr}).`,
            actionPath: `Bring an umbrella or rain jacket for the ${label}. Keep an eye on conditions beforehand.`,
            confidence,
            notify: true,
            usedRoutine: true,
            usedLocation: hasLocation,
            usedSensitivity: isSensitive
        })
    }

    // ── 3. Extreme heat during window ────────────────────────────────────────
    const heatFeels = hasForecast
        ? peakFeelsLike(slots)
        : current.feelsLike

    const heatUrgency = escalateHeat(heatFeels, sensitivities)

    if (heatUrgency === URGENCY.ALERT || heatUrgency === URGENCY.HEADS_UP) {
        const isSensitive = !!sensitivities?.heat
        const tempStr = Math.round(heatFeels)

        return createInsight({
            type: 'routine-adapt',
            urgency: heatUrgency,
            content: `It will feel like ${tempStr}°C during your ${label} — very hot for outdoor activity.`,
            actionPath: isSensitive
                ? `Shift the ${label} to a cooler part of the day. If you keep it, carry water and stay in shade.`
                : `Consider moving the ${label} earlier or later to avoid peak heat. Carry water and limit direct sun.`,
            confidence: hasForecast ? 'high' : 'medium',
            notify: true,
            usedRoutine: true,
            usedLocation: hasLocation,
            usedSensitivity: isSensitive
        })
    }

    // ── 4. Cold + wind during window ─────────────────────────────────────────
    const coldFeels = hasForecast
        ? minFeelsLike(slots)
        : current.feelsLike

    const windKmh = hasForecast
        ? peakWind(slots)
        : current.windSpeed

    const coldUrgency = escalateCold(coldFeels, sensitivities)
    const windUrgency = escalateWind(windKmh, sensitivities)

    // Only surface cold/wind at HEADS_UP or ALERT — not for USEFUL (too noisy for routine windows)
    const coldWindLevel = coldUrgency === URGENCY.ALERT || coldUrgency === URGENCY.HEADS_UP
        ? coldUrgency
        : (windUrgency === URGENCY.ALERT || windUrgency === URGENCY.HEADS_UP ? windUrgency : null)

    if (coldWindLevel) {
        const isSensitive = !!sensitivities?.cold
        const coldStr = Math.round(coldFeels)
        const windNote = windUrgency ? ` with ${Math.round(windKmh)} km/h winds` : ''

        return createInsight({
            type: 'routine-adapt',
            urgency: coldWindLevel,
            content: `Cold conditions during your ${label} — feels like ${coldStr}°C${windNote}.`,
            actionPath: isSensitive
                ? `Dress in full thermal layers for the ${label}. Cover ears and hands — wind will make it feel colder than expected.`
                : `Dress warmly for the ${label}. A wind-resistant outer layer makes a noticeable difference.`,
            confidence: hasForecast ? 'high' : 'medium',
            notify: true,
            usedRoutine: true,
            usedLocation: hasLocation,
            usedSensitivity: isSensitive
        })
    }

    // ── 5. Window looks clear — return null ──────────────────────────────────
    return null
}

// ---------------------------------------------------------------------------
// Module logic
// ---------------------------------------------------------------------------

/**
 * Routine Adaptation intelligence module.
 * Pure function — no side effects, no store access.
 *
 * Returns an array of insights (one per affected window), or null when
 * there are no declared outdoor windows or all windows are clear.
 *
 * The coordinator handles array flattening and deduplication by type
 * (keeping only the highest-urgency routine-adapt insight).
 *
 * @param {WeatherData} weatherData
 * @param {UserContext} userContext
 * @returns {Insight[]|null}
 */
export function routineModule(weatherData, userContext) {
    if (!weatherData?.current) return null

    // ── Collect all outdoor windows for today ────────────────────────────────
    const weekdayWindows = userContext?.routines?.weekday?.outdoorWindows ?? []
    const weekendWindows = userContext?.routines?.weekend?.outdoorWindows ?? []
    const allWindows = [...weekdayWindows, ...weekendWindows]

    if (!allWindows.length) return null

    // Filter to windows that apply today and haven't passed
    const todayWindows = allWindows.filter(w =>
        w?.startTime &&
        w?.endTime &&
        appliesToday(w) &&
        !windowHasPassed(w)
    )

    if (!todayWindows.length) return null

    const { current, hourly = [] } = weatherData
    const sensitivities = userContext?.sensitivities ?? null
    const hasLocation = !!userContext?.location?.primary

    const insights = []

    for (const window of todayWindows) {
        const insight = buildWindowInsight(window, current, hourly, sensitivities, hasLocation)
        if (insight !== null) {
            insights.push(insight)
        }
    }

    return insights.length > 0 ? insights : null
}
