<template>
  <div class="app min-h-screen">
    <WeatherBackground :condition="currentCondition" :icon="currentIcon" />

    <div class="weather-shell">
      <section class="header-section hero-panel">
        <header class="app-head">
          <div class="brand">
            <div>
              <h1 class="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
                LumiCast
              </h1>
              <p class="text-sm text-slate-600 dark:text-slate-300">
                Live conditions and forecast
              </p>
            </div>
          </div>
        </header>

        <section class="controls">
          <input class="search" :class="{ 'search-pulse': !hasSearchedCity && !weatherStore.loading }" type="text"
            placeholder="Enter city name (search worldwide)..." v-model="cityInput" @keyup.enter="getWeather" />
          <button class="search-btn" @click="getWeather">Search</button>
          <div class="unit-toggle" aria-label="Temperature unit toggle">
            <button type="button" class="unit-btn" @click="toggleUnit">
              {{ useCelsius ? '°C' : '°F' }}
            </button>
          </div>
          <WeatherSourceBadge :source="weatherSource" :timestamp="weatherSourceTime" />
          <div class="recent-searches" v-if="searchHistory.length">
            <button v-for="city in searchHistory" :key="'recent-' + city" type="button" class="recent-chip"
              @click="searchFromHistory(city)">
              {{ city }}
            </button>
          </div>
          <div v-if="weatherStore.loading || weatherStore.error || searchSuccessMessage || detectingLocation"
            class="search-feedback">
            <div v-if="detectingLocation" class="detecting-location">
              <span class="loading-spinner"></span>
              <span>Detecting location...</span>
            </div>
            <div v-else-if="weatherStore.loading" class="loading-indicator">
              <span class="loading-spinner"></span>
              <span>Searching weather...</span>
            </div>
            <div v-else-if="weatherStore.error" class="error-banner">
              {{ weatherStore.error }}
            </div>
            <div v-else class="success-banner">
              {{ searchSuccessMessage }}
            </div>
          </div>
        </section>
      </section>

      <section v-if="weatherStore.loading && !weatherStore.currentWeather" class="empty-card">
        <div class="loading-indicator">
          <span class="loading-spinner"></span>
          <span>Loading weather data...</span>
        </div>
      </section>

      <section v-if="!weatherStore.currentWeather && !weatherStore.error && !weatherStore.loading"
        class="empty-card empty-welcome">
        <div class="empty-welcome-content">
          <h2 class="empty-logo">LumiCast</h2>
          <p class="empty-tagline">Search any city to get started</p>
          <div class="empty-search-cta">
            <input class="search search-pulse" type="text" placeholder="Try: San Francisco" v-model="cityInput"
              @keyup.enter="getWeather" />
            <button class="search-btn" @click="getWeather">Search</button>
          </div>
          <p v-if="geolocationDenied" class="meta-line">Location access denied. Search by city to continue.</p>
        </div>
      </section>

      <section v-if="weatherStore.error && !weatherStore.currentWeather" class="empty-card">
        <div>
          <h2>Unable to load weather right now</h2>
          <p>{{ weatherStore.error }}</p>
          <p class="meta-line">Check your network, then try another city search.</p>
        </div>
      </section>

      <div class="dashboard-flow">
        <section class="current-impact-section dashboard-section two-column-section">
          <div class="dashboard-card current-weather">
            <CurrentWeatherCard :loading="weatherStore.loading" :error="weatherStore.error"
              :current-weather="weatherStore.currentWeather" :main-weather-icon-class="mainWeatherIconClass"
              :weather-icon="weatherIcon" :temp-display-key="tempDisplayKey" :unit-symbol="unitSymbol"
              :hourly-forecast="hourlyForecast" :impact-score="weatherStore.impactScore"
              :trend-indicators="weatherStore.trendIndicators"
              :activity-recommendations="weatherStore.activityRecommendations" :hourly-forecast-key="hourlyForecastKey"
              :to-display-temp="toDisplayTemp" :capitalize="capitalize" :format-hour="formatHour" :icon-svg="iconSvg" />
          </div>

          <div class="dashboard-card stability-ring">
            <WeatherImpactCard :impact-score="weatherStore.impactScore" :current-weather="weatherStore.currentWeather"
              :hourly-forecast="hourlyForecast" :trend-indicators="weatherStore.trendIndicators"
              :unit-symbol="unitSymbol" />
          </div>
        </section>

        <section class="ai-insights-section dashboard-section">
          <div class="dashboard-card panel-weather-copilot">
            <WeatherCopilot :loading="weatherStore.loading" :weather-data="sharedWeatherData" />
          </div>
        </section>

        <section class="next-12-hours-section dashboard-section horizontal-scroll-section">
          <div class="dashboard-card panel-next-12">
            <Next12HoursCard :hourly-forecast="hourlyForecast" :format-hour="formatHour" :icon-svg="iconSvg"
              :to-display-temp="toDisplayTemp" :unit-symbol="unitSymbol" />
          </div>
        </section>

        <section class="hourly-decision-section dashboard-section horizontal-scroll-section">
          <div class="dashboard-card panel-hourly-decision-timeline">
            <HourlyDecisionTimeline :weather-data="sharedWeatherData" :hourly-forecast="hourlyForecast"
              :current-weather="weatherStore.currentWeather" :icon-svg="iconSvg" :to-display-temp="toDisplayTemp"
              :unit-symbol="unitSymbol" />
          </div>
        </section>

        <section class="planning-section dashboard-section three-column-section">
          <div class="dashboard-card panel-activity-recommendations">
            <ActivityRecommendationsCard :recommendations="weatherStore.activityRecommendations"
              :current-weather="weatherStore.currentWeather" />
          </div>

          <div class="dashboard-card panel-risk-alerts">
            <WeatherRiskAlertsCard :forecast-data="hourlyTrend" :current-weather="weatherStore.currentWeather" />
          </div>

          <div class="dashboard-card panel-demand-forecast">
            <BestTimeCard :hourly-forecast="hourlyForecast" :current-weather="weatherStore.currentWeather" />
          </div>
        </section>

        <section class="seven-day-section dashboard-section">
          <div class="dashboard-card seven-day-forecast">
            <SevenDayForecastCard :daily-forecast="dailyForecast" :format-day="formatDay" :icon-svg="iconSvg"
              :to-display-temp="toDisplayTemp" :unit-symbol="unitSymbol" />
          </div>
        </section>

        <section class="weather-trends-chart-section dashboard-section single-column-section">
          <div class="dashboard-card panel-trend-charts">
            <WeatherTrendCharts :points="hourlyTrend" :unit-symbol="unitSymbol" />
          </div>
        </section>

        <section class="footer-section dashboard-section">
          <footer class="app-footer">
            <span>LumiCast</span>
            <span>Live weather intelligence for everyday planning.</span>
          </footer>
        </section>
      </div>
    </div>

  </div>
</template>


<script setup>
import { computed, defineAsyncComponent, onBeforeUnmount, onErrorCaptured, onMounted, ref, watch } from 'vue'
import { useWeatherStore } from '@/stores/weather'
import WeatherBackground from '@/components/WeatherBackground.vue'
import CurrentWeatherCard from '@/components/CurrentWeatherCard.vue'
import WeatherSourceBadge from '@/components/WeatherSourceBadge.vue'
import { getCurrentPosition } from '@/utils/geolocation'

// New dashboard components
import WeatherImpactCard from '@/components/WeatherImpactCard.vue'
import WeatherCopilot from '@/components/WeatherCopilot.vue'
import ActivityRecommendationsCard from '@/components/ActivityRecommendationsCard.vue'
import Next12HoursCard from '@/components/Next12HoursCard.vue'
import HourlyDecisionTimeline from '@/components/HourlyDecisionTimeline.tsx'
import SevenDayForecastCard from '@/components/SevenDayForecastCard.vue'
import WeatherRiskAlertsCard from '@/components/WeatherRiskAlertsCard.vue'
import BestTimeCard from '@/components/BestTimeCard.vue'

const WeatherTrendCharts = defineAsyncComponent({
  loader: () => import('@/components/WeatherTrendCharts.vue'),
  loadingComponent: { template: '<div class="chart-skeleton"></div>' },
  errorComponent: { template: '<div class="chart-error">Failed to load chart.</div>' },
  delay: 200,
  timeout: 8000
})

const cityInput = ref('')
const weatherStore = useWeatherStore()
const useCelsius = ref(true)
const searchHistory = ref([])
const lastSearchedCity = ref('')
const hasSearchedCity = ref(false)
const geolocationDenied = ref(false)
const detectingLocation = ref(false)

const SEARCH_HISTORY_KEY = 'weather-search-history'

const unitSymbol = computed(() => (useCelsius.value ? 'C' : 'F'))
const hourlyForecast = computed(() => weatherStore.hourlyForecast)
const hourlyTrend = computed(() => weatherStore.hourlyTrend)
const dailyForecast = computed(() =>
  weatherStore.forecast?.slice(0, 7) ?? []
)
const weatherSource = computed(() => weatherStore.lastSource)
const weatherSourceTime = computed(() => weatherStore.lastUpdatedAt)
const hourlyForecastKey = computed(() => hourlyForecast.value.map((slot) => slot.dt).join('-'))
const tempDisplayKey = computed(() => `${weatherStore.currentWeather?.dt ?? 'none'}-${weatherStore.currentWeather?.main?.temp ?? 'none'}-${unitSymbol.value}`)
const currentCondition = computed(() => weatherStore.currentWeather?.weather?.[0]?.main || '')
const currentIcon = computed(() => weatherStore.currentWeather?.weather?.[0]?.icon || '')
const searchSuccessMessage = computed(() => {
  if (!hasSearchedCity.value || weatherStore.loading || weatherStore.error || !weatherStore.currentWeather) {
    return ''
  }

  const cityName = weatherStore.currentWeather?.name || lastSearchedCity.value
  return cityName ? `Weather loaded for ${cityName}.` : ''
})
const weatherIcon = computed(() => {
  const map = {
    Clear: 'Clear',
    Clouds: 'Clouds',
    Rain: 'Rain',
    Thunderstorm: 'Thunderstorm',
    Snow: 'Snow',
    Drizzle: 'Rain',
    Mist: 'Fog',
    Fog: 'Fog',
    Haze: 'Fog'
  }
  return map[currentCondition.value] || 'Clear'
})
const sharedWeatherData = computed(() => {
  const current = weatherStore.currentWeather || null
  const hourly = weatherStore.hourlyForecast || []
  const impact = weatherStore.impactScore || { score: 0, label: 'Severe' }
  return {
    currentWeather: current,
    hourlyForecast: hourly,
    impactScore: impact
  }
})
const mainWeatherIconClass = computed(() => {
  const animationMap = {
    Clear: 'is-clear',
    Clouds: 'is-clouds',
    Rain: 'is-rain',
    Thunderstorm: 'is-thunderstorm',
    Snow: 'is-snow',
    Drizzle: 'is-drizzle',
    Mist: 'is-fog',
    Fog: 'is-fog',
    Haze: 'is-fog'
  }
  return animationMap[currentCondition.value] || 'is-clear'
})

function setFaviconFromWeather(condition) {
  if (typeof document === 'undefined') return

  const iconMap = {
    Clear: '☀️',
    Clouds: '☁️',
    Rain: '🌧️',
    Drizzle: '🌧️',
    Thunderstorm: '⛈️',
    Snow: '❄️'
  }

  const emoji = iconMap[condition] || '☀️'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">${emoji}</text></svg>`
  const href = `data:image/svg+xml,${encodeURIComponent(svg)}`

  let favicon = document.querySelector("link[rel='icon']")
  if (!favicon) {
    favicon = document.createElement('link')
    favicon.setAttribute('rel', 'icon')
    document.head.appendChild(favicon)
  }
  favicon.setAttribute('href', href)
}

function normalizeCity(city) {
  return city
    .trim()
    .replace(/[^a-zA-Z\s\-']/g, '')
    .slice(0, 60)
}

function loadSearchHistory() {
  const raw = localStorage.getItem(SEARCH_HISTORY_KEY)
  if (!raw) {
    searchHistory.value = []
    return
  }
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      searchHistory.value = parsed.slice(0, 3).filter((item) => typeof item === 'string' && item.trim())
      return
    }
  } catch (error) {
    console.error('Failed to parse search history:', error)
  }
  searchHistory.value = []
}

function saveSearchHistory() {
  localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(searchHistory.value))
}

function addToSearchHistory(city) {
  const normalized = normalizeCity(city)
  if (!normalized) return

  searchHistory.value = [
    normalized,
    ...searchHistory.value.filter((item) => item.toLowerCase() !== normalized.toLowerCase())
  ].slice(0, 3)
  saveSearchHistory()
}

let searchDebounceTimer = null

function queueDebouncedSearch(city) {
  const normalized = normalizeCity(city)
  if (!normalized) return

  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer)
  }

  searchDebounceTimer = setTimeout(() => {
    runCitySearch(normalized)
  }, 500)
}

function clearDebouncedSearch() {
  if (!searchDebounceTimer) return
  clearTimeout(searchDebounceTimer)
  searchDebounceTimer = null
}

async function runCitySearch(city) {
  const normalized = normalizeCity(city)
  if (!normalized) return

  hasSearchedCity.value = true
  lastSearchedCity.value = normalized
  await weatherStore.fetchWeather(normalized)
  if (!weatherStore.error) {
    addToSearchHistory(normalized)
  }
}

async function getWeather() {
  if (!cityInput.value.trim()) return
  const city = cityInput.value
  cityInput.value = ''
  queueDebouncedSearch(city)
}

async function searchFromHistory(city) {
  clearDebouncedSearch()
  await runCitySearch(city)
}

async function requestInitialWeather() {
  detectingLocation.value = true

  const position = await getCurrentPosition().catch((error) => {
    geolocationDenied.value = error?.code === 1
    console.error('[app] Geolocation unavailable, showing empty state', error)
    return null
  })

  detectingLocation.value = false

  if (position?.coords?.latitude != null && position?.coords?.longitude != null) {
    await weatherStore.fetchWeatherByCoords(position.coords.latitude, position.coords.longitude)
    if (weatherStore.currentWeather?.name) {
      cityInput.value = weatherStore.currentWeather.name
      hasSearchedCity.value = true
      lastSearchedCity.value = weatherStore.currentWeather.name
    }
  }
}

function handleOnline() {
  if (!weatherStore.currentWeather) {
    requestInitialWeather()
  }
}

function handleOffline() {
  // silently note offline status
}

onErrorCaptured((error) => {
  // Silently capture component errors without showing banner
  return false
})

function toggleUnit() {
  useCelsius.value = !useCelsius.value
}

onMounted(() => {
  document.documentElement.classList.add('dark')
  loadSearchHistory()
  requestInitialWeather()
  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)
})

watch(
  () => currentCondition.value,
  (condition) => {
    setFaviconFromWeather(condition)
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  clearDebouncedSearch()
  document.body.style.overflow = ''
  window.removeEventListener('online', handleOnline)
  window.removeEventListener('offline', handleOffline)
})

watch(
  () => weatherStore.currentWeather,
  () => {
    if (import.meta.env.DEV) {
      console.group('[LumiCast Debug]')
      console.log('Weather loaded:', weatherStore.currentWeather?.name)
      console.log('Source:', weatherStore.lastSource)
      console.log('Hourly points:', weatherStore.hourlyForecast?.length)
      console.groupEnd()
    }
  }
)

function toDate(value) {
  return new Date(value.replace(' ', 'T'))
}

function formatDay(value) {
  return toDate(value).toLocaleDateString([], { weekday: 'short' })
}

function formatHour(value) {
  return toDate(value)
    .toLocaleTimeString([], { hour: 'numeric', hour12: true })
    .replace(/\s/g, '')
    .toUpperCase()
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function toDisplayTemp(celsiusValue) {
  if (useCelsius.value) return Math.round(celsiusValue)
  return Math.round((celsiusValue * 9) / 5 + 32)
}

function windDisplay(speedMs) {
  if (useCelsius.value) return `${Math.round(speedMs * 3.6)} km/h`
  return `${Math.round(speedMs * 2.237)} mph`
}

function visibilityKm(visibilityMeters) {
  return (visibilityMeters / 1000).toFixed(1)
}

function popPercent(slot) {
  return Math.round(slot.pop ?? 0)
}

function rainChance(currentWeather) {
  const rainVolume = currentWeather.rain?.['1h']
  if (rainVolume != null) {
    return Math.min(100, Math.round(rainVolume * 20))
  }
  return popPercent(weatherStore.hourlyForecast[0] || {})
}

const iconCache = new Map()

function iconSvg(main) {
  const cacheKey = main || 'Clear'
  if (iconCache.has(cacheKey)) {
    return iconCache.get(cacheKey)
  }

  const svg = generateIconSvg(cacheKey)
  iconCache.set(cacheKey, svg)
  return svg
}

function generateIconSvg(main) {
  const sun = `
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <radialGradient id="sun-grad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#ffe59a" />
          <stop offset="100%" stop-color="#ffb100" />
        </radialGradient>
      </defs>
      <circle cx="32" cy="32" r="12" fill="url(#sun-grad)" />
      ${Array.from({ length: 8 })
      .map((_, i) => {
        const angle = (i * Math.PI) / 4
        const x1 = 32 + Math.cos(angle) * 18
        const y1 = 32 + Math.sin(angle) * 18
        const x2 = 32 + Math.cos(angle) * 26
        const y2 = 32 + Math.sin(angle) * 26
        return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#ffd166" stroke-width="3" stroke-linecap="round" />`
      })
      .join('')}
    </svg>
  `

  const cloud = `
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <path d="M20 44h26a10 10 0 0 0 0-20 14 14 0 0 0-27-3A11 11 0 0 0 20 44Z" fill="#dbe7ff" />
    </svg>
  `

  const rain = `
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <path d="M20 38h26a10 10 0 0 0 0-20 14 14 0 0 0-27-3A11 11 0 0 0 20 38Z" fill="#dbe7ff" />
      <path d="M22 46l-4 8" stroke="#4fc3f7" stroke-width="3" stroke-linecap="round" />
      <path d="M34 46l-4 8" stroke="#4fc3f7" stroke-width="3" stroke-linecap="round" />
      <path d="M46 46l-4 8" stroke="#4fc3f7" stroke-width="3" stroke-linecap="round" />
    </svg>
  `

  const snow = `
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <path d="M20 38h26a10 10 0 0 0 0-20 14 14 0 0 0-27-3A11 11 0 0 0 20 38Z" fill="#dbe7ff" />
      <circle cx="24" cy="50" r="2" fill="#bde0ff" />
      <circle cx="34" cy="50" r="2" fill="#bde0ff" />
      <circle cx="44" cy="50" r="2" fill="#bde0ff" />
    </svg>
  `

  const storm = `
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <path d="M20 36h26a10 10 0 0 0 0-20 14 14 0 0 0-27-3A11 11 0 0 0 20 36Z" fill="#dbe7ff" />
      <path d="M34 38l-6 10h6l-6 10" stroke="#ffd166" stroke-width="3" fill="none" />
    </svg>
  `

  const fog = `
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <path d="M20 38h26a10 10 0 0 0 0-20 14 14 0 0 0-27-3A11 11 0 0 0 20 38Z" fill="#dbe7ff" />
      <path d="M18 46h30" stroke="#cbd5f5" stroke-width="3" stroke-linecap="round" />
      <path d="M22 52h26" stroke="#cbd5f5" stroke-width="3" stroke-linecap="round" />
    </svg>
  `

  const map = {
    Clear: sun,
    Clouds: cloud,
    Rain: rain,
    Drizzle: rain,
    Thunderstorm: storm,
    Snow: snow,
    Mist: fog,
    Smoke: fog,
    Haze: fog,
    Fog: fog
  }

  return map[main] || sun
}
</script>

<style>
* {
  box-sizing: border-box;
}

.app {
  --text: #0f172a;
  --muted: #64748b;
  --glass: rgba(255, 255, 255, 0.95);
  --glass-2: rgba(248, 250, 252, 0.98);
  --line: #e2e8f0;
  --accent: #2563eb;
  --btn: #dbeafe;
  --stat-label: #94a3b8;
  background: #f0f4f8;
  min-height: 100svh;
  position: relative;
  overflow-x: hidden;
  overflow-y: visible;
  color: var(--text);
  font-family: 'Inter', sans-serif;
  padding-top: calc(16px + env(safe-area-inset-top));
  padding-right: calc(16px + env(safe-area-inset-right));
  padding-bottom: calc(24px + env(safe-area-inset-bottom));
  padding-left: calc(16px + env(safe-area-inset-left));
  display: block;
}

.sky-bg {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background:
    radial-gradient(circle at 15% 18%, rgba(255, 195, 133, 0.45), transparent 36%),
    radial-gradient(circle at 64% 20%, rgba(255, 183, 128, 0.34), transparent 34%),
    linear-gradient(160deg, #8dc9f6 0%, #79c1f5 32%, #88cbf8 58%, #7fb7ec 100%);
  z-index: 0;
}

.weather-overlays {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
}

.rain-overlay,
.snow-overlay,
.stars-overlay,
.lightning-overlay {
  position: absolute;
  inset: 0;
}

.rain-streak {
  position: absolute;
  width: 2px;
  height: 18px;
  left: calc(var(--i) * 2.35%);
  top: -24px;
  border-radius: 999px;
  background: linear-gradient(to bottom, rgba(174, 227, 255, 0), rgba(121, 202, 255, 0.75));
  animation: weatherRain 1.15s linear infinite;
  animation-delay: calc(var(--i) * -0.11s);
  opacity: 0.58;
}

.snow-flake {
  position: absolute;
  width: 7px;
  height: 7px;
  left: calc(var(--i) * 2.95%);
  top: -10px;
  border-radius: 50%;
  background: rgba(234, 246, 255, 0.88);
  animation: weatherSnow 7.8s linear infinite;
  animation-delay: calc(var(--i) * -0.28s);
  filter: drop-shadow(0 0 4px rgba(255, 255, 255, 0.45));
  opacity: 0.82;
}

.star {
  position: absolute;
  width: var(--size);
  height: var(--size);
  border-radius: 50%;
  background: rgba(255, 255, 255, var(--opacity));
  animation: weatherTwinkle var(--duration) ease-in-out infinite;
  animation-delay: var(--delay);
  box-shadow: 0 0 8px rgba(255, 255, 255, 0.35);
}

.lightning-overlay {
  background: radial-gradient(circle at 65% 12%, rgba(255, 255, 255, 0.82), transparent 35%);
  mix-blend-mode: screen;
  animation: weatherLightning 6.2s linear infinite;
  opacity: 0;
}

html.dark .app {
  --text: #f5fbff;
  --muted: rgba(238, 246, 255, 0.88);
  --glass: rgba(5, 18, 44, 0.78);
  --glass-2: rgba(10, 28, 57, 0.82);
  --line: rgba(255, 255, 255, 0.22);
  --accent: #27c063;
  --btn: #23314f;
}

html.dark .sky-bg {
  background:
    radial-gradient(circle at 15% 18%, rgba(255, 195, 133, 0.55), transparent 36%),
    radial-gradient(circle at 64% 20%, rgba(255, 183, 128, 0.48), transparent 34%),
    linear-gradient(160deg, #1f7fca 0%, #1390da 32%, #1d95db 58%, #0d65ae 100%);
}

.haze {
  position: absolute;
  border-radius: 50%;
  filter: blur(45px);
  opacity: 0.5;
  animation: drift 12s ease-in-out infinite;
}

.haze-1 {
  width: 320px;
  height: 180px;
  background: rgba(255, 255, 255, 0.55);
  top: 10%;
  left: 8%;
}

.haze-2 {
  width: 360px;
  height: 200px;
  background: rgba(255, 230, 190, 0.4);
  top: 28%;
  right: 10%;
  animation-delay: -4s;
}

.haze-3 {
  width: 320px;
  height: 180px;
  background: rgba(255, 255, 255, 0.4);
  bottom: 12%;
  left: 42%;
  animation-delay: -8s;
}

.bg-cloud {
  position: absolute;
  width: 160px;
  height: 70px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.35);
  top: calc(8% + (var(--i) * 9%));
  left: calc(-220px - (var(--i) * 35px));
  animation: fly 50s linear infinite;
  animation-delay: calc(var(--i) * -5s);
}

.bg-cloud::before,
.bg-cloud::after {
  content: '';
  position: absolute;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.35);
}

.bg-cloud::before {
  width: 84px;
  height: 84px;
  top: -28px;
  left: 22px;
}

.bg-cloud::after {
  width: 96px;
  height: 96px;
  top: -20px;
  right: 20px;
}

.weather-shell {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 1100px;
  margin: 0 auto;
  padding: 20px;
  border-radius: 26px;
  background: rgba(6, 16, 34, 0.62);
  border: 1px solid var(--line);
  backdrop-filter: blur(14px);
  box-shadow: 0 12px 28px rgba(5, 17, 35, 0.12);
  animation: rise 0.55s ease;
  display: grid;
  gap: 0;
}

.chart-skeleton,
.chart-error {
  min-height: 280px;
  border-radius: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.78);
  background: rgba(255, 255, 255, 0.08);
  border: 1px dashed rgba(255, 255, 255, 0.12);
}

.chart-skeleton {
  animation: pulse 1.6s ease-in-out infinite;
}

.chart-error {
  padding: 24px;
  text-align: center;
}

.app-head {
  display: grid;
  grid-template-columns: 1fr;
  align-items: center;
  margin-bottom: 12px;
}

.hero-panel {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(14px);
  border: 1px solid var(--line);
  padding: 20px;
  border-radius: 14px;
  box-shadow: 0 8px 18px rgba(4, 13, 28, 0.08);
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.brand-mark {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  background: linear-gradient(145deg, #2a8fe0, #2ed67e);
  display: grid;
  place-items: center;
  font-weight: 800;
}

.brand h1 {
  margin: 0;
  font-size: 1.25rem;
}

.brand p {
  margin: 0;
  color: var(--muted);
  font-size: 0.88rem;
}

.controls {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 12px;
  align-items: center;
  margin-bottom: 18px;
}

.recent-searches {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.search-feedback {
  grid-column: 1 / -1;
}

.recent-chip {
  border: 1px solid var(--line);
  background: var(--glass-2);
  color: var(--text);
  border-radius: 999px;
  padding: 6px 10px;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
}

.search {
  padding: 14px 16px;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: var(--glass-2);
  color: var(--text);
  font-size: 1rem;
  outline: none;
}

.search::placeholder {
  color: var(--muted);
}

.search-btn {
  border: none;
  border-radius: 999px;
  padding: 12px 18px;
  background: var(--accent);
  color: #fff;
  font-weight: 700;
  cursor: pointer;
}

.unit-toggle {
  display: inline-flex;
  background: rgba(0, 0, 0, 0.26);
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 4px;
  gap: 4px;
}

.unit-btn {
  border: none;
  background: transparent;
  border-radius: 999px;
  color: var(--text);
  padding: 8px 12px;
  cursor: pointer;
  font-weight: 700;
}

.unit-btn.active {
  background: #2dcf73;
  color: #fff;
}

.empty-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 22px;
  border-radius: 22px;
  background: var(--glass);
  border: 1px solid var(--line);
}

.empty-card.empty-welcome {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 40px 32px;
  min-height: 320px;
}

.empty-card.empty-welcome .empty-welcome-content {
  max-width: 560px;
  width: 100%;
}

.empty-card.empty-welcome .empty-logo {
  margin: 0 0 14px;
  font-size: clamp(32px, 6vw, 48px);
  letter-spacing: -0.04em;
}

.empty-card.empty-welcome .empty-tagline {
  margin: 0 0 24px;
  color: rgba(255, 255, 255, 0.8);
  font-size: 1rem;
}

.empty-card.empty-welcome .empty-search-cta {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 16px;
}

.empty-card.empty-welcome .search {
  width: min(340px, 100%);
}

.empty-card.empty-welcome .search-pulse {
  animation: pulse-border 2.2s ease-in-out infinite;
  border-color: rgba(156, 163, 175, 0.8);
}

@keyframes pulse-border {

  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(255, 255, 255, 0);
  }

  50% {
    box-shadow: 0 0 0 8px rgba(255, 255, 255, 0.06);
  }
}

.empty-card h2 {
  margin: 0 0 6px;
}

.empty-card p {
  margin: 0;
  color: var(--muted);
}

.main-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
  margin-bottom: 20px;
}

.dashboard-top-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-bottom: 24px;
}

@media (max-width: 600px) {
  .dashboard-top-grid {
    grid-template-columns: 1fr;
  }
}

.dashboard-flow {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0;
  min-height: 200px;
}

.current-impact-section {
  min-height: 320px;
}

.dashboard-section {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 24px;
  align-items: stretch;
  padding: 24px 0;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.two-column-section {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.three-column-section {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.dashboard-card {
  min-width: 0;
}

@media (min-width: 601px) and (max-width: 900px) {
  .two-column-section {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .three-column-section {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 600px) {

  .dashboard-section,
  .two-column-section,
  .three-column-section {
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .horizontal-scroll-section {
    overflow: hidden;
  }
}

/* Shared Card Styling */
.dashboard-card {
  border-radius: 14px;
  backdrop-filter: blur(14px);
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.08);
  padding: 20px;
  height: 100%;
  overflow: hidden;
  box-shadow: 0 8px 18px rgba(5, 12, 30, 0.08);
}

.horizontal-scroll-section .dashboard-card {
  overflow-x: auto;
}

.horizontal-scroll-section .dashboard-card,
.hours-container,
.hourly-scroll {
  scrollbar-width: none;
}

.horizontal-scroll-section .dashboard-card::-webkit-scrollbar,
.hours-container::-webkit-scrollbar,
.hourly-scroll::-webkit-scrollbar {
  display: none;
}

.horizontal-scroll-section .dashboard-card,
.hours-container {
  position: relative;
}

.horizontal-scroll-section .dashboard-card::after,
.hours-container::after {
  content: '';
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  display: block;
  width: 42px;
  pointer-events: none;
  background: linear-gradient(90deg, rgba(9, 20, 42, 0), rgba(9, 20, 42, 0.7));
  z-index: 2;
}

.dashboard-flow {
  animation: weatherResultsIn 0.4s ease both;
}

/* Hint to compositor for animated transitions */
.dashboard-flow {
  will-change: opacity;
}

.panel-weather-copilot,
.panel-ai-forecast-intelligence {
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.13), rgba(120, 144, 255, 0.08));
  border-color: rgba(255, 255, 255, 0.12);
}

.weather-copilot-card,
.ai-forecast-card,
.hourly-decision-timeline {
  border-radius: 14px !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  padding: 20px !important;
  box-shadow: 0 8px 18px rgba(5, 12, 30, 0.08) !important;
}

.weather-copilot-card,
.ai-forecast-card {
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.13), rgba(120, 144, 255, 0.08)) !important;
}

.weather-copilot-card .ai-badge {
  position: absolute;
  top: 14px;
  right: 14px;
  z-index: 20;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  line-height: 1;
  border: 1px solid rgba(255, 255, 255, 0.4);
  border-radius: 999px;
  padding: 5px 8px;
  color: rgba(255, 255, 255, 0.9);
  background: rgba(255, 255, 255, 0.1);
}

.app-footer {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 4px;
  color: var(--muted);
  font-size: 0.88rem;
  text-align: center;
}

.app-footer span:first-child {
  color: var(--text);
  font-weight: 800;
}

/* Minimum Widths */
.current-weather,
.stability-ring {
  min-width: 0;
}

/* Forecast Row Scrolling */
.forecast-row {
  display: flex;
  gap: 12px;
  overflow-x: auto;
}

.current-card,
.cards-forecast {
  background: var(--glass);
  border: 1px solid var(--line);
  border-radius: 22px;
  padding: 24px;
}

.current-card {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  overflow: hidden;
}

.card-title {
  font-size: 1.05rem;
  letter-spacing: 0.01em;
  font-weight: 700;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.loading-indicator {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--muted);
  animation: softFade 1.2s ease-in-out infinite;
}

.detecting-location {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--muted);
}

.loading-spinner {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.35);
  border-top-color: var(--accent);
  animation: spin 0.75s linear infinite;
}

/* Only hint will-change for this small animated element */
.loading-spinner {
  will-change: transform;
}

.error-banner {
  margin-bottom: 12px;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid rgba(255, 107, 107, 0.35);
  background: rgba(255, 107, 107, 0.14);
  color: var(--text);
  font-weight: 600;
  font-size: 0.92rem;
}

.success-banner {
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid rgba(45, 207, 115, 0.35);
  background: rgba(45, 207, 115, 0.12);
  color: var(--text);
  font-weight: 600;
  font-size: 0.92rem;
}

html.dark .icon svg {
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
}

.main-weather-icon {
  font-size: 3rem;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
}

html.dark .main-weather-icon {
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
}

.hourly-card .icon {
  font-size: 1.5rem;
}

.current-layout {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
  order: 1;
  min-width: 0;
}

.current-meta {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.current-location {
  order: 1;
  margin: 0 0 4px;
  font-size: clamp(1.7rem, 2.4vw, 2.2rem);
  line-height: 1.1;
}

.current-condition {
  order: 2;
  margin: 0 0 2px;
  color: var(--muted);
  font-size: 0.98rem;
  font-weight: 500;
}

.current-temp {
  order: 3;
  margin: 10px 0 8px;
  font-size: clamp(2.6rem, 6vw, 4.1rem);
  line-height: 0.95;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.meta-line {
  order: 4;
  margin: 4px 0;
  color: var(--text);
}

.highlights {
  margin-top: 20px;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.hourly-forecast {
  margin-top: 14px;
  order: 3;
}

.hourly-title {
  font-size: 0.92rem;
  font-weight: 700;
  color: var(--muted);
  margin-bottom: 8px;
}

.hourly-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  padding: 4px 0;
}

@media (min-width: 768px) {
  .hourly-grid {
    grid-template-columns: repeat(6, 1fr);
    gap: 16px;
  }
}

.hourly-scroll {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  scroll-behavior: smooth;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  -ms-overflow-style: none;
  padding-bottom: 2px;
}

.hourly-scroll::-webkit-scrollbar {
  display: none;
}

.hourly-card {
  background: rgba(17, 44, 84, 0.5);
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 12px;
  display: grid;
  justify-items: center;
  text-align: center;
  gap: 6px;
  min-height: 100px;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.hourly-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.hourly-time,
.hourly-temp {
  margin: 0;
}

.hourly-time {
  font-size: 0.84rem;
  color: var(--muted);
  font-weight: 700;
}

.hourly-temp {
  font-size: 1rem;
  font-weight: 700;
}

.highlight {
  background: rgba(17, 44, 84, 0.5);
  border-radius: 14px;
  padding: 16px;
  display: grid;
  gap: 6px;
  text-align: center;
}

.mobile-low-priority {
  order: 2;
}

.highlight span {
  color: var(--muted);
  font-size: 0.82rem;
}

.highlight strong {
  font-size: 1.05rem;
}

.cards-forecast h3 {
  margin: 0 0 12px;
  font-size: 2rem;
  text-align: center;
}

.forecast-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding-top: 20px;
}

@media (min-width: 768px) {
  .forecast-grid {
    grid-template-columns: repeat(4, 1fr);
    gap: 20px;
  }
}

@media (min-width: 1024px) {
  .forecast-grid {
    grid-template-columns: repeat(7, 1fr);
    gap: 24px;
  }
}

.forecast-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 16px 8px;
  background: rgba(17, 44, 84, 0.3);
  border: 1px solid var(--line);
  border-radius: 14px;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.forecast-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.forecast-list {
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.forecast-row {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 56px;
  padding: 12px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.forecast-day {
  margin: 0;
  min-width: 44px;
  font-size: 0.92rem;
  font-weight: 700;
}

.forecast-icon svg {
  width: 22px;
  height: 22px;
}

.forecast-desc {
  margin: 0;
  font-size: 0.84rem;
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.forecast-temp {
  margin: 0 0 0 auto;
  font-size: 0.88rem;
  font-weight: 700;
  white-space: nowrap;
}

.temp-value {
  display: inline-block;
}

.icon svg {
  width: 34px;
  height: 34px;
}

.main-weather-icon svg {
  width: 180px;
  height: 135px;
  will-change: transform;
}

.main-weather-icon.is-clear svg {
  animation: iconClearRotate 16s linear infinite;
}

.main-weather-icon.is-clouds svg {
  animation: iconCloudFloat 4.6s ease-in-out infinite;
}

.main-weather-icon.is-rain svg {
  animation: iconRainDrop 1.35s ease-in-out infinite;
}

.main-weather-icon.is-thunderstorm svg {
  animation: iconStormPulse 4.8s ease-in-out infinite;
}

.main-weather-icon.is-snow svg {
  animation: iconSnowFall 4.4s ease-in-out infinite;
}

.main-weather-icon.is-drizzle svg {
  animation: iconDrizzleFloat 3.8s ease-in-out infinite;
}

.main-weather-icon.is-fog svg {
  animation: iconFogFade 3.2s ease-in-out infinite;
}

.sky-icon {
  width: 180px;
  height: 135px;
  position: relative;
}

.sun {
  width: 58px;
  height: 58px;
  border-radius: 50%;
  background: radial-gradient(circle at 30% 30%, #fff3b0, #ffb703 70%);
  position: absolute;
  top: 12px;
  right: 18px;
  box-shadow: 0 0 20px rgba(255, 183, 3, 0.65);
  animation: pulse 4s ease-in-out infinite;
}

.cloud {
  position: absolute;
  width: 96px;
  height: 42px;
  background: #dbe7ff;
  border-radius: 999px;
  top: 44px;
  left: 10px;
  box-shadow: 34px -12px 0 0 #dbe7ff;
  animation: float 6s ease-in-out infinite;
}

.cloud.c2 {
  width: 76px;
  height: 34px;
  top: 66px;
  left: 44px;
  opacity: 0.82;
  animation-delay: -2s;
}

.rain {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.drop {
  position: absolute;
  width: 3px;
  height: 11px;
  background: #4fc3f7;
  border-radius: 999px;
  left: calc(8px + (var(--i) * 13px));
  top: 84px;
  animation: fall 1.25s linear infinite;
  animation-delay: calc(var(--i) * -0.14s);
  opacity: 0.7;
}

@keyframes pulse {

  0%,
  100% {
    transform: scale(1);
  }

  50% {
    transform: scale(1.08);
  }
}

@keyframes float {

  0%,
  100% {
    transform: translateX(0);
  }

  50% {
    transform: translateX(8px);
  }
}

@keyframes fall {
  0% {
    transform: translateY(0);
    opacity: 0.65;
  }

  100% {
    transform: translateY(18px);
    opacity: 0;
  }
}

@keyframes fly {
  0% {
    transform: translateX(0);
  }

  100% {
    transform: translateX(calc(100vw + 520px));
  }
}

@keyframes drift {

  0%,
  100% {
    transform: translateY(0);
  }

  50% {
    transform: translateY(14px);
  }
}

@keyframes rise {
  from {
    opacity: 0;
    transform: translateY(10px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes weatherRain {
  0% {
    transform: translate3d(0, -20px, 0) rotate(12deg);
    opacity: 0;
  }

  10% {
    opacity: 0.6;
  }

  100% {
    transform: translate3d(14px, calc(100vh + 20px), 0) rotate(12deg);
    opacity: 0;
  }
}

@keyframes weatherSnow {
  0% {
    transform: translate3d(0, -14px, 0);
  }

  50% {
    transform: translate3d(12px, 48vh, 0);
  }

  100% {
    transform: translate3d(-8px, 105vh, 0);
  }
}

@keyframes weatherTwinkle {

  0%,
  100% {
    opacity: 0.35;
  }

  50% {
    opacity: 1;
  }
}

@keyframes weatherLightning {

  0%,
  92%,
  100% {
    opacity: 0;
  }

  93% {
    opacity: 0.34;
  }

  94% {
    opacity: 0.06;
  }

  95% {
    opacity: 0.42;
  }

  96% {
    opacity: 0;
  }
}

@keyframes iconClearRotate {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

@keyframes iconCloudFloat {

  0%,
  100% {
    transform: translateY(0);
  }

  50% {
    transform: translateY(-6px);
  }
}

@keyframes iconRainDrop {

  0%,
  100% {
    transform: translateY(0);
    filter: drop-shadow(0 0 0 rgba(79, 195, 247, 0));
  }

  50% {
    transform: translateY(5px);
    filter: drop-shadow(0 8px 4px rgba(79, 195, 247, 0.2));
  }
}

@keyframes iconStormPulse {

  0%,
  84%,
  100% {
    transform: scale(1);
    filter: brightness(1);
  }

  86% {
    transform: scale(1.03);
    filter: brightness(1.5);
  }

  88% {
    transform: scale(1);
    filter: brightness(1.1);
  }

  90% {
    transform: scale(1.04);
    filter: brightness(1.6);
  }
}

@keyframes iconSnowFall {
  0% {
    transform: translateY(-3px);
  }

  50% {
    transform: translateY(4px);
  }

  100% {
    transform: translateY(-2px);
  }
}

@keyframes iconDrizzleFloat {

  0%,
  100% {
    transform: translateY(0);
  }

  50% {
    transform: translateY(3px);
  }
}

@keyframes iconFogFade {

  0%,
  100% {
    opacity: 0.95;
  }

  50% {
    opacity: 0.68;
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes softFade {

  0%,
  100% {
    opacity: 0.7;
  }

  50% {
    opacity: 1;
  }
}

.fade-update-enter-active,
.fade-update-leave-active {
  transition: opacity 0.28s ease;
}

.fade-update-enter-from,
.fade-update-leave-to {
  opacity: 0;
}

.fade-error-enter-active,
.fade-error-leave-active {
  transition: opacity 0.28s ease;
}

.fade-error-enter-from,
.fade-error-leave-to {
  opacity: 0;
}

.weather-swap-enter-active,
.weather-swap-leave-active {
  transition: opacity 0.3s ease;
}

.weather-swap-enter-from,
.weather-swap-leave-to {
  opacity: 0;
}

.temp-change-enter-active,
.temp-change-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}

.temp-change-enter-from,
.temp-change-leave-to {
  opacity: 0;
  transform: translateY(4px);
}

@media (max-width: 1080px) {
  .main-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 600px) {
  .app {
    padding-top: calc(10px + env(safe-area-inset-top));
    padding-right: env(safe-area-inset-right);
    padding-bottom: calc(80px + env(safe-area-inset-bottom));
    padding-left: env(safe-area-inset-left);
  }

  .weather-shell {
    padding: 12px 0;
    border-radius: 18px;
    max-width: 100%;
  }

  .hero-panel {
    padding-top: 14px;
    padding-bottom: 14px;
    border-radius: 12px;
  }

  .controls {
    grid-template-columns: 1fr;
  }

  .search {
    width: 100%;
  }

  .search-btn {
    width: 100%;
  }

  .unit-toggle {
    width: 100%;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .unit-btn {
    min-height: 44px;
  }

  .current-layout {
    grid-template-columns: 1fr;
  }

  .sky-icon {
    margin: 0 auto;
  }

  .highlights {
    grid-template-columns: 1fr;
    gap: 8px;
    margin-top: 10px;
  }

  .highlight {
    padding: 8px;
  }

  .highlight strong {
    font-size: 0.98rem;
  }

  .controls {
    margin-bottom: 12px;
  }

  .main-grid {
    gap: 12px;
    margin-bottom: 12px;
  }

  .current-card,
  .cards-forecast,
  .dashboard-card {
    padding: 14px;
    max-width: 100%;
    overflow-x: hidden;
  }

  .horizontal-scroll-section .dashboard-card {
    overflow-x: auto;
  }

  .hourly-decision-timeline {
    padding: 14px !important;
  }

  .weather-copilot-card,
  .ai-forecast-card {
    padding: 14px !important;
  }

  .hourly-decision-timeline>div {
    gap: 8px !important;
  }

  .hourly-decision-timeline article {
    min-width: calc((100% - 16px) / 3) !important;
    padding: 8px !important;
  }

  .current-location {
    order: 3;
    font-size: 1.5rem;
    margin-bottom: 2px;
  }

  .current-condition {
    order: 2;
    font-size: 0.9rem;
  }

  .current-temp {
    order: 1;
    font-size: clamp(2.2rem, 12vw, 3.2rem);
    margin: 8px 0 6px;
  }

  .meta-line {
    font-size: 0.9rem;
  }

  .cards-forecast h3 {
    font-size: 1.5rem;
  }

  .cards-forecast {
    border-radius: 16px;
  }

  .hourly-forecast {
    margin-top: 10px;
    order: 2;
  }

  .mobile-low-priority {
    order: 3;
  }

  .hourly-scroll {
    max-height: 132px;
  }

  .hourly-card {
    min-width: 86px;
    padding: 8px;
    gap: 3px;
  }

  .hourly-time {
    font-size: 0.75rem;
  }

  .hourly-temp {
    font-size: 0.9rem;
  }

  .forecast-row {
    min-height: 52px;
    padding: 8px 0;
    gap: 8px;
  }

  .forecast-day {
    min-width: 40px;
    font-size: 0.84rem;
  }

  .forecast-icon svg {
    width: 18px;
    height: 18px;
  }

  .forecast-desc {
    font-size: 0.78rem;
  }

  .forecast-temp {
    font-size: 0.8rem;
  }
}

/* Mobile-specific optimizations */
@media (max-width: 600px) {

  .dashboard-card,
  .weather-shell,
  .hero-panel {
    -webkit-backdrop-filter: blur(6px);
    backdrop-filter: blur(6px);
  }

  /* Reduce or disable heavy animations on mobile */
}

@media (max-width: 600px) and (prefers-reduced-motion: no-preference) {
  .main-weather-icon.is-clear svg {
    animation-duration: 30s;
  }

  .haze-1,
  .haze-2,
  .haze-3 {
    animation: none !important;
  }

  .bg-cloud {
    animation: none !important;
  }
}

/* Promote GPU compositing for scrollable containers */
.horizontal-scroll-section .dashboard-card,
.hourly-scroll {
  transform: translateZ(0);
}

/* Defer rendering of below-fold heavy sections */
.seven-day-section,
.weather-trends-chart-section {
  content-visibility: auto;
  contain-intrinsic-size: 0 400px;
}

.dashboard-card h3,
.current-weather-card h3,
.weather-impact-card h3,
.weather-copilot-card h3,
.ai-forecast-card h3,
.next-12-hours h3,
.hourly-decision-timeline h3,
.activity-recommendations h3,
.weather-risk-alerts-card h3,
.demand-forecast-card h3,
.seven-day-forecast-card h3,
.weather-trends-card h3,
.cards-forecast h3 {
  font-size: 16px !important;
  font-weight: 500 !important;
  letter-spacing: 0.015em !important;
}

.stat-label,
.factor-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: rgba(255, 255, 255, 0.62);
}

.stat-value,
.factor-value {
  font-size: 15px;
  font-weight: 600;
  color: white;
}

@keyframes weatherResultsIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (min-width: 1024px) {
  .current-layout {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 24px;
  }
}

@media (max-width: 520px) {
  .hourly-scroll {
    max-height: 122px;
  }

  .cards-forecast {
    border-radius: 14px;
  }
}

html,
body,
#app {
  overflow-x: hidden;
  width: 100%;
}
</style>
