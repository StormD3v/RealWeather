<template>
  <div class="seven-day-forecast-card">
    <h3>7 Day Forecast</h3>
    
    <div class="forecast-row">
      <div 
        v-for="(day, index) in dailyForecast.slice(0, 7)" 
        :key="index"
        class="forecast-day forecast-card"
      >
        <div class="day-name">{{ formatDay(day.dt_txt) }}</div>
        <div class="day-icon">
          <div 
            class="icon"
            :class="getWeatherIconClass(day.weather?.[0]?.main)"
            v-html="iconSvg(day.weather?.[0]?.main || 'Clear')"
          ></div>
        </div>
        <div class="day-temps">
          <span class="temp-high">{{ toDisplayTemp(day.main?.temp_max ?? 0) }}&deg;</span>
          <span class="temp-low">{{ toDisplayTemp(day.main?.temp_min ?? 0) }}&deg;</span>
        </div>
        <div class="day-condition">{{ day.weather?.[0]?.description || 'Unknown' }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  dailyForecast: {
    type: Array,
    default: () => []
  },
  formatDay: {
    type: Function,
    required: true
  },
  iconSvg: {
    type: Function,
    required: true
  },
  toDisplayTemp: {
    type: Function,
    required: true
  }
})

function getWeatherIconClass(condition) {
  const conditionMap = {
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
  return conditionMap[condition] || 'is-clear'
}

function getWeatherIcon(condition) {
  const iconMap = {
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
  return iconMap[condition] || 'Clear'
}
</script>

<style scoped>
.seven-day-forecast-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.seven-day-forecast-card h3 {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
  color: white;
}

.forecast-row {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 16px;
  align-items: start;
}

.forecast-day {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 8px;
  min-width: 0;
  padding: 6px 4px;
}

.forecast-card:hover {
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.08);
}

.day-name {
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.9);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.2px;
  line-height: 1;
}

.day-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 34px;
}

.day-icon :deep(svg) {
  width: 32px;
  height: 32px;
}

.day-temps {
  display: flex;
  align-items: baseline;
  gap: 2px;
  line-height: 1;
}

.temp-high {
  font-size: 1.25rem;
  font-weight: 600;
  color: rgba(239, 68, 68, 0.9);
}

.temp-low {
  font-size: 1rem;
  font-weight: 500;
  color: rgba(59, 130, 246, 0.9);
}

.day-condition {
  font-size: 0.98rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  line-height: 1.25;
  white-space: normal;
  overflow-wrap: anywhere;
  text-transform: lowercase;
}

@media (max-width: 600px) {
  .forecast-row {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
  }

  .day-name {
    font-size: 0.8rem;
  }

  .day-icon :deep(svg) {
    width: 28px;
    height: 28px;
  }

  .temp-high {
    font-size: 1.1rem;
  }

  .temp-low {
    font-size: 0.92rem;
  }

  .day-condition {
    font-size: 0.72rem;
  }
}

@media (max-width: 380px) {
  .forecast-row {
    gap: 8px;
  }

  .day-name {
    font-size: 0.75rem;
  }

  .day-icon :deep(svg) {
    width: 24px;
    height: 24px;
  }

  .temp-high {
    font-size: 1rem;
  }

  .temp-low {
    font-size: 0.85rem;
  }

  .day-condition {
    font-size: 0.68rem;
  }
}
</style>
