<script setup>
import { computed } from 'vue'
import { generateForecastInsights } from '@/utils/forecastIntelligence'

const props = defineProps({
  loading: {
    type: Boolean,
    default: false
  },
  weatherData: {
    type: Object,
    default: () => ({})
  },
  userProfile: {
    type: String,
    default: 'general'
  }
})

const profileTips = {
  student: {
    rain: 'Leave before your afternoon lectures to avoid getting caught in the rain.',
    hot: 'Stay hydrated between classes.',
    general: 'A good day to focus on studies.'
  },
  office_worker: {
    rain: 'Carry an umbrella for your commute.',
    hot: 'The AC in the office will be a relief today.',
    general: 'Conditions look fine for your workday.'
  },
  business_owner: {
    rain: 'Heavy rain may reduce customer footfall today. Stock up and prepare for a quieter day.',
    hot: 'Hot weather brings more foot traffic. Make sure your space is cool and well stocked.',
    general: 'Conditions look good for business today.'
  },
  delivery_rider: {
    rain: 'Schedule most deliveries before the rain arrives.',
    hot: 'Drink water regularly between deliveries.',
    general: 'Good conditions for deliveries today.'
  },
  driver: {
    rain: 'Roads may be slippery. Drive carefully.',
    hot: 'Check your tyre pressure — heat affects it.',
    general: 'Good driving conditions today.'
  },
  athlete: {
    rain: 'Move your outdoor session indoors or reschedule.',
    hot: 'Train early morning or after sunset to avoid the heat.',
    general: 'Good conditions for outdoor training.'
  },
  traveler: {
    rain: 'Pack a rain jacket — weather may affect travel.',
    hot: 'Dress light and carry water for your journey.',
    general: 'Conditions look fine for travel today.'
  }
}

function toNumber(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function toHour24(slot) {
  if (slot?.dt_txt) {
    const parsed = new Date(String(slot.dt_txt).replace(' ', 'T'))
    if (!Number.isNaN(parsed.getTime())) return parsed.getHours()
  }
  if (slot?.dt) {
    const parsed = new Date(Number(slot.dt) * 1000)
    if (!Number.isNaN(parsed.getTime())) return parsed.getHours()
  }
  return -1
}

function getProfileConditionType({ condition, temp, humidity, rainChance }) {
  if (condition.includes('rain') || condition.includes('drizzle') || condition.includes('thunder') || condition.includes('storm') || rainChance >= 70) {
    return 'rain'
  }
  if (temp >= 35 || (temp >= 32 && humidity >= 75)) {
    return 'hot'
  }
  return 'general'
}

function appendProfileTip(message, userProfile, conditionType) {
  const tip = profileTips[userProfile]?.[conditionType]
  return tip ? `${message} ${tip}` : message
}

function generateCopilotMessage(weatherData = {}, userProfile = 'general') {
  const current = weatherData.currentWeather || {}
  const hourly = Array.isArray(weatherData.hourlyForecast) ? weatherData.hourlyForecast : []

  const rainChance = toNumber(weatherData.currentWeather?.rain?.chance, 0)
  const condition = String(current?.weather?.[0]?.main || '').toLowerCase()
  const temp = toNumber(current?.main?.temp, 0)
  const humidity = toNumber(current?.main?.humidity, 0)
  const profileConditionType = getProfileConditionType({ condition, temp, humidity, rainChance })

  const peakRainHour = hourly.reduce((peak, slot) => {
    const chance = toNumber(slot?.pop, 0) * 100
    return chance > peak.chance
      ? { chance, time: slot?.dt_txt || slot?.dt }
      : peak
  }, { chance: 0, time: null })

  function formatPeakTime(dt) {
    if (!dt) return null
    const date = typeof dt === 'string'
      ? new Date(dt.replace(' ', 'T'))
      : new Date(dt * 1000)
    return date.toLocaleTimeString([], {
      hour: 'numeric', hour12: true
    })
  }

  // Thunder / storm - immediate severe message
  if (condition.includes('thunder') || condition.includes('storm')) {
    const peakTime = formatPeakTime(peakRainHour.time)
    return appendProfileTip(
      `There's a thunderstorm right now. Stay indoors and avoid travel. ${peakTime ? `Conditions look most intense around ${peakTime}. ` : ''}Wait for the storm to pass before going outside.`,
      userProfile,
      profileConditionType
    )
  }

  // CASE 1: It is currently raining/drizzling
  if (condition.includes('rain') || condition.includes('drizzle')) {
    const peakTime = formatPeakTime(peakRainHour.time)
    const intensity = rainChance >= 85 ? 'heavy rain' : 'rain'
    return appendProfileTip(`It's raining now with a ${rainChance}% chance of ${intensity} continuing today.` +
      (peakTime && peakRainHour.chance > rainChance ? ` Heaviest rain expected around ${peakTime}.` : '') +
      ` Stay indoors if you can, or carry an umbrella.`, userProfile, profileConditionType)
  }

  // CASE 2: Not raining now but high chance later
  if (rainChance >= 70) {
    const peakTime = formatPeakTime(peakRainHour.time)
    return appendProfileTip(`It is not raining right now but there is a ${rainChance}% chance of rain today.` +
      (peakTime ? ` Expect rain around ${peakTime}.` : '') +
      ` Carry an umbrella if you are going out later.`, userProfile, profileConditionType)
  }

  if (temp >= 35 || (temp >= 32 && humidity >= 75)) {
    return appendProfileTip(
      `It's extremely hot and humid right now. Avoid being outside for long periods. Drink water regularly and stay in cool places.`,
      userProfile,
      profileConditionType
    )
  }

  if (condition.includes('fog') || condition.includes('mist')) {
    return appendProfileTip(
      `Visibility is low due to fog right now. Drive carefully and use headlights if travelling. Conditions should improve as the day warms up.`,
      userProfile,
      profileConditionType
    )
  }

  const uvIndex = toNumber(current?.uvi ?? current?.uvIndex, 0)

  const morningSlots = hourly.filter((slot) => {
    const hour = toHour24(slot)
    return hour >= 6 && hour <= 11
  })
  const middaySlots = hourly.filter((slot) => {
    const hour = toHour24(slot)
    return hour >= 11 && hour <= 15
  })
  const lateSlots = hourly.filter((slot) => {
    const hour = toHour24(slot)
    return hour >= 15 && hour <= 21
  })

  const morningTemp =
    morningSlots.length > 0
      ? morningSlots.reduce((sum, slot) => sum + toNumber(slot?.main?.temp), 0) / morningSlots.length
      : toNumber(current?.main?.temp, 0)
  const middayTempPeak = middaySlots.reduce(
    (max, slot) => Math.max(max, toNumber(slot?.main?.temp, morningTemp)),
    morningTemp
  )
  const lateRainRisk = lateSlots.reduce(
    (max, slot) => Math.max(max, Math.round(toNumber(slot?.pop, 0) * 100)),
    0
  )
  const lateWindPeak = lateSlots.reduce(
    (max, slot) => Math.max(max, toNumber(slot?.wind?.speed, toNumber(current?.wind?.speed, 0))),
    toNumber(current?.wind?.speed, 0)
  )

  const morningSummary =
    morningTemp >= 18 && morningTemp <= 25
      ? 'Today starts nice and mild.'
      : morningTemp > 28
        ? 'It gets warm early. Take it easy outside.'
        : 'It starts cool. Great for morning tasks.'

  let middayInsight = 'Midday looks fine for most plans.'
  if (uvIndex > 7) {
    middayInsight = 'The sun gets strong midday. Wear sunscreen outside.'
  } else if (middayTempPeak >= 31 || humidity >= 70) {
    middayInsight = 'It gets hot and sticky. Take breaks and drink water.'
  } else if (middayTempPeak >= 18 && middayTempPeak <= 25) {
    middayInsight = 'Midday stays nice. Good time to get things done.'
  }

  let lateDayForecast = 'Late day looks calm.'
  if (lateRainRisk > 50) {
    lateDayForecast = 'Rain might come later. Finish outdoor tasks early.'
  } else if (lateWindPeak > 30) {
    lateDayForecast = 'It gets windy later. Might be harder to be outside.'
  } else if (lateSlots.length > 0) {
    const lateAvgTemp =
      lateSlots.reduce((sum, slot) => sum + toNumber(slot?.main?.temp, morningTemp), 0) / lateSlots.length
    if (lateAvgTemp <= morningTemp - 3) {
      lateDayForecast = 'It cools down later. Nice time to be outside.'
    }
  }

  if (condition.includes('thunder') || condition.includes('storm')) {
    lateDayForecast = 'Storms might come. Keep plans flexible.'
  }

  const sentenceOne = `${morningSummary.replace(/\.$/, '')}. ${middayInsight}`
  const sentenceTwo = lateDayForecast
  return appendProfileTip(`${sentenceOne} ${sentenceTwo}`, userProfile, profileConditionType)
}

const copilotMessage = computed(() => generateCopilotMessage(props.weatherData || {}, props.userProfile))

function generateWeatherInsights(input, userProfile = 'general') {
  void userProfile
  return generateForecastInsights(input)
}

const intelligence = computed(() => {
  const data = props.weatherData || {}
  const current = data.currentWeather || {}
  const hourly = Array.isArray(data.hourlyForecast) ? data.hourlyForecast : []
  const input = {
    temperature: Number(current?.main?.temp ?? 0),
    precipitationProbability: Math.round(Number(hourly[0]?.pop ?? 0)),
    windSpeed: Number(current?.wind?.speed ?? 0),
    humidity: Number(current?.main?.humidity ?? 0),
    uvIndex: Number(current?.uvi ?? current?.uvIndex ?? 0),
    condition: String(current?.weather?.[0]?.main || ''),
    hourlyForecast: hourly
  }

  return generateWeatherInsights(input, props.userProfile)
})
</script>

<template>
  <section
    class="weather-copilot-card relative overflow-hidden rounded-2xl bg-white/10 backdrop-blur p-6 shadow-lg border border-white/15">
    <span class="ai-badge">✦ AI</span>
    <div
      class="pointer-events-none absolute -top-16 -right-16 h-44 w-44 rounded-full bg-gradient-to-br from-white/25 to-transparent blur-2xl">
    </div>

    <div class="relative z-10 flex items-start justify-between gap-3">
      <div class="min-w-0">
        <h3 class="m-0 text-[22px] font-semibold text-white">Lumi AI</h3>
        <p class="mt-1 mb-0 text-xs text-white/75">Your personal weather assistant</p>
      </div>
    </div>

    <div v-if="loading" class="relative z-10 mt-4">
      <div class="shimmer-lines" aria-hidden="true">
        <span class="shimmer-line"></span>
        <span class="shimmer-line"></span>
        <span class="shimmer-line"></span>
        <span class="shimmer-line"></span>
      </div>
    </div>

    <template v-else>
      <p class="relative z-10 mt-4 mb-0 text-sm leading-relaxed text-white/90">
        {{ copilotMessage }}
      </p>

      <div class="divider-line"></div>

      <p class="insights-title">INSIGHTS</p>
      <div class="insight-list">
        <div v-for="insight in intelligence.insights" :key="insight.type" class="insight-item">
          → {{ insight.text }}
        </div>
      </div>
    </template>
  </section>
</template>

<style scoped>
.weather-copilot-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.ai-badge {
  position: absolute;
  top: 14px;
  right: 14px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  line-height: 1;
  border: 1px solid rgba(255, 255, 255, 0.4);
  border-radius: 999px;
  padding: 5px 8px;
  color: rgba(255, 255, 255, 0.9);
  background: rgba(255, 255, 255, 0.1);
}

.divider-line {
  height: 1px;
  background: rgba(255, 255, 255, 0.1);
  margin: 8px 0;
}

.insights-title {
  margin: 0;
  color: rgba(255, 255, 255, 0.6);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.insight-list {
  display: grid;
  gap: 10px;
  margin: 0;
}

.insight-item {
  color: rgba(255, 255, 255, 0.9);
  line-height: 1.45;
  font-size: 14px;
}

.shimmer-lines {
  display: grid;
  gap: 10px;
}

.shimmer-line {
  display: block;
  height: 14px;
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0.28) 50%, rgba(255, 255, 255, 0.12) 100%);
  background-size: 220% 100%;
  animation: shimmer 1.2s linear infinite;
}

@keyframes shimmer {
  from {
    background-position: 200% 0;
  }

  to {
    background-position: -200% 0;
  }
}

@media (max-width: 600px) {
  .weather-copilot-card {
    padding: 14px;
  }
}
</style>
