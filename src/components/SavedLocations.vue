<script setup>
import { onMounted, nextTick, ref, watch } from 'vue'

const emit = defineEmits(['load-location'])
const STORAGE_KEY = 'lumicast-saved-locations'

const locationSlots = [
    { key: 'home', label: 'Home', icon: '🏠' },
    { key: 'school', label: 'School', icon: '🎓' },
    { key: 'work', label: 'Work', icon: '💼' }
]

const savedLocations = ref({ home: null, school: null, work: null })
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

function loadSavedLocations() {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return

    try {
        const parsed = JSON.parse(raw)
        if (parsed && typeof parsed === 'object') {
            savedLocations.value = {
                home: parsed.home || null,
                school: parsed.school || null,
                work: parsed.work || null
            }
        }
    } catch (error) {
        console.error('Failed to load saved locations:', error)
    }
}

function saveSavedLocations() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedLocations.value))
}

function handleSlotClick(slotKey) {
    if (longPressTriggered.value) {
        longPressTriggered.value = false
        return
    }

    const savedCity = savedLocations.value[slotKey]
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

    savedLocations.value[slotKey] = normalized
    saveSavedLocations()
    editingSlot.value = null
    cityInput.value = ''
    emit('load-location', normalized)
}

function clearLocation(slotKey) {
    savedLocations.value[slotKey] = null
    saveSavedLocations()
    if (editingSlot.value === slotKey) {
        editingSlot.value = null
        cityInput.value = ''
    }
}

function startPress(slotKey) {
    if (!savedLocations.value[slotKey]) return

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

onMounted(() => {
    loadSavedLocations()
})
</script>

<template>
    <div class="saved-locations" aria-label="Saved locations">
        <div v-for="slot in locationSlots" :key="slot.key" class="saved-location-item">
            <button type="button" class="saved-location-button"
                :class="{ filled: !!savedLocations[slot.key], empty: !savedLocations[slot.key] }"
                @click="handleSlotClick(slot.key)" @mousedown="startPress(slot.key)" @mouseup="endPress"
                @mouseleave="cancelPress" @touchstart.prevent="startPress(slot.key)" @touchend="endPress"
                @touchcancel="cancelPress">
                <span class="saved-location-label">
                    <span aria-hidden="true">{{ slot.icon }}</span>
                    <span v-if="savedLocations[slot.key]" class="saved-location-name">
                        {{ savedLocations[slot.key] }}
                    </span>
                    <span v-else class="saved-location-empty-text">+ {{ slot.label }}</span>
                </span>
            </button>

            <span v-if="savedLocations[slot.key]" class="saved-location-clear" role="button" tabindex="0"
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
    gap: 10px;
    align-items: start;
}

.saved-location-item {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
}

.saved-location-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    width: 100%;
    border-radius: 999px;
    border: 1px dashed rgba(255, 255, 255, 0.35);
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.65);
    padding: 0 14px;
    font-size: 0.94rem;
    font-weight: 700;
    cursor: pointer;
    text-overflow: ellipsis;
    overflow: hidden;
    white-space: nowrap;
    transition: border-color 0.2s ease, background 0.2s ease, color 0.2s ease;
}

.saved-location-button.filled {
    border-style: solid;
    border-color: rgba(39, 192, 99, 0.9);
    background: rgba(39, 192, 99, 0.12);
    color: #ffffff;
}

.saved-location-button.empty {
    opacity: 0.72;
}

.saved-location-label {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
}

.saved-location-name,
.saved-location-empty-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.saved-location-clear {
    align-self: flex-end;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.8);
    font-size: 0.88rem;
    cursor: pointer;
    user-select: none;
}

.saved-location-input-wrapper {
    width: 100%;
}

.saved-location-input {
    width: 100%;
    padding: 10px 14px;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.18);
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
    font-size: 0.92rem;
    outline: none;
}

.saved-location-input::placeholder {
    color: rgba(255, 255, 255, 0.5);
}

@media (max-width: 640px) {
    .saved-locations {
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px;
    }
}
</style>
