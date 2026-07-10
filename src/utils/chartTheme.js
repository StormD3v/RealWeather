/**
 * chartTheme.js
 * Utilities for bridging the LumiCast CSS design-token layer with Chart.js.
 *
 * All colour values are resolved at call-time from the live computed style,
 * so the functions automatically reflect theme switches (dark ↔ light).
 * Zero hardcoded colour literals exist in this file.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Reads a single CSS custom property from :root and returns its trimmed value.
 * @param {string} property — e.g. '--lc-accent'
 * @returns {string}
 */
function token(property) {
    return getComputedStyle(document.documentElement)
        .getPropertyValue(property)
        .trim()
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} ChartTheme
 * @property {string} lineColor
 * @property {string} gradientStart
 * @property {string} gradientEnd
 * @property {string} gridColor
 * @property {string} tickColor
 * @property {string} tooltipBg
 * @property {string} tooltipTitle
 * @property {string} tooltipBody
 * @property {string} tooltipBorder
 * @property {string} currentPointColor
 * @property {string} peakPointColor
 */

/**
 * Reads the active CSS custom properties from document.documentElement
 * and returns a typed colour object for Chart.js configuration.
 * @returns {ChartTheme}
 */
export function getChartTheme() {
    return {
        lineColor: token('--lc-accent'),
        gradientStart: token('--lc-accent'),  // caller constructs alpha from this value
        gradientEnd: '',                    // gradient end is always transparent
        gridColor: token('--lc-border-subtle'),
        tickColor: token('--lc-text-muted'),
        tooltipBg: token('--lc-surface-raised'),
        tooltipTitle: token('--lc-text-primary'),
        tooltipBody: token('--lc-text-secondary'),
        tooltipBorder: token('--lc-border'),
        currentPointColor: token('--lc-bg'),
        peakPointColor: token('--lc-warning'),
    }
}

/**
 * Maps a NORMALIZED LumiCast weather condition key to the appropriate
 * CSS custom property colour token.
 *
 * IMPORTANT: This function accepts only the normalized keys produced by
 * resolveWeatherIconKey() from useWeatherIcons.js — never raw OWM strings.
 *
 * Normalized key set: 'Clear' | 'Clouds' | 'Rain' | 'Thunderstorm' | 'Snow' | 'Fog'
 * Falls back to --lc-accent for unmapped or unknown normalized keys.
 *
 * @param {string} normalizedCondition
 * @returns {string} Resolved CSS value — always a non-empty string
 */
export function getConditionColor(normalizedCondition) {
    const tokenMap = {
        Rain: '--lc-rain-color',
        Clear: '--lc-sun-color',
        Snow: '--lc-snow-color',
        Thunderstorm: '--lc-storm-color',
    }

    const cssVar = tokenMap[normalizedCondition] ?? '--lc-accent'
    const resolved = token(cssVar)

    // Fallback: if the resolved value is somehow empty (e.g. token not defined
    // in current theme), return the accent token value instead.
    return resolved || token('--lc-accent')
}

/**
 * Pure function — formats a temperature value with unit symbol.
 * @param {number} temp — temperature in the display unit
 * @param {string} unit — 'C', 'F', or other
 * @returns {string} e.g. "24°C"
 */
export function formatTempLabel(temp, unit) {
    return `${Math.round(temp)}°${unit}`
}
