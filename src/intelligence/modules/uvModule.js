/**
 * @file uvModule.js
 * Phase 3.5 — Environmental Intelligence
 *
 * UV environmental module.
 *
 * Answers: "When today is UV dangerous, and how long can I be outside safely?"
 *
 * Scope (distinct from comfortModule UV handling):
 *   comfortModule → skin preparation angle: "what to put on" (sunscreen, SPF, hat)
 *                   type: 'comfort'
 *   uvModule      → time-window advisory: "when is it dangerous, peak window,
 *                   outdoor duration guidance, UV progression through the day"
 *                   type: 'environmental', subtype: 'uv'
 *
 * Both modules coexist in the InsightSet without conflict because they use
 * different types. The coordinator deduplicates by type+subtype key.
 *
 * Scenarios (priority order):
 *   1. UV ≥ 8 (alert)    — dangerous period; mention peak window from hourly
 *   2. UV 6–7 (heads-up) — high; time guidance for midday avoidance
 *   3. UV 3–5 (useful)   — moderate; advisory for extended outdoor plans
 *   4. UV < 3            — null (benign, no guidance needed)
 *
 * Sensitivity: sensitivities.uv → uses escalateUV() which applies
 *   lower thresholds for UV-sensitive users (useful ≥2, heads-up ≥4, alert ≥6)
 *
 * Registration:
 *   useInsightEngine.js imports and registers this module explicitly.
 *   This module does NOT self-register (avoids circular imports).
 */

import { createInsight } from '@/utils/insightValidator.js'
import { URGENCY, escalateUV } from '@/utils/urgencyEngine.js'

/** @typedef {import('@/types/context.js').WeatherData} WeatherData */
/** @typedef {import('@/types/context.js').UserContext} UserContext */
/** @typedef {import('@/types/context.js').HourlyPoint} HourlyPoint */
/** @typedef {import('@/types/context.js').Insight} Insight */

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Extracts wall-clock hour (0–23) from a HourlyPoint.
 * Returns -1 if unparseable.
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
 * Formats a 0–23 hour number as a human-readable string.
 * @param {number} hour
 * @returns {string}
 */
function formatHour(hour) {
    if (hour === 0) return 'midnight'
    if (hour === 12) return 'noon'
    if (hour < 12) return `${hour} AM`
    return `${hour - 12} PM`
}

/**
 * Finds the hour of peak UV in the next N hourly slots.
 * Returns null if no valid slots exist.
 *
 * Note: HourlyPoint does not carry a uvIndex field (Open-Meteo forecast endpoint
 * does not provide per-slot UV). This function is intentionally a no-op until
 * hourly UV data is available — it returns null, which is handled gracefully.
 *
 * @param {HourlyPoint[]} hourly
 * @param {number} maxSlots
 * @returns {{ hour: number, uvIndex: number }|null}
 */
function findPeakUVSlot(hourly, maxSlots = 8) {
    const futureFacing = hourly.filter(slot => {
        const ts = typeof slot.dt === 'number'
            ? (slot.dt > 1e10 ? slot.dt : slot.dt * 1000)
            : NaN
        return isNaN(ts) || ts > Date.now()
    }).slice(0, maxSlots)

    // UV not available in HourlyPoint — future extension point
    // When per-slot UV becomes available, extract it here
    return null
}

/**
 * Returns a safe outdoor duration string based on UV index.
 * These are approximate burn-time estimates for unprotected fair skin
 * (SPF 0) at the given UV level. Guidance, not medical advice.
 *
 * @param {number} uvIndex
 * @returns {string}
 */
function safeDurationHint(uvIndex) {
    if (uvIndex >= 11) return 'under 10 minutes'
    if (uvIndex >= 8) return 'under 15 minutes'
    if (uvIndex >= 6) return 'around 20–30 minutes'
    if (uvIndex >= 3) return 'around 45–60 minutes'
    return 'no meaningful limit'
}

/**
 * Returns a midday avoidance window string.
 * Midday UV (11 AM – 3 PM) is the highest-risk window.
 * @returns {string}
 */
function middayWindow() {
    return 'between 11 AM and 3 PM'
}

// ---------------------------------------------------------------------------
// Module logic
// ---------------------------------------------------------------------------

/**
 * UV environmental intelligence module.
 * Pure function — no side effects, no store access.
 *
 * @param {WeatherData} weatherData
 * @param {UserContext} userContext
 * @returns {Insight|null}
 */
export function uvModule(weatherData, userContext) {
    if (!weatherData?.current) return null

    const { current, hourly = [] } = weatherData
    const uvIndex = current.uvIndex

    // Gate: UV must be a finite number
    if (!Number.isFinite(uvIndex)) return null

    const sensitivities = userContext?.sensitivities ?? null
    const hasLocation = !!userContext?.location?.primary
    const isSensitive = !!sensitivities?.uv
    const uvStr = Math.round(uvIndex)

    const urgency = escalateUV(uvIndex, sensitivities)
    if (!urgency) return null

    const peakSlot = findPeakUVSlot(hourly)
    const peakNote = peakSlot ? ` Peak UV is expected around ${formatHour(peakSlot.hour)}.` : ''
    const safeDuration = safeDurationHint(uvIndex)

    // ── 1. Alert — UV ≥ 8 (default) or ≥ 6 (sensitive) ─────────────────────
    if (urgency === URGENCY.ALERT) {
        return createInsight({
            type: 'environmental',
            subtype: 'uv',
            urgency: URGENCY.ALERT,
            content: `UV index is very high today (${uvStr}). Unprotected skin can burn in ${safeDuration}.${peakNote}`,
            actionPath: isSensitive
                ? `Avoid direct sun ${middayWindow()}. If you must be outside, apply SPF 50+ sunscreen, wear a hat and UV-blocking sunglasses, and limit exposure to short bursts.`
                : `Avoid prolonged direct sun ${middayWindow()}. Apply SPF 30+ sunscreen for any outdoor time. A hat and sunglasses significantly reduce exposure.`,
            confidence: 'high',
            notify: true,
            usedSensitivity: isSensitive,
            usedLocation: hasLocation
        })
    }

    // ── 2. Heads-up — UV 6–7 (default) or 4–5 (sensitive) ──────────────────
    if (urgency === URGENCY.HEADS_UP) {
        return createInsight({
            type: 'environmental',
            subtype: 'uv',
            urgency: URGENCY.HEADS_UP,
            content: `UV is elevated today (index ${uvStr}). Midday hours carry meaningful skin risk without protection.${peakNote}`,
            actionPath: isSensitive
                ? `Apply sunscreen before any outdoor time, even for short trips. Reapply every 90 minutes. Seek shade during ${middayWindow()}.`
                : `Apply sunscreen for outdoor activity lasting over 20 minutes, especially around midday. A hat helps during ${middayWindow()}.`,
            confidence: 'high',
            notify: isSensitive,
            usedSensitivity: isSensitive,
            usedLocation: hasLocation
        })
    }

    // ── 3. Useful — UV 3–5 (default) or 2–3 (sensitive) ────────────────────
    return createInsight({
        type: 'environmental',
        subtype: 'uv',
        urgency: URGENCY.USEFUL,
        content: `UV index is moderate today (${uvStr}). Worth considering protection for extended outdoor time.`,
        actionPath: isSensitive
            ? 'Apply sunscreen if you plan to be outside for more than 20 minutes. Midday sun is the strongest.'
            : 'Apply sunscreen for outdoor activity over 30 minutes, particularly during midday hours.',
        confidence: 'medium',
        usedSensitivity: isSensitive,
        usedLocation: hasLocation
    })
}
