<script setup>
/**
 * ProfileStep4Sensitivities.vue
 * Step 4: Declare environmental sensitivities.
 * All opt-in, no medical framing.
 * Emits: complete (sensitivities written), skip (nothing written)
 */
import { ref, onMounted } from 'vue'
import { useUserContext } from '@/composables/useUserContext'
import BaseButton from '@/components/ui/BaseButton.vue'

const emit = defineEmits(['complete', 'skip'])

const { userContext, setContext } = useUserContext()

const SENSITIVITIES = [
  { key: 'heat',         icon: '🌡️', label: 'Heat',          desc: 'I feel the heat more than most people' },
  { key: 'cold',         icon: '❄️', label: 'Cold',          desc: 'I feel cold more easily than most people' },
  { key: 'pollen',       icon: '🌸', label: 'Pollen',        desc: 'High pollen levels affect me noticeably' },
  { key: 'uv',           icon: '☀️', label: 'UV',            desc: "I'm sensitive to strong sun and UV exposure" },
  { key: 'airQuality',   icon: '💨', label: 'Air Quality',   desc: 'Poor air quality affects my breathing or wellbeing' },
  { key: 'precipitation',icon: '🌧️', label: 'Precipitation', desc: 'Rain significantly changes my outdoor plans' }
]

const flags = ref({
  heat: false, cold: false, pollen: false,
  uv: false, airQuality: false, precipitation: false
})

onMounted(() => {
  const s = userContext.value.sensitivities
  if (s) {
    Object.keys(flags.value).forEach(k => {
      if (typeof s[k] === 'boolean') flags.value[k] = s[k]
    })
  }
})

function confirm() {
  setContext({ sensitivities: { ...flags.value } })
  emit('complete')
}

function skip() {
  emit('skip')
}
</script>

<template>
  <div class="step-sensitivities">
    <div class="step-header">
      <span class="step-icon" aria-hidden="true">🛡️</span>
      <div>
        <h2 class="step-title">Your sensitivities</h2>
        <p class="step-desc">Lumi uses these to adjust when it alerts you. Everything is optional — only tick what applies to you.</p>
      </div>
    </div>

    <div class="sensitivity-list" role="group" aria-label="Environmental sensitivities">
      <label
        v-for="s in SENSITIVITIES"
        :key="s.key"
        class="sensitivity-row"
        :class="{ 'sensitivity-row--active': flags[s.key] }"
      >
        <input
          type="checkbox"
          class="sensitivity-checkbox"
          v-model="flags[s.key]"
          :aria-label="s.label + ': ' + s.desc"
        />
        <span class="sensitivity-icon" aria-hidden="true">{{ s.icon }}</span>
        <span class="sensitivity-text">
          <span class="sensitivity-label">{{ s.label }}</span>
          <span class="sensitivity-desc">{{ s.desc }}</span>
        </span>
        <span v-if="flags[s.key]" class="sensitivity-check" aria-hidden="true">✓</span>
      </label>
    </div>

    <div class="step-actions">
      <BaseButton variant="primary" size="md" @click="confirm" aria-label="Save sensitivities">
        Save sensitivities
      </BaseButton>
      <BaseButton variant="ghost" size="md" @click="skip" aria-label="Skip this step">
        Skip for now
      </BaseButton>
    </div>
  </div>
</template>

<style scoped>
.step-sensitivities { display: flex; flex-direction: column; gap: var(--lc-sp-5); }

.step-header { display: flex; align-items: flex-start; gap: var(--lc-sp-3); }
.step-icon { font-size: 1.5rem; line-height: 1; flex-shrink: 0; margin-top: 2px; }
.step-title { margin: 0 0 var(--lc-sp-1); font-size: var(--lc-text-h3); font-weight: var(--lc-weight-bold); color: var(--lc-text-primary); }
.step-desc { margin: 0; font-size: var(--lc-text-body-sm); color: var(--lc-text-muted); line-height: var(--lc-leading-relaxed); }

.sensitivity-list { display: flex; flex-direction: column; gap: var(--lc-sp-2); }

.sensitivity-row {
  display: flex;
  align-items: center;
  gap: var(--lc-sp-3);
  padding: var(--lc-sp-3) var(--lc-sp-4);
  border-radius: var(--lc-radius-lg);
  border: 1.5px solid var(--lc-border-glass);
  background: var(--lc-surface-overlay);
  cursor: pointer;
  transition: border-color var(--lc-transition-hover), background var(--lc-transition-hover);
  user-select: none;
  position: relative;
}

.sensitivity-row:hover { background: var(--lc-surface-hover); border-color: var(--lc-accent); }

.sensitivity-row--active {
  border-color: var(--lc-green);
  background: var(--lc-green-subtle);
}

.sensitivity-checkbox {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  accent-color: var(--lc-green);
  cursor: pointer;
}

.sensitivity-icon { font-size: 1.25rem; line-height: 1; flex-shrink: 0; }

.sensitivity-text { display: flex; flex-direction: column; gap: 1px; flex: 1; min-width: 0; }
.sensitivity-label { font-size: var(--lc-text-body-sm); font-weight: var(--lc-weight-semibold); color: var(--lc-text-primary); }
.sensitivity-desc { font-size: var(--lc-text-caption); color: var(--lc-text-muted); line-height: var(--lc-leading-snug); }

.sensitivity-check {
  flex-shrink: 0;
  font-size: var(--lc-text-body-sm);
  font-weight: var(--lc-weight-bold);
  color: var(--lc-green);
}

.step-actions { display: flex; gap: var(--lc-sp-3); align-items: center; flex-wrap: wrap; }
</style>
