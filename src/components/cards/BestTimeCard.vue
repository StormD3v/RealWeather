<script setup>
/**
 * BestTimeCard.vue — Phase 3.3 upgrade
 *
 * Consumes daily-planning and activity insights from useInsightEngine().
 * Renders insight.content and insight.actionPath directly.
 * Does NOT parse natural language or extract times from strings.
 * Does NOT add any new reasoning.
 *
 * Backwards-compatible: original props are kept but unused.
 */
import { computed } from 'vue'
import { useInsightEngine } from '@/composables/useInsightEngine'

// Backwards-compatible props (unused by new logic)
defineProps({
  hourlyForecast: { type: Array,  default: () => [] },
  currentWeather: { type: Object, default: null }
})

const { insightsByType, hasInsights } = useInsightEngine()

// Primary: daily-planning insight drives the "Today's Outlook" section
const planningInsight = computed(() => insightsByType('daily-planning').value[0] ?? null)

// Secondary: activity insight drives the "Best Window" section when present
const activityInsight = computed(() => insightsByType('activity').value[0] ?? null)

// Urgency → condition tag mapping (reuses existing CSS classes from original)
function urgencyToCondition(urgency) {
  if (urgency === 'alert')    return { label: 'Alert',   color: 'red' }
  if (urgency === 'heads-up') return { label: 'Caution', color: 'yellow' }
  if (urgency === 'useful')   return { label: 'Good',    color: 'green' }
  return { label: 'Clear', color: 'green' }
}
</script>

<template>
  <div class="best-time-card">
    <h3>Best Time to Go Out</h3>
    <p class="subtitle">Based on today's conditions</p>

    <!-- Engine has insights -->
    <div v-if="hasInsights" class="time-windows">

      <!-- Today's Outlook — from daily-planning insight -->
      <div v-if="planningInsight" class="time-window">
        <div class="time-window-header">
          <span class="window-label">Today's Outlook</span>
          <span
            class="condition-tag"
            :class="`condition-${urgencyToCondition(planningInsight.urgency).color}`"
          >
            {{ urgencyToCondition(planningInsight.urgency).label }}
          </span>
        </div>
        <div class="time-window-body">
          <p class="window-content">{{ planningInsight.content }}</p>
          <p class="window-action">{{ planningInsight.actionPath }}</p>
        </div>
      </div>

      <!-- Best Window — from activity insight (when present) -->
      <div v-if="activityInsight" class="time-window">
        <div class="time-window-header">
          <span class="window-label">Activity Window</span>
          <span
            class="condition-tag"
            :class="`condition-${urgencyToCondition(activityInsight.urgency).color}`"
          >
            {{ urgencyToCondition(activityInsight.urgency).label }}
          </span>
        </div>
        <div class="time-window-body">
          <p class="window-content">{{ activityInsight.content }}</p>
          <p class="window-action">{{ activityInsight.actionPath }}</p>
        </div>
      </div>

    </div>

    <!-- Empty state -->
    <div v-else class="time-windows">
      <div class="time-window">
        <div class="time-window-header">
          <span class="window-label">Today's Outlook</span>
          <span class="condition-tag condition-grey">—</span>
        </div>
        <div class="time-window-body">
          <p class="window-content">Search a city to see timing recommendations.</p>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
.best-time-card { display: flex; flex-direction: column; height: 100%; }
.subtitle { margin: calc(-1 * var(--lc-sp-3)) 0 var(--lc-sp-5); font-size: var(--lc-text-caption); color: var(--lc-text-muted); }
.time-windows { display: flex; flex-direction: column; gap: var(--lc-sp-3); flex: 1; }

.time-window {
  display: flex;
  flex-direction: column;
  gap: var(--lc-sp-2);
  padding: var(--lc-sp-4);
  background: var(--lc-surface-overlay);
  border: 1px solid var(--lc-border-glass);
  border-radius: var(--lc-radius-md);
  transition: background var(--lc-transition-hover);
}

.time-window:hover { background: var(--lc-surface-hover); }

.time-window-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.window-label {
  font-size: var(--lc-text-label);
  font-weight: var(--lc-weight-semibold);
  color: var(--lc-text-muted);
  text-transform: uppercase;
  letter-spacing: var(--lc-tracking-wide);
}

.time-window-body { display: flex; flex-direction: column; gap: var(--lc-sp-1); }

.window-content {
  margin: 0;
  font-size: var(--lc-text-body-sm);
  font-weight: var(--lc-weight-semibold);
  color: var(--lc-text-primary);
  line-height: var(--lc-leading-normal);
}

.window-action {
  margin: 0;
  font-size: var(--lc-text-caption);
  color: var(--lc-text-muted);
  line-height: var(--lc-leading-relaxed);
}

.condition-tag {
  font-size: var(--lc-text-label-sm);
  font-weight: var(--lc-weight-bold);
  padding: 4px var(--lc-sp-3);
  border-radius: var(--lc-radius-pill);
  text-transform: uppercase;
  letter-spacing: var(--lc-tracking-wide);
  flex-shrink: 0;
}

.condition-green  { background: var(--lc-success-subtle); color: var(--lc-success); border: 1px solid rgba(34,197,94,0.25); }
.condition-yellow { background: var(--lc-warning-subtle); color: var(--lc-warning); border: 1px solid rgba(245,158,11,0.25); }
.condition-red    { background: var(--lc-error-subtle);   color: var(--lc-error);   border: 1px solid rgba(239,68,68,0.25); }
.condition-grey   { background: rgba(148,163,184,0.12);   color: var(--lc-text-muted); border: 1px solid rgba(148,163,184,0.25); }

@media (max-width: 600px) {
  .time-window { padding: var(--lc-sp-3) var(--lc-sp-4); }
  .window-content { font-size: var(--lc-text-caption); }
}
</style>
