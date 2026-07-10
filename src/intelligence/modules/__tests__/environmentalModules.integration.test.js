/**
 * environmentalModules.integration.test.js
 * Integration tests for Phase 3.5 environmental modules.
 *
 * Tests module interactions within the pipeline:
 *   - Multiple environmental insights coexist via subtype-aware deduplication
 *   - UV module and comfortModule UV coexist (different types)
 *   - Sorting produces correct urgency order
 *   - Missing data produces no crashes and no invalid insights
 *
 * All inputs are plain mock objects — no stores, no Vue, no Pinia.
 */

import { describe, it, expect } from 'vitest'
import { uvModule } from '../uvModule.js'
import { airQualityModule } from '../airQualityModule.js'
import { pollenModule } from '../pollenModule.js'
import { comfortModule } from '../comfortModule.js'
import { validateInsight, filterValidInsights } from '@/utils/insightValidator.js'
import { sortByUrgency, URGENCY_RANK, URGENCY } from '@/utils/urgencyEngine.js'

// ---------------------------------------------------------------------------
// Mock builders
// ---------------------------------------------------------------------------

function makeWeatherData({
    uvIndex = 0,
    airQuality = null,
    pollenLevel = null,
    feelsLike = 20,
    temp = 20,
    humidity = 55,
    windSpeed = 10,
    condition = 'Clear',
    hourly = []
} = {}) {
    return {
        current: {
            temp, feelsLike, humidity, windSpeed, gustSpeed: windSpeed * 1.3,
            uvIndex, condition, visibility: 10, precipProb: 0.05,
            airQuality, pollenLevel
        },
        hourly,
        daily: [],
        fetchedAt: Date.now(),
        location: { lat: 51.5, lon: -0.1 }
    }
}

function makeContext({ sensitivities = {} } = {}) {
    return {
        location: { primary: null, saved: [], current: null },
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
            completeness: { hasLocation: false, hasRoutine: false, hasActivities: false, hasSensitivities: false, hasPreferences: true },
            contextQuality: 'none'
        }
    }
}

const baseCtx = makeContext()

// ---------------------------------------------------------------------------
// Case 1: High UV + poor AQI → multiple environmental insights coexist
// ---------------------------------------------------------------------------

describe('Integration: high UV + poor AQI', () => {
    it('both modules return non-null insights when conditions warrant', () => {
        const wd = makeWeatherData({ uvIndex: 9, airQuality: 160 })
        const uvResult = uvModule(wd, baseCtx)
        const aqiResult = airQualityModule(wd, baseCtx)
        expect(uvResult).not.toBeNull()
        expect(aqiResult).not.toBeNull()
    })

    it('both insights have type "environmental"', () => {
        const wd = makeWeatherData({ uvIndex: 9, airQuality: 160 })
        expect(uvModule(wd, baseCtx)?.type).toBe('environmental')
        expect(airQualityModule(wd, baseCtx)?.type).toBe('environmental')
    })

    it('insights have different subtypes and can coexist', () => {
        const wd = makeWeatherData({ uvIndex: 9, airQuality: 160 })
        const uvResult = uvModule(wd, baseCtx)
        const aqiResult = airQualityModule(wd, baseCtx)
        expect(uvResult?.subtype).toBe('uv')
        expect(aqiResult?.subtype).toBe('air-quality')
        expect(uvResult?.subtype).not.toBe(aqiResult?.subtype)
    })

    it('deduplication by type+subtype keeps both insights', () => {
        const wd = makeWeatherData({ uvIndex: 9, airQuality: 160 })
        const uvResult = uvModule(wd, baseCtx)
        const aqiResult = airQualityModule(wd, baseCtx)
        const allInsights = [uvResult, aqiResult].filter(Boolean)

        // Simulate coordinator deduplication by type:subtype composite key
        const byKey = new Map()
        for (const insight of allInsights) {
            const key = insight.subtype ? `${insight.type}:${insight.subtype}` : insight.type
            const existing = byKey.get(key)
            if (!existing || URGENCY_RANK[insight.urgency] > URGENCY_RANK[existing.urgency]) {
                byKey.set(key, insight)
            }
        }
        const deduped = Array.from(byKey.values())
        // Both should survive — they have different keys
        expect(deduped).toHaveLength(2)
    })

    it('all three environmental modules can coexist simultaneously', () => {
        const wd = makeWeatherData({ uvIndex: 9, airQuality: 160, pollenLevel: 'high' })
        const results = [
            uvModule(wd, baseCtx),
            airQualityModule(wd, baseCtx),
            pollenModule(wd, baseCtx)
        ].filter(Boolean)
        expect(results).toHaveLength(3)
        const subtypes = results.map(r => r.subtype)
        expect(new Set(subtypes).size).toBe(3) // all different
    })
})

// ---------------------------------------------------------------------------
// Case 2: uvModule and comfortModule UV coexistence
// ---------------------------------------------------------------------------

describe('Integration: uvModule and comfortModule UV coexistence', () => {
    it('both fire for high UV conditions', () => {
        const wd = makeWeatherData({ uvIndex: 9, feelsLike: 22, temp: 22 })
        const uvResult = uvModule(wd, baseCtx)
        const comfortResult = comfortModule(wd, baseCtx)
        expect(uvResult).not.toBeNull()
        expect(comfortResult).not.toBeNull()
    })

    it('they have different types — no deduplication conflict', () => {
        const wd = makeWeatherData({ uvIndex: 9, feelsLike: 22, temp: 22 })
        const uvResult = uvModule(wd, baseCtx)
        const comfortResult = comfortModule(wd, baseCtx)
        expect(uvResult?.type).toBe('environmental')
        expect(comfortResult?.type).toBe('comfort')
        expect(uvResult?.type).not.toBe(comfortResult?.type)
    })

    it('deduplication by type+subtype keeps both', () => {
        const wd = makeWeatherData({ uvIndex: 9, feelsLike: 22, temp: 22 })
        const uvResult = uvModule(wd, baseCtx)
        const comfortResult = comfortModule(wd, baseCtx)
        const combined = [uvResult, comfortResult].filter(Boolean)

        const byKey = new Map()
        for (const insight of combined) {
            const key = insight.subtype ? `${insight.type}:${insight.subtype}` : insight.type
            byKey.set(key, insight)
        }
        expect(byKey.size).toBe(2) // environmental:uv and comfort both survive
    })

    it('uvModule focuses on timing; comfortModule focuses on preparation', () => {
        const wd = makeWeatherData({ uvIndex: 9, feelsLike: 22, temp: 22 })
        const uvResult = uvModule(wd, baseCtx)
        const comfortResult = comfortModule(wd, baseCtx)
        // UV module: timing/duration guidance
        expect(uvResult?.actionPath).toMatch(/minut|avoid|limit|sun.*AM|3.*PM/i)
        // Comfort module: skin preparation (sunscreen/SPF)
        expect(comfortResult?.actionPath).toMatch(/sunscreen|SPF/i)
    })
})

// ---------------------------------------------------------------------------
// Case 3: Multiple environmental insights sort by urgency
// ---------------------------------------------------------------------------

describe('Integration: urgency sorting', () => {
    it('alert sorts before heads-up sorts before useful', () => {
        // AQI 200 → alert; pollen high → heads-up; UV 4 → useful
        const wd = makeWeatherData({ uvIndex: 4, airQuality: 200, pollenLevel: 'high' })
        const results = [
            uvModule(wd, baseCtx),
            airQualityModule(wd, baseCtx),
            pollenModule(wd, baseCtx)
        ].filter(Boolean)

        expect(results).toHaveLength(3)
        const sorted = sortByUrgency(results)
        expect(sorted[0].urgency).toBe('alert')
        expect(sorted[1].urgency).toBe('heads-up')
        expect(sorted[2].urgency).toBe('useful')
    })

    it('sortByUrgency does not mutate the input array', () => {
        const wd = makeWeatherData({ uvIndex: 9, airQuality: 160 })
        const results = [uvModule(wd, baseCtx), airQualityModule(wd, baseCtx)].filter(Boolean)
        const original = [...results]
        sortByUrgency(results)
        expect(results[0]).toBe(original[0]) // not mutated
    })

    it('all sorted insights pass validateInsight', () => {
        const wd = makeWeatherData({ uvIndex: 9, airQuality: 160, pollenLevel: 'very-high' })
        const results = [
            uvModule(wd, baseCtx),
            airQualityModule(wd, baseCtx),
            pollenModule(wd, baseCtx)
        ]
        const valid = filterValidInsights(results)
        for (const insight of valid) {
            expect(validateInsight(insight).valid).toBe(true)
        }
    })
})

// ---------------------------------------------------------------------------
// Case 4: Missing environmental data — graceful degradation
// ---------------------------------------------------------------------------

describe('Integration: missing environmental data', () => {
    it('all environmental modules return null when data fields are null', () => {
        const wd = makeWeatherData({ uvIndex: 0, airQuality: null, pollenLevel: null })
        expect(uvModule(wd, baseCtx)).toBeNull()
        expect(airQualityModule(wd, baseCtx)).toBeNull()
        expect(pollenModule(wd, baseCtx)).toBeNull()
    })

    it('all environmental modules return null when weatherData is null', () => {
        expect(uvModule(null, baseCtx)).toBeNull()
        expect(airQualityModule(null, baseCtx)).toBeNull()
        expect(pollenModule(null, baseCtx)).toBeNull()
    })

    it('does not crash when weatherData.current fields are all undefined', () => {
        const partialWd = {
            current: { condition: 'Clear' }, // all numeric fields absent
            hourly: [], daily: [],
            fetchedAt: Date.now(),
            location: { lat: 0, lon: 0 }
        }
        expect(() => uvModule(partialWd, baseCtx)).not.toThrow()
        expect(() => airQualityModule(partialWd, baseCtx)).not.toThrow()
        expect(() => pollenModule(partialWd, baseCtx)).not.toThrow()
    })

    it('filterValidInsights produces no output when all modules return null', () => {
        const wd = makeWeatherData({ uvIndex: 0, airQuality: null, pollenLevel: null })
        const rawResults = [
            uvModule(wd, baseCtx),
            airQualityModule(wd, baseCtx),
            pollenModule(wd, baseCtx)
        ]
        const valid = filterValidInsights(rawResults)
        expect(valid).toHaveLength(0)
    })

    it('filterValidInsights rejects insight with empty actionPath', () => {
        const badInsight = {
            type: 'environmental', subtype: 'uv', urgency: 'alert',
            content: 'UV is high.', actionPath: '',
            confidence: 'high',
            timing: { windowStart: null, windowEnd: null, notify: false, notifyAt: null },
            sourceContext: { usedLocation: false, usedRoutine: false, usedActivity: false, usedSensitivity: false }
        }
        const { valid } = validateInsight(badInsight)
        expect(valid).toBe(false)
    })
})

// ---------------------------------------------------------------------------
// Subtype isolation — no environmental subtype collision
// ---------------------------------------------------------------------------

describe('Integration: subtype isolation', () => {
    it('two insights with same type but different subtypes are treated as distinct', () => {
        const uvInsight = uvModule(makeWeatherData({ uvIndex: 9 }), baseCtx)
        const aqiInsight = airQualityModule(makeWeatherData({ airQuality: 160 }), baseCtx)
        expect(uvInsight?.subtype).toBe('uv')
        expect(aqiInsight?.subtype).toBe('air-quality')

        // They must not overwrite each other in a type-only map
        const typeOnlyMap = new Map()
        typeOnlyMap.set(uvInsight.type, uvInsight)
        typeOnlyMap.set(aqiInsight.type, aqiInsight) // would overwrite if type-only
        expect(typeOnlyMap.size).toBe(1) // confirms the OLD behaviour was lossy

        // New subtype-aware deduplication preserves both
        const subtypeMap = new Map()
        for (const insight of [uvInsight, aqiInsight]) {
            const key = insight.subtype ? `${insight.type}:${insight.subtype}` : insight.type
            subtypeMap.set(key, insight)
        }
        expect(subtypeMap.size).toBe(2) // both survive
    })

    it('same module called twice keeps only highest urgency for that subtype', () => {
        // Two 'environmental:uv' insights — deduplication keeps alert over useful
        const usefulUV = uvModule(makeWeatherData({ uvIndex: 4 }), baseCtx)
        const alertUV = uvModule(makeWeatherData({ uvIndex: 10 }), baseCtx)
        expect(usefulUV?.urgency).toBe(URGENCY.USEFUL)
        expect(alertUV?.urgency).toBe(URGENCY.ALERT)

        const byKey = new Map()
        for (const insight of [usefulUV, alertUV]) {
            if (!insight) continue
            const key = insight.subtype ? `${insight.type}:${insight.subtype}` : insight.type
            const existing = byKey.get(key)
            if (!existing || URGENCY_RANK[insight.urgency] > URGENCY_RANK[existing.urgency]) {
                byKey.set(key, insight)
            }
        }
        expect(byKey.size).toBe(1)
        expect(byKey.get('environmental:uv')?.urgency).toBe(URGENCY.ALERT)
    })
})
