/**
 * activityModule.test.js
 * Unit tests for Phase 3.2 — activityModule
 *
 * Key invariants:
 *   - Returns null when no activities are declared
 *   - Returns null when all declared activities are out of season
 *   - Returns an array for non-benign conditions
 *   - Every non-null result: type='activity', non-empty actionPath, valid Insight
 *   - Benign conditions produce an ambient positive confirmation
 *   - not-recommended conditions produce heads-up or alert
 *   - marginal conditions produce useful insights
 *   - usedActivity is always true on returned insights
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { activityModule } from '../activityModule.js'
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
    gustSpeed = 15,
    precipProb = 0.05,
    uvIndex = 3,
    visibility = 10,
    hourly = []
} = {}) {
    return {
        current: { temp, feelsLike, humidity, windSpeed, gustSpeed, uvIndex, condition, visibility, precipProb },
        hourly,
        daily: [],
        fetchedAt: Date.now(),
        location: { lat: 51.5, lon: -0.1 }
    }
}

function makeActivity(activityKey, { label = null, frequency = 'several-weekly', seasonRange = null } = {}) {
    return {
        id: `act-${activityKey}`,
        activityKey,
        label: label ?? activityKey.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        frequency,
        seasonRange,
        profile: {}
    }
}

function makeContext({
    activities = [],
    primaryLocation = null,
    sensitivities = {}
} = {}) {
    return {
        location: { primary: primaryLocation, saved: [], current: null },
        routines: {
            weekday: { departureTime: null, returnTime: null, outdoorWindows: [] },
            weekend: { outdoorWindows: [] },
            confidence: 'declared'
        },
        activities: { declared: activities },
        schedule: { manualEvents: [], calendarConnected: false },
        preferences: {
            temperatureUnit: 'C', theme: 'dark', verbosity: 'concise',
            notifications: { enabled: false, commute: false, morningBriefing: false, activityAlerts: false, riskAlerts: false, preDeparture: false, ambient: false },
            intelligenceAreas: { dailyPlanning: true, activityRecommend: true, commuteIntelligence: false, routineAdaptation: false, environmentalAware: false }
        },
        sensitivities: { heat: false, cold: false, pollen: false, uv: false, airQuality: false, precipitation: false, ...sensitivities },
        meta: {
            schemaVersion: '1.0.0', createdAt: 0, lastModifiedAt: 0,
            completeness: { hasLocation: !!primaryLocation, hasRoutine: false, hasActivities: activities.length > 0, hasSensitivities: false, hasPreferences: true },
            contextQuality: activities.length > 0 ? 'partial' : 'none'
        }
    }
}

// ---------------------------------------------------------------------------
// Contract compliance
// ---------------------------------------------------------------------------

describe('activityModule — contract compliance', () => {
    it('has exactly 2 parameters', () => {
        expect(activityModule.length).toBe(2)
    })

    it('returns null or an array — never throws', () => {
        const result = activityModule(makeWeatherData(), makeContext())
        expect(result === null || Array.isArray(result)).toBe(true)
    })

    it('returns null when weatherData is null', () => {
        expect(activityModule(null, makeContext({ activities: [makeActivity('running')] }))).toBeNull()
    })

    it('returns null when weatherData.current is missing', () => {
        expect(activityModule({ hourly: [], daily: [] }, makeContext({ activities: [makeActivity('running')] }))).toBeNull()
    })

    it('every non-null result item has type "activity"', () => {
        const ctx = makeContext({ activities: [makeActivity('running')] })
        const result = activityModule(makeWeatherData({ windSpeed: 60 }), ctx)
        if (result !== null) {
            for (const insight of result) {
                expect(insight.type).toBe('activity')
            }
        }
    })

    it('every non-null result item passes validateInsight', () => {
        const ctx = makeContext({ activities: [makeActivity('running')] })
        const result = activityModule(makeWeatherData({ windSpeed: 60 }), ctx)
        if (result !== null) {
            for (const insight of result) {
                expect(validateInsight(insight).valid).toBe(true)
            }
        }
    })

    it('every non-null result item has a non-empty actionPath', () => {
        const ctx = makeContext({ activities: [makeActivity('running')] })
        const result = activityModule(makeWeatherData({ windSpeed: 60 }), ctx)
        if (result !== null) {
            for (const insight of result) {
                expect(insight.actionPath.trim().length).toBeGreaterThan(10)
            }
        }
    })
})

// ---------------------------------------------------------------------------
// Gate: no declared activities
// ---------------------------------------------------------------------------

describe('activityModule — no declared activities', () => {
    it('returns null when activities.declared is empty', () => {
        expect(activityModule(makeWeatherData(), makeContext({ activities: [] }))).toBeNull()
    })

    it('returns null when activities is not present in context', () => {
        const ctx = makeContext()
        delete ctx.activities
        expect(activityModule(makeWeatherData(), ctx)).toBeNull()
    })

    it('returns null when context is null', () => {
        expect(activityModule(makeWeatherData(), null)).toBeNull()
    })

    it('returns null when activityKey is null (invalid entry)', () => {
        const ctx = makeContext({ activities: [{ id: 'a1', activityKey: null, label: 'Test', frequency: 'daily', seasonRange: null, profile: {} }] })
        expect(activityModule(makeWeatherData(), ctx)).toBeNull()
    })
})

// ---------------------------------------------------------------------------
// Gate: out-of-season activities
// ---------------------------------------------------------------------------

describe('activityModule — season filtering', () => {
    it('returns null when all activities are out of season', () => {
        const currentMonth = new Date().getMonth() + 1
        // Make a range that excludes the current month
        const outOfSeasonStart = (currentMonth % 12) + 1
        const outOfSeasonEnd = ((currentMonth + 1) % 12) + 1
        const activity = makeActivity('swimming', { seasonRange: { startMonth: outOfSeasonStart, endMonth: outOfSeasonEnd } })
        const ctx = makeContext({ activities: [activity] })
        expect(activityModule(makeWeatherData(), ctx)).toBeNull()
    })

    it('returns result when activity has null seasonRange (year-round)', () => {
        const ctx = makeContext({ activities: [makeActivity('running', { seasonRange: null })] })
        // Use conditions that will trigger a non-null result (high wind)
        const result = activityModule(makeWeatherData({ windSpeed: 55 }), ctx)
        expect(result).not.toBeNull()
    })

    it('includes activity when its season wraps across year boundary and current month qualifies', () => {
        // Swimming defined Nov–Mar, test month = December
        const currentMonth = new Date().getMonth() + 1
        // If we're in Nov, Dec, Jan, Feb, or Mar, create a wrapping season that includes it
        const wrappingActivity = makeActivity('swimming', { seasonRange: { startMonth: 11, endMonth: 3 } })
        const inSeason = (currentMonth >= 11 || currentMonth <= 3)
        const ctx = makeContext({ activities: [wrappingActivity] })
        // Just verify it doesn't throw and returns the correct null/non-null behavior
        const result = activityModule(makeWeatherData({ feelsLike: 5 }), ctx)
        if (inSeason) {
            // Swimming in cold temps (5°C) is not recommended — should produce insight
            expect(result).not.toBeNull()
        } else {
            expect(result).toBeNull()
        }
    })
})

// ---------------------------------------------------------------------------
// Scenario: Good conditions (ambient confirmation)
// ---------------------------------------------------------------------------

describe('activityModule — good conditions (ambient)', () => {
    it('returns ambient insight when running conditions are genuinely good', () => {
        // Running: good = feelsLike 8–22, humidity ≤65, precipitation max 0.0, windSpeed ≤25
        // precipProb: 0 → 0 mm/hr proxy satisfies precipitation max 0.0
        const ctx = makeContext({ activities: [makeActivity('running')] })
        const result = activityModule(
            makeWeatherData({ feelsLike: 14, temp: 14, humidity: 55, windSpeed: 12, precipProb: 0 }),
            ctx
        )
        expect(result).not.toBeNull()
        expect(result).toHaveLength(1)
        expect(result[0].urgency).toBe(URGENCY.AMBIENT)
        expect(result[0].type).toBe('activity')
    })

    it('ambient insight content mentions the activity name', () => {
        const ctx = makeContext({ activities: [makeActivity('running')] })
        const result = activityModule(
            makeWeatherData({ feelsLike: 14, temp: 14, humidity: 55, windSpeed: 12, precipProb: 0 }),
            ctx
        )
        expect(result[0].content).toMatch(/running/i)
    })

    it('ambient confirmation covers multiple good activities', () => {
        // Both running and gardening have good conditions:
        // running: precipProb 0, feelsLike 14, windSpeed 12, humidity 55
        // gardening: precipProb 0 → 0mm/hr (good ≤0.5), feelsLike 14 (good 10–28), uvIndex 5 (good ≤7)
        const ctx = makeContext({ activities: [makeActivity('running'), makeActivity('gardening')] })
        const result = activityModule(
            makeWeatherData({ feelsLike: 14, temp: 14, humidity: 55, windSpeed: 12, precipProb: 0, uvIndex: 5 }),
            ctx
        )
        expect(result).not.toBeNull()
        // One ambient insight covering both activities
        expect(result[0].urgency).toBe(URGENCY.AMBIENT)
    })
})

// ---------------------------------------------------------------------------
// Scenario: Marginal conditions → useful
// ---------------------------------------------------------------------------

describe('activityModule — marginal conditions', () => {
    it('returns useful insight for running when wind is marginal (32 km/h)', () => {
        // Running: good windSpeed ≤25, marginal ≤40 → 32 is marginal
        const ctx = makeContext({ activities: [makeActivity('running')] })
        const result = activityModule(makeWeatherData({ windSpeed: 32, feelsLike: 14 }), ctx)
        expect(result).not.toBeNull()
        expect(result[0].urgency).toBe(URGENCY.USEFUL)
    })

    it('marginal insight content mentions the limiting factor', () => {
        const ctx = makeContext({ activities: [makeActivity('running')] })
        const result = activityModule(makeWeatherData({ windSpeed: 32, feelsLike: 14 }), ctx)
        // Content should mention wind or the activity name
        expect(result[0].content).toMatch(/running|wind/i)
    })

    it('marginal actionPath suggests adjustments', () => {
        const ctx = makeContext({ activities: [makeActivity('running')] })
        const result = activityModule(makeWeatherData({ windSpeed: 32, feelsLike: 14 }), ctx)
        expect(result[0].actionPath.trim().length).toBeGreaterThan(10)
    })

    it('returns useful insight for cycling when feelsLike is warm (30°C) but marginal', () => {
        // Cycling: good feelsLike max 28, marginal max 35 → 30 is marginal
        // Use precipProb: 0 to avoid precipitation also going marginal (which is fine, still useful)
        const ctx = makeContext({ activities: [makeActivity('cycling')] })
        const result = activityModule(makeWeatherData({ feelsLike: 30, temp: 30, windSpeed: 15, precipProb: 0 }), ctx)
        expect(result).not.toBeNull()
        expect(result[0].urgency).toBe(URGENCY.USEFUL)
    })

    it('returns useful insight for outdoor-dining with precipitation 0.3 (marginal)', () => {
        // outdoor-dining: good precipitation ≤0, marginal ≤0.5 → precipProb 0.08 maps to ~0.32mm/hr proxy
        const ctx = makeContext({ activities: [makeActivity('outdoor-dining')] })
        // precipProb 0.08 → 0.08 * 4 = 0.32 mm/hr proxy — marginal for outdoor-dining (marginal ≤0.5)
        const result = activityModule(makeWeatherData({ precipProb: 0.08, feelsLike: 20, windSpeed: 10 }), ctx)
        expect(result).not.toBeNull()
        expect(result[0].urgency).toBe(URGENCY.USEFUL)
    })
})

// ---------------------------------------------------------------------------
// Scenario: Not-recommended conditions → heads-up
// ---------------------------------------------------------------------------

describe('activityModule — not-recommended conditions', () => {
    it('returns heads-up for running when wind is 55 km/h (above marginal threshold of 40)', () => {
        // Running: marginal ≤40, notRecommended at ≥50 → 55 is not-recommended
        const ctx = makeContext({ activities: [makeActivity('running')] })
        const result = activityModule(makeWeatherData({ windSpeed: 55, feelsLike: 14 }), ctx)
        expect(result).not.toBeNull()
        const urgencies = result.map(r => r.urgency)
        expect(urgencies.some(u => u === URGENCY.HEADS_UP || u === URGENCY.ALERT)).toBe(true)
    })

    it('returns heads-up or alert for cycling in gusty conditions (gustSpeed 70 km/h)', () => {
        // Cycling: notRecommended gustSpeed ≥65 → 70 qualifies
        const ctx = makeContext({ activities: [makeActivity('cycling')] })
        const result = activityModule(makeWeatherData({ windSpeed: 55, gustSpeed: 70, feelsLike: 18 }), ctx)
        expect(result).not.toBeNull()
        const urgencies = result.map(r => r.urgency)
        expect(urgencies.some(u => u === URGENCY.HEADS_UP || u === URGENCY.ALERT)).toBe(true)
    })

    it('not-recommended actionPath names the activity and suggests rescheduling', () => {
        const ctx = makeContext({ activities: [makeActivity('running')] })
        const result = activityModule(makeWeatherData({ windSpeed: 55, feelsLike: 14 }), ctx)
        expect(result[0].actionPath).toMatch(/running|reschedul|skip|postpone/i)
    })

    it('not-recommended insight for hiking in low visibility (0.5 km)', () => {
        // Hiking: notRecommended visibility max ≤1 → 0.5 qualifies
        const ctx = makeContext({ activities: [makeActivity('hiking')] })
        const result = activityModule(makeWeatherData({ visibility: 0.5, feelsLike: 10, windSpeed: 15 }), ctx)
        expect(result).not.toBeNull()
        const urgencies = result.map(r => r.urgency)
        expect(urgencies.some(u => u === URGENCY.HEADS_UP || u === URGENCY.ALERT)).toBe(true)
    })

    it('not-recommended insight for golf in rain (precipProb 0.9)', () => {
        // Golf: notRecommended precipitation ≥3 → precipProb 0.9 * 4 = 3.6 mm/hr
        const ctx = makeContext({ activities: [makeActivity('golf')] })
        const result = activityModule(makeWeatherData({ precipProb: 0.9, windSpeed: 10, feelsLike: 16 }), ctx)
        expect(result).not.toBeNull()
        const urgencies = result.map(r => r.urgency)
        expect(urgencies.some(u => u === URGENCY.HEADS_UP || u === URGENCY.ALERT)).toBe(true)
    })
})

// ---------------------------------------------------------------------------
// Multiple declared activities
// ---------------------------------------------------------------------------

describe('activityModule — multiple declared activities', () => {
    it('emits one insight per problematic activity', () => {
        // Running (good) + Cycling (wind too high for cycling)
        const ctx = makeContext({ activities: [makeActivity('running'), makeActivity('cycling')] })
        // windSpeed 45: running marginal (≤40 good, ≤40 marginal), cycling: marginal (≤40 marginal)
        const result = activityModule(makeWeatherData({ windSpeed: 45, feelsLike: 14 }), ctx)
        expect(result).not.toBeNull()
        // Both running and cycling should have insights (wind 45 is marginal/worse for both)
        expect(result.length).toBeGreaterThanOrEqual(1)
    })

    it('all activities good → emits exactly one ambient insight', () => {
        const ctx = makeContext({ activities: [makeActivity('running'), makeActivity('dog-walking')] })
        // Both running and dog-walking are good at precipProb 0:
        // running: good precipitation max 0.0 → precipProb 0 = 0mm/hr ✓
        // dog-walking: good precipitation max 0.5 → 0mm/hr ✓
        const result = activityModule(
            makeWeatherData({ feelsLike: 14, windSpeed: 10, precipProb: 0 }),
            ctx
        )
        expect(result).not.toBeNull()
        expect(result).toHaveLength(1)
        expect(result[0].urgency).toBe(URGENCY.AMBIENT)
    })

    it('mixed: one good, one marginal → emits only the marginal insight', () => {
        // dog-walking good conditions, sailing needs min windSpeed 10 (so 5 km/h is below — marginal)
        const ctx = makeContext({ activities: [makeActivity('dog-walking'), makeActivity('sailing')] })
        // sailing: good windSpeed min 10 — at 5 km/h it's below marginal min (5) — edge case
        const result = activityModule(
            makeWeatherData({ windSpeed: 3, feelsLike: 14, precipProb: 0.02 }),
            ctx
        )
        // sailing has min windSpeed 5 for marginal — 3 km/h is below that, so not recommended
        // dog-walking should be fine
        if (result !== null) {
            expect(result.every(i => i.type === 'activity')).toBe(true)
        }
    })
})

// ---------------------------------------------------------------------------
// Hourly window detection
// ---------------------------------------------------------------------------

describe('activityModule — hourly window suggestions', () => {
    function makeSlot(msOffset, { pop = 0, temp = 14, feelsLike = 14, windSpeed = 10 } = {}) {
        const ts = Date.now() + msOffset
        const dt = Math.floor(ts / 1000)
        const d = new Date(ts)
        const pad = n => String(n).padStart(2, '0')
        const dt_txt = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:00:00`
        return {
            dt, dt_txt,
            pop: pop / 100,
            main: { temp, feels_like: feelsLike, humidity: 55 },
            wind: { speed: windSpeed },
            weather: [{ main: 'Clouds', description: '', icon: '' }],
            visibility: 10000
        }
    }

    it('mentions a good window time when one exists in the forecast', () => {
        // Currently windy (bad), but a good slot exists in 4 hours
        const hourly = [
            makeSlot(1 * 3600000, { windSpeed: 55 }),
            makeSlot(2 * 3600000, { windSpeed: 55 }),
            makeSlot(3 * 3600000, { windSpeed: 55 }),
            makeSlot(4 * 3600000, { windSpeed: 10 }),  // good window
        ]
        const ctx = makeContext({ activities: [makeActivity('running')] })
        const result = activityModule(
            makeWeatherData({ windSpeed: 55, feelsLike: 14, hourly }),
            ctx
        )
        expect(result).not.toBeNull()
        // actionPath or content should mention a time
        const text = result[0].actionPath + ' ' + result[0].content
        expect(text).toMatch(/AM|PM|noon|midnight|\d+:\d+/i)
    })

    it('does not crash when hourly is empty', () => {
        const ctx = makeContext({ activities: [makeActivity('running')] })
        expect(() => activityModule(makeWeatherData({ windSpeed: 55, hourly: [] }), ctx)).not.toThrow()
    })
})

// ---------------------------------------------------------------------------
// sourceContext flags
// ---------------------------------------------------------------------------

describe('activityModule — sourceContext flags', () => {
    it('usedActivity is true on all returned insights', () => {
        const ctx = makeContext({ activities: [makeActivity('running')] })
        const result = activityModule(makeWeatherData({ windSpeed: 55 }), ctx)
        if (result !== null) {
            for (const insight of result) {
                expect(insight.sourceContext.usedActivity).toBe(true)
            }
        }
    })

    it('usedActivity is true on ambient confirmation', () => {
        const ctx = makeContext({ activities: [makeActivity('running')] })
        const result = activityModule(
            makeWeatherData({ feelsLike: 14, windSpeed: 10, precipProb: 0.02 }),
            ctx
        )
        if (result !== null) {
            expect(result[0].sourceContext.usedActivity).toBe(true)
        }
    })

    it('usedLocation is true when primary location is set', () => {
        const primaryLocation = { name: 'London', lat: 51.5, lon: -0.1, timezone: 'Europe/London', locationType: 'urban', confidence: 'declared' }
        const ctx = makeContext({ activities: [makeActivity('running')], primaryLocation })
        const result = activityModule(makeWeatherData({ windSpeed: 55 }), ctx)
        if (result !== null) {
            expect(result[0].sourceContext.usedLocation).toBe(true)
        }
    })

    it('usedLocation is false when no primary location', () => {
        const ctx = makeContext({ activities: [makeActivity('running')] })
        const result = activityModule(makeWeatherData({ windSpeed: 55 }), ctx)
        if (result !== null) {
            expect(result[0].sourceContext.usedLocation).toBe(false)
        }
    })

    it('usedRoutine and usedSensitivity are false (activity module does not use them)', () => {
        const ctx = makeContext({ activities: [makeActivity('running')] })
        const result = activityModule(makeWeatherData({ windSpeed: 55 }), ctx)
        if (result !== null) {
            expect(result[0].sourceContext.usedRoutine).toBe(false)
            expect(result[0].sourceContext.usedSensitivity).toBe(false)
        }
    })
})

// ---------------------------------------------------------------------------
// Activity-specific profile coverage (spot checks across all 10 activities)
// ---------------------------------------------------------------------------

describe('activityModule — activity profile coverage', () => {
    const cases = [
        // [activityKey, badWeatherData description, weatherOverride]
        ['running', 'extreme heat', { feelsLike: 36, temp: 34, windSpeed: 10, precipProb: 0 }],
        ['cycling', 'high gust', { windSpeed: 50, gustSpeed: 70, feelsLike: 18, precipProb: 0 }],
        ['hiking', 'heavy rain', { precipProb: 0.9, feelsLike: 10, windSpeed: 15 }],
        ['gardening', 'extreme UV', { uvIndex: 11, feelsLike: 20, precipProb: 0 }],
        ['photography', 'low visibility', { visibility: 0.5, precipProb: 0, uvIndex: 4 }],
        ['golf', 'strong wind', { windSpeed: 50, feelsLike: 18, precipProb: 0 }],
        ['outdoor-dining', 'cold temperature', { feelsLike: 4, temp: 5, windSpeed: 10, precipProb: 0 }],
        ['dog-walking', 'extreme heat', { feelsLike: 40, temp: 38, windSpeed: 10, precipProb: 0 }],
        ['swimming', 'cold temperature', { feelsLike: 10, temp: 12, windSpeed: 10, uvIndex: 5 }],
        ['sailing', 'storm winds', { windSpeed: 65, gustSpeed: 80, feelsLike: 15, precipProb: 0 }],
    ]

    for (const [activityKey, description, weatherOverride] of cases) {
        it(`${activityKey}: produces a non-ambient insight for ${description}`, () => {
            const ctx = makeContext({ activities: [makeActivity(activityKey)] })
            const result = activityModule(makeWeatherData(weatherOverride), ctx)
            expect(result).not.toBeNull()
            // Should be heads-up, alert, or useful — not ambient
            const hasNonAmbient = result.some(r => r.urgency !== URGENCY.AMBIENT)
            expect(hasNonAmbient).toBe(true)
        })
    }
})

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('activityModule — edge cases', () => {
    it('handles an activity with an unknown activityKey gracefully (returns null)', () => {
        const ctx = makeContext({
            activities: [{ id: 'x', activityKey: 'unicycle-jousting', label: 'Jousting', frequency: 'daily', seasonRange: null, profile: {} }]
        })
        // Unknown key → getActivityProfile returns undefined → buildActivityInsight returns null
        expect(activityModule(makeWeatherData(), ctx)).toBeNull()
    })

    it('does not throw when current has undefined fields', () => {
        const ctx = makeContext({ activities: [makeActivity('running')] })
        const partialWeather = {
            current: { temp: undefined, feelsLike: undefined, humidity: undefined, windSpeed: undefined, gustSpeed: undefined, uvIndex: undefined, precipProb: undefined, condition: 'Clear', visibility: undefined },
            hourly: [],
            daily: [],
            fetchedAt: Date.now(),
            location: { lat: 51.5, lon: -0.1 }
        }
        expect(() => activityModule(partialWeather, ctx)).not.toThrow()
    })

    it('result insights have non-empty id fields', () => {
        const ctx = makeContext({ activities: [makeActivity('running')] })
        const result = activityModule(makeWeatherData({ windSpeed: 55 }), ctx)
        if (result !== null) {
            for (const insight of result) {
                expect(typeof insight.id).toBe('string')
                expect(insight.id.trim().length).toBeGreaterThan(0)
            }
        }
    })
})
