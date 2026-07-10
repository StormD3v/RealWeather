/**
 * Search history management.
 * Extracted from App.vue — handles localStorage persistence of recent searches.
 */

import { ref } from 'vue'

const STORAGE_KEY = 'weather-search-history'
const MAX_HISTORY = 3

export function useSearchHistory() {
    const searchHistory = ref([])

    function load() {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) {
            searchHistory.value = []
            return
        }
        try {
            const parsed = JSON.parse(raw)
            if (Array.isArray(parsed)) {
                searchHistory.value = parsed
                    .slice(0, MAX_HISTORY)
                    .filter((item) => typeof item === 'string' && item.trim())
                return
            }
        } catch {
            // corrupted data — fall through to reset
        }
        searchHistory.value = []
    }

    function save() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(searchHistory.value))
    }

    function addCity(city) {
        if (!city) return
        searchHistory.value = [
            city,
            ...searchHistory.value.filter((item) => item.toLowerCase() !== city.toLowerCase())
        ].slice(0, MAX_HISTORY)
        save()
    }

    return { searchHistory, load, addCity }
}
