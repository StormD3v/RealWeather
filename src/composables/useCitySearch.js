/**
 * City search logic with debounce and normalisation.
 * Extracted from App.vue.
 */

import { ref } from 'vue'
import { useWeatherStore } from '@/stores/weather'
import { useSearchHistory } from '@/composables/useSearchHistory'

const DEBOUNCE_DELAY_MS = 500

/** Strip characters that are not valid in a city name and cap length. */
function normalizeCity(city) {
    return String(city || '')
        .trim()
        .replace(/[^a-zA-Z\s\-']/g, '')
        .slice(0, 60)
}

export function useCitySearch() {
    const weatherStore = useWeatherStore()
    const { searchHistory, load: loadHistory, addCity } = useSearchHistory()

    const cityInput = ref('')
    const hasSearchedCity = ref(false)
    const lastSearchedCity = ref('')

    let debounceTimer = null

    function clearDebounce() {
        if (!debounceTimer) return
        clearTimeout(debounceTimer)
        debounceTimer = null
    }

    async function runCitySearch(city) {
        const normalized = normalizeCity(city)
        if (!normalized) return

        hasSearchedCity.value = true
        lastSearchedCity.value = normalized

        await weatherStore.fetchWeather(normalized)

        if (!weatherStore.error) {
            addCity(normalized)
        }
    }

    function queueDebouncedSearch(city) {
        const normalized = normalizeCity(city)
        if (!normalized) return

        clearDebounce()
        debounceTimer = setTimeout(() => {
            runCitySearch(normalized)
        }, DEBOUNCE_DELAY_MS)
    }

    async function submitSearch() {
        const raw = cityInput.value.trim()
        if (!raw) return
        cityInput.value = ''
        queueDebouncedSearch(raw)
    }

    async function searchFromHistory(city) {
        clearDebounce()
        await runCitySearch(city)
    }

    return {
        cityInput,
        hasSearchedCity,
        lastSearchedCity,
        searchHistory,
        loadHistory,
        submitSearch,
        searchFromHistory,
        runCitySearch,
        clearDebounce
    }
}
