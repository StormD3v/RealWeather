<template>
  <div class="next-12-hours">
    <h3>Next 12 Hours</h3>
    
    <div class="hours-container">
      <div class="hours-grid">
        <div
          v-for="(hour, index) in hourlyForecast.slice(0, 12)"
          :key="'hour-' + index"
          class="hour-item"
        >
          <div class="hour-time">{{ formatHour(hour.dt_txt) }}</div>
          <div class="hour-icon" v-html="iconSvg(hour.weather?.[0]?.main || 'Clear')"></div>
          <div class="hour-temp">{{ toDisplayTemp(hour.main?.temp ?? 0) }}&deg;</div>
          <div class="hour-rain">{{ Math.round(hour.pop ?? 0) }}%</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  hourlyForecast: {
    type: Array,
    default: () => []
  },
  formatHour: {
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
  },
  unitSymbol: {
    type: String,
    default: 'C'
  }
})
</script>

<style scoped>
.next-12-hours { display: flex; flex-direction: column; height: 100%; }

.hours-container { flex: 1; overflow-x: auto; overflow-y: hidden; max-width: 100%; scrollbar-width: none; }
.hours-container::-webkit-scrollbar { display: none; }

.hours-grid {
  display: grid;
  grid-template-columns: repeat(12, minmax(62px, 1fr));
  gap: var(--lc-sp-2);
  min-width: fit-content;
}

.hour-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: var(--lc-sp-3) var(--lc-sp-2);
  background: var(--lc-surface-overlay);
  border: 1px solid var(--lc-border-glass);
  border-radius: var(--lc-radius-md);
  min-width: 66px;
  transition: background var(--lc-transition-hover), transform var(--lc-transition-hover);
}

.hour-item:hover { background: var(--lc-surface-hover); transform: translateY(-2px); }

.hour-time {
  font-size: var(--lc-text-label-sm);
  color: var(--lc-text-muted);
  margin-bottom: var(--lc-sp-2);
  font-weight: var(--lc-weight-semibold);
  letter-spacing: var(--lc-tracking-wide);
}

.hour-icon { margin-bottom: var(--lc-sp-2); display: flex; align-items: center; justify-content: center; }
.hour-icon :deep(svg) { width: 22px; height: 22px; }

.hour-temp {
  font-size: var(--lc-text-caption);
  font-weight: var(--lc-weight-bold);
  color: var(--lc-text-primary);
  margin-bottom: var(--lc-sp-1);
}

.hour-rain {
  font-size: var(--lc-text-label-sm);
  color: var(--lc-rain-color);
  font-weight: var(--lc-weight-semibold);
}

@media (max-width: 900px) {
  .hours-grid { grid-template-columns: repeat(12, minmax(50px, 1fr)); gap: var(--lc-sp-1); }
  .hour-item { padding: var(--lc-sp-2) var(--lc-sp-1); }
  .hour-icon :deep(svg) { width: 18px; height: 18px; }
}

@media (max-width: 600px) {
  .hours-grid { grid-template-columns: repeat(12, calc((100% - 16px) / 3)); min-width: max-content; }
  .hour-item { min-width: 0; min-height: 44px; padding: var(--lc-sp-2) var(--lc-sp-1); }
}
</style>
