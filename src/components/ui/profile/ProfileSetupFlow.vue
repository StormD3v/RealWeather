<script setup>
/**
 * ProfileSetupFlow.vue
 * Multi-step onboarding shell: steps 1–5.
 * Props:
 *   startStep: Number (default 1) — which step to open first
 * Emits: setup-complete
 */
import { ref, computed, shallowRef } from 'vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import ProfileStep1Location from './ProfileStep1Location.vue'
import ProfileStep2Routine from './ProfileStep2Routine.vue'
import ProfileStep3Activities from './ProfileStep3Activities.vue'
import ProfileStep4Sensitivities from './ProfileStep4Sensitivities.vue'
import ProfileStep5Preferences from './ProfileStep5Preferences.vue'

const props = defineProps({
  startStep: { type: Number, default: 1 }
})

const emit = defineEmits(['setup-complete'])

const STEPS = [
  { component: ProfileStep1Location,     title: 'Location',      number: 1 },
  { component: ProfileStep2Routine,      title: 'Routine',       number: 2 },
  { component: ProfileStep3Activities,   title: 'Activities',    number: 3 },
  { component: ProfileStep4Sensitivities,title: 'Sensitivities', number: 4 },
  { component: ProfileStep5Preferences,  title: 'Preferences',   number: 5 }
]

const currentStepIndex = ref(Math.max(0, Math.min(props.startStep - 1, STEPS.length - 1)))

const currentStep = computed(() => STEPS[currentStepIndex.value])
const isFirstStep = computed(() => currentStepIndex.value === 0)
const isLastStep  = computed(() => currentStepIndex.value === STEPS.length - 1)

const progressPercent = computed(() =>
  Math.round(((currentStepIndex.value + 1) / STEPS.length) * 100)
)

function advance() {
  if (isLastStep.value) {
    emit('setup-complete')
  } else {
    currentStepIndex.value++
  }
}

function goBack() {
  if (!isFirstStep.value) currentStepIndex.value--
}

function onStepComplete() { advance() }
function onStepSkip()     { advance() }
</script>

<template>
  <div class="flow-container" role="dialog" aria-modal="true" aria-label="Profile setup">

    <!-- Progress header -->
    <div class="flow-header">
      <div class="flow-meta">
        <span class="flow-step-label">Step {{ currentStep.number }} of {{ STEPS.length }}</span>
        <span class="flow-step-name">{{ currentStep.title }}</span>
      </div>
      <div
        class="flow-progress-bar"
        role="progressbar"
        :aria-valuenow="progressPercent"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-label="`Step ${currentStep.number} of ${STEPS.length}`"
      >
        <div class="flow-progress-fill" :style="{ width: progressPercent + '%' }"></div>
      </div>

      <!-- Step dots -->
      <div class="flow-dots" aria-hidden="true">
        <span
          v-for="step in STEPS"
          :key="step.number"
          class="flow-dot"
          :class="{
            'flow-dot--active': step.number === currentStep.number,
            'flow-dot--done': step.number < currentStep.number
          }"
        ></span>
      </div>
    </div>

    <!-- Step content -->
    <div class="flow-body">
      <component
        :is="currentStep.component"
        @complete="onStepComplete"
        @skip="onStepSkip"
      />
    </div>

    <!-- Back navigation -->
    <div v-if="!isFirstStep" class="flow-nav">
      <BaseButton variant="ghost" size="sm" @click="goBack" aria-label="Go back to previous step">
        ← Back
      </BaseButton>
    </div>

  </div>
</template>

<style scoped>
.flow-container {
  display: flex;
  flex-direction: column;
  gap: var(--lc-sp-5);
}

.flow-header { display: flex; flex-direction: column; gap: var(--lc-sp-2); }

.flow-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.flow-step-label {
  font-size: var(--lc-text-caption);
  color: var(--lc-text-muted);
  font-weight: var(--lc-weight-medium);
}

.flow-step-name {
  font-size: var(--lc-text-caption);
  color: var(--lc-accent);
  font-weight: var(--lc-weight-semibold);
}

.flow-progress-bar {
  height: 4px;
  border-radius: var(--lc-radius-pill);
  background: var(--lc-border-glass);
  overflow: hidden;
}

.flow-progress-fill {
  height: 100%;
  border-radius: var(--lc-radius-pill);
  background: var(--lc-accent);
  transition: width var(--lc-transition-base);
}

.flow-dots {
  display: flex;
  gap: var(--lc-sp-1);
  justify-content: center;
}

.flow-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--lc-border-glass);
  transition: background var(--lc-transition-hover), transform var(--lc-transition-hover);
}

.flow-dot--done    { background: var(--lc-green); }
.flow-dot--active  { background: var(--lc-accent); transform: scale(1.3); }

.flow-body { min-height: 0; }

.flow-nav {
  padding-top: var(--lc-sp-2);
  border-top: 1px solid var(--lc-border-subtle);
}
</style>
