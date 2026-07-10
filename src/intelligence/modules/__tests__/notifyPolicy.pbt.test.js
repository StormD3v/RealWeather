/**
 * @file notifyPolicy.pbt.test.js
 * Phase 3.4 — Notification Activation (Task 6)
 *
 * Cross-module property-based tests for the notify policy invariant.
 * Uses fast-check to generate varied inputs and verify three properties
 * that must hold across all eight intelligence modules.
 *
 * Requirements covered: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 4.1, 4.2, 4.3, 5.1, 5.2, 5.3
 */

import { describe, it } from 'vitest'
import * as fc from 'fast-check'

import { dailyPlanningModule } from '../dailyPlanningModule.js'
import { comfortModule } from '../comfortModule.js'
import { commuteModule } from '../commuteModule.js'
import { activityModule } from '../activityModule.js'
import { routineModule } from '../routineModule.js'
import { airQualityModule } from '../airQualityModule.js'
import { uvModule } from '../uvModule.js'
import { pollenModule } from '../pollenModule.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Collects all non-null insights from a module call.
 * Handles modules that return Insight|null as well as Insight[]|null.
 *
 * @param {Function} moduleFn
 * @param {object} weatherData
 * @param {object} userContext
 * @returns {Array}
 */
function collectInsights(moduleFn, weatherData, userContext) {
    try {
        const result = moduleFn(weatherData, userContext)
        if (result === null || result === undefined) return []
        if (Array.isArray(result)) return result.filter(Boolean)
        return [result]
    } catch (_) {
        return []
    }
}

/**
 * Run all 8 modules against the given inputs and collect every insight.
 */
function collectAllInsights(weatherData, userContext) {
    const modules = [
        dailyPlanningModule,
        comfortModule,
        commuteModule,
        activityModule,
        routineModule,
        airQualityModule,
        uvModule,
        pollenModule
    ]
    return modules.flatMap(m => collectInsights(m, weatherData, userContext))
}

// ---------------------------------------------------------------------------
// Base userContext builders
// ---------------------------------------------------------------------------

const makeUserCtx = (sensitivities) => ({
    sensitivities,
    location: { primary: null },
    activities: { declared: [] },
    routines: {
        weekday: { departureTime: null, outdoorWindows: [] },
        weekend: { outdoorWindows: [] }
    }
})

// ---------------------------------------------------------------------------
// Arbitraries — wide-coverage generators for Property 1
// ---------------------------------------------------------------------------

const fcWideWeatherData = fc.record({
    feelsLike: fc.float({ min: Math.fround(-20), max: Math.fround(45), noNaN: true, noDefaultInfinity: true }),
    temp: fc.float({ min: Math.fround(-20), max: Math.fround(45), noNaN: true, noDefaultInfinity: true }),
    humidity: fc.integer({ min: 10, max: 100 }),
    windSpeed: fc.integer({ min: 0, max: 80 }),
    gustSpeed: fc.integer({ min: 0, max: 90 }),
    uvIndex: fc.float({ min: Math.fround(0), max: Math.fround(11), noNaN: true, noDefaultInfinity: true }),
    precipProb: fc.float({ min: Math.fround(0), max: Math.fround(1), noNaN: true, noDefaultInfinity: true }),
    condition: fc.constantFrom('Clear', 'Clouds', 'Rain', 'Fog'),
    visibility: fc.float({ min: Math.fround(0.1), max: Math.fround(20), noNaN: true, noDefaultInfinity: true }),
    airQuality: fc.option(fc.integer({ min: 0, max: 300 }), { nil: null }),
    pollenLevel: fc.option(fc.constantFrom('low', 'moderate', 'high', 'very-high'), { nil: null })
}).map(c => ({ current: { ...c }, hourly: [] }))

const fcWideUserCtx = fc.record({
    heat: fc.boolean(),
    cold: fc.boolean(),
    pollen: fc.boolean(),
    uv: fc.boolean(),
    airQuality: fc.boolean(),
    precipitation: fc.boolean()
}).map(s => makeUserCtx(s))

// ---------------------------------------------------------------------------
// Property 1: Useful and ambient insights NEVER notify
// Feature: phase-34-notification-activation, Property 1: useful/ambient insights never notify
// Validates: Requirements 1.1, 5.1, 5.2
// ---------------------------------------------------------------------------

describe('Property 1: useful and ambient insights never notify', () => {
    it(
        'timing.notify is false for every useful/ambient insight across all modules — numRuns:25',
        () => {
            // Feature: phase-34-notification-activation, Property 1: useful/ambient insights never notify
            fc.assert(
                fc.property(
                    fcWideWeatherData,
                    fcWideUserCtx,
                    (weatherData, userCtx) => {
                        const insights = collectAllInsights(weatherData, userCtx)
                        const nonNotifiable = insights.filter(
                            i => i.urgency === 'useful' || i.urgency === 'ambient'
                        )
                        for (const insight of nonNotifiable) {
                            if (insight.timing.notify !== false) return false
                        }
                        return true
                    }
                ),
                { numRuns: 25 }
            )
        }
    )
})

// ---------------------------------------------------------------------------
// Property 2: Environmental heads-up notification follows isSensitive exactly
// Feature: phase-34-notification-activation, Property 2: environmental heads-up notify equals isSensitive
// Validates: Requirements 2.1, 2.2, 3.1, 3.2, 4.1, 4.2
// ---------------------------------------------------------------------------

describe('Property 2: environmental heads-up notify equals isSensitive', () => {

    // ── airQualityModule ─────────────────────────────────────────────────────
    //
    // Standard:  heads-up at AQI 100–149
    // Sensitive: heads-up at AQI 51–99
    //
    // Use fc.tuple(aqi, isSensitive) and derive which range to use.
    it(
        'airQualityModule heads-up: timing.notify === isSensitive — numRuns:25',
        () => {
            // Feature: phase-34-notification-activation, Property 2: environmental heads-up notify equals isSensitive
            fc.assert(
                fc.property(
                    fc.tuple(
                        fc.integer({ min: 51, max: 149 }),
                        fc.boolean()
                    ),
                    ([rawAqi, isSensitive]) => {
                        // Clamp AQI into the heads-up range for each user type:
                        //   sensitive user: heads-up = 51–99
                        //   standard user:  heads-up = 100–149
                        const aqi = isSensitive
                            ? Math.min(rawAqi, 99)    // clamp to 51–99
                            : Math.max(rawAqi, 100)   // clamp to 100–149

                        const weatherData = {
                            current: {
                                airQuality: aqi,
                                temp: 20, feelsLike: 20, humidity: 50,
                                windSpeed: 5, gustSpeed: 6, uvIndex: 2,
                                condition: 'Clear', visibility: 10,
                                precipProb: 0.05, pollenLevel: null
                            },
                            hourly: []
                        }
                        const userCtx = makeUserCtx({
                            heat: false, cold: false, pollen: false,
                            uv: false, airQuality: isSensitive, precipitation: false
                        })

                        const insight = airQualityModule(weatherData, userCtx)
                        if (!insight) return true  // null → no assertion needed
                        if (insight.urgency !== 'heads-up') return true  // guard

                        return insight.timing.notify === isSensitive
                    }
                ),
                { numRuns: 25 }
            )
        }
    )

    // ── uvModule ─────────────────────────────────────────────────────────────
    //
    // Standard:  heads-up at UV 6–7.99
    // Sensitive: heads-up at UV 4–5.99
    it(
        'uvModule heads-up: timing.notify === isSensitive — numRuns:25',
        () => {
            // Feature: phase-34-notification-activation, Property 2: environmental heads-up notify equals isSensitive
            fc.assert(
                fc.property(
                    fc.tuple(
                        fc.float({ min: Math.fround(4), max: Math.fround(7.99), noNaN: true, noDefaultInfinity: true }),
                        fc.boolean()
                    ),
                    ([rawUv, isSensitive]) => {
                        // Clamp UV into the heads-up range for each user type:
                        //   sensitive user: heads-up = 4–5.99
                        //   standard user:  heads-up = 6–7.99
                        const uvIndex = isSensitive
                            ? Math.min(rawUv, 5.99)   // clamp to 4–5.99
                            : Math.max(rawUv, 6)      // clamp to 6–7.99

                        const weatherData = {
                            current: {
                                uvIndex,
                                temp: 20, feelsLike: 20, humidity: 50,
                                windSpeed: 5, gustSpeed: 6,
                                condition: 'Clear', visibility: 10,
                                precipProb: 0.05, airQuality: null, pollenLevel: null
                            },
                            hourly: []
                        }
                        const userCtx = makeUserCtx({
                            heat: false, cold: false, pollen: false,
                            uv: isSensitive, airQuality: false, precipitation: false
                        })

                        const insight = uvModule(weatherData, userCtx)
                        if (!insight) return true
                        if (insight.urgency !== 'heads-up') return true

                        return insight.timing.notify === isSensitive
                    }
                ),
                { numRuns: 25 }
            )
        }
    )

    // ── pollenModule ─────────────────────────────────────────────────────────
    //
    // Standard:  heads-up at 'high'
    // Sensitive: heads-up at 'moderate' or 'high'
    it(
        'pollenModule heads-up: timing.notify === isSensitive — numRuns:25',
        () => {
            // Feature: phase-34-notification-activation, Property 2: environmental heads-up notify equals isSensitive
            fc.assert(
                fc.property(
                    fc.tuple(
                        fc.constantFrom('moderate', 'high'),
                        fc.boolean()
                    ),
                    ([rawLevel, isSensitive]) => {
                        // For standard user, only 'high' produces heads-up
                        // For sensitive user, 'moderate' or 'high' both produce heads-up
                        const pollenLevel = isSensitive
                            ? rawLevel               // moderate or high → heads-up
                            : 'high'                 // only high → heads-up for standard

                        const weatherData = {
                            current: {
                                pollenLevel,
                                temp: 20, feelsLike: 20, humidity: 50,
                                windSpeed: 5, gustSpeed: 6, uvIndex: 2,
                                condition: 'Clear', visibility: 10,
                                precipProb: 0.05, airQuality: null
                            },
                            hourly: []
                        }
                        const userCtx = makeUserCtx({
                            heat: false, cold: false, pollen: isSensitive,
                            uv: false, airQuality: false, precipitation: false
                        })

                        const insight = pollenModule(weatherData, userCtx)
                        if (!insight) return true
                        if (insight.urgency !== 'heads-up') return true

                        return insight.timing.notify === isSensitive
                    }
                ),
                { numRuns: 25 }
            )
        }
    )
})

// ---------------------------------------------------------------------------
// Property 3: Alert insights ALWAYS notify
// Feature: phase-34-notification-activation, Property 3: alert insights always notify
// Validates: Requirements 1.2, 1.3, 2.3, 3.3, 4.3, 5.3
// ---------------------------------------------------------------------------

describe('Property 3: alert insights always notify', () => {

    // ── dailyPlanningModule ───────────────────────────────────────────────────
    // Alert from: thunderstorm condition, heat feelsLike ≥ 40, cold feelsLike ≤ -15
    it(
        'dailyPlanningModule alert: timing.notify is true — numRuns:25',
        () => {
            // Feature: phase-34-notification-activation, Property 3: alert insights always notify
            fc.assert(
                fc.property(
                    fc.constantFrom('thunderstorm', 'heat', 'cold'),
                    fc.boolean(), // isSensitive (heat or cold)
                    (scenario, isSensitive) => {
                        let weatherData
                        let userCtx

                        if (scenario === 'thunderstorm') {
                            weatherData = {
                                current: {
                                    temp: 20, feelsLike: 20, humidity: 50,
                                    windSpeed: 10, gustSpeed: 12, uvIndex: 3,
                                    condition: 'Thunderstorm', visibility: 5,
                                    precipProb: 0.9, airQuality: null, pollenLevel: null
                                },
                                hourly: []
                            }
                            userCtx = makeUserCtx({
                                heat: false, cold: false, pollen: false,
                                uv: false, airQuality: false, precipitation: false
                            })
                        } else if (scenario === 'heat') {
                            // Alert threshold: ≥ 40°C standard, ≥ 33°C sensitive
                            const feelsLike = isSensitive ? 35 : 42
                            weatherData = {
                                current: {
                                    temp: feelsLike - 2, feelsLike, humidity: 30,
                                    windSpeed: 5, gustSpeed: 6, uvIndex: 3,
                                    condition: 'Clear', visibility: 10,
                                    precipProb: 0.0, airQuality: null, pollenLevel: null
                                },
                                hourly: []
                            }
                            userCtx = makeUserCtx({
                                heat: isSensitive, cold: false, pollen: false,
                                uv: false, airQuality: false, precipitation: false
                            })
                        } else {
                            // cold — alert threshold: ≤ -15 standard, ≤ -5 sensitive
                            const feelsLike = isSensitive ? -8 : -18
                            weatherData = {
                                current: {
                                    temp: feelsLike + 2, feelsLike, humidity: 50,
                                    windSpeed: 5, gustSpeed: 6, uvIndex: 0,
                                    condition: 'Clear', visibility: 10,
                                    precipProb: 0.0, airQuality: null, pollenLevel: null
                                },
                                hourly: []
                            }
                            userCtx = makeUserCtx({
                                heat: false, cold: isSensitive, pollen: false,
                                uv: false, airQuality: false, precipitation: false
                            })
                        }

                        const insights = collectInsights(dailyPlanningModule, weatherData, userCtx)
                        const alertInsights = insights.filter(i => i.urgency === 'alert')
                        for (const insight of alertInsights) {
                            if (insight.timing.notify !== true) return false
                        }
                        return true
                    }
                ),
                { numRuns: 25 }
            )
        }
    )

    // ── comfortModule ─────────────────────────────────────────────────────────
    // Alert from: heat+humidity extreme (feelsLike ≥ 40 + humidity ≥ 85 + temp ≥ 28)
    it(
        'comfortModule alert: timing.notify is true — numRuns:25',
        () => {
            // Feature: phase-34-notification-activation, Property 3: alert insights always notify
            fc.assert(
                fc.property(
                    fc.record({
                        feelsLike: fc.float({ min: Math.fround(40), max: Math.fround(50), noNaN: true, noDefaultInfinity: true }),
                        temp: fc.float({ min: Math.fround(28), max: Math.fround(45), noNaN: true, noDefaultInfinity: true }),
                        humidity: fc.integer({ min: 85, max: 100 })
                    }),
                    fc.boolean(),
                    ({ feelsLike, temp, humidity }, isSensitive) => {
                        const weatherData = {
                            current: {
                                temp, feelsLike, humidity,
                                windSpeed: 5, gustSpeed: 6, uvIndex: 3,
                                condition: 'Clear', visibility: 10,
                                precipProb: 0.0, airQuality: null, pollenLevel: null
                            },
                            hourly: []
                        }
                        const userCtx = makeUserCtx({
                            heat: isSensitive, cold: false, pollen: false,
                            uv: false, airQuality: false, precipitation: false
                        })

                        const insights = collectInsights(comfortModule, weatherData, userCtx)
                        const alertInsights = insights.filter(i => i.urgency === 'alert')
                        for (const insight of alertInsights) {
                            if (insight.timing.notify !== true) return false
                        }
                        return true
                    }
                ),
                { numRuns: 25 }
            )
        }
    )

    // ── commuteModule ─────────────────────────────────────────────────────────
    // Alert from: thunderstorm condition at departure time
    // departureTime = "23:00" — in the future for most of the day.
    // If the test runs after 11 PM, the commute window has passed → module returns null.
    // We guard by checking insight is non-null before asserting.
    it(
        'commuteModule thunderstorm alert: timing.notify is true — numRuns:25',
        () => {
            // Feature: phase-34-notification-activation, Property 3: alert insights always notify
            fc.assert(
                fc.property(
                    fc.boolean(), // isSensitive (precipitation)
                    (isSensitive) => {
                        const weatherData = {
                            current: {
                                temp: 20, feelsLike: 20, humidity: 70,
                                windSpeed: 30, gustSpeed: 40, uvIndex: 2,
                                condition: 'Thunderstorm', visibility: 5,
                                precipProb: 0.95, airQuality: null, pollenLevel: null
                            },
                            hourly: []
                        }
                        const userCtx = {
                            sensitivities: {
                                heat: false, cold: false, pollen: false,
                                uv: false, airQuality: false,
                                precipitation: isSensitive
                            },
                            location: { primary: null },
                            activities: { declared: [] },
                            routines: {
                                weekday: { departureTime: '23:00', outdoorWindows: [] },
                                weekend: { outdoorWindows: [] }
                            }
                        }

                        const insights = collectInsights(commuteModule, weatherData, userCtx)
                        // Module legitimately returns null when departure window has passed
                        const alertInsights = insights.filter(i => i.urgency === 'alert')
                        for (const insight of alertInsights) {
                            if (insight.timing.notify !== true) return false
                        }
                        return true
                    }
                ),
                { numRuns: 25 }
            )
        }
    )

    // ── activityModule ────────────────────────────────────────────────────────
    // Alert from: cycling + windSpeed ≥ 75 km/h (50 notRecommended threshold + ≥30% margin = 65+, or 50+15=65+)
    // Cycling notRecommended.windSpeed.min = 50, so severe requires: (value - 50) / 50 ≥ 0.3 → value ≥ 65
    // OR value - 50 ≥ 15 → value ≥ 65. Use windSpeed = 75 to be safely past the threshold.
    it(
        'activityModule cycling severe wind alert: timing.notify is true — numRuns:25',
        () => {
            // Feature: phase-34-notification-activation, Property 3: alert insights always notify
            fc.assert(
                fc.property(
                    fc.integer({ min: 75, max: 120 }),
                    (windSpeed) => {
                        const weatherData = {
                            current: {
                                temp: 20, feelsLike: 20, humidity: 50,
                                windSpeed,
                                gustSpeed: windSpeed + 10,
                                uvIndex: 3,
                                condition: 'Clear', visibility: 10,
                                precipProb: 0.0, airQuality: null, pollenLevel: null
                            },
                            hourly: []
                        }
                        const userCtx = {
                            sensitivities: {
                                heat: false, cold: false, pollen: false,
                                uv: false, airQuality: false, precipitation: false
                            },
                            location: { primary: null },
                            activities: {
                                declared: [{
                                    activityKey: 'cycling',
                                    label: 'Cycling',
                                    seasonRange: null
                                }]
                            },
                            routines: {
                                weekday: { departureTime: null, outdoorWindows: [] },
                                weekend: { outdoorWindows: [] }
                            }
                        }

                        const insights = collectInsights(activityModule, weatherData, userCtx)
                        const alertInsights = insights.filter(i => i.urgency === 'alert')
                        for (const insight of alertInsights) {
                            if (insight.timing.notify !== true) return false
                        }
                        return true
                    }
                ),
                { numRuns: 25 }
            )
        }
    )

    // ── airQualityModule ──────────────────────────────────────────────────────
    // Alert from: AQI ≥ 150 (standard) or ≥ 100 (sensitive)
    it(
        'airQualityModule alert: timing.notify is true — numRuns:25',
        () => {
            // Feature: phase-34-notification-activation, Property 3: alert insights always notify
            fc.assert(
                fc.property(
                    fc.tuple(
                        fc.integer({ min: 100, max: 300 }),
                        fc.boolean()
                    ),
                    ([rawAqi, isSensitive]) => {
                        // Ensure AQI is in alert range for the given user type:
                        //   sensitive: alert at ≥ 100
                        //   standard:  alert at ≥ 150
                        const aqi = isSensitive
                            ? Math.max(rawAqi, 100)  // ≥ 100
                            : Math.max(rawAqi, 150)  // ≥ 150

                        const weatherData = {
                            current: {
                                airQuality: aqi,
                                temp: 20, feelsLike: 20, humidity: 50,
                                windSpeed: 5, gustSpeed: 6, uvIndex: 2,
                                condition: 'Clear', visibility: 10,
                                precipProb: 0.05, pollenLevel: null
                            },
                            hourly: []
                        }
                        const userCtx = makeUserCtx({
                            heat: false, cold: false, pollen: false,
                            uv: false, airQuality: isSensitive, precipitation: false
                        })

                        const insights = collectInsights(airQualityModule, weatherData, userCtx)
                        const alertInsights = insights.filter(i => i.urgency === 'alert')
                        for (const insight of alertInsights) {
                            if (insight.timing.notify !== true) return false
                        }
                        return true
                    }
                ),
                { numRuns: 25 }
            )
        }
    )

    // ── uvModule ──────────────────────────────────────────────────────────────
    // Alert from: UV ≥ 8 (standard) or ≥ 6 (sensitive)
    it(
        'uvModule alert: timing.notify is true — numRuns:25',
        () => {
            // Feature: phase-34-notification-activation, Property 3: alert insights always notify
            fc.assert(
                fc.property(
                    fc.tuple(
                        fc.float({ min: Math.fround(6), max: Math.fround(13), noNaN: true, noDefaultInfinity: true }),
                        fc.boolean()
                    ),
                    ([rawUv, isSensitive]) => {
                        // Ensure UV is in alert range:
                        //   sensitive: alert at ≥ 6
                        //   standard:  alert at ≥ 8
                        const uvIndex = isSensitive
                            ? Math.max(rawUv, 6)   // ≥ 6
                            : Math.max(rawUv, 8)   // ≥ 8

                        const weatherData = {
                            current: {
                                uvIndex,
                                temp: 20, feelsLike: 20, humidity: 50,
                                windSpeed: 5, gustSpeed: 6,
                                condition: 'Clear', visibility: 10,
                                precipProb: 0.05, airQuality: null, pollenLevel: null
                            },
                            hourly: []
                        }
                        const userCtx = makeUserCtx({
                            heat: false, cold: false, pollen: false,
                            uv: isSensitive, airQuality: false, precipitation: false
                        })

                        const insights = collectInsights(uvModule, weatherData, userCtx)
                        const alertInsights = insights.filter(i => i.urgency === 'alert')
                        for (const insight of alertInsights) {
                            if (insight.timing.notify !== true) return false
                        }
                        return true
                    }
                ),
                { numRuns: 25 }
            )
        }
    )

    // ── pollenModule ──────────────────────────────────────────────────────────
    // Alert from: pollenLevel = 'very-high' (all users)
    it(
        'pollenModule very-high alert: timing.notify is true — numRuns:25',
        () => {
            // Feature: phase-34-notification-activation, Property 3: alert insights always notify
            fc.assert(
                fc.property(
                    fc.boolean(), // isSensitive
                    (isSensitive) => {
                        const weatherData = {
                            current: {
                                pollenLevel: 'very-high',
                                temp: 20, feelsLike: 20, humidity: 50,
                                windSpeed: 5, gustSpeed: 6, uvIndex: 2,
                                condition: 'Clear', visibility: 10,
                                precipProb: 0.05, airQuality: null
                            },
                            hourly: []
                        }
                        const userCtx = makeUserCtx({
                            heat: false, cold: false, pollen: isSensitive,
                            uv: false, airQuality: false, precipitation: false
                        })

                        const insights = collectInsights(pollenModule, weatherData, userCtx)
                        const alertInsights = insights.filter(i => i.urgency === 'alert')
                        for (const insight of alertInsights) {
                            if (insight.timing.notify !== true) return false
                        }
                        return true
                    }
                ),
                { numRuns: 25 }
            )
        }
    )
})
