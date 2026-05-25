import { defineStore } from 'pinia'
import { shallowRef } from 'vue'
import { fetchWeatherBundle } from '@/services/weatherApi'
import { normalizeWeather } from '@/services/weatherNormalizer'
import {
  calculateImpactScore,
  computeTrendIndicators,
  generateActivityRecommendations
} from '@/services/weatherProductMetrics'

let activeRequestId = 0
let activeController = null

export const useWeatherStore = defineStore('weather', {
  state: () => ({
    currentWeather: null,
    forecast: [],
    hourlyForecast: shallowRef([]),
    hourlyTrend: [],
    impactScore: {
      score: 0,
      label: 'Severe'
    },
    activityRecommendations: [],
    trendIndicators: {
      temperature: 'flat',
      humidity: 'flat'
    },
    loading: false,
    error: null,
    staleCacheWarning: null,
    lastSource: null,
    lastUpdatedAt: null
  }),

  actions: {
    async fetchWeatherByParams(params) {
      const requestId = ++activeRequestId

      if (activeController) {
        activeController.abort()
      }
      activeController = new AbortController()

      this.loading = true
      this.error = null
      this.staleCacheWarning = null

      try {
        const bundle = await fetchWeatherBundle(params, {
          signal: activeController.signal
        })

        if (requestId !== activeRequestId) return

        const normalized = normalizeWeather(bundle.current, bundle.forecast)

        this.currentWeather = normalized.current
        this.forecast = bundle.daily || normalized.dailySummaries || []
        this.hourlyForecast = normalized.hourlyNext12
        this.hourlyTrend = normalized.hourlyNext24
        this.impactScore = calculateImpactScore(normalized)
        this.trendIndicators = computeTrendIndicators(normalized)
        this.activityRecommendations = generateActivityRecommendations(normalized)

        this.lastSource = bundle.source || 'network'
        this.lastUpdatedAt = bundle.servedAt ?? Date.now()

        if (bundle.source === 'stale-cache') {
          this.staleCacheWarning = 'Showing cached data — live update failed'
        } else {
          this.staleCacheWarning = null
        }

        this.loading = false
        return
      } catch (error) {
        if (error?.name === 'AbortError') {
          return
        }

        if (requestId !== activeRequestId) return

        const message = String(error?.message || '')
        const isNotFoundError = /city not found|location not found/i.test(message)

        if (isNotFoundError) {
          this.error = 'City not found. Please check the name and try again.'
        } else {
          this.error = message || 'Could not load weather. Check your connection and try again.'
        }

        console.error('[weather-store] fetch failed', { params, message, error })
        this.loading = false
        return
      }
    },

    async fetchWeather(city) {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        this.error = "You're offline. Check your connection."
        this.loading = false
        return
      }
      return this.fetchWeatherByParams({ q: city })
    },

    async fetchWeatherByCoords(lat, lon) {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        this.error = "You're offline. Check your connection."
        this.loading = false
        return
      }
      return this.fetchWeatherByParams({ lat: String(lat), lon: String(lon) })
    }
  }
})
