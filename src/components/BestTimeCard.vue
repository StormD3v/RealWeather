<script setup>
import { computed, shallowRef, watch } from 'vue'

defineOptions({ inheritAttrs: false })

const props = defineProps({
  hourlyForecast: {
    type: Array,
    default: () => []
  },
  currentWeather: {
    type: Object,
    default: null
  }
})

const hourlyForecast = shallowRef(props.hourlyForecast)
watch(
  () => props.hourlyForecast,
  (value) => {
    hourlyForecast.value = value
  },
  { immediate: true }
)

function formatTime(timestamp) {
  const date = new Date(timestamp * 1000)
  const hour = date.getHours()
  const period = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 || 12
  return `${displayHour}:00 ${period}`
}

function getTimeLabel(timestamp) {
  const hour = new Date(timestamp * 1000).getHours()
  if (hour >= 6 && hour < 12) return 'Morning window'
  if (hour >= 12 && hour < 17) return 'Afternoon window'
  return 'Evening window'
}

function getZone(hour) {
  if (hour >= 6 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 17) return 'afternoon'
  if (hour >= 17 && hour <= 21) return 'evening'
  return null
}

function getConditionTag(score) {
  if (score >= 4) return { label: 'Good', color: 'green' }
  if (score >= 2) return { label: 'Okay', color: 'yellow' }
  return { label: 'Poor', color: 'red' }
}

function getReason(hourData, score) {
  const reasons = []
  const temp = hourData?.main?.temp ?? 0
  const rainChance = Math.round((hourData?.pop ?? 0) * 100)
  const windSpeed = hourData?.wind?.speed ?? 0

  if (temp >= 22 && temp <= 28) reasons.push('Nice and cool')
  else if (temp > 32) reasons.push('Very hot')
  else if (temp >= 29 && temp <= 32) reasons.push('Nice and warm')

  if (rainChance <= 20) reasons.push('No rain expected')
  else if (rainChance > 50) reasons.push('Rain likely')
  else reasons.push('Some rain possible')

  if (windSpeed < 10) reasons.push('Light breeze')
  else if (windSpeed > 20) reasons.push('It is windy')

  return reasons.join(' · ')
}

const bestTimeWindows = computed(() => {
  const hourly = Array.isArray(hourlyForecast.value) ? hourlyForecast.value : []

  // Score each hour from 6AM to 9PM
  const scoredHours = hourly.map((hour) => {
    const timestamp = hour?.dt
    const date = new Date(timestamp * 1000)
    const hourOfDay = date.getHours()

    // Only consider hours from 6AM to 9PM
    if (hourOfDay < 6 || hourOfDay > 21) return null

    const temp = hour?.main?.temp ?? 0
    const rainChance = Math.round(hour?.pop ?? 0)
    const windSpeed = hour?.wind?.speed ?? 0

    let score = 0

    // Temperature scoring
    if (temp >= 22 && temp <= 28) score += 2
    else if (temp >= 29 && temp <= 32) score += 1
    else if (temp > 32) score -= 1

    // Rain chance scoring
    if (rainChance <= 20) score += 2
    else if (rainChance <= 50) score += 1
    else score -= 2

    // Wind speed scoring
    if (windSpeed < 10) score += 1
    else if (windSpeed > 20) score -= 1

    return {
      timestamp,
      hourData: hour,
      score,
      zone: getZone(hourOfDay)
    }
  }).filter(Boolean)

  // Group by zone and find best hour in each zone
  const zones = ['morning', 'afternoon', 'evening']
  const zoneWindows = zones.map((zone) => {
    const zoneHours = scoredHours.filter((h) => h.zone === zone)

    if (zoneHours.length === 0) {
      return {
        time: 'Passed',
        label: zone === 'morning' ? 'Morning window' : zone === 'afternoon' ? 'Afternoon window' : 'Evening window',
        condition: { label: 'DONE', color: 'grey' },
        reason: 'This window has already passed today'
      }
    }

    const bestHour = zoneHours.reduce((best, current) =>
      current.score > best.score ? current : best
    )

    // If the best slot's timestamp is already in the past, mark this window as passed
    if (bestHour && bestHour.timestamp * 1000 < Date.now()) {
      return {
        time: 'Passed',
        label: zone === 'morning' ? 'Morning window' : zone === 'afternoon' ? 'Afternoon window' : 'Evening window',
        condition: { label: 'DONE', color: 'grey' },
        reason: 'This window has already passed today'
      }
    }

    return {
      time: formatTime(bestHour.timestamp),
      label: zone === 'morning' ? 'Morning window' : zone === 'afternoon' ? 'Afternoon window' : 'Evening window',
      condition: getConditionTag(bestHour.score),
      reason: getReason(bestHour.hourData, bestHour.score)
    }
  })

  return zoneWindows
})
</script>

<template>
  <div class="best-time-card">
    <h3>Best Time to Go Out</h3>
    <p class="subtitle">Based on today's conditions</p>

    <div class="time-windows">
      <div v-for="(window, index) in bestTimeWindows" :key="index" class="time-window">
        <div class="time-window-header">
          <span class="time">{{ window.time }}</span>
          <span class="window-label">{{ window.label }}</span>
        </div>
        <div class="time-window-footer">
          <span class="condition-tag" :class="`condition-${window.condition.color}`">
            {{ window.condition.label }}
          </span>
          <span class="reason">{{ window.reason }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.best-time-card {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.best-time-card h3 {
  margin: 0 0 8px 0;
  font-size: 20px;
  font-weight: 600;
  color: white;
}

.subtitle {
  margin: 0 0 20px 0;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
}

.time-windows {
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1;
}

.time-window {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 16px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
}

.time-window-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.time {
  font-size: 16px;
  font-weight: 700;
  color: white;
}

.window-label {
  font-size: 12px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.8);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.time-window-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.condition-tag {
  font-size: 11px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 999px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  flex-shrink: 0;
}

.condition-green {
  background: rgba(34, 197, 94, 0.2);
  color: rgba(34, 197, 94, 1);
  border: 1px solid rgba(34, 197, 94, 0.3);
}

.condition-yellow {
  background: rgba(234, 179, 8, 0.2);
  color: rgba(234, 179, 8, 1);
  border: 1px solid rgba(234, 179, 8, 0.3);
}

.condition-red {
  background: rgba(239, 68, 68, 0.2);
  color: rgba(239, 68, 68, 1);
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.condition-grey {
  background: rgba(156, 163, 175, 0.2);
  color: rgba(156, 163, 175, 1);
  border: 1px solid rgba(156, 163, 175, 0.3);
}

.reason {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.8);
  text-align: right;
  white-space: normal;
}

@media (max-width: 600px) {
  .best-time-card h3 {
    font-size: 18px;
  }

  .time-window {
    padding: 12px 14px;
  }

  .time {
    font-size: 15px;
  }

  .reason {
    font-size: 12px;
  }
}
</style>
