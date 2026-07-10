/**
 * weatherDataAdapter.test.js
 * Tests for the WeatherData normalization adapter.
 */

import { describe, it, expect } from 'vitest'
import { buildWeatherData, isWeatherDataReady } from '@/utils/weatherDataAdapter'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeStoreState(overrides = {}) {
    return {
        currentWeather: {
            name: 'London',
            coord: { lat: 51.5, lon: -0.1 },
            main: {
                temp: 22,
                feels_like: 20,
                humidity: 65
            },
            wind: { speed: 15, gust: 22 },
            weather: [{ main: 'Clouds', description: 'overcast clouds', icon: '04d' }],
            visibility: 8000,
            rain: { chance: 0.2 },
            ...overrides.currentWeather
        },
        hourlyForecast: overrides.hourlyForecast ?? [],
        forecast: overrides.forecast ?? [],
        lastUpdatedAt: overrides.lastUpdatedAt ?? Date.now()
    }
}

// ---------------------------------------------------------------------------
// buildWeatherData
// ---------------------------------------------------------------------------

describe('buildWeatherData()', () => {
    it('returns null when currentWeather is null', () => {
        expect(buildWeatherData({ currentWeather: null, hourlyForecast: [], forecast: [], lastUpdatedAt: null })).toBeNull()
    })

    it('returns null when store state is null', () => {
        expect(buildWeatherData(null)).toBeNull()
    })

    it('returns a WeatherData object with a current field', () => {
        const state = makeStoreState()
        const result = buildWeatherData(state)
        expect(result).not.toBeNull()
        expect(result.current).toBeDefined()
    })

    it('maps temperature correctly from main.temp', () => {
        const state = makeStoreState({ currentWeather: { main: { temp: 24, feels_like: 22, humidity: 55 } } })
        const result = buildWeatherData(state)
        expect(result.current.temp).toBe(24)
    })

    it('maps feelsLike from main.feels_like', () => {
        const state = makeStoreState()
        const result = buildWeatherData(state)
        expect(result.current.feelsLike).toBe(20)
    })

    it('maps feelsLike to temp as fallback when feels_like is absent', () => {
        const state = makeStoreState({
            currentWeather: {
                main: { temp: 18 },
                wind: { speed: 5 }
            }
        })
        const result = buildWeatherData(state)
        expect(result.current.feelsLike).toBe(18)
    })

    it('maps humidity from main.humidity', () => {
        const state = makeStoreState()
        const result = buildWeatherData(state)
        expect(result.current.humidity).toBe(65)
    })

    it('maps windSpeed from wind.speed', () => {
        const state = makeStoreState()
        const result = buildWeatherData(state)
        expect(result.current.windSpeed).toBe(15)
    })

    it('maps gustSpeed from wind.gust', () => {
        const state = makeStoreState()
        const result = buildWeatherData(state)
        expect(result.current.gustSpeed).toBe(22)
    })

    it('falls back to wind.speed for gustSpeed when gust is absent', () => {
        const state = makeStoreState({
            currentWeather: {
                wind: { speed: 10 }
            }
        })
        const result = buildWeatherData(state)
        expect(result.current.gustSpeed).toBe(10)
    })

    it('maps condition from weather[0].main', () => {
        const state = makeStoreState()
        const result = buildWeatherData(state)
        expect(result.current.condition).toBe('Clouds')
    })

    it('converts visibility from metres to kilometres', () => {
        const state = makeStoreState()
        const result = buildWeatherData(state)
        expect(result.current.visibility).toBe(8) // 8000m → 8km
    })

    it('maps precipProb as a 0–1 fraction from rain.chance', () => {
        const state = makeStoreState()
        const result = buildWeatherData(state)
        // rain.chance = 0.2 → normalized to 0.2 (already 0–1)
        expect(result.current.precipProb).toBeCloseTo(0.2)
    })

    it('normalizes precipProb > 1 (percent scale) to 0–1', () => {
        const state = makeStoreState({
            currentWeather: {
                rain: { chance: 65 } // percent
            }
        })
        const result = buildWeatherData(state)
        expect(result.current.precipProb).toBeCloseTo(0.65)
    })

    it('maps location from coord', () => {
        const state = makeStoreState()
        const result = buildWeatherData(state)
        expect(result.location.lat).toBe(51.5)
        expect(result.location.lon).toBe(-0.1)
    })

    it('passes hourly forecast through unchanged', () => {
        const hourly = [{ dt: 1, pop: 0.3 }, { dt: 2, pop: 0.5 }]
        const state = makeStoreState({ hourlyForecast: hourly })
        const result = buildWeatherData(state)
        expect(result.hourly).toHaveLength(2)
        expect(result.hourly[0].dt).toBe(1)
    })

    it('passes daily forecast through unchanged', () => {
        const daily = [{ date: '2025-01-01', minTemp: 10, maxTemp: 20 }]
        const state = makeStoreState({ forecast: daily })
        const result = buildWeatherData(state)
        expect(result.daily).toHaveLength(1)
    })

    it('defaults to empty arrays when forecast fields are absent', () => {
        const state = makeStoreState({ hourlyForecast: null, forecast: undefined })
        const result = buildWeatherData(state)
        expect(result.hourly).toEqual([])
        expect(result.daily).toEqual([])
    })

    it('includes fetchedAt from lastUpdatedAt', () => {
        const ts = 1700000000000
        const state = makeStoreState({ lastUpdatedAt: ts })
        const result = buildWeatherData(state)
        expect(result.fetchedAt).toBe(ts)
    })

    it('handles missing main gracefully with 0 fallbacks', () => {
        // Provide a minimal currentWeather with no main or wind — coord only
        const state = {
            currentWeather: {
                coord: { lat: 0, lon: 0 }
                // no main, no wind — all fields absent
            },
            hourlyForecast: [],
            forecast: [],
            lastUpdatedAt: null
        }
        const result = buildWeatherData(state)
        expect(result.current.temp).toBe(0)
        expect(result.current.humidity).toBe(0)
        expect(result.current.windSpeed).toBe(0)
    })
})

// ---------------------------------------------------------------------------
// isWeatherDataReady
// ---------------------------------------------------------------------------

describe('isWeatherDataReady()', () => {
    it('returns true for a valid WeatherData object', () => {
        const state = makeStoreState()
        const data = buildWeatherData(state)
        expect(isWeatherDataReady(data)).toBe(true)
    })

    it('returns false for null', () => {
        expect(isWeatherDataReady(null)).toBe(false)
    })

    it('returns false for undefined', () => {
        expect(isWeatherDataReady(undefined)).toBe(false)
    })

    it('returns false when current is null', () => {
        expect(isWeatherDataReady({ current: null, hourly: [], daily: [] })).toBe(false)
    })
})

// ---------------------------------------------------------------------------
// Phase 3.5 — airQuality and pollenLevel extraction
// ---------------------------------------------------------------------------

describe('buildWeatherData() — Phase 3.5 environmental fields', () => {
    it('airQuality is null when absent from store', () => {
        const state = makeStoreState()
        const result = buildWeatherData(state)
        expect(result.current.airQuality).toBeNull()
    })

    it('airQuality is extracted from cw.aqi when present', () => {
        const state = makeStoreState({ currentWeather: { aqi: 120 } })
        const result = buildWeatherData(state)
        expect(result.current.airQuality).toBe(120)
    })

    it('airQuality 0 is preserved as 0 (valid — means good air quality)', () => {
        const state = makeStoreState({ currentWeather: { aqi: 0 } })
        const result = buildWeatherData(state)
        expect(result.current.airQuality).toBe(0)
    })

    it('airQuality is null for non-numeric aqi value', () => {
        const state = makeStoreState({ currentWeather: { aqi: 'high' } })
        const result = buildWeatherData(state)
        expect(result.current.airQuality).toBeNull()
    })

    it('airQuality is null for negative aqi value', () => {
        const state = makeStoreState({ currentWeather: { aqi: -1 } })
        const result = buildWeatherData(state)
        expect(result.current.airQuality).toBeNull()
    })

    it('airQuality is extracted from cw.air_quality.aqi as fallback', () => {
        const state = makeStoreState({ currentWeather: { air_quality: { aqi: 75 } } })
        const result = buildWeatherData(state)
        expect(result.current.airQuality).toBe(75)
    })

    it('pollenLevel is null when absent from store', () => {
        const state = makeStoreState()
        const result = buildWeatherData(state)
        expect(result.current.pollenLevel).toBeNull()
    })

    it('pollenLevel is extracted correctly for known levels', () => {
        for (const level of ['low', 'moderate', 'high', 'very-high']) {
            const state = makeStoreState({ currentWeather: { pollen: { level } } })
            const result = buildWeatherData(state)
            expect(result.current.pollenLevel).toBe(level)
        }
    })

    it('pollenLevel is null for unknown string', () => {
        const state = makeStoreState({ currentWeather: { pollen: { level: 'extreme' } } })
        const result = buildWeatherData(state)
        expect(result.current.pollenLevel).toBeNull()
    })

    it('pollenLevel is null for numeric value', () => {
        const state = makeStoreState({ currentWeather: { pollen: { level: 3 } } })
        const result = buildWeatherData(state)
        expect(result.current.pollenLevel).toBeNull()
    })

    it('existing fields are unaffected by Phase 3.5 additions', () => {
        const state = makeStoreState({ currentWeather: { aqi: 80, pollen: { level: 'high' } } })
        const result = buildWeatherData(state)
        expect(result.current.temp).toBe(22)
        expect(result.current.humidity).toBe(65)
        expect(result.current.windSpeed).toBe(15)
        expect(result.current.airQuality).toBe(80)
        expect(result.current.pollenLevel).toBe('high')
    })
})
