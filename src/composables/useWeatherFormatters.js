/**
 * Shared formatting utilities for weather data.
 * Extracted from App.vue to eliminate prop-drilled function dependencies.
 *
 * Phase 3.1 addition: useTemperatureUnit now exposes a `setUnitFromContext(unit)`
 * function. useUserContext.js calls this when the context-declared unit changes,
 * keeping the module-level `useCelsius` ref in sync without creating a circular
 * import. All existing callers of useTemperatureUnit continue to work unchanged.
 */

import { computed, ref } from 'vue'

// ---------------------------------------------------------------------------
// Temperature unit state (module-level singleton so all consumers share it)
// ---------------------------------------------------------------------------
const useCelsius = ref(true)

/**
 * Called by useUserContext when the user's declared temperatureUnit changes.
 * Syncs the formatter's unit state to the context preference.
 * @param {'C'|'F'} unit
 */
export function setUnitFromContext(unit) {
    if (unit === 'C') useCelsius.value = true
    else if (unit === 'F') useCelsius.value = false
}

export function useTemperatureUnit() {
    const unitSymbol = computed(() => (useCelsius.value ? 'C' : 'F'))

    function toggleUnit() {
        useCelsius.value = !useCelsius.value
    }

    function toDisplayTemp(celsiusValue) {
        if (useCelsius.value) return Math.round(celsiusValue)
        return Math.round((celsiusValue * 9) / 5 + 32)
    }

    return { useCelsius, unitSymbol, toggleUnit, toDisplayTemp }
}

// ---------------------------------------------------------------------------
// Date / time formatting
// ---------------------------------------------------------------------------
function parseWeatherDate(value) {
    return new Date(String(value).replace(' ', 'T'))
}

export function formatDay(value) {
    return parseWeatherDate(value).toLocaleDateString([], { weekday: 'short' })
}

export function formatHour(value) {
    return parseWeatherDate(value)
        .toLocaleTimeString([], { hour: 'numeric', hour12: true })
        .replace(/\s/g, '')
        .toUpperCase()
}

// ---------------------------------------------------------------------------
// String helpers
// ---------------------------------------------------------------------------
export function capitalize(value) {
    if (!value) return ''
    return value.charAt(0).toUpperCase() + value.slice(1)
}
