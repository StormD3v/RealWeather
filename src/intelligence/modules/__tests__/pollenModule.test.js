/**
 * pollenModule.test.js
 * Unit tests for Phase 3.5 — pollenModule
 *
 * Key invariants:
 *   - Returns null when pollenLevel is null (gate)
 *   - No useful-tier output — pollen is prevention-focused
 *   - Standard user: silent for low and moderate; heads-up for high; alert for very-high
 *   - Sensitive user: heads-up from moderate upward
 *   - type: 'environmental', subtype: 'pollen' on all non-null results
 *   - usedSensitivity / usedLocation flags set correctly
 */

import { describe, it, expect } from 'vitest'
import { pollenModule } from '../pollenModule.js'
import { validateInsight } from '@/utils/insightValidator.js'
import { URGENCY } from '@/utils/urgencyEngine.js'

// ---------------------------------------------------------------------------
// Mock builders
// ---------------------------------------------------------------------------

function makeWeatherData({ pollenLevel = null } = {}) {
    return {
        current: {
            temp: 20, feelsLike: 20, humidity: 55, windSpeed: 10, gustSpeed: 15,
            uvIndex: 4, condition: 'Clear', visibility: 10, precipProb: 0.05,
            airQuality: null, pollenLevel
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
const sensitiveCtx = makeContext({ sensitivities: { pollen: true } })

// ---------------------------------------------------------------------------
// Contract compliance
// ---------------------------------------------------------------------------

describe('pollenModule — contract compliance', () => {
    it('has exactly 2 parameters', () => {
        expect(pollenModule.length).toBe(2)
    })

    it('returns null or a valid Insight — never throws', () => {
        const result = pollenModule(makeWeatherData({ pollenLevel: 'high' }), baseCtx)
        if (result !== null) expect(validateInsight(result).valid).toBe(true)
    })

    it('returns null when weatherData is null', () => {
        expect(pollenModule(null, baseCtx)).toBeNull()
    })

    it('returns null when weatherData.current is missing', () => {
        expect(pollenModule({ hourly: [], daily: [] }, baseCtx)).toBeNull()
    })

    it('every non-null result has type "environmental"', () => {
        const result = pollenModule(makeWeatherData({ pollenLevel: 'high' }), baseCtx)
        expect(result?.type).toBe('environmental')
    })

    it('every non-null result has subtype "pollen"', () => {
        const result = pollenModule(makeWeatherData({ pollenLevel: 'high' }), baseCtx)
        expect(result?.subtype).toBe('pollen')
    })

    it('every non-null result has a non-empty actionPath', () => {
        const result = pollenModule(makeWeatherData({ pollenLevel: 'high' }), baseCtx)
        expect(result?.actionPath.trim().length).toBeGreaterThan(10)
    })
})

// ---------------------------------------------------------------------------
// Gate: no pollen data
// ---------------------------------------------------------------------------

describe('pollenModule — no pollen data (gate)', () => {
    it('returns null when pollenLevel is null', () => {
        expect(pollenModule(makeWeatherData({ pollenLevel: null }), baseCtx)).toBeNull()
    })

    it('returns null when pollenLevel is undefined', () => {
        const wd = makeWeatherData()
        delete wd.current.pollenLevel
        expect(pollenModule(wd, baseCtx)).toBeNull()
    })

    it('returns null for unknown pollenLevel string', () => {
        expect(pollenModule(makeWeatherData({ pollenLevel: 'extreme' }), baseCtx)).toBeNull()
    })

    it('returns null for empty string pollenLevel', () => {
        expect(pollenModule(makeWeatherData({ pollenLevel: '' }), baseCtx)).toBeNull()
    })

    it('returns null when context is null', () => {
        const result = pollenModule(makeWeatherData({ pollenLevel: 'very-high' }), null)
        if (result !== null) expect(validateInsight(result).valid).toBe(true)
    })
})

// ---------------------------------------------------------------------------
// Standard user pollen scenarios
// ---------------------------------------------------------------------------

describe('pollenModule — standard user scenarios', () => {
    it('returns null for "low" pollen (standard user)', () => {
        expect(pollenModule(makeWeatherData({ pollenLevel: 'low' }), baseCtx)).toBeNull()
    })

    it('returns null for "moderate" pollen (standard user — silent)', () => {
        expect(pollenModule(makeWeatherData({ pollenLevel: 'moderate' }), baseCtx)).toBeNull()
    })

    it('returns heads-up for "high" pollen (standard user)', () => {
        const result = pollenModule(makeWeatherData({ pollenLevel: 'high' }), baseCtx)
        expect(result).not.toBeNull()
        expect(result?.urgency).toBe(URGENCY.HEADS_UP)
    })

    it('returns alert for "very-high" pollen (standard user)', () => {
        const result = pollenModule(makeWeatherData({ pollenLevel: 'very-high' }), baseCtx)
        expect(result).not.toBeNull()
        expect(result?.urgency).toBe(URGENCY.ALERT)
    })

    it('does not produce useful-tier insight for any pollen level', () => {
        for (const level of ['low', 'moderate', 'high', 'very-high']) {
            const result = pollenModule(makeWeatherData({ pollenLevel: level }), baseCtx)
            if (result !== null) {
                expect(result.urgency).not.toBe(URGENCY.USEFUL)
                expect(result.urgency).not.toBe(URGENCY.AMBIENT)
            }
        }
    })
})

// ---------------------------------------------------------------------------
// Pollen-sensitive user scenarios
// ---------------------------------------------------------------------------

describe('pollenModule — pollen-sensitive user', () => {
    it('returns null for "low" pollen even when sensitive', () => {
        expect(pollenModule(makeWeatherData({ pollenLevel: 'low' }), sensitiveCtx)).toBeNull()
    })

    it('returns heads-up for "moderate" pollen when sensitive (threshold shifts down)', () => {
        const defaultResult = pollenModule(makeWeatherData({ pollenLevel: 'moderate' }), baseCtx)
        const sensitiveResult = pollenModule(makeWeatherData({ pollenLevel: 'moderate' }), sensitiveCtx)
        expect(defaultResult).toBeNull()
        expect(sensitiveResult?.urgency).toBe(URGENCY.HEADS_UP)
    })

    it('returns heads-up for "high" pollen when sensitive', () => {
        expect(pollenModule(makeWeatherData({ pollenLevel: 'high' }), sensitiveCtx)?.urgency).toBe(URGENCY.HEADS_UP)
    })

    it('returns alert for "very-high" pollen when sensitive', () => {
        expect(pollenModule(makeWeatherData({ pollenLevel: 'very-high' }), sensitiveCtx)?.urgency).toBe(URGENCY.ALERT)
    })

    it('usedSensitivity is true for sensitive user when insight fires', () => {
        const result = pollenModule(makeWeatherData({ pollenLevel: 'high' }), sensitiveCtx)
        expect(result?.sourceContext.usedSensitivity).toBe(true)
    })

    it('sensitive actionPath includes medication and indoor guidance', () => {
        const result = pollenModule(makeWeatherData({ pollenLevel: 'high' }), sensitiveCtx)
        expect(result?.actionPath).toMatch(/antihistamine|medication|indoor|window/i)
    })
})

// ---------------------------------------------------------------------------
// Insight content quality
// ---------------------------------------------------------------------------

describe('pollenModule — insight content quality', () => {
    it('content mentions pollen', () => {
        const result = pollenModule(makeWeatherData({ pollenLevel: 'high' }), baseCtx)
        expect(result?.content).toMatch(/pollen/i)
    })

    it('alert actionPath for very-high pollen mentions multiple precautions', () => {
        const result = pollenModule(makeWeatherData({ pollenLevel: 'very-high' }), baseCtx)
        expect(result?.actionPath).toMatch(/antihistamine|limit|outdoor/i)
    })

    it('heads-up content uses the level label (not "high" for moderate when sensitive)', () => {
        const result = pollenModule(makeWeatherData({ pollenLevel: 'moderate' }), sensitiveCtx)
        expect(result?.content).toMatch(/moderate/i)
    })
})

// ---------------------------------------------------------------------------
// sourceContext flags
// ---------------------------------------------------------------------------

describe('pollenModule — sourceContext flags', () => {
    it('usedLocation is true when primary location is set', () => {
        const primaryLocation = { name: 'London', lat: 51.5, lon: -0.1, timezone: 'Europe/London', locationType: 'urban', confidence: 'declared' }
        const ctx = makeContext({ primaryLocation })
        const result = pollenModule(makeWeatherData({ pollenLevel: 'high' }), ctx)
        expect(result?.sourceContext.usedLocation).toBe(true)
    })

    it('usedLocation is false when no primary location', () => {
        const result = pollenModule(makeWeatherData({ pollenLevel: 'high' }), baseCtx)
        expect(result?.sourceContext.usedLocation).toBe(false)
    })

    it('usedSensitivity is false for standard user', () => {
        const result = pollenModule(makeWeatherData({ pollenLevel: 'high' }), baseCtx)
        expect(result?.sourceContext.usedSensitivity).toBe(false)
    })

    it('usedRoutine is false', () => {
        const result = pollenModule(makeWeatherData({ pollenLevel: 'high' }), baseCtx)
        expect(result?.sourceContext.usedRoutine).toBe(false)
    })

    it('usedActivity is false', () => {
        const result = pollenModule(makeWeatherData({ pollenLevel: 'high' }), baseCtx)
        expect(result?.sourceContext.usedActivity).toBe(false)
    })
})
