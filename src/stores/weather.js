import { defineStore } from 'pinia'
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
    hourlyForecast: [],
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
    lastSource: null,
    lastUpdatedAt: null
  }),

  actions: {
    async fetchWeatherByParams(params) {
      const requestId = ++activeRequestId
      let retryCount = 0
      const maxRetries = 3

      if (activeController) {
        activeController.abort()
      }
      activeController = new AbortController()

      this.loading = true
      this.error = null

      while (retryCount < maxRetries) {
        try {
          const bundle = await fetchWeatherBundle(params, {
            signal: activeController.signal
          })

          if (requestId !== activeRequestId) {
            return
          }

          const normalized = normalizeWeather(bundle.current, bundle.forecast)

          this.currentWeather = normalized.current
          this.forecast = bundle.daily || normalized.dailySummaries
          this.hourlyForecast = normalized.hourlyNext12
          this.hourlyTrend = normalized.hourlyNext24
          this.impactScore = calculateImpactScore(normalized)
          this.trendIndicators = computeTrendIndicators(normalized)
          this.activityRecommendations = generateActivityRecommendations(normalized)
          this.lastSource = bundle.source || 'network'
          this.lastUpdatedAt = bundle.servedAt ?? Date.now()
          this.loading = false
          return // Success, exit retry loop
        } catch (error) {
          if (error?.name === 'AbortError') {
            return
          }

          if (requestId !== activeRequestId) {
            return
          }

          retryCount++
          const message = String(error?.message || '')
          const isNotFoundError = /city not found|location not found/i.test(message)
          const isRetryableError =
            error instanceof TypeError ||
            /502|503|504|bad gateway|service unavailable|network/i.test(message)

          if (isNotFoundError) {
            this.error = 'City not found. Please check the name and try again.'
            this.loading = false
            return
          }

          if (retryCount >= maxRetries || !isRetryableError) {
            if (error instanceof TypeError) {
              this.error = 'Network error. Check your connection and try again.'
            } else if (message.includes('502') || message.toLowerCase().includes('bad gateway')) {
              this.error = 'Weather service temporarily unavailable. Please try again in a few minutes.'
            } else {
              this.error = message || 'Something went wrong while fetching weather data.'
            }

            console.error('[weather-store] fetch failed', {
              params,
              message,
              error
            })
            this.loading = false
            return
          } else {
            console.warn(`[weather-store] Retry ${retryCount}/${maxRetries} failed:`, error?.message)
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 1000 * retryCount))
          }
        }
      }

      if (requestId === activeRequestId) {
        this.loading = false
      }
    },

    async fetchWeather(city) {
      return this.fetchWeatherByParams({ q: city })
    },

    async fetchWeatherByCoords(lat, lon) {
      return this.fetchWeatherByParams({ lat: String(lat), lon: String(lon) })
    }
  }
})
