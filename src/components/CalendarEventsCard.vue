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
import { computed, defineProps, onMounted, ref, watch } from 'vue'

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
    gap: 18px;
    padding: 22px;
    border-radius: 18px;
    background: linear-gradient(135deg, rgba(39, 192, 99, 0.10), rgba(255, 255, 255, 0.04));
    border: 2px solid rgba(39, 192, 99, 0.3);
    border-top: 4px solid #27c063;
    backdrop-filter: blur(14px);
    box-shadow: 0 0 24px rgba(39, 192, 99, 0.08);
}

.calendar-card-header {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.calendar-card-header h3 {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 700;
    color: #27c063;
}

.input-row {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: center;
}

.input-row input,
.input-row button {
    min-height: 44px;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    background: rgba(255, 255, 255, 0.08);
    color: white;
    padding: 10px 14px;
}

.input-row input {
    outline: none;
}

.input-row input::placeholder {
    color: rgba(255, 255, 255, 0.7);
}

.input-row input[type='text'] {
    flex: 1 1 0;
    min-width: 0;
}

.input-row input[type='time'] {
    min-width: 130px;
}

.input-row button {
    font-weight: 600;
    color: white;
    background: #27c063;
    cursor: pointer;
    transition: transform 0.15s ease, background-color 0.15s ease;
}

.input-row button:disabled {
    opacity: 0.55;
    cursor: not-allowed;
}

.input-row button:not(:disabled):hover {
    transform: translateY(-1px);
    background: #1fa450;
}

.empty-state {
    color: rgba(39, 192, 99, 0.6);
    font-size: 0.95rem;
}

.event-list {
    display: flex;
    flex-direction: column;
    gap: 14px;
}

.event-row {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 18px;
    border-radius: 18px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(255, 255, 255, 0.12);
}

.event-row.clear {
    border-left: 4px solid #22c55e;
}

.event-row.at-risk {
    border-left: 4px solid #f59e0b;
}

.event-row.rain {
    border-left: 4px solid #fb923c;
}

.event-row.no-data {
    border-left: 4px solid rgba(148, 163, 184, 0.9);
}

.event-row-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
}

.event-name {
    margin: 0 0 4px;
    font-weight: 700;
}

.event-time {
    margin: 0;
    color: rgba(16, 35, 60, 0.72);
    font-size: 0.95rem;
}

.delete-btn {
    border: none;
    background: rgba(255, 255, 255, 0.14);
    color: #10233c;
    width: 34px;
    height: 34px;
    border-radius: 12px;
    cursor: pointer;
}

.event-metrics {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: center;
}

.weather-info {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 0.95rem;
    color: rgba(16, 35, 60, 0.88);
}

.weather-icon {
    font-size: 1.05rem;
}

.weather-temp {
    font-weight: 600;
}

.status-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.38);
    color: #10233c;
    font-weight: 600;
    white-space: nowrap;
}

.suggestion-text {
    margin: 0;
    color: #b45309;
    font-size: 0.95rem;
    font-weight: 600;
}

@media (max-width: 640px) {
    .input-row {
        grid-template-columns: minmax(0, 1fr) minmax(0, 110px) auto;
    }

    .event-row-top {
        flex-direction: column;
        align-items: stretch;
    }

    .delete-btn {
        width: 100%;
    }
}
</style>
