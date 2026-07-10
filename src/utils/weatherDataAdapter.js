/**
 * @file weatherDataAdapter.js
 * Normalizes the Pinia weather store's raw data shape into the typed
 * WeatherData object that intelligence modules consume.
 *
 * Intelligence modules NEVER read the raw store format directly.
 * They receive a WeatherData object from this adapter.
 *
 * This ensures that swapping the underlying weather API or store shape
 * requires only changes to this file — all intelligence logic stays stable.
 *
 * @see src/types/context.js — WeatherData typedef
 */

/** @typedef {import('@/types/context.js').WeatherData} WeatherData */
/** @typedef {import('@/types/context.js').CurrentWeatherData} CurrentWeatherData */
/** @typedef {import('@/types/context.js').HourlyPoint} HourlyPoint */
/** @typedef {import('@/types/context.js').DailyPoint} DailyPoint */

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function toNumber(value, fallback = 0) {
    const n = Number(value)
    return Number.isFinite(n) ? n : fallback
}

/**
 * Normalizes precipitation probability to 0–1 range.
 * The weather store may return 0–1 or 0–100 depending on source.
 * @param {unknown} value
 * @returns {number} 0–1
 */
function normalizePop(value) {
    const n = toNumber(value, 0)
    return n > 1 ? n / 100 : n
}

/**
 * Converts wind speed from m/s (OpenWeatherMap default) to km/h.
 * If the store has already converted, this is a no-op at ~1.0x scale.
 * The normalizer in weatherNormalizer.js converts to km/h — we trust that.
 * @param {unknown} value
 * @returns {number} km/h
 */
function toKmh(value) {
    return toNumber(value, 0)
}

/**
 * Extracts a nullable AQI value from a raw store field.
 * AQI of 0 is a valid value (good air quality) — must NOT default to 0.
 * Returns null for any absent, invalid, or non-finite value.
 *
 * @param {unknown} value
 * @returns {number|null}
 */
function toNullableAqi(value) {
    if (value === null || value === undefined) return null
    const n = Number(value)
    return Number.isFinite(n) && n >= 0 ? n : null
}

/**
 * Validates a pollen level string against the known category set.
 * Returns null for any absent or unrecognised value.
 *
 * @param {unknown} value
 * @returns {'low'|'moderate'|'high'|'very-high'|null}
 */
function toPollenLevel(value) {
    const VALID = new Set(['low', 'moderate', 'high', 'very-high'])
    if (typeof value === 'string' && VALID.has(value)) {
        return /** @type {'low'|'moderate'|'high'|'very-high'} */ (value)
    }
    return null
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Builds a WeatherData object from the weather store's current state.
 * Returns null if the store has no current weather loaded yet.
 *
 * @param {{
 *   currentWeather: object|null,
 *   hourlyForecast: object[],
 *   forecast: object[],
 *   lastUpdatedAt: number|null
 * }} storeState
 * @returns {WeatherData|null}
 */
export function buildWeatherData(storeState) {
    const cw = storeState?.currentWeather
    if (!cw) return null

    const coords = cw.coord ?? {}
    const main = cw.main ?? {}
    const wind = cw.wind ?? {}

    /** @type {CurrentWeatherData} */
    const current = {
        temp: toNumber(main.temp),
        feelsLike: toNumber(main.feels_like, toNumber(main.temp)),
        humidity: toNumber(main.humidity),
        windSpeed: toKmh(wind.speed),
        gustSpeed: toKmh(wind.gust ?? wind.speed),
        // Prefer enriched UV from air quality endpoint (more precise); fall back to basic source
        uvIndex: toNumber(cw.uv_index_enriched ?? cw.uvi ?? cw.uv_index ?? 0),
        condition: String(cw.weather?.[0]?.main ?? ''),
        visibility: toNumber(cw.visibility, 10000) / 1000, // m → km
        precipProb: normalizePop(cw.rain?.chance ?? cw.pop ?? 0),
        // Phase 3.5 environmental fields — null when unavailable
        // AQI is stored on the raw current object after enrichment in fetchWeatherBundle()
        // Uses dedicated null-safe extractor: AQI 0 is valid (good air quality), must NOT default to 0
        airQuality: toNullableAqi(cw.aqi ?? cw.air_quality?.aqi ?? null),
        pollenLevel: toPollenLevel(cw.pollen?.level ?? null)
    }

    // Hourly points — already normalized by weatherNormalizer.js
    const hourly = Array.isArray(storeState.hourlyForecast)
        ? storeState.hourlyForecast
        : []

    // Daily summaries — from store.forecast (daily summaries array)
    const daily = Array.isArray(storeState.forecast)
        ? storeState.forecast
        : []

    return {
        current,
        hourly,
        daily,
        fetchedAt: toNumber(storeState.lastUpdatedAt, Date.now()),
        location: {
            lat: toNumber(coords.lat),
            lon: toNumber(coords.lon)
        }
    }
}

/**
 * Returns true when the WeatherData object contains meaningful current conditions.
 * @param {WeatherData|null} weatherData
 * @returns {boolean}
 */
export function isWeatherDataReady(weatherData) {
    return (
        weatherData !== null &&
        weatherData !== undefined &&
        typeof weatherData.current === 'object' &&
        weatherData.current !== null
    )
}
