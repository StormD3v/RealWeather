/**
 * comfortModule.test.js
 * Unit tests for Phase 3.2 — comfortModule
 *
 * All inputs are plain mock objects — no stores, no Vue, no Pinia.
 * Tests verify:
 *   - Contract compliance (2 params, null safety, actionPath gate)
 *   - Heat + humidity compound scenarios
 *   - UV scenarios with and without UV sensitivity
 *   - Wind chill compound scenarios
 *   - High humidity (without extreme heat)
 *   - Dry air scenario
 *   - Benign conditions → null
 *   - Sensitivity adjustments change urgency
 *   - actionPath is always non-empty for non-null returns
 */

import { describe, it, expect } from 'vitest'
import { comfortModule } from '../comfortModule.js'
import { validateInsight } from '@/utils/insightValidator.js'
import { URGENCY } from '@/utils/urgencyEngine.js'

// ---------------------------------------------------------------------------
// Mock builders
// ---------------------------------------------------------------------------

function makeWeatherData({
    condition = 'Clouds',
    feelsLike = 18,
    temp = 18,
    humidity = 55,
    windSpeed = 10,
    uvIndex = 2,
    precipProb = 0.1
} = {}) {
    return {
        current: { temp, feelsLike, humidity, windSpeed, gustSpeed: windSpeed, uvIndex, condition, visibility: 10, precipProb },
        hourly: [],
        daily: [],
        fetchedAt: Date.now(),
        location: { lat: 51.5, lon: -0.1 }
    }
}

function makeContext(overrides = {}) {
    return {
        location: { primary: null, saved: [], current: null },
        routines: { weekday: { departureTime: null, returnTime: null, outdoorWindows: [] }, weekend: { outdoorWindows: [] }, confidence: 'declared' },
        activities: { declared: [] },
        schedule: { manualEvents: [], calendarConnected: false },
        preferences: {
            temperatureUnit: 'C', theme: 'dark', verbosity: 'concise',
            notifications: { enabled: false, commute: false, morningBriefing: false, activityAlerts: false, riskAlerts: false, preDeparture: false, ambient: false },
            intelligenceAreas: { dailyPlanning: true, activityRecommend: false, commuteIntelligence: false, routineAdaptation: true, environmentalAware: false }
        },
        sensitivities: { heat: false, cold: false, pollen: false, uv: false, airQuality: false, precipitation: false },
        meta: { schemaVersion: '1.0.0', createdAt: 0, lastModifiedAt: 0, completeness: { hasLocation: false, hasRoutine: false, hasActivities: false, hasSensitivities: false, hasPreferences: true }, contextQuality: 'none' },
        ...overrides
    }
}

const baseContext = makeContext()

// ---------------------------------------------------------------------------
// Contract compliance
// ---------------------------------------------------------------------------

describe('comfortModule — contract compliance', () => {
    it('has exactly 2 parameters', () => {
        expect(comfortModule.length).toBe(2)
    })

    it('returns null or a valid Insight — never throws', () => {
        const result = comfortModule(makeWeatherData(), baseContext)
        if (result !== null) {
            expect(validateInsight(result).valid).toBe(true)
        }
    })

    it('returns null when weatherData is null', () => {
        expect(comfortModule(null, baseContext)).toBeNull()
    })

    it('returns null when weatherData.current is missing', () => {
        expect(comfortModule({ hourly: [], daily: [] }, baseContext)).toBeNull()
    })

    it('every non-null result has type "comfort"', () => {
        const scenarios = [
            makeWeatherData({ feelsLike: 38, temp: 34, humidity: 82 }),
            makeWeatherData({ feelsLike: 42, temp: 38, humidity: 30 }),
            makeWeatherData({ uvIndex: 9 }),
            makeWeatherData({ feelsLike: 3, temp: 5, windSpeed: 40 }),
            makeWeatherData({ temp: 22, feelsLike: 22, humidity: 82 }),
            makeWeatherData({ temp: 20, feelsLike: 20, humidity: 22 })
        ]
        for (const wd of scenarios) {
            const result = comfortModule(wd, baseContext)
            if (result !== null) {
                expect(result.type).toBe('comfort')
            }
        }
    })

    it('every non-null result has a non-empty actionPath', () => {
        const scenarios = [
            makeWeatherData({ feelsLike: 38, temp: 34, humidity: 82 }),
            makeWeatherData({ uvIndex: 9 }),
            makeWeatherData({ feelsLike: 3, windSpeed: 40, temp: 5 }),
        ]
        for (const wd of scenarios) {
            const result = comfortModule(wd, baseContext)
            if (result !== null) {
                expect(result.actionPath.trim().length).toBeGreaterThan(10)
            }
        }
    })
})

// ---------------------------------------------------------------------------
// Heat + humidity compound scenarios
// ---------------------------------------------------------------------------

describe('comfortModule — heat + humidity', () => {
    it('returns alert for extreme heat-humidity combination (temp 34, humidity 87)', () => {
        const result = comfortModule(
            makeWeatherData({ feelsLike: 42, temp: 34, humidity: 87 }),
            baseContext
        )
        expect(result).not.toBeNull()
        expect(result.urgency).toBe(URGENCY.ALERT)
        expect(result.type).toBe('comfort')
    })

    it('returns heads-up for oppressive heat-humidity (feelsLike 36, humidity 81)', () => {
        const result = comfortModule(
            makeWeatherData({ feelsLike: 36, temp: 30, humidity: 81 }),
            baseContext
        )
        expect(result).not.toBeNull()
        expect(result.urgency).toBe(URGENCY.HEADS_UP)
    })

    it('heads-up actionPath mentions breathable clothing and hydration', () => {
        const result = comfortModule(
            makeWeatherData({ feelsLike: 36, temp: 30, humidity: 81 }),
            baseContext
        )
        expect(result.actionPath).toMatch(/breathable|light|hydrat|water/i)
    })

    it('returns useful for warm + muggy (feelsLike 31, humidity 72)', () => {
        const result = comfortModule(
            makeWeatherData({ feelsLike: 31, temp: 27, humidity: 72 }),
            baseContext
        )
        expect(result).not.toBeNull()
        expect(result.urgency).toBe(URGENCY.USEFUL)
    })

    it('heat-sensitive user gets alert at lower thresholds with high humidity', () => {
        const heatCtx = makeContext({ sensitivities: { heat: true } })
        // feelsLike 34 normally → useful; with heat sensitivity → heads-up or alert
        const result = comfortModule(
            makeWeatherData({ feelsLike: 34, temp: 30, humidity: 75 }),
            heatCtx
        )
        expect(result).not.toBeNull()
        // Should be at least heads-up for heat-sensitive user
        const urgencyRank = { ambient: 0, useful: 1, 'heads-up': 2, alert: 3 }
        expect(urgencyRank[result.urgency]).toBeGreaterThanOrEqual(urgencyRank['heads-up'])
    })

    it('heat-sensitive insight marks usedSensitivity: true', () => {
        const heatCtx = makeContext({ sensitivities: { heat: true } })
        const result = comfortModule(
            makeWeatherData({ feelsLike: 34, temp: 30, humidity: 75 }),
            heatCtx
        )
        if (result) {
            expect(result.sourceContext.usedSensitivity).toBe(true)
        }
    })

    it('humid heat content references the heat-index effect (feels hotter)', () => {
        const result = comfortModule(
            makeWeatherData({ feelsLike: 36, temp: 30, humidity: 81 }),
            baseContext
        )
        // Content should mention humidity or how it feels worse
        expect(result.content).toMatch(/humid|heat|feel|oppress/i)
    })
})

// ---------------------------------------------------------------------------
// Dry heat (no humidity)
// ---------------------------------------------------------------------------

describe('comfortModule — dry heat', () => {
    it('returns alert for dangerous dry heat (feelsLike 42, humidity 28)', () => {
        const result = comfortModule(
            makeWeatherData({ feelsLike: 42, temp: 40, humidity: 28 }),
            baseContext
        )
        expect(result).not.toBeNull()
        expect(result.urgency).toBe(URGENCY.ALERT)
    })

    it('dry heat alert actionPath mentions shade or limiting sun exposure', () => {
        const result = comfortModule(
            makeWeatherData({ feelsLike: 42, temp: 40, humidity: 28 }),
            baseContext
        )
        expect(result.actionPath).toMatch(/shade|sun|limit|air/i)
    })
})

// ---------------------------------------------------------------------------
// UV scenarios
// ---------------------------------------------------------------------------

describe('comfortModule — UV exposure', () => {
    it('returns heads-up for UV index 7 (default threshold)', () => {
        const result = comfortModule(
            makeWeatherData({ uvIndex: 7, feelsLike: 20, temp: 20 }),
            baseContext
        )
        expect(result).not.toBeNull()
        expect(result.urgency).toBe(URGENCY.HEADS_UP)
        expect(result.type).toBe('comfort')
    })

    it('returns alert for UV index 9', () => {
        const result = comfortModule(
            makeWeatherData({ uvIndex: 9, feelsLike: 22, temp: 22 }),
            baseContext
        )
        expect(result).not.toBeNull()
        expect(result.urgency).toBe(URGENCY.ALERT)
    })

    it('UV alert actionPath mentions sunscreen or SPF', () => {
        const result = comfortModule(
            makeWeatherData({ uvIndex: 9, feelsLike: 22, temp: 22 }),
            baseContext
        )
        expect(result.actionPath).toMatch(/sunscreen|SPF|sun|hat/i)
    })

    it('UV-sensitive user gets alert at UV index 6 (default would be heads-up)', () => {
        const uvCtx = makeContext({ sensitivities: { uv: true } })
        // Default: UV 6 → heads-up; UV-sensitive: UV 6 → alert
        const defaultResult = comfortModule(makeWeatherData({ uvIndex: 6, feelsLike: 22, temp: 22 }), baseContext)
        const sensitiveResult = comfortModule(makeWeatherData({ uvIndex: 6, feelsLike: 22, temp: 22 }), uvCtx)

        expect(defaultResult?.urgency).toBe(URGENCY.HEADS_UP)
        expect(sensitiveResult?.urgency).toBe(URGENCY.ALERT)
    })

    it('UV-sensitive user actionPath has stronger language than standard user', () => {
        const uvCtx = makeContext({ sensitivities: { uv: true } })
        const result = comfortModule(
            makeWeatherData({ uvIndex: 9, feelsLike: 22, temp: 22 }),
            uvCtx
        )
        // UV-sensitive path should mention SPF 50+
        expect(result.actionPath).toMatch(/50|sensitive|limit/i)
    })

    it('UV-sensitive result marks usedSensitivity: true', () => {
        const uvCtx = makeContext({ sensitivities: { uv: true } })
        const result = comfortModule(
            makeWeatherData({ uvIndex: 9, feelsLike: 22, temp: 22 }),
            uvCtx
        )
        expect(result?.sourceContext.usedSensitivity).toBe(true)
    })

    it('low UV (index 2) does not produce a UV insight', () => {
        const result = comfortModule(
            makeWeatherData({ uvIndex: 2, feelsLike: 20, temp: 20 }),
            baseContext
        )
        // Should be null or a different type — not UV
        if (result !== null) {
            // If a result exists, it shouldn't be triggered by UV
            expect(result.content).not.toMatch(/UV|sun.*burn/i)
        }
    })
})

// ---------------------------------------------------------------------------
// Wind chill scenarios
// ---------------------------------------------------------------------------

describe('comfortModule — wind chill', () => {
    it('returns an insight when cold + strong wind makes it feel much colder', () => {
        // temp 5°C, windSpeed 45 km/h → wind chill ~-2°C (delta ≥ 4)
        const result = comfortModule(
            makeWeatherData({ feelsLike: 2, temp: 5, windSpeed: 45 }),
            baseContext
        )
        expect(result).not.toBeNull()
        expect(result.type).toBe('comfort')
    })

    it('wind chill actionPath mentions wind-resistant layer or covering skin', () => {
        const result = comfortModule(
            makeWeatherData({ feelsLike: 2, temp: 5, windSpeed: 45 }),
            baseContext
        )
        if (result) {
            expect(result.actionPath).toMatch(/layer|wind|skin|cover|ear|hand/i)
        }
    })

    it('cold-sensitive user gets higher urgency for wind chill', () => {
        const coldCtx = makeContext({ sensitivities: { cold: true } })
        const defaultResult = comfortModule(
            makeWeatherData({ feelsLike: 3, temp: 5, windSpeed: 45 }),
            baseContext
        )
        const sensitiveResult = comfortModule(
            makeWeatherData({ feelsLike: 3, temp: 5, windSpeed: 45 }),
            coldCtx
        )
        // Both should produce results; sensitive should be ≥ urgency of default
        const rank = { ambient: 0, useful: 1, 'heads-up': 2, alert: 3 }
        if (defaultResult && sensitiveResult) {
            expect(rank[sensitiveResult.urgency]).toBeGreaterThanOrEqual(rank[defaultResult.urgency])
        }
    })

    it('warm temperature with wind does not trigger wind chill', () => {
        // Wind chill formula only applies for temps ≤ 10°C
        const result = comfortModule(
            makeWeatherData({ feelsLike: 20, temp: 22, windSpeed: 50 }),
            baseContext
        )
        // Could produce a wind insight from dailyPlanning overlap, but NOT a wind-chill comfort note
        if (result) {
            expect(result.content).not.toMatch(/wind chill|feels.*colder/i)
        }
    })
})

// ---------------------------------------------------------------------------
// High humidity without extreme heat
// ---------------------------------------------------------------------------

describe('comfortModule — muggy conditions (no extreme heat)', () => {
    it('returns useful insight for high humidity at moderate temperature', () => {
        // temp 22, humidity 82 — muggy but not hot
        const result = comfortModule(
            makeWeatherData({ feelsLike: 22, temp: 22, humidity: 82 }),
            baseContext
        )
        expect(result).not.toBeNull()
        expect(result.urgency).toBe(URGENCY.USEFUL)
        expect(result.content).toMatch(/humid|muggy|sticky/i)
    })

    it('muggy actionPath suggests moisture-wicking clothing', () => {
        const result = comfortModule(
            makeWeatherData({ feelsLike: 22, temp: 22, humidity: 82 }),
            baseContext
        )
        expect(result?.actionPath).toMatch(/moisture|breathable|wicking|break/i)
    })

    it('low humidity at same temperature does not produce a muggy insight', () => {
        const result = comfortModule(
            makeWeatherData({ feelsLike: 22, temp: 22, humidity: 50 }),
            baseContext
        )
        // Should be null — no comfort concern at moderate temp + normal humidity
        expect(result).toBeNull()
    })
})

// ---------------------------------------------------------------------------
// Dry air scenario
// ---------------------------------------------------------------------------

describe('comfortModule — dry air', () => {
    it('returns useful insight for very dry air at warm temperature', () => {
        // humidity 25, temp 22 — dry enough to matter
        const result = comfortModule(
            makeWeatherData({ feelsLike: 22, temp: 22, humidity: 25 }),
            baseContext
        )
        expect(result).not.toBeNull()
        expect(result.urgency).toBe(URGENCY.USEFUL)
        expect(result.content).toMatch(/dry/i)
    })

    it('dry air actionPath mentions hydration', () => {
        const result = comfortModule(
            makeWeatherData({ feelsLike: 22, temp: 22, humidity: 25 }),
            baseContext
        )
        expect(result?.actionPath).toMatch(/water|drink|hydrat/i)
    })

    it('dry air at cold temperature does not produce a dry air insight', () => {
        // Cold + dry doesn't trigger the dehydration concern
        const result = comfortModule(
            makeWeatherData({ feelsLike: 5, temp: 8, humidity: 25 }),
            baseContext
        )
        // Should be null or cold-related, not dry air
        if (result !== null) {
            expect(result.content).not.toMatch(/dry air|dehydrat/i)
        }
    })
})

// ---------------------------------------------------------------------------
// Benign conditions → null
// ---------------------------------------------------------------------------

describe('comfortModule — benign conditions', () => {
    it('returns null for comfortable temperature, normal humidity, low UV, calm wind', () => {
        const result = comfortModule(
            makeWeatherData({ feelsLike: 20, temp: 20, humidity: 55, windSpeed: 12, uvIndex: 3 }),
            baseContext
        )
        expect(result).toBeNull()
    })

    it('returns null for cool, low-humidity, overcast day', () => {
        const result = comfortModule(
            makeWeatherData({ feelsLike: 15, temp: 16, humidity: 60, windSpeed: 10, uvIndex: 1 }),
            baseContext
        )
        expect(result).toBeNull()
    })

    it('returns null for mild spring conditions', () => {
        const result = comfortModule(
            makeWeatherData({ feelsLike: 18, temp: 18, humidity: 58, windSpeed: 8, uvIndex: 4 }),
            baseContext
        )
        // UV 4 is below heads-up threshold (6), so no UV insight
        // All other conditions are benign
        expect(result).toBeNull()
    })
})

// ---------------------------------------------------------------------------
// sourceContext flags
// ---------------------------------------------------------------------------

describe('comfortModule — sourceContext flags', () => {
    it('usedLocation is true when primary location is set', () => {
        const ctxWithLoc = makeContext({
            location: { primary: { name: 'London', lat: 51.5, lon: -0.1, timezone: 'Europe/London', locationType: 'urban', confidence: 'declared' }, saved: [], current: null },
            meta: { schemaVersion: '1.0.0', createdAt: 0, lastModifiedAt: 0, completeness: { hasLocation: true, hasRoutine: false, hasActivities: false, hasSensitivities: false, hasPreferences: true }, contextQuality: 'minimal' }
        })
        const result = comfortModule(
            makeWeatherData({ uvIndex: 9, feelsLike: 22, temp: 22 }),
            ctxWithLoc
        )
        expect(result?.sourceContext.usedLocation).toBe(true)
    })

    it('usedLocation is false when no primary location', () => {
        const result = comfortModule(
            makeWeatherData({ uvIndex: 9, feelsLike: 22, temp: 22 }),
            baseContext
        )
        expect(result?.sourceContext.usedLocation).toBe(false)
    })

    it('usedSensitivity is false for standard user (no sensitivities)', () => {
        const result = comfortModule(
            makeWeatherData({ uvIndex: 9, feelsLike: 22, temp: 22 }),
            baseContext
        )
        expect(result?.sourceContext.usedSensitivity).toBe(false)
    })
})

// ---------------------------------------------------------------------------
// Priority ordering — heat+humidity takes priority over UV
// ---------------------------------------------------------------------------

describe('comfortModule — priority ordering', () => {
    it('heat+humidity takes priority over UV when both are present', () => {
        // Both extreme heat+humidity AND high UV — should surface heat+humidity
        const result = comfortModule(
            makeWeatherData({ feelsLike: 42, temp: 38, humidity: 87, uvIndex: 9 }),
            baseContext
        )
        expect(result).not.toBeNull()
        // The content should be about heat/humidity, not UV
        expect(result.content).toMatch(/heat|humid|oppress/i)
    })
})
