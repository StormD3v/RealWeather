<template>
    <div class="calendar-card">
        <div class="calendar-card-header">
            <h3>🗓️ My Day Planner</h3>
            <div class="input-row">
                <input type="text" v-model="eventName" placeholder="Event name" aria-label="Event name" />
                <input type="time" v-model="eventTime" aria-label="Event time" />
                <button type="button" :disabled="!canAdd" @click="addEvent">Add</button>
            </div>
        </div>

        <div v-if="!events.length" class="empty-state">
            Add up to 5 events to see weather risk checks at a glance.
        </div>

        <div class="event-list">
            <div v-for="(event, index) in events" :key="`${event.name}-${event.time}-${index}`"
                :class="['event-row', eventRiskClass(event)]">
                <div class="event-row-top">
                    <div>
                        <p class="event-name">{{ event.name }}</p>
                        <p class="event-time">{{ event.time }}</p>
                    </div>
                    <button type="button" class="delete-btn" @click="removeEvent(index)"
                        aria-label="Delete event">✕</button>
                </div>

                <div class="event-metrics">
                    <div class="weather-info">
                        <span class="weather-icon">{{ forecastIcon(eventForecast(event)) }}</span>
                        <span class="weather-temp">{{ eventForecast(event)?.tempText ?? 'No forecast' }}</span>
                    </div>
                    <span class="status-badge">{{ eventStatus(event).label }}</span>
                </div>

                <p v-if="eventStatus(event).suggestion" class="suggestion-text">
                    Better window: {{ eventStatus(event).suggestion }}
                </p>
            </div>
        </div>
    </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'

const props = defineProps({
    hourlyForecast: {
        type: Array,
        default: () => []
    },
    currentWeather: {
        type: Object,
        default: () => ({})
    }
})

const storageKey = 'lumicast-calendar-events'
const eventName = ref('')
const eventTime = ref('08:00')
const events = ref([])

const hourlySlots = computed(() => {
    return (props.hourlyForecast ?? [])
        .slice()
        .sort((a, b) => Number(a.dt) - Number(b.dt))
})

const canAdd = computed(() => {
    return eventName.value.trim() && eventTime.value && events.value.length < 5
})

const loadEvents = () => {
    try {
        const stored = JSON.parse(localStorage.getItem(storageKey) || '[]')
        if (Array.isArray(stored)) {
            events.value = stored
                .filter((item) => item && item.name && item.time)
                .slice(0, 5)
        }
    } catch (error) {
        events.value = []
    }
}

const saveEvents = () => {
    localStorage.setItem(storageKey, JSON.stringify(events.value))
}

const parseEventHour = (timeString) => {
    const [hourStr] = (timeString || '00:00').split(':')
    return Number(hourStr)
}

const formatClock = (dt) => {
    if (!dt) return ''
    return new Date(dt * 1000).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
    })
}

const eventForecast = (event) => {
    if (!event || !event.time || !hourlySlots.value.length) {
        return null
    }

    const targetHour = parseEventHour(event.time)
    let bestMatch = null
    let bestDistance = Infinity

    for (const slot of hourlySlots.value) {
        const slotHour = new Date(slot.dt * 1000).getHours()
        const distance = Math.abs(slotHour - targetHour)
        if (distance < bestDistance) {
            bestDistance = distance
            bestMatch = slot
        }
    }

    return bestMatch
}

const isRiskSlot = (slot) => {
    if (!slot) return false
    const rainRisk = (slot.pop ?? 0) > 0.5
    const windRisk = (slot.wind_speed ?? 0) > 40
    return rainRisk || windRisk
}

const eventStatus = (event) => {
    const slot = eventForecast(event)
    if (!slot) {
        return {
            label: 'No forecast',
            variant: 'no-data',
            suggestion: ''
        }
    }

    const rainRisk = (slot.pop ?? 0) > 0.5
    const windRisk = (slot.wind_speed ?? 0) > 40
    const suggestion = rainRisk || windRisk ? findSafeWindow(event.time) : ''

    if (rainRisk && !windRisk) {
        return {
            label: '🌧️ Rain Expected',
            variant: 'rain',
            suggestion
        }
    }

    if (rainRisk || windRisk) {
        return {
            label: '⚠️ At Risk',
            variant: 'at-risk',
            suggestion
        }
    }

    return {
        label: '✅ Clear',
        variant: 'clear',
        suggestion: ''
    }
}

const findSafeWindow = (timeString) => {
    if (!hourlySlots.value.length) {
        return ''
    }

    const targetHour = parseEventHour(timeString)
    const slots = hourlySlots.value
    let firstSafe = null

    for (let i = 0; i < slots.length - 1; i += 1) {
        const current = slots[i]
        const next = slots[i + 1]
        const currentHour = new Date(current.dt * 1000).getHours()
        const nextHour = new Date(next.dt * 1000).getHours()
        const consecutive = currentHour + 1 === nextHour || (currentHour === 23 && nextHour === 0)

        if (!consecutive) {
            continue
        }

        if (!isRiskSlot(current) && !isRiskSlot(next)) {
            const windowText = `${formatClock(current.dt)} - ${formatClock(next.dt)}`
            if (currentHour >= targetHour) {
                return windowText
            }
            if (!firstSafe) {
                firstSafe = windowText
            }
        }
    }

    return firstSafe || ''
}

const forecastIcon = (slot) => {
    if (!slot || !slot.weather || !slot.weather.length) {
        return '❔'
    }

    const main = slot.weather[0].main || ''
    switch (main) {
        case 'Clear':
            return '☀️'
        case 'Clouds':
            return '☁️'
        case 'Rain':
        case 'Drizzle':
            return '🌧️'
        case 'Thunderstorm':
            return '⛈️'
        case 'Snow':
            return '❄️'
        case 'Mist':
        case 'Fog':
        case 'Haze':
            return '🌫️'
        default:
            return '🌤️'
    }
}

const eventRiskClass = (event) => {
    const status = eventStatus(event).variant
    return status === 'clear' ? 'clear' : status === 'rain' ? 'rain' : status === 'at-risk' ? 'at-risk' : 'no-data'
}

const addEvent = () => {
    if (!canAdd.value) {
        return
    }

    events.value.push({
        name: eventName.value.trim(),
        time: eventTime.value
    })
    eventName.value = ''
}

const removeEvent = (index) => {
    events.value.splice(index, 1)
}

watch(events, saveEvents, { deep: true })

onMounted(() => {
    loadEvents()
})
</script>

<style scoped>
.calendar-card {
  display: flex;
  flex-direction: column;
  gap: var(--lc-sp-5);
  padding: var(--lc-sp-5);
  border-radius: var(--lc-radius-xl);
  background: linear-gradient(135deg, var(--lc-green-subtle), var(--lc-surface-overlay));
  border: 2px solid rgba(39,192,99,0.25);
  border-top: 4px solid var(--lc-green);
  backdrop-filter: var(--lc-blur-md);
  -webkit-backdrop-filter: var(--lc-blur-md);
  box-shadow: 0 0 28px rgba(39,192,99,0.07);
}

.calendar-card-header { display: flex; flex-direction: column; gap: var(--lc-sp-4); }

.calendar-card-header h3 {
  margin: 0;
  font-size: var(--lc-text-h3);
  font-weight: var(--lc-weight-bold);
  color: var(--lc-green);
}

.input-row { display: flex; flex-wrap: wrap; gap: var(--lc-sp-3); align-items: center; }

.input-row input,
.input-row button {
  min-height: 44px;
  border-radius: var(--lc-radius-md);
  border: 1px solid var(--lc-border-glass);
  background: var(--lc-surface-overlay);
  color: var(--lc-text-primary);
  padding: var(--lc-sp-3) var(--lc-sp-4);
  font-family: var(--lc-font-family);
}

.input-row input { outline: none; transition: border-color var(--lc-transition-hover), box-shadow var(--lc-transition-hover); }
.input-row input:focus { border-color: var(--lc-green); box-shadow: 0 0 0 3px var(--lc-green-subtle); }
.input-row input::placeholder { color: var(--lc-text-muted); }
.input-row input[type='text'] { flex: 1 1 0; min-width: 0; }
.input-row input[type='time'] { min-width: 130px; }

.input-row button {
  font-weight: var(--lc-weight-bold);
  color: var(--lc-text-inverted);
  background: var(--lc-green);
  cursor: pointer;
  transition: background var(--lc-transition-hover), transform var(--lc-transition-hover);
}
.input-row button:disabled { opacity: 0.5; cursor: not-allowed; }
.input-row button:not(:disabled):hover { background: var(--lc-green-hover); transform: translateY(-1px); }

.empty-state { color: rgba(39,192,99,0.55); font-size: var(--lc-text-body-sm); }

.event-list { display: flex; flex-direction: column; gap: var(--lc-sp-4); }

.event-row {
  display: flex;
  flex-direction: column;
  gap: var(--lc-sp-4);
  padding: var(--lc-sp-5);
  border-radius: var(--lc-radius-xl);
  border: 1px solid var(--lc-border-glass);
  background: var(--lc-surface-overlay);
  transition: background var(--lc-transition-hover);
}

.event-row.clear      { border-left: 4px solid var(--lc-success); }
.event-row.at-risk    { border-left: 4px solid var(--lc-warning); }
.event-row.rain       { border-left: 4px solid #fb923c; }
.event-row.no-data    { border-left: 4px solid var(--lc-border-strong); }

.event-row-top { display: flex; justify-content: space-between; align-items: center; gap: var(--lc-sp-3); }

.event-name { margin: 0 0 var(--lc-sp-1); font-weight: var(--lc-weight-bold); color: var(--lc-text-primary); font-size: var(--lc-text-body-sm); }
.event-time { margin: 0; color: var(--lc-text-muted); font-size: var(--lc-text-caption); }

.delete-btn {
  border: none;
  background: var(--lc-surface-overlay);
  color: var(--lc-text-muted);
  width: 34px;
  height: 34px;
  min-height: 34px;
  border-radius: var(--lc-radius-md);
  cursor: pointer;
  transition: background var(--lc-transition-hover), color var(--lc-transition-hover);
}
.delete-btn:hover { background: var(--lc-error-subtle); color: var(--lc-error); }

.event-metrics { display: flex; flex-wrap: wrap; gap: var(--lc-sp-3); align-items: center; }

.weather-info { display: inline-flex; align-items: center; gap: var(--lc-sp-2); font-size: var(--lc-text-body-sm); color: var(--lc-text-secondary); }
.weather-temp { font-weight: var(--lc-weight-semibold); }

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--lc-sp-2);
  padding: 6px var(--lc-sp-3);
  border-radius: var(--lc-radius-pill);
  background: var(--lc-surface-overlay);
  color: var(--lc-text-secondary);
  font-weight: var(--lc-weight-semibold);
  font-size: var(--lc-text-caption);
  white-space: nowrap;
  border: 1px solid var(--lc-border-glass);
}

.suggestion-text { margin: 0; color: var(--lc-warning); font-size: var(--lc-text-caption); font-weight: var(--lc-weight-semibold); }

@media (max-width: 640px) {
  .event-row-top { flex-direction: column; align-items: stretch; }
  .delete-btn { width: 100%; }
}
</style>
