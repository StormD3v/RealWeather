/**
 * @file urgencyEngine.js
 * Single source of truth for all urgency escalation decisions.
 *
 * Philosophy (from LUMI_INTELLIGENCE_PHILOSOPHY.md §7.3):
 *   Ambient  — enrichment, positive notes, light observations
 *   Useful   — routine guidance, moderate adjustments (most common)
 *   Heads-up — meaningful disruption, plan-adjustment advised
 *   Alert    — real risk, safety-relevant conditions
 *
 * Sensitivity-adjusted thresholds (from LUMI_MEMORY_AND_CONTEXT_MODEL.md §5.5):
 *   Heat (feels-like) : Alert ≥ 40°C  →  ≥ 33°C for heat-sensitive users
 *   UV index         : Alert ≥ 8      →  ≥ 6   for UV-sensitive users
 *   Air quality AQI  : Alert ≥ 150    →  ≥ 100 for airQuality-sensitive users
 *   Pollen (level)   : Heads-up HIGH  →  Heads-up MODERATE for pollen-sensitive users
 *   Cold (wind chill): Alert ≤ -15°C  →  ≤ -5°C for cold-sensitive users
 *
 * Usage:
 *   import { escalateHeat, escalateRain, escalateWind, escalateCold,
 *            escalateUV, URGENCY } from '@/utils/urgencyEngine'
 */

/** @typedef {import('@/types/context.js').UrgencyLevel} UrgencyLevel */
/** @typedef {import('@/types/context.js').SensitivityContext} SensitivityContext */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * The four urgency levels as a typed constant.
 * Use these values everywhere rather than bare strings.
 * @enum {UrgencyLevel}
 */
export const URGENCY = Object.freeze({
    AMBIENT:   /** @type {UrgencyLevel} */ ('ambient'),
    USEFUL:    /** @type {UrgencyLevel} */ ('useful'),
    HEADS_UP:  /** @type {UrgencyLevel} */ ('heads-up'),
    ALERT:     /** @type {UrgencyLevel} */ ('alert')
})

/**
 * Numeric rank for comparison. Higher = more urgent.
 * @type {Record<UrgencyLevel, number>}
 */
export const URGENCY_RANK = Object.freeze({
    'ambient': 0,
    'useful': 1,
    'heads-up': 2,
    'alert': 3
})

// ---------------------------------------------------------------------------
// Default thresholds
// ---------------------------------------------------------------------------

const DEFAULT_THRESHOLDS = Object.freeze({
    heat: {
        useful: { feelsLike: 30 },
        headsUp: { feelsLike: 35 },
        alert: { feelsLike: 40 }
    },
    cold: {
        useful: { windChill: 5 },
        headsUp: { windChill: -5 },
        alert: { windChill: -15 }
    },
    uv: {
        useful: 3,
        headsUp: 6,
        alert: 8
    },
    wind: {
        useful: 20,   // km/h
        headsUp: 40,
        alert: 70
    },
    precipitation: {
        // rain probability 0–100
        useful: 30,
        headsUp: 60,
        alert: 85
    },
    rainIntensity: {
        // mm/hr
        useful: 1,
        headsUp: 5,
        alert: 15
    }
})

// ---------------------------------------------------------------------------
// Sensitivity-adjusted threshold factories
// ---------------------------------------------------------------------------

/**
 * Returns heat thresholds adjusted for the user's sensitivity.
 * @param {SensitivityContext|null|undefined} sensitivities
 * @returns {{ useful: number, headsUp: number, alert: number }}
 */
export function getHeatThresholds(sensitivities) {
    if (sensitivities?.heat) {
        return { useful: 27, headsUp: 30, alert: 33 }
    }
    return { ...DEFAULT_THRESHOLDS.heat, useful: DEFAULT_THRESHOLDS.heat.useful.feelsLike, headsUp: DEFAULT_THRESHOLDS.heat.headsUp.feelsLike, alert: DEFAULT_THRESHOLDS.heat.alert.feelsLike }
}

/**
 * Returns cold (wind-chill) thresholds adjusted for the user's sensitivity.
 * @param {SensitivityContext|null|undefined} sensitivities
 * @returns {{ useful: number, headsUp: number, alert: number }}
 */
export function getColdThresholds(sensitivities) {
    if (sensitivities?.cold) {
        return { useful: 10, headsUp: 5, alert: -5 }
    }
    return { useful: DEFAULT_THRESHOLDS.cold.useful.windChill, headsUp: DEFAULT_THRESHOLDS.cold.headsUp.windChill, alert: DEFAULT_THRESHOLDS.cold.alert.windChill }
}

/**
 * Returns UV thresholds adjusted for the user's sensitivity.
 * @param {SensitivityContext|null|undefined} sensitivities
 * @returns {{ useful: number, headsUp: number, alert: number }}
 */
export function getUVThresholds(sensitivities) {
    if (sensitivities?.uv) {
        return { useful: 2, headsUp: 4, alert: 6 }
    }
    return { ...DEFAULT_THRESHOLDS.uv }
}

// ---------------------------------------------------------------------------
// Escalation functions — pure, testable
// ---------------------------------------------------------------------------

/**
 * Determines urgency for a heat condition.
 * @param {number} feelsLike - Celsius
 * @param {SensitivityContext|null|undefined} sensitivities
 * @returns {UrgencyLevel|null} null if below threshold
 */
export function escalateHeat(feelsLike, sensitivities) {
    const t = getHeatThresholds(sensitivities)
    if (feelsLike >= t.alert) return URGENCY.ALERT
    if (feelsLike >= t.headsUp) return URGENCY.HEADS_UP
    if (feelsLike >= t.useful) return URGENCY.USEFUL
    return null
}

/**
 * Determines urgency for a cold condition.
 * @param {number} feelsLike - Celsius (used as wind-chill proxy)
 * @param {SensitivityContext|null|undefined} sensitivities
 * @returns {UrgencyLevel|null}
 */
export function escalateCold(feelsLike, sensitivities) {
    const t = getColdThresholds(sensitivities)
    if (feelsLike <= t.alert) return URGENCY.ALERT
    if (feelsLike <= t.headsUp) return URGENCY.HEADS_UP
    if (feelsLike <= t.useful) return URGENCY.USEFUL
    return null
}

/**
 * Determines urgency for a wind condition.
 * @param {number} windSpeed - km/h
 * @param {SensitivityContext|null|undefined} sensitivities
 * @returns {UrgencyLevel|null}
 */
export function escalateWind(windSpeed, sensitivities) {
    // Wind sensitivity is not in the sensitivity context — future addition.
    // Using default thresholds only.
    if (windSpeed >= DEFAULT_THRESHOLDS.wind.alert) return URGENCY.ALERT
    if (windSpeed >= DEFAULT_THRESHOLDS.wind.headsUp) return URGENCY.HEADS_UP
    if (windSpeed >= DEFAULT_THRESHOLDS.wind.useful) return URGENCY.USEFUL
    return null
}

/**
 * Determines urgency for precipitation probability.
 * @param {number} precipProbPercent - 0–100
 * @param {SensitivityContext|null|undefined} sensitivities
 * @returns {UrgencyLevel|null}
 */
export function escalateRain(precipProbPercent, sensitivities) {
    const t = DEFAULT_THRESHOLDS.precipitation
    const adjusted = sensitivities?.precipitation
        ? { useful: 20, headsUp: 45, alert: 70 }
        : t

    if (precipProbPercent >= adjusted.alert) return URGENCY.ALERT
    if (precipProbPercent >= adjusted.headsUp) return URGENCY.HEADS_UP
    if (precipProbPercent >= adjusted.useful) return URGENCY.USEFUL
    return null
}

/**
 * Determines urgency for UV index.
 * @param {number} uvIndex - 0–11+
 * @param {SensitivityContext|null|undefined} sensitivities
 * @returns {UrgencyLevel|null}
 */
export function escalateUV(uvIndex, sensitivities) {
    const t = getUVThresholds(sensitivities)
    if (uvIndex >= t.alert) return URGENCY.ALERT
    if (uvIndex >= t.headsUp) return URGENCY.HEADS_UP
    if (uvIndex >= t.useful) return URGENCY.USEFUL
    return null
}

/**
 * Returns the higher urgency of two urgency levels.
 * @param {UrgencyLevel} a
 * @param {UrgencyLevel} b
 * @returns {UrgencyLevel}
 */
export function maxUrgency(a, b) {
    return URGENCY_RANK[a] >= URGENCY_RANK[b] ? a : b
}

/**
 * Sorts insights descending by urgency rank.
 * @param {Array<{urgency: UrgencyLevel}>} insights
 * @returns {Array<{urgency: UrgencyLevel}>}
 */
export function sortByUrgency(insights) {
    return [...insights].sort((a, b) => URGENCY_RANK[b.urgency] - URGENCY_RANK[a.urgency])
}

/**
 * Determines urgency for an Air Quality Index (AQI) value.
 * Uses the US AQI scale (0–300, normalized from EU AQI via ×2.5 factor).
 *
 * Default thresholds (standard user):
 *   null     AQI < 51   — good air quality
 *   useful   AQI 51–99  — moderate
 *   heads-up AQI 100–149 — unhealthy for sensitive groups
 *   alert    AQI ≥ 150  — unhealthy for all
 *
 * airQuality-sensitive thresholds:
 *   null     AQI < 51
 *   heads-up AQI 51–99  — elevated from useful: earlier warning
 *   alert    AQI ≥ 100  — earlier alert
 *
 * @param {number|null} aqi - normalized AQI 0–300; null when data unavailable
 * @param {SensitivityContext|null|undefined} sensitivities
 * @returns {UrgencyLevel|null} null if below threshold or data absent
 */
export function escalateAirQuality(aqi, sensitivities) {
    if (aqi === null || aqi === undefined || !Number.isFinite(aqi)) return null
    if (sensitivities?.airQuality) {
        if (aqi >= 100) return URGENCY.ALERT
        if (aqi >= 51) return URGENCY.HEADS_UP
        return null
    }
    if (aqi >= 150) return URGENCY.ALERT
    if (aqi >= 100) return URGENCY.HEADS_UP
    if (aqi >= 51) return URGENCY.USEFUL
    return null
}

/**
 * Determines urgency for a pollen level category.
 * Pollen is a comfort/prevention signal — thresholds are intentionally
 * conservative to avoid notification fatigue.
 *
 * Default thresholds (standard user):
 *   null     low
 *   null     moderate   — silent for standard users
 *   heads-up high
 *   alert    very-high
 *
 * pollen-sensitive thresholds:
 *   null     low        — still silent even when sensitive
 *   heads-up moderate   — threshold shifts down by one level
 *   heads-up high       — same level, but actionPath is personalized
 *   alert    very-high
 *
 * @param {string|null} pollenLevel - 'low'|'moderate'|'high'|'very-high'|null
 * @param {SensitivityContext|null|undefined} sensitivities
 * @returns {UrgencyLevel|null} null when silent or data absent
 */
export function escalatePollen(pollenLevel, sensitivities) {
    const RANK = Object.freeze({ 'low': 0, 'moderate': 1, 'high': 2, 'very-high': 3 })
    const rank = RANK[pollenLevel]
    if (rank === undefined || rank === null) return null

    if (sensitivities?.pollen) {
        if (rank >= RANK['very-high']) return URGENCY.ALERT
        if (rank >= RANK['moderate']) return URGENCY.HEADS_UP
        return null // 'low' is silent even for sensitive users
    }
    if (rank >= RANK['very-high']) return URGENCY.ALERT
    if (rank >= RANK['high']) return URGENCY.HEADS_UP
    return null // 'low' and 'moderate' are silent for standard users
}
