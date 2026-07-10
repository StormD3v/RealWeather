<template>
  <div class="dashboard-flow">

    <!-- ── Phase 3.1: First-run profile setup banner ── -->
    <!--
      Shown when contextQuality === 'none' (user has never set a profile).
      Non-blocking — weather dashboard renders normally beneath it.
      Dismissed for the session; re-appears next visit if still unconfigured.
    -->
    <div
      v-if="showProfilePrompt"
      class="profile-prompt-banner"
      role="complementary"
      aria-label="Set up your profile"
    >
      <div class="profile-prompt-content">
        <span class="profile-prompt-icon" aria-hidden="true" v-html="uiIcon('sparkles')"></span>
        <div class="profile-prompt-text">
          <strong>Personalise your forecast</strong>
          <span>Add your location, routine, and activities — Lumi will make your briefings personal.</span>
        </div>
      </div>
      <div class="profile-prompt-actions">
        <button
          type="button"
          class="profile-prompt-cta"
          @click="openProfileSetup"
          aria-label="Set up your profile"
        >
          Set up profile
        </button>
        <button
          type="button"
          class="profile-prompt-dismiss"
          @click="dismissProfilePrompt"
          aria-label="Dismiss profile setup prompt"
        >
          Not now
        </button>
      </div>
    </div>

    <!-- Profile setup flow modal (session-local) -->
    <Teleport to="body">
      <div
        v-if="showProfileFlow"
        class="dashboard-flow-backdrop"
        role="dialog"
        aria-modal="true"
        aria-label="Profile setup"
        @keydown.escape="showProfileFlow = false"
      >
        <div class="dashboard-flow-panel">
          <div class="dashboard-flow-panel-header">
            <span class="dashboard-flow-panel-title">Set up your profile</span>
            <button
              type="button"
              class="dashboard-flow-close"
              aria-label="Close profile setup"
              @click="showProfileFlow = false"
            >✕</button>
          </div>
          <div class="dashboard-flow-panel-body">
            <ProfileSetupFlow @setup-complete="onProfileSetupComplete" />
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Morning Briefing -->
    <div class="morning-briefing-section dashboard-section">
      <MorningBriefingCard
        :current-weather="store.currentWeather"
        :hourly-forecast="store.hourlyForecast"
        :impact-score="store.impactScore"
        :user-profile="userProfile"
      />
    </div>

    <!-- Day Planner -->
    <section class="calendar-events-section dashboard-section">
      <div class="dashboard-card">
        <CalendarEventsCard
          :hourly-forecast="store.hourlyForecast"
          :current-weather="store.currentWeather"
        />
      </div>
    </section>

    <!-- Current Weather + Impact Score -->
    <section class="current-impact-section dashboard-section two-column-section">
      <div class="dashboard-card current-weather">
        <CurrentWeatherCard
          :loading="store.loading"
          :error="store.error"
          :current-weather="store.currentWeather"
          :main-weather-icon-class="mainWeatherIconClass"
          :weather-icon="weatherIconKey"
          :temp-display-key="tempDisplayKey"
          :unit-symbol="unitSymbol"
          :hourly-forecast="store.hourlyForecast"
          :impact-score="store.impactScore"
          :trend-indicators="store.trendIndicators"
          :activity-recommendations="store.activityRecommendations"
          :hourly-forecast-key="hourlyForecastKey"
          :to-display-temp="toDisplayTemp"
          :capitalize="capitalize"
          :format-hour="formatHour"
          :icon-svg="iconSvg"
        />
      </div>
      <div class="dashboard-card stability-ring">
        <WeatherImpactCard
          :impact-score="store.impactScore"
          :current-weather="store.currentWeather"
          :hourly-forecast="store.hourlyForecast"
          :trend-indicators="store.trendIndicators"
          :unit-symbol="unitSymbol"
        />
      </div>
    </section>

    <!-- AI Copilot -->
    <section class="ai-insights-section dashboard-section">
      <div class="dashboard-card panel-weather-copilot">
        <WeatherCopilot
          :loading="store.loading"
          :weather-data="store.sharedWeatherData"
          :user-profile="userProfile"
        />
      </div>
    </section>

    <!-- Next 12 Hours -->
    <section class="next-12-hours-section dashboard-section horizontal-scroll-section">
      <div class="dashboard-card panel-next-12">
        <Next12HoursCard
          :hourly-forecast="store.hourlyForecast"
          :format-hour="formatHour"
          :icon-svg="iconSvg"
          :to-display-temp="toDisplayTemp"
          :unit-symbol="unitSymbol"
        />
      </div>
    </section>

    <!-- Hourly Decision Timeline -->
    <section class="hourly-decision-section dashboard-section horizontal-scroll-section">
      <div class="dashboard-card panel-hourly-decision-timeline">
        <HourlyDecisionTimeline
          :weather-data="store.sharedWeatherData"
          :hourly-forecast="store.hourlyForecast"
          :current-weather="store.currentWeather"
          :icon-svg="iconSvg"
          :to-display-temp="toDisplayTemp"
          :unit-symbol="unitSymbol"
        />
      </div>
    </section>

    <!-- Planning row: Activity Recs + Risk Alerts + Best Time -->
    <section class="planning-section dashboard-section three-column-section">
      <div class="dashboard-card panel-activity-recommendations">
        <ActivityRecommendationsCard
          :recommendations="store.activityRecommendations"
          :current-weather="store.currentWeather"
        />
      </div>
      <div class="dashboard-card panel-risk-alerts">
        <WeatherRiskAlertsCard
          :forecast-data="store.hourlyTrend"
          :current-weather="store.currentWeather"
        />
      </div>
      <div class="dashboard-card panel-demand-forecast">
        <BestTimeCard
          :hourly-forecast="store.hourlyForecast"
          :current-weather="store.currentWeather"
        />
      </div>
    </section>

    <!-- 7-Day Forecast -->
    <section class="seven-day-section dashboard-section">
      <div class="dashboard-card seven-day-forecast">
        <SevenDayForecastCard
          :daily-forecast="store.dailyForecast"
          :format-day="formatDay"
          :icon-svg="iconSvg"
          :to-display-temp="toDisplayTemp"
          :unit-symbol="unitSymbol"
        />
      </div>
    </section>

    <!-- Temperature Chart -->
    <section class="weather-trends-chart-section dashboard-section single-column-section">
      <div class="dashboard-card panel-trend-charts">
        <WeatherTrendCharts :points="store.hourlyTrend" :unit-symbol="unitSymbol" :weather-condition="weatherIconKey" />
      </div>
    </section>

    <AppFooter />
  </div>
</template>

<script setup>
/**
 * WeatherDashboard.vue — Phase 3.1 + Phase 4 additions
 *
 * Phase 3.1 additions (additive only — existing behavior unchanged):
 *   - useUserContext integration
 *   - Auto-load weather from primary location on mount (Task 4.1)
 *   - First-run profile setup prompt (non-blocking banner)
 *   - useInsightEngine initialization (coordinator skeleton, Phase 3.2 will wire modules)
 *
 * Existing behavior:
 *   - City search, geolocation, all card rendering — unchanged
 *   - If no primary location is set, app behaves identically to before
 */
import { computed, defineAsyncComponent, onMounted, ref, watch } from 'vue'
import { useWeatherStore } from '@/stores/weather'
import { useTemperatureUnit } from '@/composables/useWeatherFormatters'
import { formatDay, formatHour, capitalize } from '@/composables/useWeatherFormatters'
import { iconSvg, resolveWeatherIconKey, resolveWeatherAnimationClass } from '@/composables/useWeatherIcons'
import { uiIcon } from '@/utils/uiIcons'

// Phase 3.1 imports
import { useUserContext } from '@/composables/useUserContext'
import { useInsightEngine } from '@/composables/useInsightEngine'
import ProfileSetupFlow from '@/components/ui/profile/ProfileSetupFlow.vue'

import AppFooter                  from '@/components/layout/AppFooter.vue'
import MorningBriefingCard        from '@/components/cards/MorningBriefingCard.vue'
import CalendarEventsCard         from '@/components/cards/CalendarEventsCard.vue'
import CurrentWeatherCard         from '@/components/cards/CurrentWeatherCard.vue'
import WeatherImpactCard          from '@/components/cards/WeatherImpactCard.vue'
import WeatherCopilot             from '@/components/cards/WeatherCopilot.vue'
import Next12HoursCard            from '@/components/cards/Next12HoursCard.vue'
import HourlyDecisionTimeline     from '@/components/cards/HourlyDecisionTimeline.tsx'
import ActivityRecommendationsCard from '@/components/cards/ActivityRecommendationsCard.vue'
import WeatherRiskAlertsCard      from '@/components/cards/WeatherRiskAlertsCard.vue'
import BestTimeCard               from '@/components/cards/BestTimeCard.vue'
import SevenDayForecastCard       from '@/components/cards/SevenDayForecastCard.vue'

const WeatherTrendCharts = defineAsyncComponent({
  loader: () => import('@/components/charts/WeatherTrendCharts.vue'),
  loadingComponent: { template: '<div class="chart-skeleton"></div>' },
  errorComponent:   { template: '<div class="chart-error">Failed to load chart.</div>' },
  delay: 200,
  timeout: 8000
})

const props = defineProps({
  userProfile: { type: String, default: 'general' }
})

// ── Stores & composables ────────────────────────────────────────────────────
const store = useWeatherStore()
const { unitSymbol, toDisplayTemp } = useTemperatureUnit()

// Phase 3.1: context + insight engine
const { userContext, contextQuality } = useUserContext()
const { compute: computeInsights } = useInsightEngine()

// ── Profile prompt state (session-only) ──────────────────────────────────────
const profilePromptDismissed = ref(false)
const showProfileFlow = ref(false)

const showProfilePrompt = computed(
  () => contextQuality.value === 'none' && !profilePromptDismissed.value
)

function dismissProfilePrompt() {
  profilePromptDismissed.value = true
}

function openProfileSetup() {
  showProfileFlow.value = true
}

function onProfileSetupComplete() {
  showProfileFlow.value = false
  profilePromptDismissed.value = true
  // Re-run insight engine now that context may have changed
  computeInsights()
}

// ── Derived computed ──────────────────────────────────────────────────────────
const weatherIconKey = computed(() => resolveWeatherIconKey(store.currentCondition))
const mainWeatherIconClass = computed(() => resolveWeatherAnimationClass(store.currentCondition))

const hourlyForecastKey = computed(() =>
  (store.hourlyForecast || []).map((s) => s.dt).join('-')
)

const tempDisplayKey = computed(() =>
  `${store.currentWeather?.dt ?? 'none'}-${store.currentWeather?.main?.temp ?? 'none'}-${unitSymbol.value}`
)

// ── Phase 4.1: Auto-load from primary location ─────────────────────────────
// Fires on mount only if: weather is null AND primary location is configured.
// Existing city search and geolocation behavior takes precedence.
onMounted(() => {
  const primary = userContext.value.location?.primary
  if (!store.currentWeather && primary?.lat != null && primary?.lon != null) {
    store.fetchWeatherByCoords(primary.lat, primary.lon)
  }
})

// Re-run insight engine when weather loads or context changes
watch(
  () => store.currentWeather,
  (w) => { if (w) computeInsights() }
)
</script>

<style scoped>
/* ── Profile setup prompt banner (Phase 3.1 / Task 4.1) ── */
.profile-prompt-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--lc-sp-3);
  padding: var(--lc-sp-3) var(--lc-sp-5);
  border-radius: var(--lc-radius-lg);
  border: 1px solid var(--lc-border-glass);
  background: linear-gradient(135deg, var(--lc-accent-subtle), var(--lc-surface-overlay));
  margin-bottom: var(--lc-sp-2);
  flex-wrap: wrap;
  animation: dashboardIn var(--lc-duration-slow) var(--lc-ease-out) both;
}

.profile-prompt-content {
  display: flex;
  align-items: center;
  gap: var(--lc-sp-3);
  flex: 1;
  min-width: 0;
}

.profile-prompt-icon { display: flex; align-items: center; flex-shrink: 0; }
.profile-prompt-icon svg { width: 20px; height: 20px; color: var(--lc-accent); }

.profile-prompt-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.profile-prompt-text strong {
  font-size: var(--lc-text-body-sm);
  font-weight: var(--lc-weight-bold);
  color: var(--lc-text-primary);
}

.profile-prompt-text span {
  font-size: var(--lc-text-caption);
  color: var(--lc-text-muted);
  line-height: var(--lc-leading-snug);
}

.profile-prompt-actions {
  display: flex;
  gap: var(--lc-sp-2);
  align-items: center;
  flex-shrink: 0;
}

.profile-prompt-cta {
  height: 36px;
  min-height: 36px;
  padding: 0 var(--lc-sp-4);
  border: none;
  border-radius: var(--lc-radius-pill);
  background: var(--lc-accent);
  color: var(--lc-text-on-accent);
  font-size: var(--lc-text-label);
  font-weight: var(--lc-weight-bold);
  font-family: var(--lc-font-family);
  cursor: pointer;
  transition: background var(--lc-transition-hover), transform var(--lc-transition-hover);
}

.profile-prompt-cta:hover {
  background: var(--lc-accent-hover);
  transform: translateY(-1px);
}

.profile-prompt-dismiss {
  height: 36px;
  min-height: 36px;
  padding: 0 var(--lc-sp-3);
  border: 1px solid var(--lc-border-glass);
  border-radius: var(--lc-radius-pill);
  background: transparent;
  color: var(--lc-text-muted);
  font-size: var(--lc-text-label);
  font-weight: var(--lc-weight-medium);
  font-family: var(--lc-font-family);
  cursor: pointer;
  transition: background var(--lc-transition-hover), color var(--lc-transition-hover);
}

.profile-prompt-dismiss:hover {
  background: var(--lc-surface-overlay);
  color: var(--lc-text-primary);
}

/* ── Profile setup flow modal (mirrors UserProfileSelector pattern) ── */
.dashboard-flow-backdrop {
  position: fixed;
  inset: 0;
  z-index: var(--lc-z-modal);
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--lc-sp-4);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

.dashboard-flow-panel {
  width: 100%;
  max-width: 520px;
  max-height: 90vh;
  overflow-y: auto;
  border-radius: var(--lc-radius-2xl);
  background: var(--lc-surface-raised);
  border: 1px solid var(--lc-border-glass);
  box-shadow: var(--lc-shadow-modal);
  display: flex;
  flex-direction: column;
}

.dashboard-flow-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--lc-sp-4) var(--lc-sp-5);
  border-bottom: 1px solid var(--lc-border-subtle);
  flex-shrink: 0;
}

.dashboard-flow-panel-title {
  font-size: var(--lc-text-h3);
  font-weight: var(--lc-weight-bold);
  color: var(--lc-text-primary);
}

.dashboard-flow-close {
  width: 32px;
  height: 32px;
  min-height: 32px;
  border: 1px solid var(--lc-border-glass);
  border-radius: var(--lc-radius-pill);
  background: var(--lc-surface-overlay);
  color: var(--lc-text-muted);
  font-size: 0.8rem;
  cursor: pointer;
  display: grid;
  place-items: center;
  transition: background var(--lc-transition-hover), color var(--lc-transition-hover);
}

.dashboard-flow-close:hover { background: var(--lc-surface-hover); color: var(--lc-text-primary); }

.dashboard-flow-panel-body { padding: var(--lc-sp-5); overflow-y: auto; }

@media (max-width: 640px) {
  .profile-prompt-banner { flex-direction: column; align-items: flex-start; }
  .profile-prompt-actions { width: 100%; }
  .dashboard-flow-panel { max-height: 100vh; border-radius: var(--lc-radius-xl) var(--lc-radius-xl) 0 0; }
  .dashboard-flow-backdrop { align-items: flex-end; padding: 0; }
}
</style>
