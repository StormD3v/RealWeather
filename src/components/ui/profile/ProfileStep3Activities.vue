<script setup>
/**
 * ProfileStep3Activities.vue
 * Step 3: Declare outdoor activities from the system catalogue.
 * Emits: complete (activities written), skip (nothing written)
 */
import { ref, onMounted } from 'vue'
import { useUserContext } from '@/composables/useUserContext'
import { getActivityProfile, ALL_ACTIVITY_KEYS } from '@/utils/activityProfiles'
import BaseButton from '@/components/ui/BaseButton.vue'
import { uiIcon } from '@/utils/uiIcons'

const emit = defineEmits(['complete', 'skip'])

const { userContext, setContext } = useUserContext()

const ACTIVITY_META = {
  running:         { label: 'Running',       icon: 'running' },
  cycling:         { label: 'Cycling',       icon: 'cycling' },
  hiking:          { label: 'Hiking',        icon: 'hiking' },
  gardening:       { label: 'Gardening',     icon: 'gardening' },
  photography:     { label: 'Photography',   icon: 'photography' },
  golf:            { label: 'Golf',          icon: 'golf' },
  'outdoor-dining':{ label: 'Outdoor Dining',icon: 'outdoor-dining' },
  'dog-walking':   { label: 'Dog Walking',   icon: 'dog-walking' },
  swimming:        { label: 'Swimming',      icon: 'swimming' },
  sailing:         { label: 'Sailing',       icon: 'sailing' }
}

const FREQUENCIES = [
  { value: 'daily',          label: 'Daily' },
  { value: 'several-weekly', label: 'Several times/week' },
  { value: 'occasional',     label: 'Occasionally' }
]

// Map of activityKey → { selected: bool, frequency: string }
const selections = ref(
  Object.fromEntries(ALL_ACTIVITY_KEYS.map(key => [key, { selected: false, frequency: 'several-weekly' }]))
)

onMounted(() => {
  const declared = userContext.value.activities?.declared ?? []
  declared.forEach(a => {
    if (selections.value[a.activityKey]) {
      selections.value[a.activityKey].selected = true
      selections.value[a.activityKey].frequency = a.frequency || 'several-weekly'
    }
  })
})

function toggleActivity(key) {
  selections.value[key].selected = !selections.value[key].selected
}

function confirm() {
  const declared = ALL_ACTIVITY_KEYS
    .filter(key => selections.value[key].selected)
    .map(key => ({
      id: `activity-${key}-${Date.now()}`,
      activityKey: key,
      label: ACTIVITY_META[key].label,
      frequency: selections.value[key].frequency,
      seasonRange: null,
      profile: getActivityProfile(key) ?? null
    }))

  setContext({ activities: { declared } })
  emit('complete')
}

function skip() {
  emit('skip')
}
</script>

<template>
  <div class="step-activities">
    <div class="step-header">
      <span class="step-icon" aria-hidden="true" v-html="uiIcon('leaf')"></span>
      <div>
        <h2 class="step-title">Your outdoor activities</h2>
        <p class="step-desc">Select the activities you do outdoors. Lumi will tailor its recommendations to what matters for each one.</p>
      </div>
    </div>

    <div class="activity-grid" role="group" aria-label="Select your outdoor activities">
      <div
        v-for="key in ALL_ACTIVITY_KEYS"
        :key="key"
        class="activity-card"
        :class="{ 'activity-card--selected': selections[key].selected }"
        role="checkbox"
        :aria-checked="selections[key].selected"
        tabindex="0"
        @click="toggleActivity(key)"
        @keydown.space.prevent="toggleActivity(key)"
        @keydown.enter.prevent="toggleActivity(key)"
      >
        <span class="activity-icon" aria-hidden="true" v-html="uiIcon(ACTIVITY_META[key].icon)"></span>
        <span class="activity-label">{{ ACTIVITY_META[key].label }}</span>
        <span v-if="selections[key].selected" class="activity-check" aria-hidden="true" v-html="uiIcon('check')"></span>
      </div>
    </div>

    <!-- Frequency selectors for selected activities -->
    <div
      v-if="ALL_ACTIVITY_KEYS.some(k => selections[k].selected)"
      class="frequency-section"
    >
      <p class="field-label">How often?</p>
      <div class="frequency-list">
        <div
          v-for="key in ALL_ACTIVITY_KEYS.filter(k => selections[k].selected)"
          :key="key"
          class="frequency-row"
        >
          <span class="freq-activity-name">
            <span aria-hidden="true" v-html="uiIcon(ACTIVITY_META[key].icon)"></span>
            {{ ACTIVITY_META[key].label }}
          </span>
          <div class="freq-buttons" role="group" :aria-label="`Frequency for ${ACTIVITY_META[key].label}`">
            <button
              v-for="freq in FREQUENCIES"
              :key="freq.value"
              type="button"
              class="freq-btn"
              :class="{ 'freq-btn--active': selections[key].frequency === freq.value }"
              @click="selections[key].frequency = freq.value"
              :aria-pressed="selections[key].frequency === freq.value"
            >
              {{ freq.label }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="step-actions">
      <BaseButton variant="primary" size="md" @click="confirm" aria-label="Save activities">
        Save activities
      </BaseButton>
      <BaseButton variant="ghost" size="md" @click="skip" aria-label="Skip this step">
        Skip for now
      </BaseButton>
    </div>
  </div>
</template>

<style scoped>
.step-activities { display: flex; flex-direction: column; gap: var(--lc-sp-5); }

.step-header { display: flex; align-items: flex-start; gap: var(--lc-sp-3); }
.step-icon { line-height: 1; flex-shrink: 0; margin-top: 2px; display: inline-flex; width: 28px; height: 28px; }
.step-icon :deep(svg) { width: 28px; height: 28px; }
.step-title { margin: 0 0 var(--lc-sp-1); font-size: var(--lc-text-h3); font-weight: var(--lc-weight-bold); color: var(--lc-text-primary); }
.step-desc { margin: 0; font-size: var(--lc-text-body-sm); color: var(--lc-text-muted); line-height: var(--lc-leading-relaxed); }

.activity-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  gap: var(--lc-sp-2);
}

.activity-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--lc-sp-1);
  padding: var(--lc-sp-3) var(--lc-sp-2);
  border-radius: var(--lc-radius-lg);
  border: 1.5px solid var(--lc-border-glass);
  background: var(--lc-surface-overlay);
  cursor: pointer;
  transition: border-color var(--lc-transition-hover), background var(--lc-transition-hover), transform var(--lc-transition-hover);
  position: relative;
  user-select: none;
}

.activity-card:hover { background: var(--lc-surface-hover); border-color: var(--lc-accent); transform: translateY(-1px); }
.activity-card:focus-visible { outline: 2px solid var(--lc-accent); outline-offset: 2px; }

.activity-card--selected {
  border-color: var(--lc-green);
  background: var(--lc-green-subtle);
}

.activity-icon { display: inline-flex; width: 28px; height: 28px; flex-shrink: 0; }
.activity-icon :deep(svg) { width: 28px; height: 28px; }
.activity-label { font-size: var(--lc-text-caption); font-weight: var(--lc-weight-semibold); color: var(--lc-text-primary); text-align: center; }

.activity-check {
  position: absolute;
  top: 4px;
  right: 6px;
  display: inline-flex;
  width: 14px;
  height: 14px;
  color: var(--lc-green);
}
.activity-check :deep(svg) { width: 14px; height: 14px; }

.frequency-section { display: flex; flex-direction: column; gap: var(--lc-sp-3); }

.field-label {
  font-size: var(--lc-text-label);
  font-weight: var(--lc-weight-semibold);
  color: var(--lc-text-secondary);
  text-transform: uppercase;
  letter-spacing: var(--lc-tracking-wider);
  margin: 0;
}

.frequency-list { display: flex; flex-direction: column; gap: var(--lc-sp-3); }

.frequency-row {
  display: flex;
  align-items: center;
  gap: var(--lc-sp-3);
  flex-wrap: wrap;
}

.freq-activity-name {
  display: flex;
  align-items: center;
  gap: var(--lc-sp-1);
  font-size: var(--lc-text-body-sm);
  font-weight: var(--lc-weight-semibold);
  color: var(--lc-text-primary);
  min-width: 120px;
}

.freq-activity-name > span:first-child { display: inline-flex; width: 18px; height: 18px; flex-shrink: 0; }
.freq-activity-name > span:first-child :deep(svg) { width: 18px; height: 18px; }

.freq-buttons { display: flex; gap: var(--lc-sp-1); flex-wrap: wrap; }

.freq-btn {
  padding: 5px var(--lc-sp-3);
  border-radius: var(--lc-radius-pill);
  border: 1px solid var(--lc-border-glass);
  background: var(--lc-surface-overlay);
  color: var(--lc-text-muted);
  font-size: var(--lc-text-caption);
  font-weight: var(--lc-weight-medium);
  font-family: var(--lc-font-family);
  cursor: pointer;
  transition: background var(--lc-transition-hover), border-color var(--lc-transition-hover), color var(--lc-transition-hover);
  min-height: 32px;
}

.freq-btn:hover { background: var(--lc-surface-hover); border-color: var(--lc-accent); color: var(--lc-text-primary); }

.freq-btn--active {
  background: var(--lc-accent-subtle);
  border-color: var(--lc-accent);
  color: var(--lc-accent);
  font-weight: var(--lc-weight-bold);
}

.step-actions { display: flex; gap: var(--lc-sp-3); align-items: center; flex-wrap: wrap; }
</style>
