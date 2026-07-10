/**
 * phase35Pipeline.test.js — Phase 3.5
 *
 * End-to-end pipeline tests:
 *   normalizeWeather → weatherDataAdapter → environmental module activation
 *
 * These tests verify the complete data flow from the raw API response
 * (as produced by weatherApi.js after enrichment) through to the intelligence
 * modules receiving non-null environmental values and producing insights.
 *
 * Constraints:
 *   - No mocking of the normalizer, adapter, or modules
 *   - No modification of urgency thresholds
 *   - Tests prove data flows correctly end-to-end
 */

import { describe, it, expect } from 'vitest'
import { normalizeWeather } from '@/services/weatherNormalizer'
import { buildWeatherData } from '@/utils/weatherDataAdapter'
import { airQualityModule } from '@/intelligence/modules/airQualityModule'
import { uvModule } from '@/intelligence/modules/uvModule'
import { pollenModule } from '@/intelligence/modules/pollenModule'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Simulates the enriched current object as produced by weatherApi.js
 * after fetchAirQuality() has been merged in.
 */
function makeEnrichedRawCurrent(overrides = {}) {
    return {
        dt: Date.now() / 1000,
        name: 'London',
        coord: { lat: 51.5, lon: -0.1 },
        main: { temp: 22, feels_like: 20, humidity: 60, pressure: 1013 },
        wind: { speed: 15, gust: 20 },
        rain: { chance: 0.2 },
        weather: [{ main: 'Clear', description: 'clear sky', icon: '01d' }],
        visibility: 10000,
        ...overrides
    }
}

function makeMinimalContext() {
    return {
        location: { primary: null, saved: [], current: null },
        routines: {
            weekday: { departureTime: null, returnTime: null, outdoorWindows: [] },
            weekend: { outdoorWindows: [] },
            confidence: 'declared'
        },
        activities: { declared: [] },
        schedule: { manualEvents: [], calendarConnected: false },
        preferences: {
            temperatureUnit: 'C', theme: 'dark', verbosity: 'concise',
            notifications: { enabled: false, commute: false, morningBriefing: false, activityAlerts: false, riskAlerts: false, preDeparture: false, ambient: false },
            intelligenceAreas: { dailyPlanning: true, activityRecommend: false, commuteIntelligence: false, routineAdaptation: false, environmentalAware: true }
        },
        sensitivities: { heat: false, cold: false, pollen: false, uv: false, airQuality: false, precipitation: false },
        meta: {
            schemaVersion: '1.0.0', createdAt: 0, lastModifiedAt: 0,
            completeness: { hasLocation: false, hasRoutine: false, hasActivities: false, hasSensitivities: false, hasPreferences: true },
            contextQuality: 'none'
        }
    }
}

// ---------------------------------------------------------------------------
// AQI pipeline: rawCurrent → normalizer → adapter → airQualityModule
// ---------------------------------------------------------------------------

describe('Phase 3.5 Pipeline — AQI', () => {

    it('AQI survives full pipeline: rawCurrent → normalizer → adapter → module', () => {
        // Simulate what weatherApi.js produces after enrichment
        const rawCurrent = makeEnrichedRawCurrent({ aqi: 160 })

        // Step 1: normalizer (as called by weather.js store)
        const normalized = normalizeWeather(rawCurrent, { list: [] })
        expect(normalized.current.aqi).toBe(160) // survives normalization

        // Step 2: adapter (as called by useInsightEngine via buildWeatherData)
        const storeState = {
            currentWeather: normalized.current,
            hourlyForecast: [],
            forecast: [],
            lastUpdatedAt: Date.now()
        }
        const weatherData = buildWeatherData(storeState)
        expect(weatherData.current.airQuality).toBe(160) // adapter reads it

        // Step 3: module activates and produces an insight
        const insight = airQualityModule(weatherData, makeMinimalContext())
        expect(insight).not.toBeNull()
        expect(insight.type).toBe('environmental')
        expect(insight.subtype).toBe('air-quality')
        expect(insight.urgency).toBe('alert') // AQI 160 → alert for default user
    })

    it('AQI 0 (clean air) flows through as 0 and module returns null (below threshold)', () => {
        const rawCurrent = makeEnrichedRawCurrent({ aqi: 0 })
        const normalized = normalizeWeather(rawCurrent, { list: [] })
        expect(normalized.current.aqi).toBe(0)

        const storeState = { currentWeather: normalized.current, hourlyForecast: [], forecast: [], lastUpdatedAt: Date.now() }
        const weatherData = buildWeatherData(storeState)
        expect(weatherData.current.airQuality).toBe(0) // adapter preserves 0

        // AQI 0 is below all thresholds → module returns null (correct)
        const insight = airQualityModule(weatherData, makeMinimalContext())
        expect(insight).toBeNull()
    })

    it('absent AQI produces null at adapter → module returns null', () => {
        // No aqi field on rawCurrent (API call failed / unavailable)
        const rawCurrent = makeEnrichedRawCurrent() // no aqi
        const normalized = normalizeWeather(rawCurrent, { list: [] })
        expect(normalized.current).not.toHaveProperty('aqi') // not present

        const storeState = { currentWeather: normalized.current, hourlyForecast: [], forecast: [], lastUpdatedAt: Date.now() }
        const weatherData = buildWeatherData(storeState)
        expect(weatherData.current.airQuality).toBeNull() // adapter gets null

        // Module gate: airQuality null → module returns null
        const insight = airQualityModule(weatherData, makeMinimalContext())
        expect(insight).toBeNull()
    })

    it('sensitive user receives alert at AQI 100 via full pipeline', () => {
        const rawCurrent = makeEnrichedRawCurrent({ aqi: 100 })
        const normalized = normalizeWeather(rawCurrent, { list: [] })
        const storeState = { currentWeather: normalized.current, hourlyForecast: [], forecast: [], lastUpdatedAt: Date.now() }
        const weatherData = buildWeatherData(storeState)

        const sensitiveCtx = makeMinimalContext()
        sensitiveCtx.sensitivities.airQuality = true

        const insight = airQualityModule(weatherData, sensitiveCtx)
        expect(insight).not.toBeNull()
        expect(insight.urgency).toBe('alert') // sensitive: alert at 100 vs heads-up for default
        expect(insight.sourceContext.usedSensitivity).toBe(true)
    })
})

// ---------------------------------------------------------------------------
// UV pipeline: rawCurrent → normalizer → adapter → uvModule
// ---------------------------------------------------------------------------

describe('Phase 3.5 Pipeline — UV', () => {

    it('UV enrichment survives full pipeline and activates uvModule', () => {
        const rawCurrent = makeEnrichedRawCurrent({ uv_index_enriched: 9.2 })
        const normalized = normalizeWeather(rawCurrent, { list: [] })
        expect(normalized.current.uv_index_enriched).toBe(9.2) // survives

        const storeState = { currentWeather: normalized.current, hourlyForecast: [], forecast: [], lastUpdatedAt: Date.now() }
        const weatherData = buildWeatherData(storeState)

        // Adapter prefers uv_index_enriched
        expect(weatherData.current.uvIndex).toBe(9.2)

        const insight = uvModule(weatherData, makeMinimalContext())
        expect(insight).not.toBeNull()
        expect(insight.type).toBe('environmental')
        expect(insight.subtype).toBe('uv')
        expect(insight.urgency).toBe('alert') // UV 9.2 → alert
    })

    it('UV enrichment takes priority over uvi fallback in adapter', () => {
        // Both fields present — enriched should win
        const rawCurrent = makeEnrichedRawCurrent({ uv_index_enriched: 8.5, uvi: 3 })
        const normalized = normalizeWeather(rawCurrent, { list: [] })
        const storeState = { currentWeather: normalized.current, hourlyForecast: [], forecast: [], lastUpdatedAt: Date.now() }
        const weatherData = buildWeatherData(storeState)
        expect(weatherData.current.uvIndex).toBe(8.5) // enriched wins
    })

    it('absent UV enrichment produces uvIndex 0 via fallback chain → module returns null', () => {
        // No enrichment, no uvi, no uv_index — fallback to 0
        const rawCurrent = makeEnrichedRawCurrent()
        const normalized = normalizeWeather(rawCurrent, { list: [] })
        const storeState = { currentWeather: normalized.current, hourlyForecast: [], forecast: [], lastUpdatedAt: Date.now() }
        const weatherData = buildWeatherData(storeState)
        expect(weatherData.current.uvIndex).toBe(0)

        // UV 0 → below useful threshold → module returns null
        const insight = uvModule(weatherData, makeMinimalContext())
        expect(insight).toBeNull()
    })

    it('UV-sensitive user gets alert at UV 6 via full pipeline', () => {
        const rawCurrent = makeEnrichedRawCurrent({ uv_index_enriched: 6 })
        const normalized = normalizeWeather(rawCurrent, { list: [] })
        const storeState = { currentWeather: normalized.current, hourlyForecast: [], forecast: [], lastUpdatedAt: Date.now() }
        const weatherData = buildWeatherData(storeState)

        const sensitiveCtx = makeMinimalContext()
        sensitiveCtx.sensitivities.uv = true

        const insight = uvModule(weatherData, sensitiveCtx)
        expect(insight).not.toBeNull()
        expect(insight.urgency).toBe('alert') // sensitive: alert at 6 vs heads-up for default
    })
})

// ---------------------------------------------------------------------------
// Pollen pipeline: pollenLevel flows through adapter (data sourced separately)
// ---------------------------------------------------------------------------

describe('Phase 3.5 Pipeline — Pollen', () => {

    it('pollenLevel flows through adapter when present directly on currentWeather', () => {
        // Pollen data is sourced separately and placed directly on the store's
        // currentWeather object. The normalizer does not strip it because
        // pollen is a future enrichment — when pollen API is integrated it will
        // be merged onto currentWeather the same way aqi is, then read by
        // the adapter from cw.pollen.level.
        // For now, simulate it being present on the normalized current directly.
        const storeState = {
            currentWeather: {
                name: 'London',
                coord: { lat: 51.5, lon: -0.1 },
                main: { temp: 20, feels_like: 19, humidity: 60 },
                wind: { speed: 10 },
                weather: [{ main: 'Clear' }],
                // Pollen field as it would appear after future API integration
                pollen: { level: 'high' }
            },
            hourlyForecast: [],
            forecast: [],
            lastUpdatedAt: Date.now()
        }
        const weatherData = buildWeatherData(storeState)
        expect(weatherData.current.pollenLevel).toBe('high')

        const insight = pollenModule(weatherData, makeMinimalContext())
        expect(insight).not.toBeNull()
        expect(insight.type).toBe('environmental')
        expect(insight.subtype).toBe('pollen')
    })

    it('absent pollen data produces null pollenLevel → pollenModule returns null', () => {
        const rawCurrent = makeEnrichedRawCurrent()
        const normalized = normalizeWeather(rawCurrent, { list: [] })
        const storeState = { currentWeather: normalized.current, hourlyForecast: [], forecast: [], lastUpdatedAt: Date.now() }
        const weatherData = buildWeatherData(storeState)
        expect(weatherData.current.pollenLevel).toBeNull()

        const insight = pollenModule(weatherData, makeMinimalContext())
        expect(insight).toBeNull()
    })
})

// ---------------------------------------------------------------------------
// Graceful degradation: no crash when data is missing
// ---------------------------------------------------------------------------

describe('Phase 3.5 Pipeline — graceful degradation', () => {

    it('full pipeline does not crash when all environmental fields are absent', () => {
        const rawCurrent = makeEnrichedRawCurrent() // no aqi, no uv_index_enriched, no pollen
        expect(() => {
            const normalized = normalizeWeather(rawCurrent, { list: [] })
            const storeState = { currentWeather: normalized.current, hourlyForecast: [], forecast: [], lastUpdatedAt: Date.now() }
            const weatherData = buildWeatherData(storeState)
            airQualityModule(weatherData, makeMinimalContext())
            uvModule(weatherData, makeMinimalContext())
            pollenModule(weatherData, makeMinimalContext())
        }).not.toThrow()
    })

    it('all three environmental modules return null when data is absent', () => {
        const rawCurrent = makeEnrichedRawCurrent()
        const normalized = normalizeWeather(rawCurrent, { list: [] })
        const storeState = { currentWeather: normalized.current, hourlyForecast: [], forecast: [], lastUpdatedAt: Date.now() }
        const weatherData = buildWeatherData(storeState)

        expect(airQualityModule(weatherData, makeMinimalContext())).toBeNull()
        expect(uvModule(weatherData, makeMinimalContext())).toBeNull()
        expect(pollenModule(weatherData, makeMinimalContext())).toBeNull()
    })
})
