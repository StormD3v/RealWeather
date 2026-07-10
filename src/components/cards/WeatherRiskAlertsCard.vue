<template>
  <div class="weather-risk-alerts-card">
    <h3>Weather Risk Alerts</h3>

    <div class="alerts-content" v-if="hasAlerts">
      <div
        v-for="item in mappedAlerts"
        :key="item.id"
        class="alert-item"
        :class="item.severity"
      >
        <div class="alert-icon" v-html="item.icon" aria-hidden="true"></div>
        <div class="alert-info">
          <div class="alert-title">{{ item.title }}</div>
          <div class="alert-description">{{ item.description }}</div>
        </div>
      </div>
    </div>

    <div class="no-alerts" v-else>
      <div class="no-alerts-icon" aria-hidden="true" v-html="uiIcon('check-circle')"></div>
      <div class="no-alerts-text">No severe weather alerts</div>
    </div>
  </div>
</template>

<script setup>
/**
 * WeatherRiskAlertsCard.vue — Phase 3.3 upgrade
 *
 * Consumes alertInsights from useInsightEngine().
 * Maps urgency levels to the existing CSS severity classes.
 * No weather reasoning inside this component.
 *
 * Backwards-compatible: original props are kept but unused.
 */
import { computed } from 'vue'
import { useInsightEngine } from '@/composables/useInsightEngine'
import { uiIcon } from '@/utils/uiIcons'

// Backwards-compatible props (unused by new logic)
defineProps({
  forecastData:   { type: Array,  default: () => [] },
  currentWeather: { type: Object, default: null }
})

const { alertInsights } = useInsightEngine()

const hasAlerts = computed(() => alertInsights.value.length > 0)

/**
 * Maps urgency to the icon and CSS severity class used by existing styles.
 *   heads-up → 'high'   (yellow-tinted existing style)
 *   alert    → 'severe' (red-tinted existing style)
 */
function urgencyToIcon(urgency) {
  if (urgency === 'alert')    return uiIcon('alert')
  if (urgency === 'heads-up') return uiIcon('warning')
  return uiIcon('info')
}

function urgencyToSeverity(urgency) {
  if (urgency === 'alert') return 'severe'
  return 'high'
}

const mappedAlerts = computed(() =>
  alertInsights.value.map((insight) => ({
    id:          insight.id,
    icon:        urgencyToIcon(insight.urgency),
    title:       insight.content,
    description: insight.actionPath,
    severity:    urgencyToSeverity(insight.urgency)
  }))
)
</script>

<style scoped>
.weather-risk-alerts-card { display: flex; flex-direction: column; height: 100%; }
.alerts-content { display: flex; flex-direction: column; gap: var(--lc-sp-3); flex: 1; }

.alert-item {
  display: flex;
  align-items: flex-start;
  gap: var(--lc-sp-3);
  padding: var(--lc-sp-4);
  border-radius: var(--lc-radius-md);
  transition: transform var(--lc-transition-hover);
}

.alert-item.high   { background: var(--lc-error-subtle);  border: 1px solid rgba(239,68,68,0.25); }
.alert-item.severe { background: var(--lc-severe-subtle); border: 1px solid rgba(220,38,38,0.30); }
.alert-item:hover  { transform: translateY(-2px); }

.alert-icon { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.alert-icon :deep(svg) { width: 24px; height: 24px; }
.alert-item.high   .alert-icon { color: var(--lc-warning); }
.alert-item.severe .alert-icon { color: var(--lc-error); }
.alert-info { flex: 1; }
.alert-title { font-size: var(--lc-text-body-sm); font-weight: var(--lc-weight-semibold); color: var(--lc-text-primary); margin-bottom: var(--lc-sp-1); }
.alert-description { font-size: var(--lc-text-caption); color: var(--lc-text-secondary); line-height: var(--lc-leading-normal); }

.no-alerts { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: var(--lc-sp-8); text-align: center; flex: 1; }
.no-alerts-icon {
  width: 44px; height: 44px; min-height: 44px;
  display: flex; align-items: center; justify-content: center;
  background: var(--lc-success-subtle);
  border: 1px solid rgba(34,197,94,0.2);
  border-radius: var(--lc-radius-full);
  color: var(--lc-success);
  margin-bottom: var(--lc-sp-3);
}
.no-alerts-icon :deep(svg) { width: 24px; height: 24px; }
.no-alerts-text { font-size: var(--lc-text-body-sm); color: var(--lc-text-muted); font-weight: var(--lc-weight-medium); }

@media (max-width: 768px) {
  .alert-item { padding: var(--lc-sp-3); gap: var(--lc-sp-2); }
  .alert-title { font-size: var(--lc-text-caption); }
  .alert-description { font-size: var(--lc-text-label); }
}
</style>
