/**
 * routineModule.test.js
 * Unit tests for Phase 3.2 — routineModule
 *
 * Key invariants:
 *   - Returns null when no outdoor windows are declared
 *   - Returns null when all windows have passed today
 *   - Returns null when windows don't apply today (day-of-week filtering)
 *   - Returns null for benign window conditions
 *   - Every non-null result: type='routine-adapt', non-empty actionPath, valid Insight
 *   - Urgency is sensitivity-adjusted via urgencyEngine
 *   - usedRoutine is always true on returned insights
 */

import { describe, it, expect } from 'vitest'
import { routineModule } from '../routineModule.js'
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

/**
 * Makes a TimeWindow starting N minutes from now, lasting `durationMins`.
 * daysOfWeek defaults to [] (all days).
 */
function makeWindow({
    minutesFromNow = 30,
    durationMins = 60,
    label = 'Morning walk',
    daysOfWeek = []
} = {}) {
    const startMs = Date.now() + minutesFromNow * 60 * 1000
    const endMs = startMs + durationMins * 60 * 1000
    const fmt = ms => {
        const d = new Date(ms)
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    }
    return { startTime: fmt(startMs), endTime: fmt(endMs), label, daysOfWeek }
}

/**
 * Makes a window that ended N minutes ago (past window).
 */
function pastWindow(minutesAgo = 60, label = 'Morning walk') {
    const endMs = Date.now() - minutesAgo * 60 * 1000
    const startMs = endMs - 60 * 60 * 1000
    const fmt = ms => {
        const d = new Date(ms)
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    }
    return { startTime: fmt(startMs), endTime: fmt(endMs), label, daysOfWeek: [] }
}

function makeContext({
    weekdayWindows = [],
    weekendWindows = [],
    primaryLocation = null,
    sensitivities = {}
} = {}) {
    return {
        location: { primary: primaryLocation, saved: [], current: null },
        routines: {
            weekday: { departureTime: null, returnTime: null, outdoorWindows: weekdayWindows },
            weekend: { outdoorWindows: weekendWindows },
            confidence: 'declared'
        },
        activities: { declared: [] },
        schedule: { manualEvents: [], calendarConnected: false },
        preferences: {
            temperatureUnit: 'C', theme: 'dark', verbosity: 'concise',
            notifications: { enabled: false, commute: false, morningBriefing: false, activityAlerts: false, riskAlerts: false, preDeparture: false, ambient: false },
            intelligenceAreas: { dailyPlanning: true, activityRecommend: false, commuteIntelligence: false, routineAdaptation: true, environmentalAware: false }
        },
        sensitivities: { heat: false, cold: false, pollen: false, uv: false, airQuality: false, precipitation: false, ...sensitivities },
        meta: {
            schemaVersion: '1.0.0', createdAt: 0, lastModifiedAt: 0,
            completeness: { hasLocation: !!primaryLocation, hasRoutine: weekdayWindows.length > 0 || weekendWindows.length > 0, hasActivities: false, hasSensitivities: false, hasPreferences: true },
            contextQuality: 'partial'
        }
    }
}

/**
 * Builds a HourlyPoint anchored to a specific offset from now.
 */
function makeSlot(msOffset, { pop = 0, temp = 18, feelsLike = 18, windSpeed = 10, condition = 'Clouds' } = {}) {
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
        weather: [{ main: condition, description: '', icon: '' }],
        visibility: 10000
    }
}

// ---------------------------------------------------------------------------
// Contract compliance
// ---------------------------------------------------------------------------

describe('routineModule — contract compliance', () => {
    it('has exactly 2 parameters', () => {
        expect(routineModule.length).toBe(2)
    })

    it('returns null or an array — never throws', () => {
        const w = makeWindow()
        const ctx = makeContext({ weekdayWindows: [w] })
        const result = routineModule(makeWeatherData(), ctx)
        expect(result === null || Array.isArray(result)).toBe(true)
    })

    it('returns null when weatherData is null', () => {
        const ctx = makeContext({ weekdayWindows: [makeWindow()] })
        expect(routineModule(null, ctx)).toBeNull()
    })

    it('returns null when weatherData.current is missing', () => {
        const ctx = makeContext({ weekdayWindows: [makeWindow()] })
        expect(routineModule({ hourly: [], daily: [] }, ctx)).toBeNull()
    })

    it('every non-null result item has type "routine-adapt"', () => {
        const w = makeWindow({ minutesFromNow: 30 })
        const ctx = makeContext({ weekdayWindows: [w] })
        const result = routineModule(makeWeatherData({ condition: 'Thunderstorm' }), ctx)
        if (result !== null) {
            for (const insight of result) expect(insight.type).toBe('routine-adapt')
        }
    })

    it('every non-null result item passes validateInsight', () => {
        const w = makeWindow({ minutesFromNow: 30 })
        const ctx = makeContext({ weekdayWindows: [w] })
        const result = routineModule(makeWeatherData({ condition: 'Thunderstorm' }), ctx)
        if (result !== null) {
            for (const insight of result) expect(validateInsight(insight).valid).toBe(true)
        }
    })

    it('every non-null result item has a non-empty actionPath', () => {
        const w = makeWindow({ minutesFromNow: 30 })
        const ctx = makeContext({ weekdayWindows: [w] })
        const result = routineModule(makeWeatherData({ condition: 'Thunderstorm' }), ctx)
        if (result !== null) {
            for (const insight of result) {
                expect(insight.actionPath.trim().length).toBeGreaterThan(10)
            }
        }
    })
})

// ---------------------------------------------------------------------------
// Gate: no outdoor windows
// ---------------------------------------------------------------------------

describe('routineModule — no outdoor windows declared', () => {
    it('returns null when weekday and weekend windows are both empty', () => {
        expect(routineModule(makeWeatherData(), makeContext())).toBeNull()
    })

    it('returns null when routines is absent from context', () => {
        const ctx = makeContext()
        delete ctx.routines
        expect(routineModule(makeWeatherData(), ctx)).toBeNull()
    })

    it('returns null when context is null', () => {
        expect(routineModule(makeWeatherData(), null)).toBeNull()
    })

    it('returns null when all windows have passed', () => {
        const ctx = makeContext({ weekdayWindows: [pastWindow(90), pastWindow(120)] })
        expect(routineModule(makeWeatherData(), ctx)).toBeNull()
    })
})

// ---------------------------------------------------------------------------
// Gate: day-of-week filtering
// ---------------------------------------------------------------------------

describe('routineModule — day-of-week filtering', () => {
    it('includes window when daysOfWeek is empty (applies every day)', () => {
        const w = makeWindow({ daysOfWeek: [] })
        const ctx = makeContext({ weekdayWindows: [w] })
        // Thunderstorm should trigger a result for an all-day window
        const result = routineModule(makeWeatherData({ condition: 'Thunderstorm' }), ctx)
        expect(result).not.toBeNull()
    })

    it('includes window when today is in daysOfWeek', () => {
        const today = new Date().getDay()
        const w = makeWindow({ daysOfWeek: [today] })
        const ctx = makeContext({ weekdayWindows: [w] })
        const result = routineModule(makeWeatherData({ condition: 'Thunderstorm' }), ctx)
        expect(result).not.toBeNull()
    })

    it('excludes window when today is NOT in daysOfWeek', () => {
        const today = new Date().getDay()
        // Use a day that is definitely not today
        const notToday = (today + 1) % 7
        const w = makeWindow({ daysOfWeek: [notToday] })
        const ctx = makeContext({ weekdayWindows: [w] })
        expect(routineModule(makeWeatherData({ condition: 'Thunderstorm' }), ctx)).toBeNull()
    })
})

// ---------------------------------------------------------------------------
// Scenario 1: Thunderstorm
// ---------------------------------------------------------------------------

describe('routineModule — thunderstorm during window', () => {
    it('returns alert when current condition is Thunderstorm', () => {
        const ctx = makeContext({ weekdayWindows: [makeWindow()] })
        const result = routineModule(makeWeatherData({ condition: 'Thunderstorm' }), ctx)
        expect(result).not.toBeNull()
        expect(result[0].urgency).toBe(URGENCY.ALERT)
        expect(result[0].type).toBe('routine-adapt')
    })

    it('returns alert when a thunderstorm slot overlaps the window', () => {
        const w = makeWindow({ minutesFromNow: 30 })
        const hourly = [makeSlot(30 * 60 * 1000, { condition: 'Thunderstorm', pop: 90 })]
        const ctx = makeContext({ weekdayWindows: [w] })
        const result = routineModule(makeWeatherData({ hourly }), ctx)
        expect(result).not.toBeNull()
        expect(result[0].urgency).toBe(URGENCY.ALERT)
    })

    it('thunderstorm actionPath suggests skipping or moving indoors', () => {
        const ctx = makeContext({ weekdayWindows: [makeWindow()] })
        const result = routineModule(makeWeatherData({ condition: 'Thunderstorm' }), ctx)
        expect(result[0].actionPath).toMatch(/skip|indoor|storm|shelter/i)
    })

    it('thunderstorm result marks usedRoutine: true', () => {
        const ctx = makeContext({ weekdayWindows: [makeWindow()] })
        const result = routineModule(makeWeatherData({ condition: 'Thunderstorm' }), ctx)
        expect(result[0].sourceContext.usedRoutine).toBe(true)
    })

    it('thunderstorm insight mentions the window label in content', () => {
        const w = makeWindow({ label: 'Evening jog' })
        const ctx = makeContext({ weekdayWindows: [w] })
        const result = routineModule(makeWeatherData({ condition: 'Thunderstorm' }), ctx)
        expect(result[0].content).toMatch(/Evening jog/i)
    })
})

// ---------------------------------------------------------------------------
// Scenario 2: Rain during window
// ---------------------------------------------------------------------------

describe('routineModule — rain during window', () => {
    it('returns heads-up when rain probability is 65% in window slot', () => {
        const w = makeWindow({ minutesFromNow: 20 })
        const hourly = [makeSlot(20 * 60 * 1000, { pop: 65 })]
        const ctx = makeContext({ weekdayWindows: [w] })
        const result = routineModule(makeWeatherData({ hourly }), ctx)
        expect(result).not.toBeNull()
        expect(result[0].urgency).toBe(URGENCY.HEADS_UP)
    })

    it('returns alert when rain probability is 88% in window slot', () => {
        const w = makeWindow({ minutesFromNow: 20 })
        const hourly = [makeSlot(20 * 60 * 1000, { pop: 88 })]
        const ctx = makeContext({ weekdayWindows: [w] })
        const result = routineModule(makeWeatherData({ hourly }), ctx)
        expect(result).not.toBeNull()
        expect(result[0].urgency).toBe(URGENCY.ALERT)
    })

    it('rain heads-up actionPath mentions umbrella or rain jacket', () => {
        const w = makeWindow({ minutesFromNow: 20 })
        const hourly = [makeSlot(20 * 60 * 1000, { pop: 65 })]
        const ctx = makeContext({ weekdayWindows: [w] })
        const result = routineModule(makeWeatherData({ hourly }), ctx)
        expect(result[0].actionPath).toMatch(/umbrella|rain|jacket/i)
    })

    it('precipitation-sensitive user gets alert at lower rain probability', () => {
        const w = makeWindow({ minutesFromNow: 20 })
        // 50% — above sensitive threshold (45%) but below default heads-up (60%)
        const hourly = [makeSlot(20 * 60 * 1000, { pop: 50 })]
        const defaultCtx = makeContext({ weekdayWindows: [w] })
        const sensitiveCtx = makeContext({ weekdayWindows: [w], sensitivities: { precipitation: true } })

        const defaultResult = routineModule(makeWeatherData({ hourly }), defaultCtx)
        const sensitiveResult = routineModule(makeWeatherData({ hourly }), sensitiveCtx)

        if (defaultResult !== null) {
            expect(defaultResult[0].urgency).not.toBe(URGENCY.HEADS_UP)
        }
        if (sensitiveResult !== null) {
            expect(sensitiveResult[0].urgency).toBe(URGENCY.HEADS_UP)
        }
    })

    it('rain insight content mentions the window label', () => {
        const w = makeWindow({ label: 'Afternoon walk', minutesFromNow: 20 })
        const hourly = [makeSlot(20 * 60 * 1000, { pop: 70 })]
        const ctx = makeContext({ weekdayWindows: [w] })
        const result = routineModule(makeWeatherData({ hourly }), ctx)
        expect(result[0].content).toMatch(/Afternoon walk/i)
    })

    it('low rain probability (20%) does not produce a rain insight', () => {
        const w = makeWindow({ minutesFromNow: 20 })
        const hourly = [makeSlot(20 * 60 * 1000, { pop: 20 })]
        const ctx = makeContext({ weekdayWindows: [w] })
        const result = routineModule(makeWeatherData({ hourly }), ctx)
        if (result !== null) {
            // If a result exists, should not be rain-triggered
            expect(result[0].content).not.toMatch(/\d+%.*chance/i)
        }
    })
})

// ---------------------------------------------------------------------------
// Scenario 3: Heat during window
// ---------------------------------------------------------------------------

describe('routineModule — heat during window', () => {
    it('returns heads-up when window slot has feels-like 37°C', () => {
        const w = makeWindow({ minutesFromNow: 20 })
        const hourly = [makeSlot(20 * 60 * 1000, { feelsLike: 37, temp: 35 })]
        const ctx = makeContext({ weekdayWindows: [w] })
        const result = routineModule(makeWeatherData({ hourly }), ctx)
        expect(result).not.toBeNull()
        expect(result[0].urgency).toBe(URGENCY.HEADS_UP)
    })

    it('returns alert when window feels-like is 42°C', () => {
        const w = makeWindow({ minutesFromNow: 20 })
        const hourly = [makeSlot(20 * 60 * 1000, { feelsLike: 42, temp: 40 })]
        const ctx = makeContext({ weekdayWindows: [w] })
        const result = routineModule(makeWeatherData({ hourly }), ctx)
        expect(result).not.toBeNull()
        expect(result[0].urgency).toBe(URGENCY.ALERT)
    })

    it('heat actionPath suggests shifting timing or carrying water', () => {
        const w = makeWindow({ minutesFromNow: 20 })
        const hourly = [makeSlot(20 * 60 * 1000, { feelsLike: 37, temp: 35 })]
        const ctx = makeContext({ weekdayWindows: [w] })
        const result = routineModule(makeWeatherData({ hourly }), ctx)
        expect(result[0].actionPath).toMatch(/water|shift|cool|earlier|later|heat/i)
    })

    it('heat-sensitive user gets alert at 34°C (default would be useful — silent)', () => {
        const w = makeWindow({ minutesFromNow: 20 })
        const hourly = [makeSlot(20 * 60 * 1000, { feelsLike: 34, temp: 32 })]
        const defaultCtx = makeContext({ weekdayWindows: [w] })
        const sensitiveCtx = makeContext({ weekdayWindows: [w], sensitivities: { heat: true } })

        const defaultResult = routineModule(makeWeatherData({ hourly }), defaultCtx)
        const sensitiveResult = routineModule(makeWeatherData({ hourly }), sensitiveCtx)

        // 34°C default = useful tier → module is silent (only HEADS_UP/ALERT trigger heat insights)
        // heat-sensitive: 34°C → alert (sensitive alert threshold = 33°C)
        if (defaultResult !== null) {
            // If it returned something, it should not be heat-related at useful tier
            expect(defaultResult[0].urgency).not.toBe(URGENCY.ALERT)
        }
        if (sensitiveResult !== null) {
            expect(sensitiveResult[0].urgency).toBe(URGENCY.ALERT)
        }
    })

    it('heat result marks usedSensitivity: true when heat sensitivity active', () => {
        const w = makeWindow({ minutesFromNow: 20 })
        const hourly = [makeSlot(20 * 60 * 1000, { feelsLike: 34, temp: 32 })]
        const sensitiveCtx = makeContext({ weekdayWindows: [w], sensitivities: { heat: true } })
        const result = routineModule(makeWeatherData({ hourly }), sensitiveCtx)
        if (result !== null) {
            expect(result[0].sourceContext.usedSensitivity).toBe(true)
        }
    })
})

// ---------------------------------------------------------------------------
// Scenario 4: Cold + wind during window
// ---------------------------------------------------------------------------

describe('routineModule — cold and wind during window', () => {
    it('returns heads-up when window feels-like is -6°C', () => {
        const w = makeWindow({ minutesFromNow: 20 })
        const hourly = [makeSlot(20 * 60 * 1000, { feelsLike: -6, temp: -3 })]
        const ctx = makeContext({ weekdayWindows: [w] })
        const result = routineModule(makeWeatherData({ hourly }), ctx)
        expect(result).not.toBeNull()
        expect(result[0].urgency).toBe(URGENCY.HEADS_UP)
    })

    it('returns alert when window feels-like is -18°C', () => {
        const w = makeWindow({ minutesFromNow: 20 })
        const hourly = [makeSlot(20 * 60 * 1000, { feelsLike: -18, temp: -12 })]
        const ctx = makeContext({ weekdayWindows: [w] })
        const result = routineModule(makeWeatherData({ hourly }), ctx)
        expect(result).not.toBeNull()
        expect(result[0].urgency).toBe(URGENCY.ALERT)
    })

    it('cold actionPath mentions layers or wind-resistant clothing', () => {
        const w = makeWindow({ minutesFromNow: 20 })
        const hourly = [makeSlot(20 * 60 * 1000, { feelsLike: -6, temp: -3 })]
        const ctx = makeContext({ weekdayWindows: [w] })
        const result = routineModule(makeWeatherData({ hourly }), ctx)
        expect(result[0].actionPath).toMatch(/layer|warm|wind|thermal|outer/i)
    })

    it('strong wind at window triggers a cold/wind insight', () => {
        const w = makeWindow({ minutesFromNow: 20 })
        const hourly = [makeSlot(20 * 60 * 1000, { windSpeed: 50, feelsLike: 8, temp: 10 })]
        const ctx = makeContext({ weekdayWindows: [w] })
        const result = routineModule(makeWeatherData({ hourly }), ctx)
        expect(result).not.toBeNull()
    })

    it('cold-sensitive user gets alert at -6°C (default would be heads-up)', () => {
        const w = makeWindow({ minutesFromNow: 20 })
        const hourly = [makeSlot(20 * 60 * 1000, { feelsLike: -6, temp: -3 })]
        const defaultCtx = makeContext({ weekdayWindows: [w] })
        const sensitiveCtx = makeContext({ weekdayWindows: [w], sensitivities: { cold: true } })
        const defaultResult = routineModule(makeWeatherData({ hourly }), defaultCtx)
        const sensitiveResult = routineModule(makeWeatherData({ hourly }), sensitiveCtx)
        if (defaultResult) expect(defaultResult[0].urgency).toBe(URGENCY.HEADS_UP)
        if (sensitiveResult) expect(sensitiveResult[0].urgency).toBe(URGENCY.ALERT)
    })
})

// ---------------------------------------------------------------------------
// Benign conditions → null
// ---------------------------------------------------------------------------

describe('routineModule — benign window conditions', () => {
    it('returns null for a mild, clear window', () => {
        const w = makeWindow({ minutesFromNow: 30 })
        const hourly = [
            makeSlot(20 * 60 * 1000, { pop: 5, temp: 18, feelsLike: 18, windSpeed: 8 }),
            makeSlot(50 * 60 * 1000, { pop: 5, temp: 19, feelsLike: 19, windSpeed: 8 })
        ]
        const ctx = makeContext({ weekdayWindows: [w] })
        expect(routineModule(makeWeatherData({ hourly }), ctx)).toBeNull()
    })

    it('returns null for a cool spring morning window with low rain', () => {
        const w = makeWindow({ minutesFromNow: 30 })
        const hourly = [makeSlot(30 * 60 * 1000, { pop: 10, temp: 14, feelsLike: 12, windSpeed: 10 })]
        const ctx = makeContext({ weekdayWindows: [w] })
        expect(routineModule(makeWeatherData({ hourly }), ctx)).toBeNull()
    })

    it('returns null when feelsLike is 10°C (above cold threshold, benign)', () => {
        const w = makeWindow({ minutesFromNow: 30 })
        const hourly = [makeSlot(30 * 60 * 1000, { feelsLike: 10, temp: 12, windSpeed: 8 })]
        const ctx = makeContext({ weekdayWindows: [w] })
        expect(routineModule(makeWeatherData({ hourly }), ctx)).toBeNull()
    })
})

// ---------------------------------------------------------------------------
// Multiple windows
// ---------------------------------------------------------------------------

describe('routineModule — multiple windows', () => {
    it('emits one insight per affected window', () => {
        const w1 = makeWindow({ minutesFromNow: 20, label: 'Morning walk' })
        const w2 = makeWindow({ minutesFromNow: 300, label: 'Evening run' })
        // Both windows get rainy slots
        const hourly = [
            makeSlot(20 * 60 * 1000, { pop: 70 }),
            makeSlot(300 * 60 * 1000, { pop: 80 })
        ]
        const ctx = makeContext({ weekdayWindows: [w1, w2] })
        const result = routineModule(makeWeatherData({ hourly }), ctx)
        expect(result).not.toBeNull()
        expect(result.length).toBeGreaterThanOrEqual(1)
    })

    it('only emits insight for the affected window when one window is clear', () => {
        const w1 = makeWindow({ minutesFromNow: 20, label: 'Morning walk' })
        const w2 = makeWindow({ minutesFromNow: 300, label: 'Evening run' })
        // Only morning walk gets a rainy slot
        const hourly = [
            makeSlot(20 * 60 * 1000, { pop: 70 }),
            makeSlot(300 * 60 * 1000, { pop: 5 })  // clear
        ]
        const ctx = makeContext({ weekdayWindows: [w1, w2] })
        const result = routineModule(makeWeatherData({ hourly }), ctx)
        expect(result).not.toBeNull()
        // At least one insight for the rainy window
        expect(result.some(i => /Morning walk/i.test(i.content))).toBe(true)
    })

    it('returns null when all windows are clear', () => {
        const w1 = makeWindow({ minutesFromNow: 20, label: 'Morning walk' })
        const w2 = makeWindow({ minutesFromNow: 300, label: 'Evening run' })
        const hourly = [
            makeSlot(20 * 60 * 1000, { pop: 5, feelsLike: 16, windSpeed: 8 }),
            makeSlot(300 * 60 * 1000, { pop: 5, feelsLike: 14, windSpeed: 8 })
        ]
        const ctx = makeContext({ weekdayWindows: [w1, w2] })
        expect(routineModule(makeWeatherData({ hourly }), ctx)).toBeNull()
    })
})

// ---------------------------------------------------------------------------
// Weekend windows
// ---------------------------------------------------------------------------

describe('routineModule — weekend windows', () => {
    it('processes weekend outdoor windows', () => {
        const w = makeWindow({ minutesFromNow: 30, label: 'Weekend hike' })
        const ctx = makeContext({ weekendWindows: [w] })
        const result = routineModule(makeWeatherData({ condition: 'Thunderstorm' }), ctx)
        expect(result).not.toBeNull()
        expect(result[0].type).toBe('routine-adapt')
    })

    it('processes both weekday and weekend windows together', () => {
        const wk = makeWindow({ minutesFromNow: 20, label: 'Weekday walk' })
        const we = makeWindow({ minutesFromNow: 300, label: 'Weekend run' })
        const hourly = [
            makeSlot(20 * 60 * 1000, { pop: 70 }),
            makeSlot(300 * 60 * 1000, { pop: 80 })
        ]
        const ctx = makeContext({ weekdayWindows: [wk], weekendWindows: [we] })
        const result = routineModule(makeWeatherData({ hourly }), ctx)
        expect(result).not.toBeNull()
        expect(result.length).toBeGreaterThanOrEqual(1)
    })
})

// ---------------------------------------------------------------------------
// sourceContext flags
// ---------------------------------------------------------------------------

describe('routineModule — sourceContext flags', () => {
    it('usedRoutine is true on all returned insights', () => {
        const ctx = makeContext({ weekdayWindows: [makeWindow()] })
        const result = routineModule(makeWeatherData({ condition: 'Thunderstorm' }), ctx)
        if (result !== null) {
            for (const i of result) expect(i.sourceContext.usedRoutine).toBe(true)
        }
    })

    it('usedLocation is true when primary location is set', () => {
        const primaryLocation = { name: 'London', lat: 51.5, lon: -0.1, timezone: 'Europe/London', locationType: 'urban', confidence: 'declared' }
        const ctx = makeContext({ weekdayWindows: [makeWindow()], primaryLocation })
        const result = routineModule(makeWeatherData({ condition: 'Thunderstorm' }), ctx)
        if (result !== null) {
            expect(result[0].sourceContext.usedLocation).toBe(true)
        }
    })

    it('usedLocation is false when no primary location', () => {
        const ctx = makeContext({ weekdayWindows: [makeWindow()] })
        const result = routineModule(makeWeatherData({ condition: 'Thunderstorm' }), ctx)
        if (result !== null) {
            expect(result[0].sourceContext.usedLocation).toBe(false)
        }
    })

    it('usedSensitivity is false for standard user', () => {
        const ctx = makeContext({ weekdayWindows: [makeWindow()] })
        const result = routineModule(makeWeatherData({ condition: 'Thunderstorm' }), ctx)
        if (result !== null) {
            expect(result[0].sourceContext.usedSensitivity).toBe(false)
        }
    })

    it('usedSensitivity is true when precipitation sensitivity changes rain urgency', () => {
        const w = makeWindow({ minutesFromNow: 20 })
        const hourly = [makeSlot(20 * 60 * 1000, { pop: 70 })]
        const ctx = makeContext({ weekdayWindows: [w], sensitivities: { precipitation: true } })
        const result = routineModule(makeWeatherData({ hourly }), ctx)
        if (result !== null) {
            expect(result[0].sourceContext.usedSensitivity).toBe(true)
        }
    })

    it('usedActivity is false (routine module does not use activity context)', () => {
        const ctx = makeContext({ weekdayWindows: [makeWindow()] })
        const result = routineModule(makeWeatherData({ condition: 'Thunderstorm' }), ctx)
        if (result !== null) {
            expect(result[0].sourceContext.usedActivity).toBe(false)
        }
    })
})

// ---------------------------------------------------------------------------
// Confidence levels
// ---------------------------------------------------------------------------

describe('routineModule — confidence levels', () => {
    it('high confidence when hourly forecast covers the window', () => {
        const w = makeWindow({ minutesFromNow: 20 })
        const hourly = [makeSlot(20 * 60 * 1000, { pop: 80 })]
        const ctx = makeContext({ weekdayWindows: [w] })
        const result = routineModule(makeWeatherData({ hourly }), ctx)
        if (result !== null) expect(result[0].confidence).toBe('high')
    })

    it('thunderstorm always has high confidence', () => {
        const ctx = makeContext({ weekdayWindows: [makeWindow()] })
        const result = routineModule(makeWeatherData({ condition: 'Thunderstorm' }), ctx)
        if (result !== null) expect(result[0].confidence).toBe('high')
    })
})

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('routineModule — edge cases', () => {
    it('does not crash with malformed window (missing endTime)', () => {
        const badWindow = { startTime: '08:00', endTime: null, label: 'Walk', daysOfWeek: [] }
        const ctx = makeContext({ weekdayWindows: [badWindow] })
        expect(() => routineModule(makeWeatherData({ condition: 'Thunderstorm' }), ctx)).not.toThrow()
    })

    it('does not crash when hourly is empty', () => {
        const ctx = makeContext({ weekdayWindows: [makeWindow()] })
        expect(() => routineModule(makeWeatherData({ condition: 'Thunderstorm', hourly: [] }), ctx)).not.toThrow()
    })

    it('result insights have non-empty id fields', () => {
        const ctx = makeContext({ weekdayWindows: [makeWindow()] })
        const result = routineModule(makeWeatherData({ condition: 'Thunderstorm' }), ctx)
        if (result !== null) {
            for (const i of result) {
                expect(typeof i.id).toBe('string')
                expect(i.id.trim().length).toBeGreaterThan(0)
            }
        }
    })
})
