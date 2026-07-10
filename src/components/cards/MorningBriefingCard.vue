<script setup>
/**
 * MorningBriefingCard.vue — Phase 3.3 upgrade
 *
 * Consumes useInsightEngine() output exclusively.
 * No weather reasoning inside this component.
 * Original props are kept for backwards compatibility but are unused.
 *
 * Urgency → visual mapping:
 *   ambient   → no badge, muted accent
 *   useful    → info badge (accent color)
 *   heads-up  → warning badge (warning color)
 *   alert     → danger badge (error color)
 */
import { computed } from 'vue'
import { useInsightEngine } from '@/composables/useInsightEngine'
import { useWeatherStore } from '@/stores/weather'
import { uiIcon } from '@/utils/uiIcons'
import { iconSvg } from '@/composables/useWeatherIcons'

// ── Backwards-compatible props (unused by new logic, kept so parent doesn't break) ──
defineProps({
  currentWeather:  { type: Object,  default: () => ({}) },
  hourlyForecast:  { type: Array,   default: () => [] },
  impactScore:     { type: Object,  default: () => ({}) },
  userProfile:     { type: String,  default: 'general' }
})

const store = useWeatherStore()
const { leadInsight, alertInsights, hasInsights } = useInsightEngine()

// City name for greeting — display only, no logic
const cityName = computed(() => store.currentWeather?.name || 'Your location')

// The single most urgent insight drives the headline
const primaryInsight = leadInsight

// A secondary alert (heads-up or alert tier) if it differs from lead
const secondaryInsight = computed(() => {
  const alerts = alertInsights.value
  if (!alerts.length) return null
  // If the lead insight is already an alert, show the second alert as secondary
  const lead = primaryInsight.value
  if (lead && (lead.urgency === 'heads-up' || lead.urgency === 'alert')) {
    return alerts[1] ?? null
  }
  return alerts[0] ?? null
})
</script>

<template>
  <div class="morning-briefing-card">
    <h3 class="morning-briefing-title">
      <span class="title-icon" v-html="iconSvg('Clear')" aria-hidden="true"></span>
      Morning Briefing
    </h3>

    <div class="briefing-content">

      <!-- Greeting -->
      <div class="briefing-greeting">
        <div class="greeting-text">Good morning</div>
        <div class="city-text">{{ cityName }}</div>
      </div>

      <!-- Engine has insights -->
      <template v-if="hasInsights && primaryInsight">

        <!-- Lead insight -->
        <div class="insight-block" :class="`insight-block--${primaryInsight.urgency}`">
          <div class="insight-header">
            <span class="insight-badge" :class="`badge--${primaryInsight.urgency}`">
              <span class="badge-icon" v-if="primaryInsight.urgency === 'alert'"    v-html="uiIcon('alert')"   aria-hidden="true"></span>
              <span class="badge-icon" v-else-if="primaryInsight.urgency === 'heads-up'" v-html="uiIcon('warning')" aria-hidden="true"></span>
              <span class="badge-icon" v-else-if="primaryInsight.urgency === 'useful'"   v-html="uiIcon('info')"    aria-hidden="true"></span>
              <span class="badge-icon" v-else                                            v-html="uiIcon('check')"   aria-hidden="true"></span>
              <span v-if="primaryInsight.urgency === 'alert'">Alert</span>
              <span v-else-if="primaryInsight.urgency === 'heads-up'">Heads up</span>
              <span v-else-if="primaryInsight.urgency === 'useful'">Today</span>
              <span v-else>Today</span>
            </span>
          </div>
          <p class="insight-content">{{ primaryInsight.content }}</p>
          <p class="insight-action">{{ primaryInsight.actionPath }}</p>
        </div>

        <!-- Secondary alert insight (if present and different) -->
        <div
          v-if="secondaryInsight"
          class="insight-block insight-block--secondary"
          :class="`insight-block--${secondaryInsight.urgency}`"
        >
          <p class="insight-content">{{ secondaryInsight.content }}</p>
          <p class="insight-action">{{ secondaryInsight.actionPath }}</p>
        </div>

      </template>

      <!-- Empty state -->
      <div v-else class="briefing-empty">
        <div class="briefing-empty-text">
          {{ store.loading ? 'Loading your briefing…' : 'No significant weather events today.' }}
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
.morning-briefing-card {
  width: 100%;
  border-radius: var(--lc-radius-lg);
  border-left: 3px solid var(--lc-green);
  background: linear-gradient(135deg, var(--lc-green-subtle), var(--lc-surface-overlay));
  backdrop-filter: var(--lc-blur-sm);
  -webkit-backdrop-filter: var(--lc-blur-sm);
  border-top: 1px solid var(--lc-border-glass);
  border-right: 1px solid var(--lc-border-glass);
  border-bottom: 1px solid var(--lc-border-glass);
  padding: var(--lc-sp-5);
  box-shadow: var(--lc-shadow-raised);
}

.morning-briefing-title {
  margin: 0 0 var(--lc-sp-4) 0;
  font-size: var(--lc-text-h3);
  font-weight: var(--lc-weight-bold);
  color: var(--lc-green);
  display: flex;
  align-items: center;
  gap: var(--lc-sp-2);
}

.title-icon { display: inline-flex; width: 20px; height: 20px; flex-shrink: 0; }
.title-icon :deep(svg) { width: 20px; height: 20px; }

.briefing-content { display: flex; flex-direction: column; gap: var(--lc-sp-4); }

.briefing-greeting { display: flex; flex-direction: column; gap: var(--lc-sp-1); }
.greeting-text { font-size: var(--lc-text-body); font-weight: var(--lc-weight-semibold); color: var(--lc-text-primary); }
.city-text     { font-size: var(--lc-text-body-sm); color: var(--lc-text-muted); }

/* ── Insight block ── */
.insight-block {
  display: flex;
  flex-direction: column;
  gap: var(--lc-sp-2);
  padding: var(--lc-sp-4);
  border-radius: var(--lc-radius-md);
  background: var(--lc-surface-overlay);
  border: 1px solid var(--lc-border-glass);
}

.insight-block--alert    { border-color: rgba(239,68,68,0.35);  background: var(--lc-error-subtle);   }
.insight-block--heads-up { border-color: rgba(245,158,11,0.35); background: var(--lc-warning-subtle); }
.insight-block--useful   { border-color: var(--lc-border-glass); }
.insight-block--ambient  { border-color: var(--lc-border-glass); }
.insight-block--secondary { margin-top: calc(-1 * var(--lc-sp-2)); }

.insight-header { display: flex; align-items: center; gap: var(--lc-sp-2); }

.insight-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px var(--lc-sp-3);
  border-radius: var(--lc-radius-pill);
  font-size: var(--lc-text-label);
  font-weight: var(--lc-weight-bold);
}

.badge-icon { display: inline-flex; width: 14px; height: 14px; flex-shrink: 0; }
.badge-icon :deep(svg) { width: 14px; height: 14px; }

.badge--alert    { background: rgba(239,68,68,0.15);  color: var(--lc-error);   }
.badge--heads-up { background: rgba(245,158,11,0.15); color: var(--lc-warning); }
.badge--useful   { background: var(--lc-accent-subtle); color: var(--lc-accent); }
.badge--ambient  { background: var(--lc-green-subtle);  color: var(--lc-green);  }

.insight-content {
  margin: 0;
  font-size: var(--lc-text-body-sm);
  font-weight: var(--lc-weight-semibold);
  color: var(--lc-text-primary);
  line-height: var(--lc-leading-normal);
}

.insight-action {
  margin: 0;
  font-size: var(--lc-text-caption);
  color: var(--lc-text-secondary);
  line-height: var(--lc-leading-relaxed);
}

/* ── Empty state ── */
.briefing-empty {
  padding: var(--lc-sp-4) 0;
}
.briefing-empty-text {
  font-size: var(--lc-text-body-sm);
  color: var(--lc-text-muted);
}

@media (max-width: 640px) {
  .morning-briefing-card { padding: var(--lc-sp-4); }
  .briefing-content { gap: var(--lc-sp-3); }
}
</style>
