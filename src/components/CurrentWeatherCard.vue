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
    
    <div class="weather-content">
      <div class="weather-main">
        <div class="city-name">{{ currentWeather?.name ?? 'Unknown' }}</div>

        <div class="weather-icon">
          <div 
            class="icon main-weather-icon"
            :class="mainWeatherIconClass"
            v-html="iconSvg(weatherIcon)"
          ></div>
        </div>
        
        <div class="temp-display">
          {{ toDisplayTemp(currentWeather?.main?.temp ?? 0) }}&deg;{{ unitSymbol }}
          <span class="trend-arrow">{{ trendArrow(trendIndicators.temperature) }}</span>
        </div>

        <div class="condition-description">
          {{ capitalize(currentWeather?.weather?.[0]?.description ?? 'clear sky') }}
        </div>

        <div class="feels-like">
          Feels like {{ toDisplayTemp(currentWeather?.main?.feels_like ?? currentWeather?.main?.temp ?? 0) }}&deg;{{ unitSymbol }}
        </div>
      </div>
      
      <!-- Stats Grid -->
      <div class="stats-grid">
        <div class="stat-item">
          <span class="stat-label">Humidity</span>
          <span class="stat-value">{{ humidity }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Wind Speed</span>
          <span class="stat-value">{{ windDisplay }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Pressure</span>
          <span class="stat-value">{{ pressure }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Rain Chance Today</span>
          <span class="stat-value">{{ rainChance }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.current-weather-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  height: 100%;
}

.current-weather-card.rain {
  box-shadow: 0 8px 18px rgba(0, 150, 255, 0.08);
}

.current-weather-card.clear {
  box-shadow: 0 8px 18px rgba(255, 200, 80, 0.08);
}

.current-weather-card.storm {
  box-shadow: 0 8px 18px rgba(168, 85, 247, 0.08);
}

.current-weather-card h3 {
  margin: 0 0 20px 0;
  font-size: 22px;
  font-weight: 600;
  color: white;
}

.weather-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
}

.weather-main {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
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

.temp-display {
  font-size: clamp(28px, 8vw, 44px);
  font-weight: 800;
  color: white;
  display: flex;
  align-items: center;
  gap: 8px;
  line-height: 1;
  letter-spacing: 0.5px;
}

.trend-arrow {
  font-size: 18px;
  color: rgba(255, 255, 255, 0.6);
}

.city-name {
  font-size: clamp(16px, 4vw, 20px);
  line-height: 1.2;
  font-weight: 700;
  color: white;
  max-width: 100%;
  overflow-wrap: anywhere;
}

.condition-description {
  font-size: 15px;
  font-weight: 600;
  color: white;
}

.feels-like {
  font-size: 13px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.6);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  align-content: center;
  min-width: 0;
}

.stat-item {
  display: grid;
  grid-template-rows: auto 1fr;
  align-items: flex-start;
  gap: 8px;
  min-height: 112px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 10px;
}

.stat-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.stat-value {
  align-self: end;
  font-size: 15px;
  font-weight: 600;
  color: white;
}

@media (max-width: 600px) {
  .weather-content {
    gap: 16px;
  }

  .weather-icon .icon {
    width: min(120px, 42vw);
    height: 104px;
  }

  .weather-icon :deep(.main-weather-icon svg) {
    width: min(160px, 54vw);
    height: 126px;
  }
  
  .temp-display {
    font-size: clamp(28px, 8vw, 44px);
  }
  
  .city-name {
    font-size: clamp(16px, 4vw, 20px);
  }
  
  .stats-grid {
    gap: 8px;
  }

  .stat-item {
    min-height: 96px;
    padding: 12px;
  }
}
</style>
