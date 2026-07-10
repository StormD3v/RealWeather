<script setup>
/**
 * SavedLocations.vue — Phase 3.1 upgrade
 *
 * Reads/writes saved locations through useUserContext instead of
 * the old lumicast-saved-locations localStorage key directly.
 *
 * The migration in contextMigration.js (migrateFromLegacySavedLocations)
 * runs on app init and transfers any existing data into userContext.location.saved
 * before this component first renders.
 *
 * Slot-to-id mapping:
 *   home   → 'saved-home'
 *   school → 'saved-school'
 *   work   → 'saved-work'
 *
 * All existing visual behavior, emitted events, and long-press-to-clear
 * behavior are preserved unchanged.
 */
import { computed, nextTick, ref, watch } from 'vue'
import { useUserContext } from '@/composables/useUserContext'

const emit = defineEmits(['load-location'])

const { userContext, setContext } = useUserContext()

const locationSlots = [
  { key: 'home',   label: 'Home',   icon: '🏠', savedId: 'saved-home' },
  { key: 'school', label: 'School', icon: '🎓', savedId: 'saved-school' },
  { key: 'work',   label: 'Work',   icon: '💼', savedId: 'saved-work' }
]

// ── Derive slot values from context ─────────────────────────────────────────
const savedMap = computed(() => {
  const saved = userContext.value.location?.saved ?? []
  const map = {}
  for (const slot of locationSlots) {
    const entry = saved.find(s => s.id === slot.savedId)
    map[slot.key] = entry?.name ?? null
  }
  return map
})

// ── Input state ──────────────────────────────────────────────────────────────
const editingSlot = ref(null)
const cityInput = ref('')
const inputRef = ref(null)
const longPressTriggered = ref(false)
let longPressTimer = null

function normalizeCity(value) {
  return String(value || '')
    .trim()
    .replace(/[^a-zA-Z\s\-']/g, '')
    .slice(0, 60)
}

// ── Saved array helpers ──────────────────────────────────────────────────────
function getSavedArray() {
  return [...(userContext.value.location?.saved ?? [])]
}

function upsertSlot(slotKey, name) {
  const savedId = locationSlots.find(s => s.key === slotKey)?.savedId
  if (!savedId) return

  const arr = getSavedArray().filter(s => s.id !== savedId)
  arr.push({
    id: savedId,
    name,
    lat: null,
    lon: null,
    timezone: null,
    locationType: 'urban'
  })
  setContext({ location: { saved: arr } })
}

function removeSlot(slotKey) {
  const savedId = locationSlots.find(s => s.key === slotKey)?.savedId
  if (!savedId) return

  const arr = getSavedArray().filter(s => s.id !== savedId)
  setContext({ location: { saved: arr } })
}

// ── Interaction handlers ─────────────────────────────────────────────────────
function handleSlotClick(slotKey) {
  if (longPressTriggered.value) {
    longPressTriggered.value = false
    return
  }

  const savedCity = savedMap.value[slotKey]
  if (savedCity) {
    emit('load-location', savedCity)
    return
  }

  editingSlot.value = slotKey
  cityInput.value = ''
}

function saveLocation(slotKey) {
  const normalized = normalizeCity(cityInput.value)
  if (!normalized) return

  upsertSlot(slotKey, normalized)
  editingSlot.value = null
  cityInput.value = ''
  emit('load-location', normalized)
}

function clearLocation(slotKey) {
  removeSlot(slotKey)
  if (editingSlot.value === slotKey) {
    editingSlot.value = null
    cityInput.value = ''
  }
}

function startPress(slotKey) {
  if (!savedMap.value[slotKey]) return

  longPressTriggered.value = false
  longPressTimer = window.setTimeout(() => {
    clearLocation(slotKey)
    longPressTriggered.value = true
    longPressTimer = null
  }, 500)
}

function endPress() {
  if (longPressTimer) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
}

function cancelPress() {
  if (longPressTimer) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
}

function closeInput() {
  editingSlot.value = null
  cityInput.value = ''
}

watch(editingSlot, async (slotKey) => {
  if (slotKey) {
    await nextTick()
    inputRef.value?.focus()
  }
})
</script>

<template>
  <div class="saved-locations" aria-label="Saved locations">
    <div v-for="slot in locationSlots" :key="slot.key" class="saved-location-item">
      <button type="button" class="saved-location-button"
        :class="{ filled: !!savedMap[slot.key], empty: !savedMap[slot.key] }"
        @click="handleSlotClick(slot.key)" @mousedown="startPress(slot.key)" @mouseup="endPress"
        @mouseleave="cancelPress" @touchstart.prevent="startPress(slot.key)" @touchend="endPress"
        @touchcancel="cancelPress">
        <span class="saved-location-label">
          <span aria-hidden="true">{{ slot.icon }}</span>
          <span v-if="savedMap[slot.key]" class="saved-location-name">
            {{ savedMap[slot.key] }}
          </span>
          <span v-else class="saved-location-empty-text">+ {{ slot.label }}</span>
        </span>
      </button>

      <span v-if="savedMap[slot.key]" class="saved-location-clear" role="button" tabindex="0"
        aria-label="Clear saved location" @click.stop="clearLocation(slot.key)">
        ✕
      </span>

      <div v-if="editingSlot === slot.key" class="saved-location-input-wrapper">
        <input ref="inputRef" class="saved-location-input" type="text" placeholder="Type city name"
          v-model="cityInput" @keyup.enter="saveLocation(slot.key)" @blur="closeInput" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.saved-locations {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--lc-sp-3);
  align-items: start;
}

.saved-location-item { display: flex; flex-direction: column; gap: var(--lc-sp-2); min-width: 0; }

.saved-location-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  width: 100%;
  border-radius: var(--lc-radius-pill);
  border: 1.5px dashed var(--lc-border-glass);
  background: var(--lc-surface-overlay);
  color: var(--lc-text-muted);
  padding: 0 var(--lc-sp-4);
  font-size: var(--lc-text-caption);
  font-weight: var(--lc-weight-bold);
  font-family: var(--lc-font-family);
  cursor: pointer;
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
  transition: border-color var(--lc-transition-hover), background var(--lc-transition-hover),
              color var(--lc-transition-hover), transform var(--lc-transition-hover);
}

.saved-location-button:hover { background: var(--lc-surface-hover); border-color: var(--lc-accent); color: var(--lc-text-primary); }

.saved-location-button.filled {
  border-style: solid;
  border-color: rgba(39,192,99,0.8);
  background: var(--lc-green-subtle);
  color: var(--lc-text-primary);
}

.saved-location-button.filled:hover { border-color: var(--lc-green); transform: translateY(-1px); }
.saved-location-button.empty { opacity: 0.7; }

.saved-location-label { display: inline-flex; align-items: center; gap: var(--lc-sp-2); min-width: 0; }

.saved-location-name,
.saved-location-empty-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.saved-location-clear {
  align-self: flex-end;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  min-height: 24px;
  border-radius: var(--lc-radius-pill);
  background: var(--lc-surface-overlay);
  color: var(--lc-text-muted);
  font-size: 0.8rem;
  cursor: pointer;
  user-select: none;
  transition: background var(--lc-transition-hover), color var(--lc-transition-hover);
}

.saved-location-clear:hover { background: var(--lc-error-subtle); color: var(--lc-error); }

.saved-location-input-wrapper { width: 100%; }

.saved-location-input {
  width: 100%;
  padding: var(--lc-sp-3) var(--lc-sp-4);
  border-radius: var(--lc-radius-pill);
  border: 1.5px solid var(--lc-border-glass);
  background: var(--lc-surface-overlay);
  color: var(--lc-text-primary);
  font-size: var(--lc-text-caption);
  font-family: var(--lc-font-family);
  outline: none;
  transition: border-color var(--lc-transition-hover), box-shadow var(--lc-transition-hover);
}

.saved-location-input:focus { border-color: var(--lc-green); box-shadow: 0 0 0 3px var(--lc-green-subtle); }
.saved-location-input::placeholder { color: var(--lc-text-muted); }

@media (max-width: 640px) {
  .saved-locations { gap: var(--lc-sp-2); }
}
</style>
