/**
 * Geolocation-based initial weather loading.
 * Extracted from App.vue.
 *
 * Phase 3.1 addition: successful GPS position is forwarded to the session
 * context store (useContextStore) so useUserContext can compute isAtPrimary.
 * All existing behavior is preserved unchanged.
 */

import { ref } from 'vue'
import { getCurrentPosition } from '@/utils/geolocation'
import { useWeatherStore } from '@/stores/weather'

export function useGeolocationSearch() {
    const weatherStore = useWeatherStore()

    const detectingLocation = ref(false)
    const geolocationDenied = ref(false)

    async function requestInitialWeather(onSuccess) {
        detectingLocation.value = true

        const position = await getCurrentPosition().catch((error) => {
            geolocationDenied.value = error?.code === 1
            console.error('[app] Geolocation unavailable, showing empty state', error)
            return null
        })

        detectingLocation.value = false

        if (position?.coords?.latitude != null && position?.coords?.longitude != null) {
            const lat = position.coords.latitude
            const lon = position.coords.longitude

            // Phase 3.1: update session context store with GPS position.
            // Imported lazily to avoid init-time circular dependency.
            try {
                const { useContextStore } = await import('@/stores/context.js')
                useContextStore().updateGpsPosition(lat, lon, 'granted')
            } catch {
                // Non-fatal — session context update failure does not block weather load
            }

            await weatherStore.fetchWeatherByCoords(lat, lon)
            if (weatherStore.currentWeather?.name && typeof onSuccess === 'function') {
                onSuccess(weatherStore.currentWeather.name)
            }
        }
    }

    return { detectingLocation, geolocationDenied, requestInitialWeather }
}
