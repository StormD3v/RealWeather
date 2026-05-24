import { buildWeatherCacheKey, readWeatherCache, writeWeatherCache } from '@/utils/weatherCache'

const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search'
const REVERSE_GEOCODE_URL = 'https://nominatim.openstreetmap.org/reverse'
const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast'
const CACHE_TTL_MS = 15 * 60 * 1000

function buildGeocodeUrl(city) {
  const params = new URLSearchParams({
    name: city,
    count: '1'
  })
  return `${GEOCODE_URL}?${params}`
}

function buildWeatherUrl(lat, lon) {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    hourly: 'temperature_2m,relative_humidity_2m,precipitation,windspeed_10m,precipitation_probability,surface_pressure',
    daily: 'temperature_2m_max,temperature_2m_min,weathercode',
    current_weather: true,
    timezone: 'auto',
    forecast_days: 7
  })
  return `${WEATHER_URL}?${params}`
}

function buildReverseGeocodeUrl(lat, lon) {
  const params = new URLSearchParams({
    lat,
    lon,
    format: 'json'
  })
  return `${REVERSE_GEOCODE_URL}?${params}`
}

async function parseJsonSafe(response) {
  try {
    return await response.json()
  } catch (error) {
    return {}
  }
}

function resolveErrorMessage(response, payload, params) {
  if (response.status === 404) {
    return params.q
      ? 'City not found. Please try another location.'
      : 'Location not found. Please try a different search.'
  }
  return payload?.message || 'Unable to fetch weather data.'
}

async function geocodeCity(city) {
  const res = await fetch(buildGeocodeUrl(city))
  const data = await res.json()

  if (!data.results || data.results.length === 0) {
    throw new Error('City not found')
  }

  const r = data.results[0]

  console.log('[weather-api] Geocoded:', r.latitude, r.longitude)

  return {
    lat: r.latitude,
    lon: r.longitude,
    name: r.name
  }
}

async function reverseGeocodeLocation(lat, lon) {
  const response = await fetch(buildReverseGeocodeUrl(lat, lon), {
    headers: {
      'User-Agent': 'LumiCast/1.0'
    }
  })
  const result = await response.json()
  const address = result?.address || {}

  return address.city || address.town || address.village || address.county || null
}

function transformOpenMeteo(data, lat, lon, name) {
  const currentWeather = data.current_weather
  const hourly = data.hourly
  const daily = data.daily

  // Get current hour's index from hourly.time array
  const now = new Date()
  const currentHourStr = now.toISOString().slice(0, 13)
  const currentIndex = (hourly.time || []).findIndex(t => t.startsWith(currentHourStr))
  const idx = currentIndex >= 0 ? currentIndex : 0

  const humidity = hourly?.relative_humidity_2m?.[idx] ?? null
  const rainChance = Math.max(
    ...(hourly?.precipitation_probability?.slice(idx, idx + 12) ?? [0])
  ) ?? null

  const current = {
    dt: Date.now() / 1000,
    name,
    coord: { lat, lon },
    main: {
      temp: currentWeather.temperature,
      humidity: humidity,
      pressure: hourly?.surface_pressure?.[idx] ?? null,
      feels_like: currentWeather.temperature, // Open-Meteo doesn't provide feels_like
      visibility: null
    },
    wind: {
      speed: currentWeather.windspeed
    },
    rain: {
      chance: rainChance
    },
    weather: [{
      main: getWeatherConditionFromCode(currentWeather.weathercode),
      description: getWeatherDescriptionFromCode(currentWeather.weathercode),
      icon: '01d'
    }]
  }

  // Create hourly forecast for next 24 hours
  const forecastList = []
  const hours = Math.min(24, hourly?.temperature_2m?.length || 0)

  for (let i = 0; i < hours; i++) {
    const timestamp = Date.now() / 1000 + (i * 3600)
    const hourTemp = hourly.temperature_2m?.[i] || 0
    const hourHumidity = hourly.relative_humidity_2m?.[i] || 0
    const hourWindSpeed = hourly.windspeed_10m?.[i] || 0
    const hourPrecipitation = hourly.precipitation?.[i] || 0

    forecastList.push({
      dt: timestamp,
      dt_txt: new Date(timestamp * 1000).toISOString(),
      main: {
        temp: hourTemp,
        humidity: hourHumidity
      },
      wind: {
        speed: hourWindSpeed
      },
      weather: [{
        main: getWeatherCondition(hourPrecipitation, hourHumidity),
        description: getWeatherDescription(hourPrecipitation, hourHumidity),
        icon: '01d'
      }]
    })
  }

  return {
    current,
    forecast: { list: forecastList },
    daily: daily?.time?.slice(0, 7).map((time, index) => ({
      dt: new Date(time).getTime() / 1000,
      dt_txt: time,
      main: {
        temp_max: daily.temperature_2m_max?.[index] || 0,
        temp_min: daily.temperature_2m_min?.[index] || 0,
        temp: ((daily.temperature_2m_max?.[index] || 0) + (daily.temperature_2m_min?.[index] || 0)) / 2
      },
      weather: [{
        main: getWeatherConditionFromCode(daily.weathercode?.[index]),
        description: getWeatherDescriptionFromCode(daily.weathercode?.[index]),
        icon: '01d'
      }]
    })) || []
  }
}

// Debug function to log daily data
function debugDailyData(daily) {
  console.log('[weather-api] Daily data structure:', {
    time: daily?.time,
    tempMax: daily?.temperature_2m_max,
    tempMin: daily?.temperature_2m_min,
    weatherCode: daily?.weathercode,
    length: daily?.time?.length
  })
  return daily
}

function getWeatherCondition(precipitation, humidity) {
  if (precipitation > 0) {
    if (precipitation > 2.5) return 'Rain'
    return 'Drizzle'
  }
  if (humidity > 80) return 'Clouds'
  return 'Clear'
}

function getWeatherDescription(precipitation, humidity) {
  if (precipitation > 0) {
    if (precipitation > 2.5) return 'moderate rain'
    return 'light rain'
  }
  if (humidity > 80) return 'overcast clouds'
  if (humidity > 60) return 'scattered clouds'
  return 'clear sky'
}

function getWeatherConditionFromCode(code) {
  if (!code) return 'Clear'

  // Open-Meteo weather codes (WMO code)
  if (code === 0) return 'Clear'
  if (code === 1 || code === 2 || code === 3) return 'Clouds'
  if (code >= 45 && code <= 48) return 'Fog'
  if (code >= 51 && code <= 55) return 'Drizzle'
  if (code >= 56 && code <= 57) return 'Drizzle'
  if (code >= 61 && code <= 65) return 'Rain'
  if (code >= 66 && code <= 67) return 'Rain'
  if (code >= 71 && code <= 77) return 'Snow'
  if (code >= 80 && code <= 82) return 'Rain'
  if (code >= 85 && code <= 86) return 'Snow'
  if (code === 95) return 'Thunderstorm'
  if (code >= 96 && code <= 99) return 'Thunderstorm'

  return 'Clear'
}

function getWeatherDescriptionFromCode(code) {
  if (!code) return 'clear sky'

  if (code === 0) return 'clear sky'
  if (code === 1) return 'mainly clear'
  if (code === 2) return 'partly cloudy'
  if (code === 3) return 'overcast'
  if (code >= 45 && code <= 48) return 'fog'
  if (code >= 51 && code <= 55) return 'drizzle'
  if (code >= 56 && code <= 57) return 'freezing drizzle'
  if (code >= 61 && code <= 65) return 'rain'
  if (code >= 66 && code <= 67) return 'freezing rain'
  if (code >= 71 && code <= 77) return 'snow'
  if (code >= 80 && code <= 82) return 'rain showers'
  if (code >= 85 && code <= 86) return 'snow showers'
  if (code === 95) return 'thunderstorm'
  if (code >= 96 && code <= 99) return 'thunderstorm with hail'

  return 'clear sky'
}

export async function fetchWeatherBundle(params, options = {}) {
  let lat, lon, locationName

  // Handle city search (geocoding)
  if (params.q) {
    const geoResult = await geocodeCity(params.q)
    lat = geoResult.lat
    lon = geoResult.lon
    locationName = geoResult.name
  } else if (params.lat && params.lon) {
    lat = parseFloat(params.lat)
    lon = parseFloat(params.lon)
    locationName = `${lat.toFixed(4)}, ${lon.toFixed(4)}`

    try {
      locationName = await reverseGeocodeLocation(lat, lon) || locationName
    } catch (error) {
      console.warn('[weather-api] Reverse geocode failed:', error)
    }
  } else {
    throw new Error('Either city name (q) or coordinates (lat, lon) are required')
  }

  const cacheKey = buildWeatherCacheKey({ lat, lon })
  const cached = readWeatherCache(cacheKey, CACHE_TTL_MS)
  if (cached.fresh && cached.data) {
    return { ...cached.data, source: 'cache', servedAt: cached.timestamp ?? Date.now() }
  }

  // Build Open-Meteo request URL with geocoded coordinates
  const url = buildWeatherUrl(lat, lon)
  console.log("Open-Meteo request:", url)

  try {
    console.log('[weather-api] Making request to:', url)
    const response = await fetch(url, { signal: options.signal })
    console.log('[weather-api] Response status:', response.status, response.statusText)

    const openMeteoData = await parseJsonSafe(response)
    console.log('[weather-api] Parsed response data:', openMeteoData)

    if (!response.ok) {
      console.error('[weather-api] API request failed:', response.status, openMeteoData)
      throw new Error(resolveErrorMessage(response, openMeteoData, params))
    }

    // Transform Open-Meteo data to match expected structure
    const transformedData = transformOpenMeteo(openMeteoData, lat, lon, locationName)
    console.log('[weather-api] Transformed data:', transformedData)

    const bundle = {
      current: transformedData.current,
      forecast: transformedData.forecast,
      daily: transformedData.daily
    }
    const savedAt = writeWeatherCache(cacheKey, bundle)
    return { ...bundle, source: 'network', servedAt: savedAt ?? Date.now() }
  } catch (error) {
    console.error('[weather-api] Error in fetchWeatherBundle:', error)
    console.error('[weather-api] Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    })

    if (error?.name === 'AbortError') {
      throw error
    }

    if (cached.data) {
      console.error('[weather-api] Network failed, using stale cached weather', {
        params,
        error
      })
      return { ...cached.data, source: 'stale-cache', servedAt: cached.timestamp ?? Date.now() }
    }

    throw error
  }
}
