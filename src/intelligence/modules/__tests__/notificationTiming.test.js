/**
 * notificationTiming.test.js — Phase 3.4
 *
 * Verifies that intelligence modules correctly set timing.notify on their
 * returned insights according to the Phase 3.4 notification matrix:
 *
 *   notify: true  — severe weather alerts (ALERT urgency), all commute
 *                   insights, routine window disruptions, activity
 *                   NOT_RECOMMENDED (ALERT/HEADS_UP), daily-planning
 *                   ALERT and HEADS_UP scenarios (rain, heat, cold, wind)
 *
 *   notify: false — ambient confirmations, useful informational insights,
 *                   marginal activity suggestions, comfort HEADS_UP/USEFUL,
 *                   environmental HEADS_UP/USEFUL
 *
 * Rules:
 *   - Does NOT modify existing test assertions.
 *   - Only imports and calls production module functions.
 *   - Uses the same minimal fixture helpers as the existing module tests.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { dailyPlanningModule } from '../dailyPlanningModule.js'
import { commuteModule } from '../commuteModule.js'
import { activityModule } from '../activityModule.js'
import { routineModule } from '../routineModule.js'
import { comfortModule } from '../comfortModule.js'
import { uvModule } from '../uvModule.js'
import { airQualityModule } from '../airQualityModule.js'
import { pollenModule } from '../pollenModule.js'

// ---------------------------------------------------------------------------
// Shared fixture builders
// ---------------------------------------------------------------------------

function makeWeatherData(overrides = {}) {
    return {
        current: {
            condition: 'Clear',
            temp: 20,
            feelsLike: 20,
            humidity: 50,
            windSpeed: 10,
            gustSpeed: 12,
            uvIndex: 3,
            precipProb: 0.1,
            visibility: 10,
            airQuality: null,
            pollenLevel: null,
            ...overrides.current
        },
        hourly: overrides.hourly ?? [],
        daily: overrides.daily ?? [],
        fetchedAt: Date.now()
    }
}

function makeUserContext(overrides = {}) {
    return {
        location: { primary: { lat: 51.5, lon: -0.1, name: 'London' } },
        sensitivities: null,
        routines: {
            weekday: { departureTime: null, outdoorWindows: [] },
            weekend: { outdoorWindows: [] }
        },
        activities: { declared: [] },
        preferences: { notifications: { enabled: true } },
        ...overrides
    }
}

/** Creates a future hourly slot (dt = now + offsetMinutes). */
function futureSlot(offsetMinutes, overrides = {}) {
    const dt = Math.floor((Date.now() + offsetMinutes * 60 * 1000) / 1000)
    return {
        dt,
        main: { temp: 20, feels_like: 20, humidity: 50 },
        wind: { speed: 10 },
        weather: [{ main: 'Clear' }],
        pop: 0.1,
        ...overrides
    }
}

/** Creates a departure time string "HH:MM" for N minutes from now. */
function futureTime(minutesFromNow) {
    const d = new Date(Date.now() + minutesFromNow * 60 * 1000)
    const h = String(d.getHours()).padStart(2, '0')
    const m = String(d.getMinutes()).padStart(2, '0')
    return `${h}:${m}`
}

// ---------------------------------------------------------------------------
// dailyPlanningModule — timing.notify tests
// ---------------------------------------------------------------------------

describe('dailyPlanningModule — timing.notify', () => {

    // ── Scenarios that SHOULD notify ─────────────────────────────────────────

    it('thunderstorm alert has timing.notify === true', () => {
        const wd = makeWeatherData({ current: { condition: 'Thunderstorm', feelsLike: 22, precipProb: 0.9 } })
        const result = dailyPlanningModule(wd, makeUserContext())
        expect(result).not.toBeNull()
        expect(result.urgency).toBe('alert')
        expect(result.timing.notify).toBe(true)
    })

    it('extreme heat alert has timing.notify === true', () => {
        // feelsLike >= 40 → ALERT from escalateHeat
        const wd = makeWeatherData({ current: { condition: 'Clear', feelsLike: 41, temp: 41, precipProb: 0.05 } })
        const result = dailyPlanningModule(wd, makeUserContext())
        expect(result).not.toBeNull()
        expect(result.urgency).toBe('alert')
        expect(result.timing.notify).toBe(true)
    })

    it('extreme cold alert has timing.notify === true', () => {
        // feelsLike <= -15 → ALERT from escalateCold
        const wd = makeWeatherData({ current: { condition: 'Clear', feelsLike: -18, temp: -15, precipProb: 0.05, windSpeed: 5 } })
        const result = dailyPlanningModule(wd, makeUserContext())
        expect(result).not.toBeNull()
        expect(result.urgency).toBe('alert')
        expect(result.timing.notify).toBe(true)
    })

    it('heads-up heat scenario has timing.notify === true', () => {
        // feelsLike 35–39 → HEADS_UP from escalateHeat
        const wd = makeWeatherData({ current: { condition: 'Clear', feelsLike: 37, temp: 35, precipProb: 0.05, windSpeed: 5 } })
        const result = dailyPlanningModule(wd, makeUserContext())
        expect(result).not.toBeNull()
        expect(result.urgency).toBe('heads-up')
        expect(result.timing.notify).toBe(true)
    })

    it('rain incoming (HEADS_UP) has timing.notify === true', () => {
        // High rain probability in a near-future slot
        const rainSlot = futureSlot(60, { pop: 0.85, weather: [{ main: 'Rain' }] })
        const wd = makeWeatherData({
            current: { condition: 'Clear', feelsLike: 18, temp: 18, precipProb: 0.1, windSpeed: 5 },
            hourly: [rainSlot]
        })
        const result = dailyPlanningModule(wd, makeUserContext())
        expect(result).not.toBeNull()
        // HEADS_UP or higher for high rain prob
        expect(['heads-up', 'alert']).toContain(result.urgency)
        expect(result.timing.notify).toBe(true)
    })

    it('dangerous wind (HEADS_UP) has timing.notify === true', () => {
        // windSpeed >= 40 → HEADS_UP from escalateWind
        const wd = makeWeatherData({ current: { condition: 'Clear', feelsLike: 18, temp: 18, windSpeed: 45, precipProb: 0.05 } })
        const result = dailyPlanningModule(wd, makeUserContext())
        expect(result).not.toBeNull()
        expect(['heads-up', 'alert']).toContain(result.urgency)
        expect(result.timing.notify).toBe(true)
    })

    it('dangerous wind (ALERT) has timing.notify === true', () => {
        // windSpeed >= 70 → ALERT from escalateWind
        const wd = makeWeatherData({ current: { condition: 'Clear', feelsLike: 18, temp: 18, windSpeed: 75, precipProb: 0.05 } })
        const result = dailyPlanningModule(wd, makeUserContext())
        expect(result).not.toBeNull()
        expect(result.urgency).toBe('alert')
        expect(result.timing.notify).toBe(true)
    })

    // ── Scenarios that should NOT notify ─────────────────────────────────────

    it('ambient benign day has timing.notify === false', () => {
        // Genuinely good conditions → ambient
        const wd = makeWeatherData({
            current: { condition: 'Clear', feelsLike: 20, temp: 20, precipProb: 0.05, windSpeed: 10, humidity: 50 }
        })
        const result = dailyPlanningModule(wd, makeUserContext())
        expect(result).not.toBeNull()
        expect(result.urgency).toBe('ambient')
        expect(result.timing.notify).toBe(false)
    })

    it('useful heat observation has timing.notify === false', () => {
        // feelsLike 30–34 → USEFUL from escalateHeat
        const wd = makeWeatherData({ current: { condition: 'Clear', feelsLike: 31, temp: 30, precipProb: 0.05, windSpeed: 5 } })
        const result = dailyPlanningModule(wd, makeUserContext())
        expect(result).not.toBeNull()
        expect(result.urgency).toBe('useful')
        expect(result.timing.notify).toBe(false)
    })

    it('distant rain (useful, > 6 slots away) has timing.notify === false', () => {
        // Rain only at slot index 8 — no near-term rain
        const distantRain = futureSlot(30 * 60, { pop: 0.8 })
        // Fill 6 clear slots first so firstRainIndex > 6
        const clearSlots = Array.from({ length: 7 }, (_, i) => futureSlot((i + 1) * 60, { pop: 0.05 }))
        const wd = makeWeatherData({
            current: { condition: 'Clear', feelsLike: 18, temp: 18, precipProb: 0.05, windSpeed: 5 },
            hourly: [...clearSlots, distantRain]
        })
        const result = dailyPlanningModule(wd, makeUserContext())
        // May return null (no threshold met) or useful
        if (result !== null) {
            expect(result.urgency).toBe('useful')
            expect(result.timing.notify).toBe(false)
        }
    })
})

// ---------------------------------------------------------------------------
// commuteModule — ALL non-null insights should notify
// ---------------------------------------------------------------------------

describe('commuteModule — timing.notify', () => {

    it('thunderstorm at departure has timing.notify === true', () => {
        const wd = makeWeatherData({ current: { condition: 'Thunderstorm', feelsLike: 20, precipProb: 0.9 } })
        const ctx = makeUserContext({
            routines: { weekday: { departureTime: futureTime(60), outdoorWindows: [] }, weekend: { outdoorWindows: [] } }
        })
        const result = commuteModule(wd, ctx)
        expect(result).not.toBeNull()
        expect(result.timing.notify).toBe(true)
    })

    it('rain at departure has timing.notify === true', () => {
        const departureSlot = futureSlot(30, { pop: 0.85 })
        const wd = makeWeatherData({
            current: { condition: 'Clear', feelsLike: 18, precipProb: 0.1 },
            hourly: [departureSlot]
        })
        const ctx = makeUserContext({
            routines: { weekday: { departureTime: futureTime(60), outdoorWindows: [] }, weekend: { outdoorWindows: [] } }
        })
        const result = commuteModule(wd, ctx)
        expect(result).not.toBeNull()
        expect(result.timing.notify).toBe(true)
    })

    it('extreme heat at departure has timing.notify === true', () => {
        const wd = makeWeatherData({ current: { condition: 'Clear', feelsLike: 41, temp: 40, precipProb: 0.05, windSpeed: 5 } })
        const ctx = makeUserContext({
            routines: { weekday: { departureTime: futureTime(60), outdoorWindows: [] }, weekend: { outdoorWindows: [] } }
        })
        const result = commuteModule(wd, ctx)
        expect(result).not.toBeNull()
        expect(result.timing.notify).toBe(true)
    })

    it('extreme cold at departure has timing.notify === true', () => {
        const wd = makeWeatherData({ current: { condition: 'Clear', feelsLike: -18, temp: -15, precipProb: 0.05, windSpeed: 10 } })
        const ctx = makeUserContext({
            routines: { weekday: { departureTime: futureTime(60), outdoorWindows: [] }, weekend: { outdoorWindows: [] } }
        })
        const result = commuteModule(wd, ctx)
        expect(result).not.toBeNull()
        expect(result.timing.notify).toBe(true)
    })

    it('returns null (benign commute) — no notify concern', () => {
        const wd = makeWeatherData({ current: { condition: 'Clear', feelsLike: 18, temp: 18, precipProb: 0.05, windSpeed: 5 } })
        const ctx = makeUserContext({
            routines: { weekday: { departureTime: futureTime(60), outdoorWindows: [] }, weekend: { outdoorWindows: [] } }
        })
        const result = commuteModule(wd, ctx)
        // Null is the correct output — absence of insight = clear commute
        expect(result).toBeNull()
    })
})

// ---------------------------------------------------------------------------
// activityModule — timing.notify tests
// ---------------------------------------------------------------------------

describe('activityModule — timing.notify', () => {

    function makeActivity(overrides = {}) {
        return {
            activityKey: 'running',
            label: 'Morning Run',
            frequency: 'daily',
            seasonRange: null,
            ...overrides
        }
    }

    it('ALERT (not-recommended, severe) activity insight has timing.notify === true', () => {
        // Extreme heat for running — feelsLike 45 is well past notRecommended threshold
        const wd = makeWeatherData({ current: { condition: 'Clear', feelsLike: 45, temp: 43, humidity: 30, windSpeed: 5, precipProb: 0.05, uvIndex: 2 } })
        const ctx = makeUserContext({ activities: { declared: [makeActivity()] } })
        const results = activityModule(wd, ctx)
        expect(results).not.toBeNull()
        const alerts = results.filter(r => r.urgency === 'alert')
        expect(alerts.length).toBeGreaterThan(0)
        for (const r of alerts) {
            expect(r.timing.notify).toBe(true)
        }
    })

    it('HEADS_UP (not-recommended) activity insight has timing.notify === true', () => {
        // High wind for running — 55 km/h is above marginal threshold
        const wd = makeWeatherData({ current: { condition: 'Clear', feelsLike: 18, temp: 18, humidity: 50, windSpeed: 55, gustSpeed: 65, precipProb: 0.1, uvIndex: 2, visibility: 10 } })
        const ctx = makeUserContext({ activities: { declared: [makeActivity()] } })
        const results = activityModule(wd, ctx)
        expect(results).not.toBeNull()
        const headsUp = results.filter(r => r.urgency === 'heads-up')
        expect(headsUp.length).toBeGreaterThan(0)
        for (const r of headsUp) {
            expect(r.timing.notify).toBe(true)
        }
    })

    it('USEFUL (marginal) activity insight has timing.notify === false', () => {
        // Moderate wind — marginal, not dangerous
        const wd = makeWeatherData({ current: { condition: 'Clear', feelsLike: 18, temp: 18, humidity: 50, windSpeed: 32, gustSpeed: 38, precipProb: 0.1, uvIndex: 2, visibility: 10 } })
        const ctx = makeUserContext({ activities: { declared: [makeActivity()] } })
        const results = activityModule(wd, ctx)
        expect(results).not.toBeNull()
        const useful = results.filter(r => r.urgency === 'useful')
        expect(useful.length).toBeGreaterThan(0)
        for (const r of useful) {
            expect(r.timing.notify).toBe(false)
        }
    })

    it('AMBIENT (good conditions) activity insight has timing.notify === false', () => {
        // Perfect running conditions — all variables within good thresholds:
        //   feelsLike 8–22, humidity < 65, precipitation max 0.0, windSpeed < 25
        // precipProb: 0 → precipitation proxy = 0 (exactly at good.max: 0)
        const wd = makeWeatherData({
            current: {
                condition: 'Clear', feelsLike: 18, temp: 18,
                humidity: 50, windSpeed: 8, gustSpeed: 10,
                precipProb: 0,   // maps to 0 mm/hr — within running good.precipitation.max: 0.0
                uvIndex: 2, visibility: 15
            }
        })
        const ctx = makeUserContext({ activities: { declared: [makeActivity()] } })
        const results = activityModule(wd, ctx)
        expect(results).not.toBeNull()
        expect(results.length).toBeGreaterThan(0)
        for (const r of results) {
            expect(r.urgency).toBe('ambient')
            expect(r.timing.notify).toBe(false)
        }
    })
})

// ---------------------------------------------------------------------------
// routineModule — ALL non-null insights should notify
// ---------------------------------------------------------------------------

describe('routineModule — timing.notify', () => {

    function makeWindow(overrides = {}) {
        // Default: a future window that hasn't passed
        const startMins = 120 // 2 hours from now
        const endMins = 180 // 3 hours from now
        const startH = String(Math.floor((new Date().getHours() + 2) % 24)).padStart(2, '0')
        const endH = String(Math.floor((new Date().getHours() + 3) % 24)).padStart(2, '0')
        return {
            label: 'Morning Walk',
            startTime: `${startH}:00`,
            endTime: `${endH}:00`,
            daysOfWeek: [],
            ...overrides
        }
    }

    it('thunderstorm during window has timing.notify === true', () => {
        const window = makeWindow()
        const ctx = makeUserContext({
            routines: { weekday: { outdoorWindows: [window] }, weekend: { outdoorWindows: [] } }
        })
        const thunderSlot = futureSlot(150, { weather: [{ main: 'Thunderstorm' }] })
        const wd = makeWeatherData({
            current: { condition: 'Clear', feelsLike: 20, precipProb: 0.9, windSpeed: 5 },
            hourly: [thunderSlot]
        })
        const results = routineModule(wd, ctx)
        expect(results).not.toBeNull()
        expect(results.length).toBeGreaterThan(0)
        for (const r of results) {
            expect(r.timing.notify).toBe(true)
        }
    })

    it('rain during window has timing.notify === true', () => {
        const window = makeWindow()
        const ctx = makeUserContext({
            routines: { weekday: { outdoorWindows: [window] }, weekend: { outdoorWindows: [] } }
        })
        const rainSlot = futureSlot(150, { pop: 0.85 })
        const wd = makeWeatherData({
            current: { condition: 'Clear', feelsLike: 18, precipProb: 0.1, windSpeed: 5 },
            hourly: [rainSlot]
        })
        const results = routineModule(wd, ctx)
        expect(results).not.toBeNull()
        expect(results.length).toBeGreaterThan(0)
        for (const r of results) {
            expect(r.timing.notify).toBe(true)
        }
    })

    it('extreme heat during window has timing.notify === true', () => {
        const window = makeWindow()
        const ctx = makeUserContext({
            routines: { weekday: { outdoorWindows: [window] }, weekend: { outdoorWindows: [] } }
        })
        const hotSlot = futureSlot(150, { main: { temp: 41, feels_like: 43, humidity: 30 } })
        const wd = makeWeatherData({
            current: { condition: 'Clear', feelsLike: 41, temp: 40, precipProb: 0.05, windSpeed: 5 },
            hourly: [hotSlot]
        })
        const results = routineModule(wd, ctx)
        expect(results).not.toBeNull()
        expect(results.length).toBeGreaterThan(0)
        for (const r of results) {
            expect(r.timing.notify).toBe(true)
        }
    })

    it('extreme cold during window has timing.notify === true', () => {
        const window = makeWindow()
        const ctx = makeUserContext({
            routines: { weekday: { outdoorWindows: [window] }, weekend: { outdoorWindows: [] } }
        })
        const coldSlot = futureSlot(150, { main: { temp: -18, feels_like: -20, humidity: 60 }, wind: { speed: 5 } })
        const wd = makeWeatherData({
            current: { condition: 'Clear', feelsLike: -18, temp: -16, precipProb: 0.05, windSpeed: 5 },
            hourly: [coldSlot]
        })
        const results = routineModule(wd, ctx)
        expect(results).not.toBeNull()
        expect(results.length).toBeGreaterThan(0)
        for (const r of results) {
            expect(r.timing.notify).toBe(true)
        }
    })
})

// ---------------------------------------------------------------------------
// comfortModule — only ALERT should notify
// ---------------------------------------------------------------------------

describe('comfortModule — timing.notify', () => {

    it('extreme heat-humidity (ALERT) has timing.notify === true', () => {
        // High temp + very high humidity → ALERT
        const wd = makeWeatherData({ current: { condition: 'Clear', feelsLike: 41, temp: 38, humidity: 88, windSpeed: 5, uvIndex: 3, precipProb: 0.1 } })
        const result = comfortModule(wd, makeUserContext())
        expect(result).not.toBeNull()
        expect(result.urgency).toBe('alert')
        expect(result.timing.notify).toBe(true)
    })

    it('dangerous dry heat (ALERT) has timing.notify === true', () => {
        // Extreme dry heat → ALERT
        const wd = makeWeatherData({ current: { condition: 'Clear', feelsLike: 42, temp: 42, humidity: 20, windSpeed: 5, uvIndex: 3, precipProb: 0.05 } })
        const result = comfortModule(wd, makeUserContext())
        expect(result).not.toBeNull()
        expect(result.urgency).toBe('alert')
        expect(result.timing.notify).toBe(true)
    })

    it('very high UV (ALERT) comfort insight has timing.notify === true', () => {
        // UV index >= 8 → ALERT UV comfort insight
        const wd = makeWeatherData({ current: { condition: 'Clear', feelsLike: 22, temp: 22, humidity: 40, windSpeed: 5, uvIndex: 9, precipProb: 0.05 } })
        const result = comfortModule(wd, makeUserContext())
        expect(result).not.toBeNull()
        expect(result.urgency).toBe('alert')
        expect(result.timing.notify).toBe(true)
    })

    it('HEADS_UP comfort insight has timing.notify === false', () => {
        // Oppressive humidity (heads-up tier) — not ALERT
        const wd = makeWeatherData({ current: { condition: 'Clear', feelsLike: 36, temp: 30, humidity: 82, windSpeed: 5, uvIndex: 3, precipProb: 0.1 } })
        const result = comfortModule(wd, makeUserContext())
        expect(result).not.toBeNull()
        expect(result.urgency).toBe('heads-up')
        expect(result.timing.notify).toBe(false)
    })

    it('USEFUL comfort insight has timing.notify === false', () => {
        // Warm + muggy but not dangerous
        const wd = makeWeatherData({ current: { condition: 'Clear', feelsLike: 28, temp: 26, humidity: 75, windSpeed: 5, uvIndex: 3, precipProb: 0.1 } })
        const result = comfortModule(wd, makeUserContext())
        // May produce useful or null — only check when non-null
        if (result !== null && result.urgency === 'useful') {
            expect(result.timing.notify).toBe(false)
        }
    })
})

// ---------------------------------------------------------------------------
// uvModule — only ALERT should notify
// ---------------------------------------------------------------------------

describe('uvModule — timing.notify', () => {

    it('UV ALERT (index >= 8) has timing.notify === true', () => {
        const wd = makeWeatherData({ current: { condition: 'Clear', uvIndex: 9 } })
        const result = uvModule(wd, makeUserContext())
        expect(result).not.toBeNull()
        expect(result.urgency).toBe('alert')
        expect(result.timing.notify).toBe(true)
    })

    it('UV HEADS_UP (index 6-7) has timing.notify === false', () => {
        const wd = makeWeatherData({ current: { condition: 'Clear', uvIndex: 7 } })
        const result = uvModule(wd, makeUserContext())
        expect(result).not.toBeNull()
        expect(result.urgency).toBe('heads-up')
        expect(result.timing.notify).toBe(false)
    })

    it('UV USEFUL (index 3-5) has timing.notify === false', () => {
        const wd = makeWeatherData({ current: { condition: 'Clear', uvIndex: 4 } })
        const result = uvModule(wd, makeUserContext())
        expect(result).not.toBeNull()
        expect(result.urgency).toBe('useful')
        expect(result.timing.notify).toBe(false)
    })
})

// ---------------------------------------------------------------------------
// airQualityModule — only ALERT should notify
// ---------------------------------------------------------------------------

describe('airQualityModule — timing.notify', () => {

    it('ALERT air quality (AQI >= 150) has timing.notify === true', () => {
        const wd = makeWeatherData({ current: { condition: 'Haze', airQuality: 180 } })
        const result = airQualityModule(wd, makeUserContext())
        expect(result).not.toBeNull()
        expect(result.urgency).toBe('alert')
        expect(result.timing.notify).toBe(true)
    })

    it('HEADS_UP air quality (AQI 100-149) has timing.notify === false', () => {
        const wd = makeWeatherData({ current: { condition: 'Haze', airQuality: 120 } })
        const result = airQualityModule(wd, makeUserContext())
        expect(result).not.toBeNull()
        expect(result.urgency).toBe('heads-up')
        expect(result.timing.notify).toBe(false)
    })

    it('USEFUL air quality (AQI 51-99) has timing.notify === false', () => {
        const wd = makeWeatherData({ current: { condition: 'Haze', airQuality: 75 } })
        const result = airQualityModule(wd, makeUserContext())
        expect(result).not.toBeNull()
        expect(result.urgency).toBe('useful')
        expect(result.timing.notify).toBe(false)
    })
})

// ---------------------------------------------------------------------------
// pollenModule — only ALERT should notify
// ---------------------------------------------------------------------------

describe('pollenModule — timing.notify', () => {

    it('ALERT pollen (very-high) has timing.notify === true', () => {
        const wd = makeWeatherData({ current: { condition: 'Clear', pollenLevel: 'very-high' } })
        const result = pollenModule(wd, makeUserContext())
        expect(result).not.toBeNull()
        expect(result.urgency).toBe('alert')
        expect(result.timing.notify).toBe(true)
    })

    it('HEADS_UP pollen (high, standard user) has timing.notify === false', () => {
        const wd = makeWeatherData({ current: { condition: 'Clear', pollenLevel: 'high' } })
        const result = pollenModule(wd, makeUserContext())
        expect(result).not.toBeNull()
        expect(result.urgency).toBe('heads-up')
        expect(result.timing.notify).toBe(false)
    })

    it('pollen-sensitive HEADS_UP (moderate) has timing.notify === true', () => {
        const wd = makeWeatherData({ current: { condition: 'Clear', pollenLevel: 'moderate' } })
        const ctx = makeUserContext({ sensitivities: { pollen: true } })
        const result = pollenModule(wd, ctx)
        expect(result).not.toBeNull()
        expect(result.urgency).toBe('heads-up')
        expect(result.timing.notify).toBe(true)
    })
})
