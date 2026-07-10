/**
 * @file activityModule.js
 * Phase 3.2 — Decision Engine
 *
 * Activity intelligence module.
 *
 * Answers: "Should I do [my declared activity] today, and when?"
 *
 * Scope (distinct from other modules):
 *   dailyPlanningModule → plans the whole day, weather-first
 *   comfortModule       → felt experience and body preparation
 *   activityModule      → activity-specific go/no-go recommendation
 *                         driven by ACTIVITY_PROFILES thresholds
 *
 * This module is SILENT when:
 *   - No activities are declared (returns null immediately)
 *   - Activity is out of its declared season range (returns null)
 *   - Current weather conditions are benign for all declared activities
 *
 * How scoring works:
 *   Each activity has good/marginal/notRecommended threshold sets.
 *   The module evaluates each primary weather variable against thresholds.
 *   The worst-case variable across the primary set determines the verdict:
 *     good         → AMBIENT insight (positive confirmation, only when genuinely good)
 *     marginal     → USEFUL insight ("possible with adjustments")
 *     notRecommended → HEADS_UP or ALERT depending on severity
 *
 *   When multiple activities are declared, we emit one insight per activity
 *   that has a noteworthy condition (marginal or worse). Benign activities
 *   don't generate noise. One positive ambient confirmation per session
 *   is emitted only when all declared activities are in "good" range.
 *
 * Hourly window:
 *   For marginal/not-recommended conditions NOW, the module looks ahead up to
 *   8 slots (~24h) to find a "good" window and mentions it in the actionPath.
 *
 * Philosophy (LUMI_INTELLIGENCE_PHILOSOPHY.md):
 *   - Never say "conditions are X" — always say "you can/should/avoid [activity]"
 *   - Name the specific activity by label, not category
 *   - Timing precision: "this afternoon", "before noon", not "later"
 *   - Absence of insight = conditions are fine — don't manufacture content
 *
 * Registration:
 *   useInsightEngine.js imports this module and wires it into the registry.
 *   This module does NOT self-register (avoids circular imports).
 */

import { createInsight } from '@/utils/insightValidator.js'
import { URGENCY } from '@/utils/urgencyEngine.js'
import { getActivityProfile } from '@/utils/activityProfiles.js'

/** @typedef {import('@/types/context.js').WeatherData} WeatherData */
/** @typedef {import('@/types/context.js').UserContext} UserContext */
/** @typedef {import('@/types/context.js').HourlyPoint} HourlyPoint */
/** @typedef {import('@/types/context.js').DeclaredActivity} DeclaredActivity */
/** @typedef {import('@/types/context.js').Insight} Insight */
/** @typedef {import('@/types/context.js').ActivitySensitivityProfile} ActivitySensitivityProfile */

// ---------------------------------------------------------------------------
// Verdict levels — maps to urgency
// ---------------------------------------------------------------------------

/** @enum {string} */
const VERDICT = Object.freeze({
    GOOD: 'good',
    MARGINAL: 'marginal',
    NOT_RECOMMENDED: 'notRecommended'
})

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Extracts the current values of the weather variables that an activity cares about.
 * Returns a map of variable → value.
 *
 * @param {import('@/types/context.js').CurrentWeatherData} current
 * @param {string[]} primaryVariables
 * @returns {Record<string, number>}
 */
function extractCurrentValues(current, primaryVariables) {
    /** @type {Record<string, number>} */
    const values = {}
    for (const variable of primaryVariables) {
        switch (variable) {
            case 'feelsLike': values.feelsLike = current.feelsLike; break
            case 'humidity': values.humidity = current.humidity; break
            case 'precipitation': {
                // Map precipProb (0–1) to a mm/hr proxy so it's comparable to profile thresholds.
                // precipProb of 1.0 maps to ~4 mm/hr (moderate rain proxy).
                const prob = Number(current.precipProb ?? 0)
                values.precipitation = (prob <= 1 ? prob : prob / 100) * 4
                break
            }
            case 'windSpeed': values.windSpeed = current.windSpeed; break
            case 'gustSpeed': values.gustSpeed = current.gustSpeed; break
            case 'uvIndex': values.uvIndex = current.uvIndex; break
            case 'visibility': values.visibility = current.visibility; break
            // temperature (raw) — fall through to feelsLike as fallback
            case 'temperature': values.temperature = current.temp; break
            default: values[variable] = 0
        }
    }
    return values
}

/**
 * Tests a single numeric value against a threshold range { min?, max? }.
 * Returns true if the value VIOLATES the threshold (i.e. condition is NOT met).
 *
 * @param {number} value
 * @param {{ min?: number, max?: number }} threshold
 * @returns {boolean}
 */
function violatesThreshold(value, threshold) {
    if (threshold.min !== undefined && value < threshold.min) return true
    if (threshold.max !== undefined && value > threshold.max) return true
    return false
}

/**
 * Tests whether a value is IN the "danger zone" expressed by a notRecommended threshold.
 *
 * notRecommended thresholds use min/max to express one-sided danger:
 *   { min: 50 } means "dangerous when value ≥ 50"  (e.g. windSpeed ≥ 50 km/h)
 *   { max: 1  } means "dangerous when value ≤ 1"   (e.g. visibility ≤ 1 km)
 *
 * @param {number} value
 * @param {{ min?: number, max?: number }} threshold
 * @returns {boolean}
 */
function inDangerZone(value, threshold) {
    if (threshold.min !== undefined && value >= threshold.min) return true
    if (threshold.max !== undefined && value <= threshold.max) return true
    return false
}

/**
 * Returns the worst verdict for a set of current variable values against
 * an activity profile's threshold sets.
 *
 * Priority: notRecommended > marginal > good
 *
 * Algorithm:
 *   1. If ANY variable is in the notRecommended danger zone → NOT_RECOMMENDED
 *   2. Else if ANY variable violates the good range → check if still within marginal range
 *      a. If within marginal range → MARGINAL
 *      b. If also outside marginal range → NOT_RECOMMENDED
 *   3. All variables within good ranges → GOOD
 *
 * @param {Record<string, number>} values
 * @param {ActivitySensitivityProfile} profile
 * @returns {'good'|'marginal'|'notRecommended'}
 */
function scoreActivity(values, profile) {
    const { thresholds } = profile
    let verdict = VERDICT.GOOD

    for (const [variable, value] of Object.entries(values)) {
        // ── Step 1: notRecommended danger zone check ─────────────────────────
        const notRec = thresholds.notRecommended[variable]
        if (notRec && inDangerZone(value, notRec)) {
            return VERDICT.NOT_RECOMMENDED
        }

        // ── Step 2: good threshold check ─────────────────────────────────────
        const good = thresholds.good[variable]
        if (good && violatesThreshold(value, good)) {
            // Outside good range — check if still within marginal range
            const marginal = thresholds.marginal[variable]
            if (!marginal || violatesThreshold(value, marginal)) {
                // Also outside marginal range → not recommended
                return VERDICT.NOT_RECOMMENDED
            }
            // Within marginal range → at best marginal
            verdict = VERDICT.MARGINAL
        }
    }

    return verdict
}

/**
 * Returns the display label for an activity, title-cased.
 * Falls back to the activityKey if no label.
 *
 * @param {DeclaredActivity} activity
 * @returns {string}
 */
function activityLabel(activity) {
    const label = activity.label?.trim()
    if (label) return label
    // Title-case the key as fallback
    return activity.activityKey
        .replace(/-/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase())
}

/**
 * Checks if an activity is in-season for the current month.
 * Returns true if year-round (seasonRange is null) or within the range.
 * Handles wrapping ranges (e.g. Nov → Mar).
 *
 * @param {DeclaredActivity} activity
 * @returns {boolean}
 */
function isInSeason(activity) {
    const { seasonRange } = activity
    if (!seasonRange || seasonRange.startMonth === null || seasonRange.endMonth === null) return true

    const currentMonth = new Date().getMonth() + 1 // 1–12
    const { startMonth, endMonth } = seasonRange

    if (startMonth <= endMonth) {
        // Normal range: Jun → Sep
        return currentMonth >= startMonth && currentMonth <= endMonth
    } else {
        // Wrapping range: Nov → Mar
        return currentMonth >= startMonth || currentMonth <= endMonth
    }
}

/**
 * Extracts wall-clock hour (0–23) from a HourlyPoint.
 * Returns -1 if unparseable.
 *
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
 * Formats an hour number as a readable string.
 * 7 → "7 AM", 14 → "2 PM", 6 → "6 AM"
 *
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
 * Builds a simplified weather value snapshot from a HourlyPoint.
 * Used to evaluate future hourly windows.
 *
 * @param {HourlyPoint} slot
 * @returns {import('@/types/context.js').CurrentWeatherData}
 */
function slotToCurrentValues(slot) {
    const temp = Number(slot?.main?.temp ?? 15)
    const feelsLike = Number(slot?.main?.feels_like ?? temp)
    const humidity = Number(slot?.main?.humidity ?? 50)
    const windSpeed = Number(slot?.wind?.speed ?? 0)
    const pop = Number(slot?.pop ?? 0)
    // pop is 0–1 from the API; precipitation proxy in the same scale as ACTIVITY_PROFILES
    const precipitation = (pop <= 1 ? pop : pop / 100) * 4 // map 0–1 → 0–4 mm/hr proxy
    const visibility = Number(slot?.visibility ?? 10000) / 1000 // metres → km

    return {
        temp,
        feelsLike,
        humidity,
        windSpeed,
        gustSpeed: windSpeed * 1.3,  // rough gust estimate when not available
        uvIndex: 0,  // not in HourlyPoint; ignored for window detection
        condition: String(slot?.weather?.[0]?.main ?? 'Clear'),
        visibility,
        precipProb: pop <= 1 ? pop : pop / 100,
        precipitation  // extra field for threshold matching
    }
}

/**
 * Looks ahead in the hourly forecast for the first slot where the activity
 * reaches a "good" verdict. Returns the hour string, or null.
 *
 * @param {HourlyPoint[]} hourly
 * @param {ActivitySensitivityProfile} profile
 * @param {string[]} primaryVariables
 * @param {number} maxSlots
 * @returns {string|null}
 */
function findGoodWindow(hourly, profile, primaryVariables, maxSlots = 8) {
    const futureSlots = hourly.filter(slot => {
        const ts = typeof slot.dt === 'number'
            ? (slot.dt > 1e10 ? slot.dt : slot.dt * 1000)
            : NaN
        return isNaN(ts) || ts > Date.now()
    })

    for (const slot of futureSlots.slice(0, maxSlots)) {
        const slotCurrentValues = slotToCurrentValues(slot)
        const values = extractCurrentValues(slotCurrentValues, primaryVariables)
        const verdict = scoreActivity(values, profile)
        if (verdict === VERDICT.GOOD) {
            const hour = slotHour(slot)
            return hour >= 0 ? formatHour(hour) : null
        }
    }
    return null
}

/**
 * Identifies which primary variable is the main reason conditions are poor.
 * Returns a human-readable phrase for use in insight content.
 *
 * @param {Record<string, number>} values
 * @param {ActivitySensitivityProfile} profile
 * @param {'marginal'|'notRecommended'} verdict
 * @returns {string}
 */
function primaryLimitingFactor(values, profile, verdict) {
    if (verdict === VERDICT.NOT_RECOMMENDED) {
        // First look for the variable triggering the notRecommended danger zone
        for (const [variable, value] of Object.entries(values)) {
            const threshold = profile.thresholds.notRecommended[variable]
            if (threshold && inDangerZone(value, threshold)) {
                return variablePhrase(variable, value, threshold)
            }
        }
        // Fallback: variable outside marginal range
        for (const [variable, value] of Object.entries(values)) {
            const threshold = profile.thresholds.marginal[variable]
            if (threshold && violatesThreshold(value, threshold)) {
                return variablePhrase(variable, value, threshold)
            }
        }
    } else {
        // MARGINAL: find the variable outside the good range
        for (const [variable, value] of Object.entries(values)) {
            const threshold = profile.thresholds.good[variable]
            if (threshold && violatesThreshold(value, threshold)) {
                return variablePhrase(variable, value, threshold)
            }
        }
    }
    return 'current conditions'
}

/**
 * Returns a short human phrase for a variable + value combination.
 *
 * @param {string} variable
 * @param {number} value
 * @param {{ min?: number, max?: number }} threshold
 * @returns {string}
 */
function variablePhrase(variable, value, threshold) {
    switch (variable) {
        case 'feelsLike':
            if (threshold.max !== undefined && value > threshold.max) return `heat (${Math.round(value)}°C)`
            if (threshold.min !== undefined && value < threshold.min) return `cold (${Math.round(value)}°C)`
            return `temperature (${Math.round(value)}°C)`
        case 'windSpeed':
            return `wind (${Math.round(value)} km/h)`
        case 'gustSpeed':
            return `gusts (${Math.round(value)} km/h)`
        case 'precipitation':
            return 'precipitation'
        case 'humidity':
            if (threshold.max !== undefined && value > threshold.max) return `high humidity (${Math.round(value)}%)`
            return `low humidity (${Math.round(value)}%)`
        case 'uvIndex':
            return `UV (index ${Math.round(value)})`
        case 'visibility':
            return `low visibility (${value.toFixed(1)} km)`
        default:
            return variable
    }
}

// ---------------------------------------------------------------------------
// Single-activity insight builder
// ---------------------------------------------------------------------------

/**
 * Builds an activity insight for one declared activity.
 * Returns null if conditions are benign (good verdict).
 *
 * @param {DeclaredActivity} activity
 * @param {import('@/types/context.js').CurrentWeatherData} current
 * @param {HourlyPoint[]} hourly
 * @param {boolean} hasLocation
 * @returns {Insight|null}
 */
function buildActivityInsight(activity, current, hourly, hasLocation) {
    const profile = getActivityProfile(activity.activityKey)
    if (!profile) return null

    const { primaryVariables } = profile
    const values = extractCurrentValues(current, primaryVariables)
    const verdict = scoreActivity(values, profile)
    const label = activityLabel(activity)

    if (verdict === VERDICT.GOOD) {
        // Only emit a positive confirmation for "good" — do not emit for all benign.
        // The caller decides whether to emit ambient confirmations.
        return null
    }

    if (verdict === VERDICT.NOT_RECOMMENDED) {
        const factor = primaryLimitingFactor(values, profile, VERDICT.NOT_RECOMMENDED)
        const goodWindow = findGoodWindow(hourly, profile, primaryVariables)
        const windowNote = goodWindow ? ` Conditions improve around ${goodWindow}.` : ''

        // Distinguish between severe (safety) and just "not good"
        // Severe: e.g. thunderstorm, feelsLike > notRecommended thresholds significantly
        const isSevere = isSevereCondition(values, profile)

        if (isSevere) {
            return createInsight({
                type: 'activity',
                urgency: URGENCY.ALERT,
                content: `${label} is not recommended right now — ${factor} poses a real risk.`,
                actionPath: goodWindow
                    ? `Skip ${label} until conditions improve, around ${goodWindow}.`
                    : `Skip ${label} today. Conditions are too poor for safe participation.`,
                confidence: 'high',
                notify: true,
                usedActivity: true,
                usedLocation: hasLocation
            })
        }

        return createInsight({
            type: 'activity',
            urgency: URGENCY.HEADS_UP,
            content: `${label} is not recommended today — ${factor} is outside safe limits.${windowNote}`,
            actionPath: goodWindow
                ? `Postpone ${label} until around ${goodWindow} when conditions are better.`
                : `Consider rescheduling ${label} — today's conditions aren't suitable.`,
            confidence: goodWindow ? 'high' : 'medium',
            notify: true,
            usedActivity: true,
            usedLocation: hasLocation
        })
    }

    // MARGINAL
    const factor = primaryLimitingFactor(values, profile, VERDICT.MARGINAL)
    const goodWindow = findGoodWindow(hourly, profile, primaryVariables)
    const windowNote = goodWindow ? ` A better window is around ${goodWindow}.` : ''

    return createInsight({
        type: 'activity',
        urgency: URGENCY.USEFUL,
        content: `${label} is possible today, but ${factor} makes conditions less than ideal.${windowNote}`,
        actionPath: goodWindow
            ? `If possible, aim for ${goodWindow} for better ${label} conditions. Adjust expectations for current conditions.`
            : `Adjust plans for ${label} — conditions are workable but not great. Take appropriate precautions for ${factor}.`,
        confidence: goodWindow ? 'high' : 'medium',
        usedActivity: true,
        usedLocation: hasLocation
    })
}

/**
 * Returns true when current conditions are severe enough to warrant an ALERT.
 * Severe = a variable is significantly past the notRecommended threshold.
 * "Significantly" means ≥30% beyond the threshold, or an absolute margin ≥15 units.
 *
 * @param {Record<string, number>} values
 * @param {ActivitySensitivityProfile} profile
 * @returns {boolean}
 */
function isSevereCondition(values, profile) {
    const notRec = profile.thresholds.notRecommended

    for (const [variable, value] of Object.entries(values)) {
        const threshold = notRec[variable]
        if (!threshold) continue
        if (!inDangerZone(value, threshold)) continue

        if (threshold.min !== undefined && value >= threshold.min) {
            const margin = value - threshold.min
            const pctMargin = threshold.min !== 0 ? margin / Math.abs(threshold.min) : 0
            if (pctMargin >= 0.3 || margin >= 15) return true
        }
        if (threshold.max !== undefined && value <= threshold.max) {
            const margin = threshold.max - value
            const pctMargin = threshold.max !== 0 ? margin / Math.abs(threshold.max) : 0
            if (pctMargin >= 0.3 || margin >= 10) return true
        }
    }

    return false
}

// ---------------------------------------------------------------------------
// Module logic
// ---------------------------------------------------------------------------

/**
 * Activity intelligence module.
 * Pure function — no side effects, no store access.
 *
 * Returns an array of insights (one per problematic declared activity),
 * or null when there are no declared activities or all conditions are benign.
 *
 * The coordinator handles array flattening and deduplication.
 *
 * @param {WeatherData} weatherData
 * @param {UserContext} userContext
 * @returns {Insight[]|null}
 */
export function activityModule(weatherData, userContext) {
    if (!weatherData?.current) return null

    // ── Gate: only active when activities are declared ───────────────────────
    const declared = userContext?.activities?.declared ?? []
    if (!declared.length) return null

    const { current, hourly = [] } = weatherData
    const hasLocation = !!userContext?.location?.primary

    // Filter to in-season activities with valid keys AND known profiles
    const activeActivities = declared.filter(a => a.activityKey && isInSeason(a) && !!getActivityProfile(a.activityKey))
    if (!activeActivities.length) return null

    const insights = []
    let allGood = true

    for (const activity of activeActivities) {
        const insight = buildActivityInsight(activity, current, hourly, hasLocation)
        if (insight !== null) {
            insights.push(insight)
            allGood = false
        }
    }

    // If all declared activities are in "good" conditions, emit one ambient confirmation.
    // Only when there are activities to confirm — don't emit ambient on no-data.
    if (allGood && activeActivities.length > 0) {
        const activityNames = activeActivities.map(activityLabel).join(' and ')
        const isMultiple = activeActivities.length > 1
        return [createInsight({
            type: 'activity',
            urgency: URGENCY.AMBIENT,
            content: `Good conditions for ${activityNames} today.`,
            actionPath: isMultiple
                ? `Conditions look good for your declared activities. Go ahead and enjoy.`
                : `Conditions are good for ${activityNames}. Go ahead.`,
            confidence: 'high',
            usedActivity: true,
            usedLocation: hasLocation
        })]
    }

    return insights.length > 0 ? insights : null
}
