<template>
  <div class="activity-recommendations">
    <h3>Activity Recommendations</h3>

    <div class="recommendations-content">

      <!-- State 1: Has declared activities + engine has activity insights -->
      <template v-if="hasActivities && activityInsights.length > 0">
        <div
          v-for="insight in activityInsights"
          :key="insight.id"
          class="activity-insight-item"
        >
          <div class="activity-insight-header">
            <span class="activity-status-tag" :class="`status-${urgencyToStatus(insight.urgency).color}`">
              {{ urgencyToStatus(insight.urgency).label }}
            </span>
          </div>
          <p class="activity-insight-content">{{ insight.content }}</p>
          <p class="activity-insight-action">{{ insight.actionPath }}</p>
        </div>
      </template>

      <!-- State 2: Has declared activities, engine returned no activity insights (all benign) -->
      <template v-else-if="hasActivities && activityInsights.length === 0 && hasInsights">
        <div class="recommendation-message">
          <p>Conditions look good for your declared activities today.</p>
        </div>
        <div class="activity-tags">
          <div
            v-for="activity in declaredActivityLabels"
            :key="activity"
            class="activity-tag"
          >
            {{ activity }}
          </div>
        </div>
      </template>

      <!-- State 3: Profile set, no activities declared -->
      <template v-else-if="hasContext && !hasActivities">
        <div class="recommendation-message">
          <p>Add activities to your profile to get personalised recommendations.</p>
        </div>
        <div class="activity-tags">
          <div class="activity-tag activity-tag--muted">Running</div>
          <div class="activity-tag activity-tag--muted">Cycling</div>
          <div class="activity-tag activity-tag--muted">Hiking</div>
        </div>
      </template>

      <!-- State 4: No context / fallback — generic weather-based guidance -->
      <template v-else>
        <div class="recommendation-message">
          <p>{{ fallbackRecommendation }}</p>
        </div>
        <div class="activity-tags">
          <div v-for="activity in fallbackActivities" :key="activity" class="activity-tag">
            {{ activity }}
          </div>
        </div>
      </template>

    </div>
  </div>
</template>

<script setup>
/**
 * ActivityRecommendationsCard.vue — Phase 3.3 upgrade
 *
 * Consumes activity insights from useInsightEngine().
 * Falls back to generic guidance when no profile/context exists.
 * No weather reasoning inside this component.
 *
 * Backwards-compatible: original props are kept but unused.
 */
import { computed } from 'vue'
import { useInsightEngine } from '@/composables/useInsightEngine'
import { useUserContext } from '@/composables/useUserContext'

// Backwards-compatible props (unused by new logic)
const props = defineProps({
  recommendations: { type: Array,  default: () => [] },
  currentWeather:  { type: Object, default: null }
})

const { insightsByType, hasInsights } = useInsightEngine()
const { hasContext, userContext } = useUserContext()

const activityInsights = computed(() => insightsByType('activity').value)

const hasActivities = computed(() =>
  (userContext.value.activities?.declared?.length ?? 0) > 0
)

const declaredActivityLabels = computed(() =>
  (userContext.value.activities?.declared ?? [])
    .map(a => a.label?.trim() || a.activityKey)
    .filter(Boolean)
    .slice(0, 4)
)

/**
 * Maps urgency to a status label + color for the activity status tag.
 * ambient   → Good  (green)
 * useful    → Check (yellow)   — marginal conditions
 * heads-up  → Caution (yellow)
 * alert     → Avoid (red)
 */
function urgencyToStatus(urgency) {
  if (urgency === 'alert')    return { label: 'Avoid',   color: 'red' }
  if (urgency === 'heads-up') return { label: 'Caution', color: 'yellow' }
  if (urgency === 'useful')   return { label: 'Check',   color: 'yellow' }
  return { label: 'Good', color: 'green' }
}

// ── Generic fallback (State 4) — used only when no profile exists ──────────
// This is a minimal pass-through — no reasoning added here.
// The text comes from the existing recommendations prop (weather store) if
// populated, otherwise a neutral message.
const fallbackRecommendation = computed(() => {
  if (Array.isArray(props.recommendations) && props.recommendations.length > 0) {
    return props.recommendations[0]
  }
  return 'Weather data unavailable for activity recommendations.'
})

const fallbackActivities = computed(() => {
  if (Array.isArray(props.recommendations) && props.recommendations.length > 1) {
    return props.recommendations.slice(1, 5)
  }
  return ['Light Exercise', 'Walking', 'Casual Outings']
})
</script>

<style scoped>
.activity-recommendations { display: flex; flex-direction: column; height: 100%; }
.recommendations-content { display: flex; flex-direction: column; gap: var(--lc-sp-4); flex: 1; }

/* ── Insight-based items ── */
.activity-insight-item {
  display: flex;
  flex-direction: column;
  gap: var(--lc-sp-2);
  padding: var(--lc-sp-3) var(--lc-sp-4);
  border-radius: var(--lc-radius-md);
  background: var(--lc-surface-overlay);
  border: 1px solid var(--lc-border-glass);
}

.activity-insight-header { display: flex; align-items: center; }

.activity-status-tag {
  display: inline-flex;
  align-items: center;
  padding: 3px var(--lc-sp-3);
  border-radius: var(--lc-radius-pill);
  font-size: var(--lc-text-label);
  font-weight: var(--lc-weight-bold);
  text-transform: uppercase;
  letter-spacing: var(--lc-tracking-wide);
}

.status-green  { background: var(--lc-success-subtle); color: var(--lc-success); border: 1px solid rgba(34,197,94,0.25); }
.status-yellow { background: var(--lc-warning-subtle); color: var(--lc-warning); border: 1px solid rgba(245,158,11,0.25); }
.status-red    { background: var(--lc-error-subtle);   color: var(--lc-error);   border: 1px solid rgba(239,68,68,0.25); }

.activity-insight-content {
  margin: 0;
  font-size: var(--lc-text-body-sm);
  color: var(--lc-text-secondary);
  line-height: var(--lc-leading-normal);
}

.activity-insight-action {
  margin: 0;
  font-size: var(--lc-text-caption);
  color: var(--lc-text-muted);
  line-height: var(--lc-leading-relaxed);
}

/* ── Generic / fallback items (kept from original) ── */
.recommendation-message { flex: 1; }
.recommendation-message p { margin: 0; font-size: var(--lc-text-body-sm); color: var(--lc-text-secondary); line-height: var(--lc-leading-relaxed); }

.activity-tags { display: flex; flex-wrap: wrap; gap: var(--lc-sp-2); }

.activity-tag {
  padding: var(--lc-sp-2) var(--lc-sp-5);
  background: var(--lc-surface-overlay);
  border: 1px solid var(--lc-border-glass);
  border-radius: var(--lc-radius-pill);
  font-size: var(--lc-text-caption);
  color: var(--lc-text-secondary);
  font-weight: var(--lc-weight-semibold);
  transition: background var(--lc-transition-hover), transform var(--lc-transition-hover),
              border-color var(--lc-transition-hover);
  letter-spacing: var(--lc-tracking-normal);
}

.activity-tag:hover {
  background: var(--lc-surface-hover);
  border-color: var(--lc-accent);
  transform: translateY(-2px);
}

.activity-tag--muted {
  opacity: 0.45;
  pointer-events: none;
}

@media (max-width: 768px) {
  .recommendations-content { gap: var(--lc-sp-3); }
  .activity-tag { padding: var(--lc-sp-1) var(--lc-sp-3); font-size: var(--lc-text-label); }
}
</style>
