<template>
  <template v-if="dailyForecast && dailyForecast.length > 0">
    <div class="seven-day-forecast-card">
      <h3>7 Day Forecast</h3>

      <div class="forecast-row">
        <div v-for="(day, index) in dailyForecast.slice(0, 7)" :key="index" class="forecast-day forecast-card">
          <div class="day-name">{{ formatDay(day.dt_txt) }}</div>
          <div class="day-icon">
            <div class="icon" :class="getWeatherIconClass(day.weather?.[0]?.main)"
              v-html="iconSvg(day.weather?.[0]?.main || 'Clear')"></div>
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
  <template v-else>
    <div class="seven-day-forecast-card">
      <h3>7 Day Forecast</h3>
      <div class="empty-forecast">No forecast data yet.</div>
    </div>
  </template>
</template>

<script setup>
import { shallowRef, watch } from 'vue'

defineOptions({ inheritAttrs: false })

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

const dailyForecast = shallowRef(props.dailyForecast)
watch(
  () => props.dailyForecast,
  (value) => {
    dailyForecast.value = value
  },
  { immediate: true }
)

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
</script>

<style scoped>
.seven-day-forecast-card { display: flex; flex-direction: column; gap: var(--lc-sp-4); }

.forecast-row {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: var(--lc-sp-3);
  align-items: start;
}

.forecast-day {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: var(--lc-sp-2);
  min-width: 0;
  padding: var(--lc-sp-2) var(--lc-sp-1);
  border-radius: var(--lc-radius-md);
  transition: background var(--lc-transition-hover), transform var(--lc-transition-hover);
}

.forecast-day:hover { background: var(--lc-surface-overlay); transform: translateY(-2px); }

.day-name {
  font-size: var(--lc-text-label);
  color: var(--lc-text-secondary);
  font-weight: var(--lc-weight-bold);
  text-transform: uppercase;
  letter-spacing: var(--lc-tracking-wide);
  line-height: 1;
}

.day-icon { display: flex; align-items: center; justify-content: center; min-height: 34px; }
.day-icon :deep(svg) { width: 30px; height: 30px; }

.day-temps { display: flex; align-items: baseline; gap: 3px; line-height: 1; }
.temp-high { font-size: 1.1rem; font-weight: var(--lc-weight-semibold); color: var(--lc-temp-hot); }
.temp-low  { font-size: 0.9rem; font-weight: var(--lc-weight-medium);   color: var(--lc-temp-cold); }

.day-condition {
  font-size: var(--lc-text-label);
  font-weight: var(--lc-weight-medium);
  color: var(--lc-text-muted);
  line-height: var(--lc-leading-snug);
  white-space: normal;
  overflow-wrap: anywhere;
  text-transform: lowercase;
}

.empty-forecast { color: var(--lc-text-muted); font-size: var(--lc-text-body-sm); padding: var(--lc-sp-6) 0; text-align: center; }

@media (max-width: 600px) {
  .forecast-row { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--lc-sp-2); }
  .day-icon :deep(svg) { width: 26px; height: 26px; }
  .temp-high { font-size: 1rem; }
  .temp-low  { font-size: 0.85rem; }
  .day-condition { font-size: 0.65rem; }
}

@media (max-width: 380px) {
  .forecast-row { gap: var(--lc-sp-1); }
  .day-icon :deep(svg) { width: 22px; height: 22px; }
}
</style>
