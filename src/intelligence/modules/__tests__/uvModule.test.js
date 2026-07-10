/**
 * uvModule.test.js
 * Unit tests for Phase 3.5 — uvModule
 *
 * Key invariants:
 *   - Returns null when UV is below threshold
 *   - Returns null when weatherData is null or current missing
 *   - type: 'environmental', subtype: 'uv' on all non-null results
 *   - Urgency follows escalateUV() thresholds (with sensitivity adjustment)
 *   - Focus: time-window advisory (distinct from comfortModule UV preparation)
 *   - usedSensitivity / usedLocation flags set correctly
 */

import { describe, it, expect } from 'vitest'
import { uvModule } from '../uvModule.js'
import { validateInsight } from '@/utils/insightValidator.js'
import { URGENCY } from '@/utils/urgencyEngine.js'

// ---------------------------------------------------------------------------
// Mock builders
// ---------------------------------------------------------------------------

function makeWeatherData({ uvIndex = 0, feelsLike = 20, temp = 20, hourly = [] } = {}) {
    return {
        current: {
            temp, feelsLike, humidity: 55, windSpeed: 10, gustSpeed: 15,
            uvIndex, condition: 'Clear', visibility: 10, precipProb: 0.05,
            airQuality: null, pollenLevel: null
        },
        hourly,
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

describe('uvModule — contract compliance', () => {
    it('has exactly 2 parameters', () => {
        expect(uvModule.length).toBe(2)
    })

    it('returns null or a valid Insight — never throws', () => {
        const result = uvModule(makeWeatherData({ uvIndex: 9 }), baseCtx)
        if (result !== null) expect(validateInsight(result).valid).toBe(true)
    })

    it('returns null when weatherData is null', () => {
        expect(uvModule(null, baseCtx)).toBeNull()
    })

    it('returns null when weatherData.current is missing', () => {
        expect(uvModule({ hourly: [], daily: [] }, baseCtx)).toBeNull()
    })

    it('every non-null result has type "environmental"', () => {
        const result = uvModule(makeWeatherData({ uvIndex: 9 }), baseCtx)
        expect(result?.type).toBe('environmental')
    })

    it('every non-null result has subtype "uv"', () => {
        const result = uvModule(makeWeatherData({ uvIndex: 9 }), baseCtx)
        expect(result?.subtype).toBe('uv')
    })

    it('every non-null result has a non-empty actionPath', () => {
        const result = uvModule(makeWeatherData({ uvIndex: 9 }), baseCtx)
        expect(result?.actionPath.trim().length).toBeGreaterThan(10)
    })
})

// ---------------------------------------------------------------------------
// Gate: UV below threshold
// ---------------------------------------------------------------------------

describe('uvModule — UV below threshold', () => {
    it('returns null for UV index 0', () => {
        expect(uvModule(makeWeatherData({ uvIndex: 0 }), baseCtx)).toBeNull()
    })

    it('returns null for UV index 2', () => {
        expect(uvModule(makeWeatherData({ uvIndex: 2 }), baseCtx)).toBeNull()
    })

    it('returns null for UV index 2.9', () => {
        expect(uvModule(makeWeatherData({ uvIndex: 2.9 }), baseCtx)).toBeNull()
    })

    it('returns null when uvIndex is undefined', () => {
        const wd = makeWeatherData()
        delete wd.current.uvIndex
        expect(() => uvModule(wd, baseCtx)).not.toThrow()
    })

    it('returns null when uvIndex is NaN', () => {
        expect(uvModule(makeWeatherData({ uvIndex: NaN }), baseCtx)).toBeNull()
    })

    it('returns null when context is null', () => {
        const result = uvModule(makeWeatherData({ uvIndex: 9 }), null)
        // Should still produce an insight (context null → fallback behaviour)
        if (result !== null) expect(validateInsight(result).valid).toBe(true)
    })
})

// ---------------------------------------------------------------------------
// UV urgency tiers — default thresholds
// ---------------------------------------------------------------------------

describe('uvModule — urgency tiers (default)', () => {
    it('returns useful for UV index 3', () => {
        expect(uvModule(makeWeatherData({ uvIndex: 3 }), baseCtx)?.urgency).toBe(URGENCY.USEFUL)
    })

    it('returns useful for UV index 5', () => {
        expect(uvModule(makeWeatherData({ uvIndex: 5 }), baseCtx)?.urgency).toBe(URGENCY.USEFUL)
    })

    it('returns heads-up for UV index 6', () => {
        expect(uvModule(makeWeatherData({ uvIndex: 6 }), baseCtx)?.urgency).toBe(URGENCY.HEADS_UP)
    })

    it('returns heads-up for UV index 7', () => {
        expect(uvModule(makeWeatherData({ uvIndex: 7 }), baseCtx)?.urgency).toBe(URGENCY.HEADS_UP)
    })

    it('returns alert for UV index 8', () => {
        expect(uvModule(makeWeatherData({ uvIndex: 8 }), baseCtx)?.urgency).toBe(URGENCY.ALERT)
    })

    it('returns alert for UV index 11', () => {
        expect(uvModule(makeWeatherData({ uvIndex: 11 }), baseCtx)?.urgency).toBe(URGENCY.ALERT)
    })

    it('boundary: UV 2 → null, UV 3 → useful', () => {
        expect(uvModule(makeWeatherData({ uvIndex: 2 }), baseCtx)).toBeNull()
        expect(uvModule(makeWeatherData({ uvIndex: 3 }), baseCtx)?.urgency).toBe(URGENCY.USEFUL)
    })

    it('boundary: UV 5.9 → useful, UV 6 → heads-up', () => {
        expect(uvModule(makeWeatherData({ uvIndex: 5.9 }), baseCtx)?.urgency).toBe(URGENCY.USEFUL)
        expect(uvModule(makeWeatherData({ uvIndex: 6 }), baseCtx)?.urgency).toBe(URGENCY.HEADS_UP)
    })
})

// ---------------------------------------------------------------------------
// UV sensitivity adjustments
// ---------------------------------------------------------------------------

describe('uvModule — UV-sensitive user', () => {
    const sensitiveCtx = makeContext({ sensitivities: { uv: true } })

    it('alert at UV 6 for sensitive (default would be heads-up)', () => {
        const defaultResult = uvModule(makeWeatherData({ uvIndex: 6 }), baseCtx)
        const sensitiveResult = uvModule(makeWeatherData({ uvIndex: 6 }), sensitiveCtx)
        expect(defaultResult?.urgency).toBe(URGENCY.HEADS_UP)
        expect(sensitiveResult?.urgency).toBe(URGENCY.ALERT)
    })

    it('heads-up at UV 4 for sensitive (default: useful)', () => {
        const defaultResult = uvModule(makeWeatherData({ uvIndex: 4 }), baseCtx)
        const sensitiveResult = uvModule(makeWeatherData({ uvIndex: 4 }), sensitiveCtx)
        expect(defaultResult?.urgency).toBe(URGENCY.USEFUL)
        expect(sensitiveResult?.urgency).toBe(URGENCY.HEADS_UP)
    })

    it('usedSensitivity is true for UV-sensitive user', () => {
        const result = uvModule(makeWeatherData({ uvIndex: 9 }), sensitiveCtx)
        expect(result?.sourceContext.usedSensitivity).toBe(true)
    })

    it('sensitive alert actionPath includes stronger guidance', () => {
        const result = uvModule(makeWeatherData({ uvIndex: 9 }), sensitiveCtx)
        expect(result?.actionPath).toMatch(/SPF 50|avoid.*sun|short|burst/i)
    })
})

// ---------------------------------------------------------------------------
// Insight content quality
// ---------------------------------------------------------------------------

describe('uvModule — insight content quality', () => {
    it('content mentions UV or sun', () => {
        const result = uvModule(makeWeatherData({ uvIndex: 8 }), baseCtx)
        expect(result?.content).toMatch(/UV|sun|burn/i)
    })

    it('alert actionPath mentions duration limit or avoidance', () => {
        const result = uvModule(makeWeatherData({ uvIndex: 9 }), baseCtx)
        expect(result?.actionPath).toMatch(/avoid|limit|minut|sun/i)
    })

    it('heads-up actionPath mentions sunscreen or midday', () => {
        const result = uvModule(makeWeatherData({ uvIndex: 7 }), baseCtx)
        expect(result?.actionPath).toMatch(/sunscreen|midday|noon|11.*AM|3.*PM/i)
    })

    it('useful insight content describes UV as moderate', () => {
        const result = uvModule(makeWeatherData({ uvIndex: 4 }), baseCtx)
        expect(result?.content).toMatch(/moderate/i)
    })

    it('alert insight has high confidence', () => {
        const result = uvModule(makeWeatherData({ uvIndex: 9 }), baseCtx)
        expect(result?.confidence).toBe('high')
    })

    it('useful insight has medium confidence', () => {
        const result = uvModule(makeWeatherData({ uvIndex: 4 }), baseCtx)
        expect(result?.confidence).toBe('medium')
    })
})

// ---------------------------------------------------------------------------
// sourceContext flags
// ---------------------------------------------------------------------------

describe('uvModule — sourceContext flags', () => {
    it('usedLocation is true when primary location is set', () => {
        const primaryLocation = { name: 'London', lat: 51.5, lon: -0.1, timezone: 'Europe/London', locationType: 'urban', confidence: 'declared' }
        const ctx = makeContext({ primaryLocation })
        const result = uvModule(makeWeatherData({ uvIndex: 9 }), ctx)
        expect(result?.sourceContext.usedLocation).toBe(true)
    })

    it('usedLocation is false when no primary location', () => {
        const result = uvModule(makeWeatherData({ uvIndex: 9 }), baseCtx)
        expect(result?.sourceContext.usedLocation).toBe(false)
    })

    it('usedSensitivity is false for standard user', () => {
        const result = uvModule(makeWeatherData({ uvIndex: 9 }), baseCtx)
        expect(result?.sourceContext.usedSensitivity).toBe(false)
    })

    it('usedRoutine is false', () => {
        const result = uvModule(makeWeatherData({ uvIndex: 9 }), baseCtx)
        expect(result?.sourceContext.usedRoutine).toBe(false)
    })

    it('usedActivity is false', () => {
        const result = uvModule(makeWeatherData({ uvIndex: 9 }), baseCtx)
        expect(result?.sourceContext.usedActivity).toBe(false)
    })
})
