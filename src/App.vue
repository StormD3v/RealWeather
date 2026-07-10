<template>
  <div class="app">
    <WeatherBackground :condition="store.currentCondition" :icon="store.currentIcon" />

    <div class="weather-shell">
      <!-- ── Header panel ── -->
      <section class="hero-panel">
        <header class="app-head">
          <div class="brand">
            <div class="brand-mark" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <circle cx="10" cy="10" r="5" fill="white" opacity="0.9"/>
                <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.34 4.34l1.42 1.42M14.24 14.24l1.42 1.42M4.34 15.66l1.42-1.42M14.24 5.76l1.42-1.42" stroke="white" stroke-width="1.5" stroke-linecap="round" opacity="0.75"/>
              </svg>
            </div>
            <div>
              <h1 class="brand-name">LumiCast</h1>
              <p class="brand-tagline">Live conditions and forecast</p>
            </div>
          </div>
          <div class="header-actions">
            <button
              type="button"
              class="theme-toggle-btn"
              :aria-label="`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`"
              @click="toggleTheme"
            >
              <span v-if="resolvedTheme === 'dark'" aria-hidden="true">☀️</span>
              <span v-else aria-hidden="true">🌙</span>
            </button>
          </div>
        </header>

        <div class="controls">
          <div class="search-row">
            <div class="search-wrapper">
              <span class="search-icon" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" stroke-width="1.5"/>
                  <path d="M10.5 10.5L14 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                </svg>
              </span>
              <input
                class="search-input"
                :class="{ 'search-pulse': !hasSearchedCity && !store.loading }"
                type="search"
                autocomplete="off"
                autocorrect="off"
                spellcheck="false"
                placeholder="Search any city worldwide..."
                aria-label="Search city"
                v-model="cityInput"
                @keyup.enter="submitSearch"
              />
            </div>
            <button class="search-btn" @click="submitSearch" aria-label="Search">
              Search
            </button>
            <button
              type="button"
              class="unit-btn"
              :aria-label="`Temperature unit: ${useCelsius ? 'Celsius' : 'Fahrenheit'}. Click to switch.`"
              @click="toggleUnit"
            >
              {{ useCelsius ? '°C' : '°F' }}
            </button>
          </div>

          <div class="controls-row">
            <WeatherSourceBadge :source="store.lastSource" :timestamp="store.lastUpdatedAt" />
          </div>

          <UserProfileSelector @profile-changed="handleProfileChanged" />
          <SavedLocations @load-location="runCitySearch" />
          <SearchHistory :history="searchHistory" @select="searchFromHistory" />

          <SearchFeedback
            :detecting-location="detectingLocation"
            :loading="store.loading"
            :error="store.error"
            :success-message="searchSuccessMessage"
          />
        </div>
      </section>

      <!-- ── Empty / loading / error states ── -->
      <EmptyState
        :loading="store.loading"
        :has-weather="!!store.currentWeather"
        :error="store.error"
        :geolocation-denied="geolocationDenied"
        :city-input="cityInput"
        @search="submitSearch"
        @update:city-input="cityInput = $event"
      />

      <!-- ── Dashboard ── -->
      <WeatherDashboard v-if="store.currentWeather" :user-profile="userProfile" />
    </div>

    <NotificationPrompt />
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onErrorCaptured, onMounted, ref, watch } from 'vue'

import { useWeatherStore }        from '@/stores/weather'
import { useTemperatureUnit }     from '@/composables/useWeatherFormatters'
import { useCitySearch }          from '@/composables/useCitySearch'
import { useGeolocationSearch }   from '@/composables/useGeolocationSearch'
import { setFaviconFromWeather }  from '@/composables/useWeatherFavicon'
import { scheduleWeatherAlerts, schedulePreDepartureAlert } from '@/composables/useWeatherNotifications'
import { useInsightEngine }       from '@/composables/useInsightEngine'
import { useBehavioralSignals }   from '@/composables/useBehavioralSignals'
import { useUserContext }         from '@/composables/useUserContext'
import { useTheme }               from '@/composables/useTheme'

import SearchHistory       from '@/components/layout/SearchHistory.vue'
import SearchFeedback      from '@/components/layout/SearchFeedback.vue'
import EmptyState          from '@/components/layout/EmptyState.vue'
import WeatherDashboard    from '@/components/layout/WeatherDashboard.vue'

import WeatherBackground   from '@/components/weather/WeatherBackground.vue'
import WeatherSourceBadge  from '@/components/weather/WeatherSourceBadge.vue'
import NotificationPrompt  from '@/components/weather/NotificationPrompt.vue'
import UserProfileSelector from '@/components/ui/UserProfileSelector.vue'
import SavedLocations      from '@/components/ui/SavedLocations.vue'

// ── Store & composables ──────────────────────────────────────────────────────
const store = useWeatherStore()
const { useCelsius, toggleUnit } = useTemperatureUnit()
const { resolvedTheme, toggleTheme, initTheme } = useTheme()
const { insights } = useInsightEngine()
const { recordAppOpen } = useBehavioralSignals()
const { userContext } = useUserContext()
const {
  cityInput,
  hasSearchedCity,
  lastSearchedCity,
  searchHistory,
  loadHistory,
  submitSearch,
  searchFromHistory,
  runCitySearch,
  clearDebounce
} = useCitySearch()
const { detectingLocation, geolocationDenied, requestInitialWeather } = useGeolocationSearch()

// ── User profile ─────────────────────────────────────────────────────────────
const userProfile = ref('general')
function handleProfileChanged(profile) {
  userProfile.value = profile || 'general'
}

// ── Derived UI state ──────────────────────────────────────────────────────────
const searchSuccessMessage = computed(() => {
  if (!hasSearchedCity.value || store.loading || store.error || !store.currentWeather) return ''
  const name = store.currentWeather?.name || lastSearchedCity.value
  return name ? `Weather loaded for ${name}.` : ''
})

// ── Connectivity ──────────────────────────────────────────────────────────────
function handleOnline() {
  if (!store.currentWeather) {
    requestInitialWeather((name) => {
      cityInput.value = name
      hasSearchedCity.value = true
      lastSearchedCity.value = name
    })
  }
}

// ── Lifecycle ────────────────────────────────────────────────────────────────
onErrorCaptured(() => false)

onMounted(() => {
  initTheme()
  loadHistory()
  recordAppOpen()
  requestInitialWeather((name) => {
    cityInput.value = name
    hasSearchedCity.value = true
    lastSearchedCity.value = name
  })
  window.addEventListener('online', handleOnline)
})

onBeforeUnmount(() => {
  clearDebounce()
  document.body.style.overflow = ''
  window.removeEventListener('online', handleOnline)
})

// ── Watchers ─────────────────────────────────────────────────────────────────
watch(() => store.currentCondition, setFaviconFromWeather, { immediate: true })

watch(
  () => store.currentWeather,
  () => {
    if (import.meta.env.DEV) {
      console.group('[LumiCast]')
      console.log('Weather loaded:', store.currentWeather?.name)
      console.log('Source:', store.lastSource)
      console.groupEnd()
    }
  }
)

watch(
  () => store.hourlyForecast,
  (forecast) => {
    if (store.currentWeather && !store.loading && Array.isArray(forecast) && forecast.length) {
      // Phase 3.3+: pass InsightSet as first arg, hourlyForecast as fallback
      scheduleWeatherAlerts(insights.value, forecast)

      // Phase 3.4: pre-departure briefing notification
      const ctx = userContext.value
      schedulePreDepartureAlert(
        insights.value,
        ctx?.routines?.weekday?.departureTime ?? null,
        ctx?.preferences?.notifications ?? null
      )
    }
  },
  { immediate: true }
)
</script>

<style>
/* ══════════════════════════════════════════════════════════════════════════
   APP ROOT
   ══════════════════════════════════════════════════════════════════════════ */
.app {
  min-height: 100svh;
  position: relative;
  overflow-x: hidden;
  overflow-y: visible;
  color: var(--lc-text-primary);
  font-family: var(--lc-font-family);
  background: var(--lc-bg);
  padding-top: calc(var(--lc-sp-4) + env(safe-area-inset-top));
  padding-right: calc(var(--lc-sp-4) + env(safe-area-inset-right));
  padding-bottom: calc(var(--lc-sp-6) + env(safe-area-inset-bottom));
  padding-left: calc(var(--lc-sp-4) + env(safe-area-inset-left));
  transition: background-color var(--lc-transition-theme), color var(--lc-transition-theme);
}

/* ── Shell ─────────────────────────────────────────────────────────────── */
.weather-shell {
  position: relative;
  z-index: var(--lc-z-shell);
  width: 100%;
  max-width: 1100px;
  margin: 0 auto;
  padding: var(--lc-sp-5);
  border-radius: var(--lc-radius-3xl);
  background: var(--lc-surface-shell);
  border: 1px solid var(--lc-border-glass);
  backdrop-filter: var(--lc-blur-md);
  -webkit-backdrop-filter: var(--lc-blur-md);
  box-shadow: var(--lc-shadow-hover);
  animation: appRise var(--lc-duration-slower) var(--lc-ease-out) both;
  display: grid;
  gap: 0;
}

/* ── Hero / Header panel ───────────────────────────────────────────────── */
.hero-panel {
  background: var(--lc-surface-overlay);
  backdrop-filter: var(--lc-blur-md);
  -webkit-backdrop-filter: var(--lc-blur-md);
  border: 1px solid var(--lc-border-glass);
  padding: var(--lc-sp-5);
  border-radius: var(--lc-radius-lg);
  box-shadow: var(--lc-shadow-glass);
  margin-bottom: 0;
}

/* ── App head (logo row) ───────────────────────────────────────────────── */
.app-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--lc-sp-4);
}

.brand {
  display: flex;
  align-items: center;
  gap: var(--lc-sp-3);
}

.brand-mark {
  width: 38px;
  height: 38px;
  border-radius: var(--lc-radius-md);
  background: linear-gradient(145deg, #2a8fe0, #27c063);
  display: grid;
  place-items: center;
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(39, 192, 99, 0.35);
}

.brand-name {
  margin: 0;
  font-size: var(--lc-text-h2);
  font-weight: var(--lc-weight-bold);
  color: var(--lc-text-primary);
  letter-spacing: var(--lc-tracking-tight);
  line-height: var(--lc-leading-tight);
}

.brand-tagline {
  margin: 2px 0 0;
  font-size: var(--lc-text-caption);
  color: var(--lc-text-muted);
  font-weight: var(--lc-weight-medium);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: var(--lc-sp-2);
}

.theme-toggle-btn {
  width: 40px;
  height: 40px;
  min-height: 40px;
  border: 1px solid var(--lc-border-glass);
  background: var(--lc-surface-overlay);
  border-radius: var(--lc-radius-pill);
  display: grid;
  place-items: center;
  cursor: pointer;
  font-size: 1rem;
  transition: background var(--lc-transition-hover), border-color var(--lc-transition-hover),
              transform var(--lc-transition-hover);
  line-height: 1;
}

.theme-toggle-btn:hover {
  background: var(--lc-surface-hover);
  transform: scale(1.05);
}

/* ── Controls ──────────────────────────────────────────────────────────── */
.controls {
  display: flex;
  flex-direction: column;
  gap: var(--lc-sp-3);
}

.search-row {
  display: flex;
  gap: var(--lc-sp-2);
  align-items: center;
}

.search-wrapper {
  position: relative;
  flex: 1;
  min-width: 0;
}

.search-icon {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--lc-text-muted);
  pointer-events: none;
  display: flex;
  align-items: center;
  z-index: 1;
}

.search-input {
  width: 100%;
  padding: 13px 16px 13px 40px;
  border-radius: var(--lc-radius-pill);
  border: 1.5px solid var(--lc-border-glass);
  background: var(--lc-surface-overlay);
  color: var(--lc-text-primary);
  font-size: var(--lc-text-body);
  font-family: var(--lc-font-family);
  outline: none;
  transition: border-color var(--lc-transition-hover), background var(--lc-transition-hover),
              box-shadow var(--lc-transition-hover);
  min-height: 48px;
  backdrop-filter: var(--lc-blur-sm);
  -webkit-backdrop-filter: var(--lc-blur-sm);
}

.search-input::placeholder { color: var(--lc-text-muted); }

.search-input:hover {
  border-color: var(--lc-border-strong);
  background: var(--lc-surface-hover);
}

.search-input:focus {
  border-color: var(--lc-accent);
  background: var(--lc-surface-active);
  box-shadow: 0 0 0 3px var(--lc-accent-subtle);
}

/* search-pulse: subtle attention animation when no city is searched */
.search-pulse {
  animation: searchPulse 2.8s var(--lc-ease) infinite;
}

.search-btn {
  flex-shrink: 0;
  height: 48px;
  min-height: 48px;
  padding: 0 var(--lc-sp-5);
  border: none;
  border-radius: var(--lc-radius-pill);
  background: var(--lc-accent);
  color: var(--lc-text-on-accent);
  font-size: var(--lc-text-body-sm);
  font-weight: var(--lc-weight-bold);
  font-family: var(--lc-font-family);
  cursor: pointer;
  transition: background var(--lc-transition-hover), transform var(--lc-transition-hover),
              box-shadow var(--lc-transition-hover);
  white-space: nowrap;
  letter-spacing: 0.01em;
}

.search-btn:hover {
  background: var(--lc-accent-hover);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.35);
}

html.dark .search-btn:hover {
  box-shadow: 0 4px 12px rgba(39, 192, 99, 0.35);
}

.search-btn:active { transform: translateY(0); }

.unit-btn {
  flex-shrink: 0;
  height: 48px;
  min-height: 48px;
  width: 52px;
  border: 1.5px solid var(--lc-border-glass);
  border-radius: var(--lc-radius-pill);
  background: var(--lc-surface-overlay);
  color: var(--lc-text-primary);
  font-size: var(--lc-text-body-sm);
  font-weight: var(--lc-weight-bold);
  font-family: var(--lc-font-family);
  cursor: pointer;
  transition: background var(--lc-transition-hover), border-color var(--lc-transition-hover),
              transform var(--lc-transition-hover);
}

.unit-btn:hover {
  background: var(--lc-surface-hover);
  border-color: var(--lc-accent);
  transform: scale(1.04);
}

.controls-row {
  display: flex;
  align-items: center;
  gap: var(--lc-sp-2);
  flex-wrap: wrap;
}

/* ── Feedback states ───────────────────────────────────────────────────── */
.loading-indicator {
  display: inline-flex;
  align-items: center;
  gap: var(--lc-sp-2);
  font-size: var(--lc-text-caption);
  font-weight: var(--lc-weight-semibold);
  color: var(--lc-text-muted);
  animation: softFade 1.4s var(--lc-ease) infinite;
}

.detecting-location {
  display: inline-flex;
  align-items: center;
  gap: var(--lc-sp-2);
  font-size: var(--lc-text-caption);
  font-weight: var(--lc-weight-semibold);
  color: var(--lc-text-muted);
}

.loading-spinner {
  will-change: transform;
  width: 14px;
  height: 14px;
  min-height: 14px;
  border-radius: var(--lc-radius-full);
  border: 2px solid var(--lc-border-glass);
  border-top-color: var(--lc-accent);
  animation: spin 0.7s linear infinite;
}

.error-banner {
  padding: var(--lc-sp-3) var(--lc-sp-4);
  border-radius: var(--lc-radius-md);
  border: 1px solid rgba(239, 68, 68, 0.3);
  background: var(--lc-error-subtle);
  color: var(--lc-text-primary);
  font-weight: var(--lc-weight-semibold);
  font-size: var(--lc-text-body-sm);
}

.success-banner {
  padding: var(--lc-sp-3) var(--lc-sp-4);
  border-radius: var(--lc-radius-md);
  border: 1px solid rgba(39, 192, 99, 0.3);
  background: var(--lc-green-subtle);
  color: var(--lc-text-primary);
  font-weight: var(--lc-weight-semibold);
  font-size: var(--lc-text-body-sm);
}

/* ── Empty states ──────────────────────────────────────────────────────── */
.empty-card {
  display: flex;
  align-items: center;
  gap: var(--lc-sp-4);
  padding: var(--lc-sp-6);
  border-radius: var(--lc-radius-2xl);
  background: var(--lc-surface);
  border: 1px solid var(--lc-border);
  margin-top: var(--lc-sp-4);
}

.empty-card.empty-welcome {
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: var(--lc-sp-10) var(--lc-sp-8);
  min-height: 340px;
}

.empty-welcome-content { max-width: 560px; width: 100%; }

.empty-logo {
  margin: 0 0 var(--lc-sp-4);
  font-size: clamp(2rem, 6vw, 3rem);
  font-weight: var(--lc-weight-extrabold);
  letter-spacing: var(--lc-tracking-tight);
  color: var(--lc-text-primary);
  background: linear-gradient(135deg, #a8d8ff, #27c063);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.empty-tagline {
  margin: 0 0 var(--lc-sp-6);
  color: var(--lc-text-muted);
  font-size: var(--lc-text-body);
  font-weight: var(--lc-weight-medium);
}

.empty-search-cta {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: var(--lc-sp-3);
  margin-bottom: var(--lc-sp-4);
}

.empty-search-cta .search-input { width: min(340px, 100%); }
.empty-card h2 { margin: 0 0 var(--lc-sp-2); color: var(--lc-text-primary); }
.empty-card p  { margin: 0; color: var(--lc-text-muted); }

/* ── Dashboard flow ────────────────────────────────────────────────────── */
.dashboard-flow {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0;
  animation: dashboardIn var(--lc-duration-slow) var(--lc-ease-out) both;
}

.dashboard-section {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--lc-sp-6);
  align-items: stretch;
  padding: var(--lc-sp-6) 0;
  border-top: 1px solid var(--lc-border-subtle);
}

.two-column-section   { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.three-column-section { grid-template-columns: repeat(3, minmax(0, 1fr)); }

/* ── Dashboard cards ───────────────────────────────────────────────────── */
.dashboard-card {
  min-width: 0;
  border-radius: var(--lc-radius-lg);
  backdrop-filter: var(--lc-blur-md);
  -webkit-backdrop-filter: var(--lc-blur-md);
  background: var(--lc-surface-card);
  border: 1px solid var(--lc-border-glass);
  padding: var(--lc-sp-5);
  height: 100%;
  overflow: hidden;
  box-shadow: var(--lc-shadow-glass);
  transition: box-shadow var(--lc-transition-base);
}

/* card headings — uniform across all cards */
.dashboard-card h3 {
  margin: 0 0 var(--lc-sp-5) 0;
  font-size: var(--lc-text-h3) !important;
  font-weight: var(--lc-weight-semibold) !important;
  color: var(--lc-text-primary);
  letter-spacing: var(--lc-tracking-normal) !important;
  line-height: var(--lc-leading-tight);
}

/* Scroll sections */
.horizontal-scroll-section .dashboard-card { overflow-x: auto; }
.horizontal-scroll-section .dashboard-card,
.hours-container,
.hourly-scroll { scrollbar-width: none; transform: translateZ(0); }
.horizontal-scroll-section .dashboard-card::-webkit-scrollbar,
.hours-container::-webkit-scrollbar,
.hourly-scroll::-webkit-scrollbar { display: none; }
.horizontal-scroll-section .dashboard-card,
.hours-container { position: relative; }
.horizontal-scroll-section .dashboard-card::after,
.hours-container::after {
  content: '';
  position: absolute;
  right: 0; top: 0; bottom: 0;
  width: 40px;
  pointer-events: none;
  background: linear-gradient(90deg, transparent, var(--lc-scroll-fade));
  z-index: 2;
}

/* AI Copilot accent */
.panel-weather-copilot {
  background: linear-gradient(145deg, var(--lc-surface-overlay), rgba(100,120,255,0.05)) !important;
  border-color: var(--lc-border-glass) !important;
}

html.light .panel-weather-copilot {
  background: linear-gradient(145deg, rgba(29,82,216,0.06), rgba(255,255,255,0.85)) !important;
  border-color: rgba(29,82,216,0.18) !important;
}

/* override copilot/timeline self-styling to align with card system */
.weather-copilot-card,
.hourly-decision-timeline {
  border-radius: var(--lc-radius-lg) !important;
  border: 1px solid var(--lc-border-glass) !important;
  padding: var(--lc-sp-5) !important;
  box-shadow: var(--lc-shadow-glass) !important;
}

.weather-copilot-card {
  background: linear-gradient(145deg, var(--lc-surface-overlay), rgba(100,120,255,0.05)) !important;
}

html.light .weather-copilot-card {
  background: linear-gradient(145deg, rgba(29,82,216,0.06), rgba(255,255,255,0.85)) !important;
  border-color: rgba(29,82,216,0.18) !important;
}

/* Chart async fallbacks */
.chart-skeleton, .chart-error {
  min-height: 260px;
  border-radius: var(--lc-radius-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--lc-text-muted);
  background: var(--lc-surface-overlay);
  border: 1px dashed var(--lc-border-subtle);
}
.chart-skeleton { animation: shimmerPulse 1.8s var(--lc-ease) infinite; }
.chart-error { padding: var(--lc-sp-6); text-align: center; font-size: var(--lc-text-body-sm); }

/* Stat / factor shared labels */
.stat-label, .factor-label {
  font-size: var(--lc-text-label);
  text-transform: uppercase;
  letter-spacing: var(--lc-tracking-wider);
  color: var(--lc-text-muted);
  font-weight: var(--lc-weight-semibold);
}
.stat-value, .factor-value {
  font-size: var(--lc-text-body-sm);
  font-weight: var(--lc-weight-semibold);
  color: var(--lc-text-primary);
}

/* Meta / misc */
.meta-line { margin: var(--lc-sp-1) 0; color: var(--lc-text-muted); font-size: var(--lc-text-caption); }

/* Footer */
.app-footer {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--lc-sp-1);
  color: var(--lc-text-muted);
  font-size: var(--lc-text-caption);
  text-align: center;
  padding: var(--lc-sp-4) 0 var(--lc-sp-2);
}
.app-footer span:first-child {
  color: var(--lc-text-secondary);
  font-weight: var(--lc-weight-bold);
  letter-spacing: var(--lc-tracking-wide);
}

/* Recent search chips */
.recent-searches {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  gap: var(--lc-sp-2);
}

.recent-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--lc-sp-1);
  border: 1px solid var(--lc-border-glass);
  background: var(--lc-surface-overlay);
  color: var(--lc-text-secondary);
  border-radius: var(--lc-radius-pill);
  padding: 5px var(--lc-sp-3);
  font-size: var(--lc-text-label);
  font-weight: var(--lc-weight-semibold);
  cursor: pointer;
  min-height: 32px;
  transition: background var(--lc-transition-hover), border-color var(--lc-transition-hover),
              transform var(--lc-transition-hover);
}

.recent-chip:hover {
  background: var(--lc-surface-hover);
  border-color: var(--lc-accent);
  transform: translateY(-1px);
}

/* Icon animations */
.main-weather-icon svg { width: 180px; height: 135px; will-change: transform; }
.main-weather-icon.is-clear svg       { animation: iconClearRotate 16s linear infinite; }
.main-weather-icon.is-clouds svg      { animation: iconCloudFloat 4.6s var(--lc-ease) infinite; }
.main-weather-icon.is-rain svg        { animation: iconRainDrop 1.35s var(--lc-ease) infinite; }
.main-weather-icon.is-thunderstorm svg{ animation: iconStormPulse 4.8s var(--lc-ease) infinite; }
.main-weather-icon.is-snow svg        { animation: iconSnowFall 4.4s var(--lc-ease) infinite; }
.main-weather-icon.is-drizzle svg     { animation: iconDrizzleFloat 3.8s var(--lc-ease) infinite; }
.main-weather-icon.is-fog svg         { animation: iconFogFade 3.2s var(--lc-ease) infinite; }

/* Performance hints */
.seven-day-section, .weather-trends-chart-section {
  content-visibility: auto;
  contain-intrinsic-size: 0 400px;
}

/* ── Keyframes ──────────────────────────────────────────────────────────── */
@keyframes appRise {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes dashboardIn {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes searchPulse {
  0%, 100% { box-shadow: 0 0 0 0 transparent; }
  50%       { box-shadow: 0 0 0 6px var(--lc-accent-subtle); }
}
@keyframes shimmerPulse {
  0%, 100% { opacity: 0.5; }
  50%       { opacity: 1; }
}
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes softFade { 0%, 100% { opacity: 0.6; } 50% { opacity: 1; } }
@keyframes iconClearRotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
@keyframes iconCloudFloat  { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
@keyframes iconRainDrop {
  0%, 100% { transform: translateY(0); }
  50%       { transform: translateY(5px); }
}
@keyframes iconStormPulse {
  0%, 84%, 100% { transform: scale(1); filter: brightness(1); }
  86% { transform: scale(1.03); filter: brightness(1.5); }
  90% { transform: scale(1.04); filter: brightness(1.6); }
}
@keyframes iconSnowFall   { 0% { transform: translateY(-3px); } 50% { transform: translateY(4px); } 100% { transform: translateY(-2px); } }
@keyframes iconDrizzleFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(3px); } }
@keyframes iconFogFade    { 0%, 100% { opacity: 0.95; } 50% { opacity: 0.65; } }

/* ── Responsive ──────────────────────────────────────────────────────────── */
@media (min-width: 601px) and (max-width: 900px) {
  .two-column-section   { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .three-column-section { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 600px) {
  .app {
    padding-top: calc(var(--lc-sp-3) + env(safe-area-inset-top));
    padding-right: env(safe-area-inset-right);
    padding-bottom: calc(80px + env(safe-area-inset-bottom));
    padding-left: env(safe-area-inset-left);
  }
  .weather-shell { padding: var(--lc-sp-3) 0; border-radius: var(--lc-radius-xl); }
  .hero-panel { padding: var(--lc-sp-4); border-radius: var(--lc-radius-md); }
  .search-row { flex-wrap: wrap; }
  .search-wrapper { width: 100%; order: 0; }
  .search-btn { flex: 1; }
  .unit-btn { width: 52px; }
  .dashboard-section,
  .two-column-section,
  .three-column-section { grid-template-columns: 1fr; gap: var(--lc-sp-4); }
  .horizontal-scroll-section { overflow: hidden; }
  .dashboard-card { padding: var(--lc-sp-4); overflow-x: hidden; }
  .horizontal-scroll-section .dashboard-card { overflow-x: auto; }
  .hourly-decision-timeline { padding: var(--lc-sp-4) !important; }
  .weather-copilot-card { padding: var(--lc-sp-4) !important; }
}

html, body, #app { overflow-x: hidden; width: 100%; }
</style>
