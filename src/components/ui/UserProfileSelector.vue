<script setup>
/**
 * UserProfileSelector.vue — Phase 3.1 + Phase 3.4 upgrade
 *
 * Phase 3.1: Full profile management surface.
 * Phase 3.4: Signal audit section — shows behavioral learning summary
 *            and lets the user delete all recorded signals.
 *
 * Backwards compatibility:
 *   - Still emits 'profile-changed' once on mount with the legacy
 *     lumicast-user-profile value (or 'general') so App.vue continues to work.
 *   - The lumicast-user-profile key is READ once for the legacy emit only —
 *     it is never written here.
 *   - All new writes go through useUserContext.setContext().
 */
import { ref, computed, onMounted } from 'vue'
import { useUserContext } from '@/composables/useUserContext'
import { useBehavioralSignals } from '@/composables/useBehavioralSignals'
import BaseButton from '@/components/ui/BaseButton.vue'
import ProfileSetupFlow from '@/components/ui/profile/ProfileSetupFlow.vue'
import { uiIcon } from '@/utils/uiIcons'

const emit = defineEmits(['profile-changed'])

const { userContext, contextQuality, clearContext } = useUserContext()
const { learningEnabled, getSignalSummary, clearSignals } = useBehavioralSignals()

// ── Profile setup flow overlay ───────────────────────────────────────────────
const showFlow = ref(false)
const flowStartStep = ref(1)

function openSetup(step = 1) {
  flowStartStep.value = step
  showFlow.value = true
}

function onSetupComplete() {
  showFlow.value = false
}

// ── Clear-all confirmation state ─────────────────────────────────────────────
const showClearConfirm = ref(false)

function confirmClear() {
  clearContext()
  showClearConfirm.value = false
}

// ── Signal audit state ────────────────────────────────────────────────────────
const showSignalClearConfirm = ref(false)

/** Live summary of recent signals (30-day window). Recomputed on demand. */
const signalSummary = computed(() => getSignalSummary())

function confirmClearSignals() {
  clearSignals()
  showSignalClearConfirm.value = false
}

// ── Derived display values ───────────────────────────────────────────────────
const locationLabel = computed(() => {
  const p = userContext.value.location?.primary
  return p?.name ?? 'Not set'
})

const departureLabel = computed(() => {
  const t = userContext.value.routines?.weekday?.departureTime
  if (!t) return 'Not set'
  // Format HH:MM to locale time
  try {
    const [h, m] = t.split(':').map(Number)
    return new Date(2000, 0, 1, h, m).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  } catch {
    return t
  }
})

const activitiesLabel = computed(() => {
  const declared = userContext.value.activities?.declared ?? []
  if (!declared.length) return 'None declared'
  const names = declared.slice(0, 3).map(a => a.label)
  return declared.length > 3 ? names.join(', ') + ` +${declared.length - 3}` : names.join(', ')
})

const sensitivitiesLabel = computed(() => {
  const s = userContext.value.sensitivities
  if (!s) return 'None declared'
  const count = Object.values(s).filter(Boolean).length
  return count === 0 ? 'None declared' : count === 1 ? '1 sensitivity' : `${count} sensitivities`
})

// ── Legacy compatibility ─────────────────────────────────────────────────────
onMounted(() => {
  const legacy = localStorage.getItem('lumicast-user-profile') || 'general'
  emit('profile-changed', legacy)
})
</script>

<template>
  <div class="profile-selector" aria-label="User profile">

    <!-- ── Setup flow overlay ── -->
    <Teleport to="body">
      <div
        v-if="showFlow"
        class="flow-backdrop"
        role="dialog"
        aria-modal="true"
        aria-label="Profile setup"
        @keydown.escape="showFlow = false"
      >
        <div class="flow-panel">
          <div class="flow-panel-header">
            <span class="flow-panel-title">Set up your profile</span>
            <button
              type="button"
              class="flow-close-btn"
              aria-label="Close profile setup"
              @click="showFlow = false"
            >✕</button>
          </div>
          <div class="flow-panel-body">
            <ProfileSetupFlow
              :start-step="flowStartStep"
              @setup-complete="onSetupComplete"
            />
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ── Empty / first-run state ── -->
    <div v-if="contextQuality === 'none'" class="profile-empty">
      <div class="profile-empty-text">
        <span class="profile-empty-icon" aria-hidden="true" v-html="uiIcon('user')"></span>
        <div>
          <p class="profile-empty-heading">Personalise LumiCast</p>
          <p class="profile-empty-desc">Add your location and routine to get smarter, more relevant weather insights.</p>
        </div>
      </div>
      <BaseButton variant="primary" size="sm" @click="openSetup(1)" aria-label="Set up your profile">
        Set up profile
      </BaseButton>
    </div>

    <!-- ── Summary state ── -->
    <div v-else class="profile-summary">
      <div class="profile-summary-grid">
        <div class="summary-item">
          <span class="summary-icon" aria-hidden="true" v-html="uiIcon('location')"></span>
          <span class="summary-label">Location</span>
          <span class="summary-value">{{ locationLabel }}</span>
        </div>
        <div class="summary-item">
          <span class="summary-icon" aria-hidden="true" v-html="uiIcon('clock')"></span>
          <span class="summary-label">Departure</span>
          <span class="summary-value">{{ departureLabel }}</span>
        </div>
        <div class="summary-item">
          <span class="summary-icon" aria-hidden="true" v-html="uiIcon('leaf')"></span>
          <span class="summary-label">Activities</span>
          <span class="summary-value">{{ activitiesLabel }}</span>
        </div>
        <div class="summary-item">
          <span class="summary-icon" aria-hidden="true" v-html="uiIcon('shield')"></span>
          <span class="summary-label">Sensitivities</span>
          <span class="summary-value">{{ sensitivitiesLabel }}</span>
        </div>
      </div>

      <div class="profile-summary-actions">
        <BaseButton variant="secondary" size="sm" @click="openSetup(1)" aria-label="Edit your profile">
          Edit profile
        </BaseButton>
      </div>
    </div>

    <!-- ── Data management section (always visible) ── -->
    <div class="profile-data-section">
      <div class="data-section-header">
        <span class="data-section-title">Signal data</span>
        <span
          class="learning-badge"
          :class="learningEnabled ? 'learning-badge--on' : 'learning-badge--off'"
          :aria-label="`Behavioral learning is ${learningEnabled ? 'on' : 'off'}`"
        >
          {{ learningEnabled ? 'Learning on' : 'Learning off' }}
        </span>
      </div>

      <!-- Summary when learning is on and there is data -->
      <template v-if="learningEnabled && signalSummary.totalSignals > 0">
        <div class="signal-stats" aria-label="Signal summary for the last 30 days">
          <div class="signal-stat">
            <span class="signal-stat-value">{{ signalSummary.appOpens }}</span>
            <span class="signal-stat-label">app opens</span>
          </div>
          <div class="signal-stat">
            <span class="signal-stat-value">{{ signalSummary.insightEngagements }}</span>
            <span class="signal-stat-label">insight actions</span>
          </div>
        </div>
        <p class="data-section-note">Last 30 days · All data stays on this device.</p>

        <!-- Clear signals only -->
        <div v-if="!showSignalClearConfirm" class="clear-row">
          <button
            type="button"
            class="clear-btn"
            @click="showSignalClearConfirm = true"
            aria-label="Delete all behavioral signal data"
          >
            Delete signal data
          </button>
        </div>

        <div v-else class="clear-confirm" role="alertdialog" aria-label="Confirm signal deletion">
          <p class="clear-confirm-text">This will remove all signal data. Your profile and preferences are not affected.</p>
          <div class="clear-confirm-actions">
            <BaseButton variant="danger" size="sm" @click="confirmClearSignals" aria-label="Confirm delete signal data">
              Yes, delete signals
            </BaseButton>
            <BaseButton variant="ghost" size="sm" @click="showSignalClearConfirm = false" aria-label="Cancel">
              Cancel
            </BaseButton>
          </div>
        </div>
      </template>

      <!-- No data yet or learning is off -->
      <template v-else>
        <p class="data-section-note">
          <template v-if="!learningEnabled">Behavioral learning is off — no signals are being recorded.</template>
          <template v-else>No signal data recorded yet. Signal data builds up as you use the app.</template>
        </p>
      </template>

      <!-- Clear all profile data -->
      <div v-if="!showClearConfirm" class="clear-row">
        <button
          type="button"
          class="clear-btn"
          @click="showClearConfirm = true"
          aria-label="Clear all profile data"
        >
          Clear all my data
        </button>
      </div>

      <div v-else class="clear-confirm" role="alertdialog" aria-label="Confirm data deletion">
        <p class="clear-confirm-text">This will remove all your profile data and signals. Lumi will return to default settings.</p>
        <div class="clear-confirm-actions">
          <BaseButton variant="danger" size="sm" @click="confirmClear" aria-label="Confirm clear all data">
            Yes, clear everything
          </BaseButton>
          <BaseButton variant="ghost" size="sm" @click="showClearConfirm = false" aria-label="Cancel">
            Cancel
          </BaseButton>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
.profile-selector {
  display: flex;
  flex-direction: column;
  gap: var(--lc-sp-3);
}

/* ── Empty state ── */
.profile-empty {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--lc-sp-3);
  padding: var(--lc-sp-3) var(--lc-sp-4);
  border-radius: var(--lc-radius-lg);
  border: 1px dashed var(--lc-border-glass);
  background: var(--lc-surface-overlay);
  flex-wrap: wrap;
}

.profile-empty-text {
  display: flex;
  align-items: flex-start;
  gap: var(--lc-sp-3);
  flex: 1;
  min-width: 0;
}

.profile-empty-icon { flex-shrink: 0; width: 28px; height: 28px; display: inline-flex; }
.profile-empty-icon :deep(svg) { width: 28px; height: 28px; }

.profile-empty-heading {
  margin: 0 0 2px;
  font-size: var(--lc-text-body-sm);
  font-weight: var(--lc-weight-bold);
  color: var(--lc-text-primary);
}

.profile-empty-desc {
  margin: 0;
  font-size: var(--lc-text-caption);
  color: var(--lc-text-muted);
  line-height: var(--lc-leading-snug);
}

/* ── Summary state ── */
.profile-summary { display: flex; flex-direction: column; gap: var(--lc-sp-3); }

.profile-summary-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--lc-sp-2);
}

.summary-item {
  display: flex;
  align-items: flex-start;
  gap: var(--lc-sp-2);
  padding: var(--lc-sp-2) var(--lc-sp-3);
  border-radius: var(--lc-radius-md);
  background: var(--lc-surface-overlay);
  border: 1px solid var(--lc-border-subtle);
  min-width: 0;
  overflow: hidden;
}

.summary-icon { line-height: 1.2; flex-shrink: 0; width: 18px; height: 18px; display: inline-flex; }
.summary-icon :deep(svg) { width: 18px; height: 18px; }

.summary-item > :not(.summary-icon) { display: flex; flex-direction: column; gap: 1px; min-width: 0; overflow: hidden; }

.summary-label {
  font-size: var(--lc-text-label);
  font-weight: var(--lc-weight-semibold);
  color: var(--lc-text-muted);
  text-transform: uppercase;
  letter-spacing: var(--lc-tracking-wider);
}

.summary-value {
  font-size: var(--lc-text-caption);
  font-weight: var(--lc-weight-medium);
  color: var(--lc-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.profile-summary-actions { display: flex; }

/* ── Data section ── */
.profile-data-section {
  display: flex;
  flex-direction: column;
  gap: var(--lc-sp-2);
  padding-top: var(--lc-sp-3);
  border-top: 1px solid var(--lc-border-subtle);
}

.data-section-header { display: flex; align-items: center; justify-content: space-between; }

.data-section-title {
  font-size: var(--lc-text-label);
  font-weight: var(--lc-weight-semibold);
  color: var(--lc-text-muted);
  text-transform: uppercase;
  letter-spacing: var(--lc-tracking-wider);
}

/* Learning on/off badge */
.learning-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px var(--lc-sp-2);
  border-radius: var(--lc-radius-pill);
  font-size: var(--lc-text-label);
  font-weight: var(--lc-weight-semibold);
}

.learning-badge--on {
  background: var(--lc-success-subtle);
  color: var(--lc-success);
  border: 1px solid rgba(34,197,94,0.2);
}

.learning-badge--off {
  background: var(--lc-surface-overlay);
  color: var(--lc-text-muted);
  border: 1px solid var(--lc-border-subtle);
}

/* Signal stats row */
.signal-stats {
  display: flex;
  gap: var(--lc-sp-4);
}

.signal-stat {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.signal-stat-value {
  font-size: var(--lc-text-body-sm);
  font-weight: var(--lc-weight-bold);
  color: var(--lc-text-primary);
  line-height: 1;
}

.signal-stat-label {
  font-size: var(--lc-text-label);
  color: var(--lc-text-muted);
}

.data-section-note {
  margin: 0;
  font-size: var(--lc-text-caption);
  color: var(--lc-text-muted);
  font-style: italic;
}

.clear-row { display: flex; }

.clear-btn {
  background: none;
  border: none;
  padding: 0;
  font-family: var(--lc-font-family);
  font-size: var(--lc-text-caption);
  color: var(--lc-text-muted);
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
  transition: color var(--lc-transition-hover);
}

.clear-btn:hover { color: var(--lc-error); }

.clear-confirm {
  display: flex;
  flex-direction: column;
  gap: var(--lc-sp-3);
  padding: var(--lc-sp-3) var(--lc-sp-4);
  border-radius: var(--lc-radius-md);
  border: 1px solid rgba(239,68,68,0.25);
  background: var(--lc-error-subtle);
}

.clear-confirm-text {
  margin: 0;
  font-size: var(--lc-text-caption);
  color: var(--lc-text-primary);
  line-height: var(--lc-leading-snug);
}

.clear-confirm-actions { display: flex; gap: var(--lc-sp-2); flex-wrap: wrap; }

/* ── Flow overlay ── */
.flow-backdrop {
  position: fixed;
  inset: 0;
  z-index: var(--lc-z-modal);
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--lc-sp-4);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

.flow-panel {
  width: 100%;
  max-width: 520px;
  max-height: 90vh;
  overflow-y: auto;
  border-radius: var(--lc-radius-2xl);
  background: var(--lc-surface-raised);
  border: 1px solid var(--lc-border-glass);
  box-shadow: var(--lc-shadow-modal);
  display: flex;
  flex-direction: column;
}

.flow-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--lc-sp-4) var(--lc-sp-5);
  border-bottom: 1px solid var(--lc-border-subtle);
  flex-shrink: 0;
}

.flow-panel-title {
  font-size: var(--lc-text-h3);
  font-weight: var(--lc-weight-bold);
  color: var(--lc-text-primary);
}

.flow-close-btn {
  width: 32px;
  height: 32px;
  min-height: 32px;
  border: 1px solid var(--lc-border-glass);
  border-radius: var(--lc-radius-pill);
  background: var(--lc-surface-overlay);
  color: var(--lc-text-muted);
  font-size: 0.8rem;
  cursor: pointer;
  display: grid;
  place-items: center;
  transition: background var(--lc-transition-hover), color var(--lc-transition-hover);
}

.flow-close-btn:hover { background: var(--lc-surface-hover); color: var(--lc-text-primary); }

.flow-panel-body { padding: var(--lc-sp-5); overflow-y: auto; }

@media (max-width: 480px) {
  .profile-summary-grid { grid-template-columns: 1fr; }
  .flow-panel { max-height: 100vh; border-radius: var(--lc-radius-xl) var(--lc-radius-xl) 0 0; }
  .flow-backdrop { align-items: flex-end; padding: 0; }
}
</style>
