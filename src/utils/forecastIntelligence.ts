export type InsightType = 'productivity' | 'warning' | 'comfort'

export interface ForecastInsight {
  type: InsightType
  text: string
}

export interface ForecastIntelligenceResult {
  summary: string
  insights: [ForecastInsight, ForecastInsight, ForecastInsight]
}

export interface ForecastHourlyPoint {
  dt_txt?: string
  dt?: number
  pop?: number
  main?: {
    temp?: number
    humidity?: number
  }
  wind?: {
    speed?: number
  }
  weather?: Array<{
    main?: string
  }>
}

export interface ForecastIntelligenceInput {
  temperature?: number
  precipitationProbability?: number
  windSpeed?: number
  humidity?: number
  uvIndex?: number
  condition?: string
  hourlyForecast?: ForecastHourlyPoint[]
}

function toHourLabel(raw?: string | number): string {
  if (!raw) return 'later'
  const date =
    typeof raw === 'number'
      ? new Date(raw * 1000)
      : new Date(String(raw).replace(' ', 'T'))
  if (Number.isNaN(date.getTime())) return 'later'
  return date
    .toLocaleTimeString([], { hour: 'numeric', hour12: true })
    .replace(/\s/g, '')
    .toLowerCase()
}

function toPercent(pop?: number): number {
  const value = Number(pop ?? 0)
  return value <= 1 ? Math.round(value * 100) : Math.round(value)
}

function toNum(value: unknown, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

export function generateDailySummary(
  weatherData: ForecastIntelligenceInput = {}
): string {
  const hourly = Array.isArray(weatherData.hourlyForecast)
    ? weatherData.hourlyForecast
    : []
  const temp = toNum(weatherData.temperature)
  const uv = toNum(weatherData.uvIndex)
  const wind = toNum(weatherData.windSpeed)
  const rainNow = toNum(weatherData.precipitationProbability)
  const lateSlots = hourly.slice(3)
  const lateRainMax = lateSlots.reduce(
    (max, slot) => Math.max(max, toPercent(slot?.pop)),
    rainNow
  )
  const windyLater = lateSlots.some((slot) => toNum(slot?.wind?.speed) > 30) || wind > 30

  if (lateRainMax > 50 && temp >= 18 && temp <= 25) {
    return 'Nice morning, but rain might come later.'
  }
  if (temp >= 18 && temp <= 25 && uv > 7) {
    return 'Nice day, but the sun gets strong midday.'
  }
  if (temp > 26 && uv > 7) {
    return 'Warm and sunny. The sun is strong today.'
  }
  if (windyLater || wind > 30) {
    return 'It gets windy. Might be hard to be outside.'
  }
  if (lateRainMax > 50) {
    return 'Start is fine, but rain might come later.'
  }
  if (temp < 14) {
    return 'It stays cool. Bundle up if going out.'
  }

  return 'Weather looks fine today. Good for most plans.'
}

export function generateForecastInsights(
  weatherData: ForecastIntelligenceInput = {}
): ForecastIntelligenceResult {
  const hourly = Array.isArray(weatherData.hourlyForecast)
    ? weatherData.hourlyForecast
    : []

  const temp = toNum(weatherData.temperature)
  const humidity = toNum(weatherData.humidity)
  const wind = toNum(weatherData.windSpeed)
  const uv = toNum(weatherData.uvIndex)
  const condition = String(weatherData.condition || '').toLowerCase()
  const rainNow = toNum(weatherData.precipitationProbability)
  let bestWindow: { start: string; end: string } | null = null
  let bestScore = -Infinity
  const windowSize = Math.min(4, Math.max(3, hourly.length >= 4 ? 4 : 3))

  for (let i = 0; i <= hourly.length - windowSize; i++) {
    const window = hourly.slice(i, i + windowSize)
    const avgTemp =
      window.reduce((sum, slot) => sum + toNum(slot?.main?.temp, temp), 0) /
      window.length
    const avgRain =
      window.reduce((sum, slot) => sum + toPercent(slot?.pop), 0) / window.length
    const avgWind =
      window.reduce((sum, slot) => sum + toNum(slot?.wind?.speed, wind), 0) /
      window.length

    const withinSweetSpot =
      avgTemp >= 18 && avgTemp <= 25 && avgRain < 30 && avgWind <= 30
    if (!withinSweetSpot) continue

    const score = 100 - Math.abs(avgTemp - 22) * 2 - avgRain - avgWind * 0.25
    if (score > bestScore) {
      bestScore = score
      bestWindow = {
        start: toHourLabel(window[0]?.dt_txt || window[0]?.dt),
        end: toHourLabel(window[window.length - 1]?.dt_txt || window[window.length - 1]?.dt)
      }
    }
  }

  const productivityText = bestWindow
    ? `Best time: ${bestWindow.start}-${bestWindow.end} is great for getting things done outside.`
    : temp >= 18 && temp <= 25 && rainNow < 30
      ? 'Best time: Now is good for outdoor work. Do important tasks soon.'
      : 'Best time: Mix of conditions. Do outdoor tasks when it driest.'

  const firstRainRiskSlot = hourly.find((slot) => toPercent(slot?.pop) > 50)
  const windySlot = hourly.find((slot) => toNum(slot?.wind?.speed) > 30)
  const severeCondition =
    condition.includes('thunder') ||
    condition.includes('storm') ||
    condition.includes('snow')

  let warningText =
    'Weather heads-up: No big issues right now. Keep your plans.'
  if (firstRainRiskSlot || rainNow > 50) {
    const atTime = firstRainRiskSlot
      ? ` around ${toHourLabel(firstRainRiskSlot.dt_txt || firstRainRiskSlot.dt)}`
      : ''
    warningText = `Weather heads-up: Rain chance is high${atTime}. Do outdoor tasks early. Move inside later.`
  } else if (uv > 7) {
    warningText =
      'Weather heads-up: The sun is strong. Stay in shade midday.'
  } else if (windySlot || wind > 30) {
    warningText =
      'Weather heads-up: It is very windy. Secure loose items outside.'
  } else if (severeCondition) {
    warningText =
      'Weather heads-up: Storms might happen. Have backup plans ready.'
  }

  let comfortText =
    'Comfort tip: Feels okay right now. No big comfort issues.'
  if (humidity >= 70) {
    comfortText =
      'Comfort tip: It is quite humid. Drink water and take breaks.'
  } else if (uv > 7) {
    comfortText =
      'Comfort tip: The sun is strong. Wear sunscreen if outside.'
  } else if (temp > 30) {
    comfortText =
      'Comfort tip: It is very hot. Take cool breaks often.'
  } else if (temp < 10) {
    comfortText =
      'Comfort tip: It is cold. Wear layers to stay warm.'
  } else if (humidity <= 35) {
    comfortText =
      'Comfort tip: Air is dry. Drink water to stay focused.'
  }

  return {
    summary: generateDailySummary(weatherData),
    insights: [
      { type: 'productivity', text: productivityText },
      { type: 'warning', text: warningText },
      { type: 'comfort', text: comfortText }
    ]
  }
}
