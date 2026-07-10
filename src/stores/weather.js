import { defineStore } from 'pinia'
import { shallowRef } from 'vue'
import { fetchWeatherBundle } from '@/services/weatherApi'
import { normalizeWeather } from '@/services/weatherNormalizer'
import {
  calculateImpactScore,
  computeTrendIndicators,
  generateActivityRecommendations
} from '@/services/weatherProductMetrics'

// Module-level request tracking — not reactive, intentionally outside state
let activeRequestId = 0
let activeController = null

export const useWeatherStore = defineStore('weather', {
  state: () => ({
    currentWeather: null,
    forecast: [],
    hourlyForecast: shallowRef([]),
    hourlyTrend: [],
    impactScore: { score: 0, label: 'Severe' },
    activityRecommendations: [],
    trendIndicators: { temperature: 'flat', humidity: 'flat' },
    loading: false,
    error: null,
    staleCacheWarning: null,
    lastSource: null,
    lastUpdatedAt: null
  }),

  getters: {
    /** Normalised condition string from the current weather response. */
    currentCondition: (state) => state.currentWeather?.weather?.[0]?.main || '',

    /** Icon code from the current weather response (e.g. "01d"). */
    currentIcon: (state) => state.currentWeather?.weather?.[0]?.icon || '',

    /** Daily forecast capped to 7 days. */
    dailyForecast: (state) => state.forecast?.slice(0, 7) ?? [],

    /** True when a stale-cache warning is active. */
    isStale: (state) => state.staleCacheWarning !== null,

    /** Bundled data object consumed by WeatherCopilot and HourlyDecisionTimeline. */
    sharedWeatherData: (state) => ({
      currentWeather: state.currentWeather || null,
      hourlyForecast: state.hourlyForecast || [],
      impactScore: state.impactScore || { score: 0, label: 'Severe' }
    })
  },

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

        this.staleCacheWarning =
          bundle.source === 'stale-cache'
            ? 'Showing cached data — live update failed'
            : null

        this.loading = false
      } catch (error) {
        if (error?.name === 'AbortError') {
          this.loading = false
          return
        }
        if (requestId !== activeRequestId) return

        const message = String(error?.message || '')
        const isNotFound = /city not found|location not found/i.test(message)

        this.error = isNotFound
          ? 'City not found. Please check the name and try again.'
          : message || 'Could not load weather. Check your connection and try again.'

        console.error('[weather-store] fetch failed', { params, message, error })
        this.loading = false
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
