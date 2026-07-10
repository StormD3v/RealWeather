<script setup>
/**
 * ProfileStep5Preferences.vue
 * Step 5: Temperature unit + notification preferences.
 * Emits: complete (preferences written), skip (nothing written)
 */
import { ref, computed, onMounted } from 'vue'
import { useUserContext } from '@/composables/useUserContext'
import BaseButton from '@/components/ui/BaseButton.vue'

const emit = defineEmits(['complete', 'skip'])

const { userContext, setContext } = useUserContext()

const temperatureUnit = ref('C')
const notificationsEnabled = ref(false)
const notifMorningBriefing = ref(false)
const notifCommute = ref(false)
const notifActivityAlerts = ref(false)
const notifRiskAlerts = ref(false)

onMounted(() => {
  const prefs = userContext.value.preferences
  if (prefs) {
    temperatureUnit.value = prefs.temperatureUnit || 'C'
    const n = prefs.notifications
    if (n) {
      notificationsEnabled.value = !!n.enabled
      notifMorningBriefing.value = !!n.morningBriefing
      notifCommute.value = !!n.commute
      notifActivityAlerts.value = !!n.activityAlerts
      notifRiskAlerts.value = !!n.riskAlerts
    }
  }
})

const NOTIF_CATEGORIES = [
  { key: 'morningBriefing', model: notifMorningBriefing, label: 'Morning Briefing',   desc: 'Daily summary before you head out' },
  { key: 'commute',         model: notifCommute,          label: 'Commute Alerts',     desc: 'Weather alerts around your departure time' },
  { key: 'activityAlerts',  model: notifActivityAlerts,   label: 'Activity Alerts',    desc: 'Conditions for your declared activities' },
  { key: 'riskAlerts',      model: notifRiskAlerts,       label: 'Risk Alerts',        desc: 'Severe weather warnings for your area' }
]

function confirm() {
  setContext({
    preferences: {
      temperatureUnit: temperatureUnit.value,
      notifications: {
        enabled: notificationsEnabled.value,
        morningBriefing: notifMorningBriefing.value,
        commute: notifCommute.value,
        activityAlerts: notifActivityAlerts.value,
        riskAlerts: notifRiskAlerts.value
      }
    }
  })
  emit('complete')
}

function skip() {
  emit('skip')
}
</script>

<template>
  <div class="step-preferences">
    <div class="step-header">
      <span class="step-icon" aria-hidden="true">⚙️</span>
      <div>
        <h2 class="step-title">Your preferences</h2>
        <p class="step-desc">Set your display units and choose which notifications you'd like to receive.</p>
      </div>
    </div>

    <!-- Temperature unit -->
    <div class="field-group">
      <p class="field-label">Temperature unit</p>
      <div class="unit-toggle" role="group" aria-label="Temperature unit">
        <button
          type="button"
          class="unit-btn"
          :class="{ 'unit-btn--active': temperatureUnit === 'C' }"
          @click="temperatureUnit = 'C'"
          :aria-pressed="temperatureUnit === 'C'"
        >
          °C — Celsius
        </button>
        <button
          type="button"
          class="unit-btn"
          :class="{ 'unit-btn--active': temperatureUnit === 'F' }"
          @click="temperatureUnit = 'F'"
          :aria-pressed="temperatureUnit === 'F'"
        >
          °F — Fahrenheit
        </button>
      </div>
    </div>

    <!-- Notifications master toggle -->
    <div class="field-group">
      <p class="field-label">Notifications</p>
      <label class="toggle-row" :class="{ 'toggle-row--active': notificationsEnabled }">
        <span class="toggle-text">
          <span class="toggle-label">Enable notifications</span>
          <span class="toggle-desc">Lumi will send alerts based on your settings below</span>
        </span>
        <span class="toggle-switch-wrap">
          <input
            type="checkbox"
            class="sr-only"
            v-model="notificationsEnabled"
            aria-label="Enable notifications"
            role="switch"
            :aria-checked="notificationsEnabled"
          />
          <span
            class="toggle-switch"
            :class="{ 'toggle-switch--on': notificationsEnabled }"
            aria-hidden="true"
          >
            <span class="toggle-thumb"></span>
          </span>
        </span>
      </label>

      <!-- Per-category toggles, only when master is on -->
      <div v-if="notificationsEnabled" class="notif-categories">
        <label
          v-for="cat in NOTIF_CATEGORIES"
          :key="cat.key"
          class="notif-row"
          :class="{ 'notif-row--active': cat.model.value }"
        >
          <span class="notif-text">
            <span class="notif-label">{{ cat.label }}</span>
            <span class="notif-desc">{{ cat.desc }}</span>
          </span>
          <span class="toggle-switch-wrap">
            <input
              type="checkbox"
              class="sr-only"
              v-model="cat.model.value"
              :aria-label="cat.label"
              role="switch"
              :aria-checked="cat.model.value"
            />
            <span
              class="toggle-switch toggle-switch--sm"
              :class="{ 'toggle-switch--on': cat.model.value }"
              aria-hidden="true"
            >
              <span class="toggle-thumb"></span>
            </span>
          </span>
        </label>
      </div>
    </div>

    <div class="step-actions">
      <BaseButton variant="primary" size="md" @click="confirm" aria-label="Save preferences">
        Save preferences
      </BaseButton>
      <BaseButton variant="ghost" size="md" @click="skip" aria-label="Skip this step">
        Skip for now
      </BaseButton>
    </div>
  </div>
</template>

<style scoped>
.step-preferences { display: flex; flex-direction: column; gap: var(--lc-sp-5); }

.step-header { display: flex; align-items: flex-start; gap: var(--lc-sp-3); }
.step-icon { font-size: 1.5rem; line-height: 1; flex-shrink: 0; margin-top: 2px; }
.step-title { margin: 0 0 var(--lc-sp-1); font-size: var(--lc-text-h3); font-weight: var(--lc-weight-bold); color: var(--lc-text-primary); }
.step-desc { margin: 0; font-size: var(--lc-text-body-sm); color: var(--lc-text-muted); line-height: var(--lc-leading-relaxed); }

.field-group { display: flex; flex-direction: column; gap: var(--lc-sp-3); }

.field-label {
  margin: 0;
  font-size: var(--lc-text-label);
  font-weight: var(--lc-weight-semibold);
  color: var(--lc-text-secondary);
  text-transform: uppercase;
  letter-spacing: var(--lc-tracking-wider);
}

.unit-toggle { display: flex; gap: var(--lc-sp-2); }

.unit-btn {
  flex: 1;
  padding: var(--lc-sp-3) var(--lc-sp-4);
  border-radius: var(--lc-radius-lg);
  border: 1.5px solid var(--lc-border-glass);
  background: var(--lc-surface-overlay);
  color: var(--lc-text-muted);
  font-size: var(--lc-text-body-sm);
  font-weight: var(--lc-weight-medium);
  font-family: var(--lc-font-family);
  cursor: pointer;
  transition: border-color var(--lc-transition-hover), background var(--lc-transition-hover), color var(--lc-transition-hover);
  min-height: 48px;
}

.unit-btn:hover { background: var(--lc-surface-hover); border-color: var(--lc-accent); color: var(--lc-text-primary); }

.unit-btn--active {
  border-color: var(--lc-accent);
  background: var(--lc-accent-subtle);
  color: var(--lc-accent);
  font-weight: var(--lc-weight-bold);
}

/* Toggle row (master notifications) */
.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--lc-sp-3);
  padding: var(--lc-sp-3) var(--lc-sp-4);
  border-radius: var(--lc-radius-lg);
  border: 1.5px solid var(--lc-border-glass);
  background: var(--lc-surface-overlay);
  cursor: pointer;
  transition: border-color var(--lc-transition-hover), background var(--lc-transition-hover);
}

.toggle-row:hover { background: var(--lc-surface-hover); border-color: var(--lc-accent); }
.toggle-row--active { border-color: var(--lc-green); background: var(--lc-green-subtle); }

.toggle-text { display: flex; flex-direction: column; gap: 2px; }
.toggle-label { font-size: var(--lc-text-body-sm); font-weight: var(--lc-weight-semibold); color: var(--lc-text-primary); }
.toggle-desc { font-size: var(--lc-text-caption); color: var(--lc-text-muted); }

/* Notification categories */
.notif-categories {
  display: flex;
  flex-direction: column;
  gap: var(--lc-sp-2);
  margin-top: var(--lc-sp-1);
  padding-left: var(--lc-sp-4);
  border-left: 2px solid var(--lc-border-glass);
}

.notif-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--lc-sp-3);
  padding: var(--lc-sp-2) var(--lc-sp-3);
  border-radius: var(--lc-radius-md);
  border: 1px solid var(--lc-border-subtle);
  background: var(--lc-surface-overlay);
  cursor: pointer;
  transition: border-color var(--lc-transition-hover), background var(--lc-transition-hover);
}

.notif-row:hover { background: var(--lc-surface-hover); }
.notif-row--active { border-color: rgba(39, 192, 99, 0.35); background: var(--lc-green-subtle); }

.notif-text { display: flex; flex-direction: column; gap: 1px; }
.notif-label { font-size: var(--lc-text-body-sm); font-weight: var(--lc-weight-semibold); color: var(--lc-text-primary); }
.notif-desc { font-size: var(--lc-text-caption); color: var(--lc-text-muted); }

/* Toggle switch visual */
.toggle-switch-wrap { flex-shrink: 0; cursor: pointer; }

.sr-only {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border-width: 0;
}

.toggle-switch {
  display: flex;
  align-items: center;
  width: 44px;
  height: 24px;
  border-radius: var(--lc-radius-pill);
  background: var(--lc-border-glass);
  padding: 2px;
  transition: background var(--lc-transition-hover);
  position: relative;
}

.toggle-switch--sm { width: 36px; height: 20px; }

.toggle-switch--on { background: var(--lc-green); }

.toggle-thumb {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: white;
  box-shadow: 0 1px 3px rgba(0,0,0,0.3);
  transition: transform var(--lc-transition-hover);
}

.toggle-switch--sm .toggle-thumb { width: 16px; height: 16px; }
.toggle-switch--on .toggle-thumb { transform: translateX(20px); }
.toggle-switch--sm.toggle-switch--on .toggle-thumb { transform: translateX(16px); }

.step-actions { display: flex; gap: var(--lc-sp-3); align-items: center; flex-wrap: wrap; }
</style>
