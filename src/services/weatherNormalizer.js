function toNumber(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function toNullableNumber(value) {
  if (value == null) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function toText(value, fallback = '') {
  return typeof value === 'string' ? value : fallback
}

function normalizeCondition(entry) {
  return {
    main: toText(entry?.main, 'Clear'),
    description: toText(entry?.description, 'clear sky'),
    icon: toText(entry?.icon, '01d')
  }
}

function normalizeForecastSlot(slot = {}) {
  return {
    dt: toNumber(slot?.dt),
    dt_txt: toText(slot?.dt_txt, ''),
    weather: [normalizeCondition(slot?.weather?.[0])],
    main: {
      temp: toNumber(slot?.main?.temp),
      feels_like: toNumber(slot?.main?.feels_like),
      temp_min: toNumber(slot?.main?.temp_min),
      temp_max: toNumber(slot?.main?.temp_max),
      pressure: toNumber(slot?.main?.pressure),
      humidity: toNumber(slot?.main?.humidity)
    },
    wind: {
      speed: toNumber(slot?.wind?.speed),
      deg: toNumber(slot?.wind?.deg)
    },
    visibility: toNumber(slot?.visibility),
    pop: toNumber(slot?.pop),
    rain: {
      '3h': toNullableNumber(slot?.rain?.['3h'])
    },
    snow: {
      '3h': toNullableNumber(slot?.snow?.['3h'])
    }
  }
}

function summarizeDailyForecast(slots = []) {
  const grouped = new Map()

  for (const slot of slots) {
    const key = slot.dt_txt ? slot.dt_txt.slice(0, 10) : `day-${slot.dt}`
    if (!grouped.has(key)) {
      grouped.set(key, {
        date: key,
        dt: slot.dt,
        dt_txt: slot.dt_txt,
        minTemp: slot.main.temp_min,
        maxTemp: slot.main.temp_max,
        rainfallTotal: 0,
        conditionCounts: new Map(),
        descriptionCounts: new Map(),
        iconCounts: new Map()
      })
    }

    const group = grouped.get(key)
    group.minTemp = Math.min(group.minTemp, slot.main.temp_min)
    group.maxTemp = Math.max(group.maxTemp, slot.main.temp_max)
    group.rainfallTotal += toNumber(slot.rain?.['3h'])

    const condition = slot.weather?.[0]?.main || 'Clear'
    const description = slot.weather?.[0]?.description || 'clear sky'
    const icon = slot.weather?.[0]?.icon || '01d'

    group.conditionCounts.set(condition, (group.conditionCounts.get(condition) || 0) + 1)
    group.descriptionCounts.set(description, (group.descriptionCounts.get(description) || 0) + 1)
    group.iconCounts.set(icon, (group.iconCounts.get(icon) || 0) + 1)
  }

  const topEntry = (map, fallback) => {
    let winner = fallback
    let max = -1
    for (const [key, value] of map.entries()) {
      if (value > max) {
        max = value
        winner = key
      }
    }
    return winner
  }

  return Array.from(grouped.values())
    .sort((a, b) => a.dt - b.dt)
    .map((day) => {
      const dominantMain = topEntry(day.conditionCounts, 'Clear')
      const dominantDescription = topEntry(day.descriptionCounts, 'clear sky')
      const dominantIcon = topEntry(day.iconCounts, '01d')

      return {
        date: day.date,
        dt: day.dt,
        dt_txt: day.dt_txt,
        minTemp: day.minTemp,
        maxTemp: day.maxTemp,
        dominantCondition: dominantMain,
        totalRainfall: Number(day.rainfallTotal.toFixed(2)),
        main: {
          temp_min: day.minTemp,
          temp_max: day.maxTemp,
          temp: (day.minTemp + day.maxTemp) / 2
        },
        weather: [
          {
            main: dominantMain,
            description: dominantDescription,
            icon: dominantIcon
          }
        ]
      }
    })
}

export function normalizeWeather(rawCurrent = {}, rawForecast = {}) {
  const currentCondition = normalizeCondition(rawCurrent?.weather?.[0])

  const current = {
    dt: toNumber(rawCurrent?.dt),
    name: toText(rawCurrent?.name, 'Unknown location'),
    coord: {
      lat: toNumber(rawCurrent?.coord?.lat),
      lon: toNumber(rawCurrent?.coord?.lon)
    },
    weather: [currentCondition],
    main: {
      temp: toNumber(rawCurrent?.main?.temp),
      feels_like: toNumber(rawCurrent?.main?.feels_like),
      temp_min: toNumber(rawCurrent?.main?.temp_min),
      temp_max: toNumber(rawCurrent?.main?.temp_max),
      pressure: toNumber(rawCurrent?.main?.pressure),
      humidity: toNumber(rawCurrent?.main?.humidity)
    },
    wind: {
      speed: toNumber(rawCurrent?.wind?.speed),
      deg: toNumber(rawCurrent?.wind?.deg)
    },
    visibility: toNumber(rawCurrent?.visibility),
    clouds: {
      all: toNumber(rawCurrent?.clouds?.all)
    },
    rain: {
      '1h': toNullableNumber(rawCurrent?.rain?.['1h']),
      chance: toNullableNumber(rawCurrent?.rain?.chance)
    },
    snow: {
      '1h': toNullableNumber(rawCurrent?.snow?.['1h'])
    }
  }

  // Phase 3.5 — explicitly preserve enrichment fields added by weatherApi.js.
  // These fields are not part of the standard weather response shape, so the
  // normalizer must carry them forward explicitly rather than ignore them.
  // aqi             — EU AQI × 2.5 (normalized to US scale), may be null
  // uv_index_enriched — precise UV from air quality endpoint, may be null
  if (rawCurrent?.aqi != null) {
    current.aqi = rawCurrent.aqi
  }
  if (rawCurrent?.uv_index_enriched != null) {
    current.uv_index_enriched = rawCurrent.uv_index_enriched
  }

  const allForecastSlots = Array.isArray(rawForecast?.list)
    ? rawForecast.list.map(normalizeForecastSlot)
    : []

  const dailySummaries = summarizeDailyForecast(allForecastSlots)

  return {
    current,
    forecast: allForecastSlots,
    hourlyNext12: allForecastSlots.slice(0, 12),
    hourlyNext24: allForecastSlots.slice(0, 24),
    dailySummaries
  }
}
