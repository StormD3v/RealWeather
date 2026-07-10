<script setup>
/**
 * ProfileStep2Routine.vue
 * Step 2: Declare weekday routine — departure time, return time, outdoor windows.
 * Emits: complete (routine written), skip (nothing written)
 */
import { ref, computed, onMounted } from 'vue'
import { useUserContext } from '@/composables/useUserContext'
import BaseButton from '@/components/ui/BaseButton.vue'
import { uiIcon } from '@/utils/uiIcons'

const emit = defineEmits(['complete', 'skip'])

const { userContext, setContext } = useUserContext()

const departureTime = ref('')
const returnTime = ref('')

// Up to 3 outdoor windows
const outdoorWindows = ref([
  { label: '', startTime: '', endTime: '', error: '' },
  { label: '', startTime: '', endTime: '', error: '' },
  { label: '', startTime: '', endTime: '', error: '' }
])

onMounted(() => {
  const weekday = userContext.value.routines?.weekday
  if (weekday) {
    departureTime.value = weekday.departureTime || ''
    returnTime.value = weekday.returnTime || ''
    if (Array.isArray(weekday.outdoorWindows)) {
      weekday.outdoorWindows.slice(0, 3).forEach((w, i) => {
        outdoorWindows.value[i] = { label: w.label || '', startTime: w.startTime || '', endTime: w.endTime || '', error: '' }
      })
    }
  }
})

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/

function isValidTime(v) {
  return !v || TIME_RE.test(v)
}

const departureError = computed(() => {
  if (departureTime.value && !TIME_RE.test(departureTime.value)) return 'Use HH:MM format (e.g. 08:30)'
  return ''
})

const returnError = computed(() => {
  if (returnTime.value && !TIME_RE.test(returnTime.value)) return 'Use HH:MM format (e.g. 17:30)'
  return ''
})

function validateWindows() {
  let ok = true
  outdoorWindows.value.forEach(w => {
    w.error = ''
    if (!w.startTime && !w.endTime && !w.label) return
    if (w.startTime && !TIME_RE.test(w.startTime)) { w.error = 'Invalid start time (HH:MM)'; ok = false; return }
    if (w.endTime && !TIME_RE.test(w.endTime)) { w.error = 'Invalid end time (HH:MM)'; ok = false; return }
    if (w.startTime && w.endTime && w.endTime <= w.startTime) { w.error = 'End time must be after start time'; ok = false }
  })
  return ok
}

function confirm() {
  if (departureError.value || returnError.value) return
  if (!validateWindows()) return

  const windows = outdoorWindows.value
    .filter(w => w.startTime && w.endTime)
    .map(w => ({
      startTime: w.startTime,
      endTime: w.endTime,
      label: w.label || 'Outdoor time',
      daysOfWeek: []
    }))

  setContext({
    routines: {
      weekday: {
        departureTime: departureTime.value || null,
        returnTime: returnTime.value || null,
        outdoorWindows: windows
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
  <div class="step-routine">
    <div class="step-header">
      <span class="step-icon" aria-hidden="true" v-html="uiIcon('clock')"></span>
      <div>
        <h2 class="step-title">Your daily routine</h2>
        <p class="step-desc">Tell Lumi when you typically leave and arrive, so it can time its advice around your day.</p>
      </div>
    </div>

    <!-- Departure time -->
    <div class="field-group">
      <label for="departure-time" class="field-label">Morning departure time</label>
      <input
        id="departure-time"
        class="text-input"
        :class="{ 'text-input--error': departureError }"
        type="time"
        v-model="departureTime"
        aria-label="Morning departure time"
        aria-describedby="departure-error"
      />
      <p v-if="departureError" id="departure-error" class="field-error" role="alert">{{ departureError }}</p>
      <p v-else class="field-hint">When do you usually leave home on weekdays?</p>
    </div>

    <!-- Return time -->
    <div class="field-group">
      <label for="return-time" class="field-label">Evening return time <span class="optional-tag">optional</span></label>
      <input
        id="return-time"
        class="text-input"
        :class="{ 'text-input--error': returnError }"
        type="time"
        v-model="returnTime"
        aria-label="Evening return time"
        aria-describedby="return-error"
      />
      <p v-if="returnError" id="return-error" class="field-error" role="alert">{{ returnError }}</p>
    </div>

    <!-- Outdoor windows -->
    <div class="field-group">
      <p class="field-label">Regular outdoor windows <span class="optional-tag">optional</span></p>
      <p class="field-hint">Times you're usually outside, e.g. a lunch walk or evening run.</p>

      <div class="windows-list">
        <div
          v-for="(w, i) in outdoorWindows"
          :key="i"
          class="window-row"
          :aria-label="`Outdoor window ${i + 1}`"
        >
          <input
            class="text-input text-input--sm window-label"
            type="text"
            :placeholder="`Label (e.g. Lunch walk)`"
            v-model="w.label"
            :aria-label="`Outdoor window ${i + 1} label`"
            maxlength="40"
          />
          <input
            class="text-input text-input--sm window-time"
            type="time"
            v-model="w.startTime"
            :aria-label="`Outdoor window ${i + 1} start time`"
          />
          <span class="time-sep" aria-hidden="true">–</span>
          <input
            class="text-input text-input--sm window-time"
            type="time"
            v-model="w.endTime"
            :aria-label="`Outdoor window ${i + 1} end time`"
          />
          <p v-if="w.error" class="field-error window-error" role="alert">{{ w.error }}</p>
        </div>
      </div>
    </div>

    <div class="step-actions">
      <BaseButton variant="primary" size="md" @click="confirm" aria-label="Save routine">
        Save routine
      </BaseButton>
      <BaseButton variant="ghost" size="md" @click="skip" aria-label="Skip this step">
        Skip for now
      </BaseButton>
    </div>
  </div>
</template>

<style scoped>
.step-routine { display: flex; flex-direction: column; gap: var(--lc-sp-5); }

.step-header { display: flex; align-items: flex-start; gap: var(--lc-sp-3); }
.step-icon { line-height: 1; flex-shrink: 0; margin-top: 2px; display: inline-flex; width: 28px; height: 28px; }
.step-icon :deep(svg) { width: 28px; height: 28px; }
.step-title { margin: 0 0 var(--lc-sp-1); font-size: var(--lc-text-h3); font-weight: var(--lc-weight-bold); color: var(--lc-text-primary); }
.step-desc { margin: 0; font-size: var(--lc-text-body-sm); color: var(--lc-text-muted); line-height: var(--lc-leading-relaxed); }

.field-group { display: flex; flex-direction: column; gap: var(--lc-sp-2); }

.field-label {
  font-size: var(--lc-text-label);
  font-weight: var(--lc-weight-semibold);
  color: var(--lc-text-secondary);
  text-transform: uppercase;
  letter-spacing: var(--lc-tracking-wider);
}

.optional-tag {
  text-transform: none;
  font-weight: var(--lc-weight-regular);
  color: var(--lc-text-muted);
  letter-spacing: 0;
  font-size: var(--lc-text-caption);
  margin-left: var(--lc-sp-1);
}

.field-hint { margin: 0; font-size: var(--lc-text-caption); color: var(--lc-text-muted); }

.text-input {
  padding: 12px var(--lc-sp-4);
  border-radius: var(--lc-radius-pill);
  border: 1.5px solid var(--lc-border-glass);
  background: var(--lc-surface-overlay);
  color: var(--lc-text-primary);
  font-size: var(--lc-text-body-sm);
  font-family: var(--lc-font-family);
  outline: none;
  transition: border-color var(--lc-transition-hover), box-shadow var(--lc-transition-hover);
  min-height: 48px;
}

.text-input--sm { min-height: 40px; padding: 8px var(--lc-sp-3); font-size: var(--lc-text-caption); }
.text-input:focus { border-color: var(--lc-accent); box-shadow: 0 0 0 3px var(--lc-accent-subtle); }
.text-input--error { border-color: var(--lc-error); }
.text-input::placeholder { color: var(--lc-text-muted); }

.field-error { margin: 0; font-size: var(--lc-text-caption); color: var(--lc-error); font-weight: var(--lc-weight-medium); }

.windows-list { display: flex; flex-direction: column; gap: var(--lc-sp-3); }

.window-row {
  display: grid;
  grid-template-columns: 1fr auto auto auto;
  gap: var(--lc-sp-2);
  align-items: center;
  flex-wrap: wrap;
}

.window-label { grid-column: 1 / -1; }
.window-time { width: 110px; min-width: 0; }
.time-sep { color: var(--lc-text-muted); font-weight: var(--lc-weight-semibold); }
.window-error { grid-column: 1 / -1; }

.step-actions { display: flex; gap: var(--lc-sp-3); align-items: center; flex-wrap: wrap; }

@media (min-width: 480px) {
  .window-row { grid-template-columns: 1fr auto auto auto; }
  .window-label { grid-column: 1; }
}
</style>
