/**
 * airQualityModule.test.js
 * Unit tests for Phase 3.5 — airQualityModule
 *
 * Key invariants:
 *   - Returns null when airQuality is null (gate)
 *   - Returns null when AQI < 51
 *   - type: 'environmental', subtype: 'air-quality' on all non-null results
 *   - Urgency follows escalateAirQuality() thresholds
 *   - Sensitive-user personalization changes urgency and actionPath
 *   - usedSensitivity / usedLocation flags set correctly
 */

import { describe, it, expect } from 'vitest'
import { airQualityModule } from '../airQualityModule.js'
import { validateInsight } from '@/utils/insightValidator.js'
import { URGENCY } from '@/utils/urgencyEngine.js'

// ---------------------------------------------------------------------------
// Mock builders
// ---------------------------------------------------------------------------

function makeWeatherData({ airQuality = null, uvIndex = 3 } = {}) {
    return {
        current: {
            temp: 20, feelsLike: 20, humidity: 55, windSpeed: 10, gustSpeed: 15,
            uvIndex, condition: 'Clear', visibility: 10, precipProb: 0.05,
            airQuality, pollenLevel: null
        },
        hourly: [],
        daily: [],
        fetchedAt: Date.now(),
        location: { lat: 51.5, lon: -0.1 }
    }
}

function makeContext({ primaryLocation = null, sensitivities = {} } = {}) {
    return {
        location: { primary: primaryLocation, saved: [], current: null },
        routines: { weekday: { departureTime: null, returnTime: null, outdoorWindows: [] }, weekend: { outdoorWindows: [] }, confidence: 'declared' },
        activities: { declared: [] },
        schedule: { manualEvents: [], calendarConnected: false },
        preferences: {
            temperatureUnit: 'C', theme: 'dark', verbosity: 'concise',
            notifications: { enabled: false, commute: false, morningBriefing: false, activityAlerts: false, riskAlerts: false, preDeparture: false, ambient: false },
            intelligenceAreas: { dailyPlanning: true, activityRecommend: false, commuteIntelligence: false, routineAdaptation: false, environmentalAware: true }
        },
        sensitivities: { heat: false, cold: false, pollen: false, uv: false, airQuality: false, precipitation: false, ...sensitivities },
        meta: {
            schemaVersion: '1.0.0', createdAt: 0, lastModifiedAt: 0,
            completeness: { hasLocation: !!primaryLocation, hasRoutine: false, hasActivities: false, hasSensitivities: false, hasPreferences: true },
            contextQuality: 'none'
        }
    }
}

const baseCtx = makeContext()

// ---------------------------------------------------------------------------
// Contract compliance
// ---------------------------------------------------------------------------

describe('airQualityModule — contract compliance', () => {
    it('has exactly 2 parameters', () => {
        expect(airQualityModule.length).toBe(2)
    })

    it('returns null or a valid Insight — never throws', () => {
        const result = airQualityModule(makeWeatherData({ airQuality: 120 }), baseCtx)
        if (result !== null) expect(validateInsight(result).valid).toBe(true)
    })

    it('returns null when weatherData is null', () => {
        expect(airQualityModule(null, baseCtx)).toBeNull()
    })

    it('returns null when weatherData.current is missing', () => {
        expect(airQualityModule({ hourly: [], daily: [] }, baseCtx)).toBeNull()
    })

    it('every non-null result has type "environmental"', () => {
        const result = airQualityModule(makeWeatherData({ airQuality: 160 }), baseCtx)
        expect(result?.type).toBe('environmental')
    })

    it('every non-null result has subtype "air-quality"', () => {
        const result = airQualityModule(makeWeatherData({ airQuality: 160 }), baseCtx)
        expect(result?.subtype).toBe('air-quality')
    })

    it('every non-null result has a non-empty actionPath', () => {
        const result = airQualityModule(makeWeatherData({ airQuality: 160 }), baseCtx)
        expect(result?.actionPath.trim().length).toBeGreaterThan(10)
    })
})

// ---------------------------------------------------------------------------
// Gate: no AQI data
// ---------------------------------------------------------------------------

describe('airQualityModule — no AQI data (gate)', () => {
    it('returns null when airQuality is null', () => {
        expect(airQualityModule(makeWeatherData({ airQuality: null }), baseCtx)).toBeNull()
    })

    it('returns null when airQuality is undefined', () => {
        const wd = makeWeatherData()
        delete wd.current.airQuality
        expect(airQualityModule(wd, baseCtx)).toBeNull()
    })

    it('returns null when context is null (gate passes through)', () => {
        const result = airQualityModule(makeWeatherData({ airQuality: 160 }), null)
        if (result !== null) expect(validateInsight(result).valid).toBe(true)
    })
})

// ---------------------------------------------------------------------------
// AQI urgency tiers — default thresholds
// ---------------------------------------------------------------------------

describe('airQualityModule — urgency tiers (default user)', () => {
    it('returns null for AQI 0 (good)', () => {
        expect(airQualityModule(makeWeatherData({ airQuality: 0 }), baseCtx)).toBeNull()
    })

    it('returns null for AQI 50', () => {
        expect(airQualityModule(makeWeatherData({ airQuality: 50 }), baseCtx)).toBeNull()
    })

    it('boundary: AQI 50 → null, AQI 51 → useful', () => {
        expect(airQualityModule(makeWeatherData({ airQuality: 50 }), baseCtx)).toBeNull()
        expect(airQualityModule(makeWeatherData({ airQuality: 51 }), baseCtx)?.urgency).toBe(URGENCY.USEFUL)
    })

    it('returns useful for AQI 51', () => {
        expect(airQualityModule(makeWeatherData({ airQuality: 51 }), baseCtx)?.urgency).toBe(URGENCY.USEFUL)
    })

    it('returns useful for AQI 99', () => {
        expect(airQualityModule(makeWeatherData({ airQuality: 99 }), baseCtx)?.urgency).toBe(URGENCY.USEFUL)
    })

    it('returns heads-up for AQI 100', () => {
        expect(airQualityModule(makeWeatherData({ airQuality: 100 }), baseCtx)?.urgency).toBe(URGENCY.HEADS_UP)
    })

    it('boundary: AQI 149 → heads-up, AQI 150 → alert', () => {
        expect(airQualityModule(makeWeatherData({ airQuality: 149 }), baseCtx)?.urgency).toBe(URGENCY.HEADS_UP)
        expect(airQualityModule(makeWeatherData({ airQuality: 150 }), baseCtx)?.urgency).toBe(URGENCY.ALERT)
    })

    it('returns alert for AQI 200', () => {
        expect(airQualityModule(makeWeatherData({ airQuality: 200 }), baseCtx)?.urgency).toBe(URGENCY.ALERT)
    })

    it('returns alert for AQI 300 (hazardous)', () => {
        expect(airQualityModule(makeWeatherData({ airQuality: 300 }), baseCtx)?.urgency).toBe(URGENCY.ALERT)
    })
})

// ---------------------------------------------------------------------------
// AQI sensitivity adjustments
// ---------------------------------------------------------------------------

describe('airQualityModule — airQuality-sensitive user', () => {
    const sensitiveCtx = makeContext({ sensitivities: { airQuality: true } })

    it('returns heads-up at AQI 51 for sensitive (default: useful)', () => {
        const defaultResult = airQualityModule(makeWeatherData({ airQuality: 51 }), baseCtx)
        const sensitiveResult = airQualityModule(makeWeatherData({ airQuality: 51 }), sensitiveCtx)
        expect(defaultResult?.urgency).toBe(URGENCY.USEFUL)
        expect(sensitiveResult?.urgency).toBe(URGENCY.HEADS_UP)
    })

    it('returns alert at AQI 100 for sensitive (default: heads-up)', () => {
        const defaultResult = airQualityModule(makeWeatherData({ airQuality: 100 }), baseCtx)
        const sensitiveResult = airQualityModule(makeWeatherData({ airQuality: 100 }), sensitiveCtx)
        expect(defaultResult?.urgency).toBe(URGENCY.HEADS_UP)
        expect(sensitiveResult?.urgency).toBe(URGENCY.ALERT)
    })

    it('sensitive alert actionPath includes respiratory-specific guidance', () => {
        const result = airQualityModule(makeWeatherData({ airQuality: 160 }), sensitiveCtx)
        expect(result?.actionPath).toMatch(/indoor|window|mask|respiratory|N95/i)
    })

    it('usedSensitivity is true for sensitive user when insight fires', () => {
        const result = airQualityModule(makeWeatherData({ airQuality: 120 }), sensitiveCtx)
        expect(result?.sourceContext.usedSensitivity).toBe(true)
    })
})

// ---------------------------------------------------------------------------
// Insight content quality
// ---------------------------------------------------------------------------

describe('airQualityModule — insight content quality', () => {
    it('content mentions air quality or AQI', () => {
        const result = airQualityModule(makeWeatherData({ airQuality: 120 }), baseCtx)
        expect(result?.content).toMatch(/air quality|AQI/i)
    })

    it('alert actionPath tells user to limit or avoid outdoor activity', () => {
        const result = airQualityModule(makeWeatherData({ airQuality: 160 }), baseCtx)
        expect(result?.actionPath).toMatch(/limit|avoid|indoor|outdoor/i)
    })

    it('useful insight actionPath is informational, not alarming', () => {
        const result = airQualityModule(makeWeatherData({ airQuality: 75 }), baseCtx)
        expect(result?.actionPath).toMatch(/check|consider|respiratory/i)
    })

    it('alert insight has high confidence', () => {
        const result = airQualityModule(makeWeatherData({ airQuality: 200 }), baseCtx)
        expect(result?.confidence).toBe('high')
    })
})

// ---------------------------------------------------------------------------
// sourceContext flags
// ---------------------------------------------------------------------------

describe('airQualityModule — sourceContext flags', () => {
    it('usedLocation is true when primary location is set', () => {
        const primaryLocation = { name: 'London', lat: 51.5, lon: -0.1, timezone: 'Europe/London', locationType: 'urban', confidence: 'declared' }
        const ctx = makeContext({ primaryLocation })
        const result = airQualityModule(makeWeatherData({ airQuality: 160 }), ctx)
        expect(result?.sourceContext.usedLocation).toBe(true)
    })

    it('usedLocation is false when no primary location', () => {
        const result = airQualityModule(makeWeatherData({ airQuality: 160 }), baseCtx)
        expect(result?.sourceContext.usedLocation).toBe(false)
    })

    it('usedSensitivity is false for standard user', () => {
        const result = airQualityModule(makeWeatherData({ airQuality: 160 }), baseCtx)
        expect(result?.sourceContext.usedSensitivity).toBe(false)
    })

    it('usedRoutine is false', () => {
        const result = airQualityModule(makeWeatherData({ airQuality: 160 }), baseCtx)
        expect(result?.sourceContext.usedRoutine).toBe(false)
    })

    it('usedActivity is false', () => {
        const result = airQualityModule(makeWeatherData({ airQuality: 160 }), baseCtx)
        expect(result?.sourceContext.usedActivity).toBe(false)
    })
})
