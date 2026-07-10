<script setup>
import { computed } from 'vue'

const props = defineProps({
  loading: Boolean,
  error: {
    type: String,
    default: null
  },
  currentWeather: {
    type: Object,
    default: null
  },
  mainWeatherIconClass: {
    type: String,
    default: ''
  },
  weatherIcon: {
    type: String,
    default: 'Clear'
  },
  tempDisplayKey: {
    type: String,
    default: ''
  },
  unitSymbol: {
    type: String,
    default: 'C'
  },
  hourlyForecast: {
    type: Array,
    default: () => []
  },
  impactScore: {
    type: Object,
    default: () => ({ score: 0, label: 'Severe' })
  },
  trendIndicators: {
    type: Object,
    default: () => ({ temperature: 'flat', humidity: 'flat' })
  },
  activityRecommendations: {
    type: Array,
    default: () => []
  },
  hourlyForecastKey: {
    type: String,
    default: ''
  },
  toDisplayTemp: {
    type: Function,
    required: true
  },
  capitalize: {
    type: Function,
    required: true
  },
  formatHour: {
    type: Function,
    required: true
  },
  iconSvg: {
    type: Function,
    required: true
  }
})

const windDisplay = computed(() => {
  if (!props.currentWeather?.wind?.speed) return 'N/A'
  return `${props.currentWeather.wind.speed} km/h`
})

const visibilityKm = computed(() => {
  const visibility = props.currentWeather?.main?.visibility
  if (!visibility) return 'N/A'
  return Math.round(visibility / 1000)
})

const rainChance = computed(() => {
  const chance = props.currentWeather?.rain?.chance
  if (chance === null || chance === undefined) return 'N/A'
  return `${Math.round(chance)}%`
})

const humidity = computed(() => {
  const humidity = props.currentWeather?.main?.humidity
  return humidity !== undefined && humidity !== null ? `${humidity}%` : 'N/A'
})

const pressure = computed(() => {
  const pressure = props.currentWeather?.main?.pressure
  return pressure !== undefined && pressure !== null && pressure > 0 ? `${pressure} hPa` : 'N/A'
})

const weatherGlowClass = computed(() => {
  const main = (props.currentWeather?.weather?.[0]?.main || '').toLowerCase()
  if (main.includes('rain') || main.includes('drizzle')) return 'rain'
  if (main.includes('clear')) return 'clear'
  if (main.includes('thunderstorm') || main.includes('storm') || main.includes('squall') || main.includes('tornado')) return 'storm'
  return ''
})

function trendArrow(value) {
  if (value === 'up') return '↑'
  if (value === 'down') return '↓'
  return '→'
}
</script>

<template>
  <div class="current-weather-card" :class="weatherGlowClass">
    <h3>Current Weather</h3>

    <Transition enter-active-class="transition-opacity duration-300" enter-from-class="opacity-0">
      <template #default>
        <div v-if="props.loading" class="weather-content skeleton-state">
          <div class="weather-main">
            <div class="skeleton skeleton-title"></div>
            <div class="skeleton skeleton-icon"></div>
            <div class="skeleton skeleton-temp"></div>
            <div class="skeleton skeleton-line"></div>
            <div class="skeleton skeleton-line short"></div>
          </div>

          <div class="stats-grid">
            <div class="stat-item skeleton-stat"></div>
            <div class="stat-item skeleton-stat"></div>
            <div class="stat-item skeleton-stat"></div>
            <div class="stat-item skeleton-stat"></div>
          </div>
        </div>

        <div v-else class="weather-content">
          <div class="weather-main">
            <div class="city-name">{{ currentWeather?.name ?? 'Unknown' }}</div>

            <div class="weather-icon">
              <div class="icon main-weather-icon" :class="mainWeatherIconClass" v-html="iconSvg(weatherIcon)"></div>
            </div>

            <div class="temp-display">
              {{ toDisplayTemp(currentWeather?.main?.temp ?? 0) }}&deg;{{ unitSymbol }}
              <span class="trend-arrow">{{ trendArrow(trendIndicators.temperature) }}</span>
            </div>

            <div class="condition-description">
              {{ capitalize(currentWeather?.weather?.[0]?.description ?? 'clear sky') }}
            </div>

            <div class="feels-like">
              Feels like {{ toDisplayTemp(currentWeather?.main?.feels_like ?? currentWeather?.main?.temp ?? 0) }}&deg;{{
                unitSymbol }}
            </div>
          </div>

          <!-- Stats Grid -->
          <div class="stats-grid">
            <div class="stat-item">
              <span class="stat-label">💧 HUMIDITY</span>
              <span class="stat-value">{{ humidity }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">💨 WIND SPEED</span>
              <span class="stat-value">{{ windDisplay }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">🌡️ PRESSURE</span>
              <span class="stat-value">{{ pressure }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">🌧️ RAIN CHANCE TODAY</span>
              <span class="stat-value">{{ rainChance }}</span>
            </div>
          </div>
        </div>
      </template>
    </Transition>
  </div>
</template>

<style scoped>
.current-weather-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  height: 100%;
}

.current-weather-card.rain  { box-shadow: 0 6px 20px rgba(79, 195, 247, 0.10); }
.current-weather-card.clear { box-shadow: 0 6px 20px rgba(255, 209, 102, 0.10); }
.current-weather-card.storm { box-shadow: 0 6px 20px rgba(168, 85, 247, 0.10); }

.weather-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--lc-sp-6);
}

.weather-main {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--lc-sp-2);
  min-width: 0;
  text-align: center;
}

.weather-icon {
  display: flex;
  justify-content: center;
  align-items: center;
  flex-shrink: 0;
}

.weather-icon .icon {
  width: 150px;
  height: 130px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.weather-icon :deep(.main-weather-icon svg) {
  width: 190px;
  height: 150px;
  display: block;
  margin: 0 auto;
}

.city-name {
  font-size: clamp(1rem, 4vw, 1.25rem);
  font-weight: var(--lc-weight-bold);
  color: var(--lc-text-primary);
  line-height: var(--lc-leading-snug);
  max-width: 100%;
  overflow-wrap: anywhere;
}

.temp-display {
  font-size: clamp(1.75rem, 8vw, 2.75rem);
  font-weight: var(--lc-weight-extrabold);
  color: var(--lc-text-primary);
  display: flex;
  align-items: center;
  gap: var(--lc-sp-2);
  line-height: 1;
  letter-spacing: var(--lc-tracking-tight);
}

.trend-arrow {
  font-size: 1.1rem;
  color: var(--lc-text-muted);
}

.condition-description {
  font-size: var(--lc-text-body-sm);
  font-weight: var(--lc-weight-semibold);
  color: var(--lc-text-secondary);
}

.feels-like {
  font-size: var(--lc-text-caption);
  font-weight: var(--lc-weight-medium);
  color: var(--lc-text-muted);
}

/* ── Stats grid ── */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--lc-sp-3);
  align-content: center;
  min-width: 0;
  width: 100%;
}

.stat-item {
  display: grid;
  grid-template-rows: auto 1fr;
  align-items: flex-start;
  gap: var(--lc-sp-2);
  min-height: 100px;
  padding: var(--lc-sp-4);
  background: var(--lc-surface-overlay);
  border: 1px solid var(--lc-border-glass);
  border-radius: var(--lc-radius-md);
  transition: background var(--lc-transition-hover);
}

.stat-item:hover { background: var(--lc-surface-hover); }

.stat-label {
  font-size: var(--lc-text-label);
  color: var(--lc-text-muted);
  text-transform: uppercase;
  letter-spacing: var(--lc-tracking-wider);
  font-weight: var(--lc-weight-semibold);
}

.stat-value {
  align-self: end;
  font-size: var(--lc-text-body-sm);
  font-weight: var(--lc-weight-semibold);
  color: var(--lc-text-primary);
}

/* ── Skeleton states ── */
.skeleton-state {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--lc-sp-5);
}

.skeleton {
  width: 100%;
  min-height: 16px;
  background: linear-gradient(
    90deg,
    var(--lc-surface-overlay) 0%,
    var(--lc-border-glass) 50%,
    var(--lc-surface-overlay) 100%
  );
  background-size: 200% 100%;
  animation: skeletonShimmer 1.6s var(--lc-ease) infinite;
  border-radius: var(--lc-radius-sm);
}

.skeleton-title  { width: 120px; height: 20px; }
.skeleton-icon   { width: 88px; height: 88px; border-radius: var(--lc-radius-full); }
.skeleton-temp   { width: 80px; height: 36px; }
.skeleton-line   { width: 220px; height: 14px; }
.skeleton-line.short { width: 140px; }
.skeleton-stat   { height: 64px; border-radius: var(--lc-radius-md); min-width: 100%; }

@keyframes skeletonShimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

@media (max-width: 600px) {
  .weather-content { gap: var(--lc-sp-4); }
  .weather-icon .icon { width: min(120px, 42vw); height: 104px; }
  .weather-icon :deep(.main-weather-icon svg) { width: min(160px, 54vw); height: 126px; }
  .stats-grid { gap: var(--lc-sp-2); }
  .stat-item { min-height: 88px; padding: var(--lc-sp-3); }
}
</style>
