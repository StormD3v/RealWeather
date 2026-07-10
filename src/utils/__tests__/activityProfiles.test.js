/**
 * activityProfiles.test.js
 * Unit tests for src/utils/activityProfiles.js — Phase 1, Task 5.4
 */

import { describe, it, expect } from 'vitest'
import {
    ALL_ACTIVITY_KEYS,
    ACTIVITY_PROFILES,
    getActivityProfile
} from '@/utils/activityProfiles.js'

describe('activityProfiles', () => {

    // ---------------------------------------------------------------------------
    // ALL_ACTIVITY_KEYS
    // ---------------------------------------------------------------------------

    describe('ALL_ACTIVITY_KEYS', () => {
        it('contains exactly 10 keys', () => {
            expect(ALL_ACTIVITY_KEYS).toHaveLength(10)
        })

        it('contains all expected activity keys', () => {
            const expected = [
                'running', 'cycling', 'hiking', 'gardening', 'photography',
                'golf', 'outdoor-dining', 'dog-walking', 'swimming', 'sailing'
            ]
            for (const key of expected) {
                expect(ALL_ACTIVITY_KEYS).toContain(key)
            }
        })
    })

    // ---------------------------------------------------------------------------
    // ACTIVITY_PROFILES completeness
    // ---------------------------------------------------------------------------

    describe('ACTIVITY_PROFILES — completeness', () => {
        it('every ActivityKey has a defined profile', () => {
            for (const key of ALL_ACTIVITY_KEYS) {
                expect(ACTIVITY_PROFILES[key], `missing profile for "${key}"`).toBeDefined()
            }
        })

        it('every profile has a non-empty primaryVariables array', () => {
            for (const key of ALL_ACTIVITY_KEYS) {
                const profile = ACTIVITY_PROFILES[key]
                expect(Array.isArray(profile.primaryVariables), `${key}.primaryVariables not array`).toBe(true)
                expect(profile.primaryVariables.length, `${key}.primaryVariables is empty`).toBeGreaterThan(0)
            }
        })

        it('every profile has thresholds.good', () => {
            for (const key of ALL_ACTIVITY_KEYS) {
                expect(ACTIVITY_PROFILES[key].thresholds.good, `${key} missing good`).toBeDefined()
            }
        })

        it('every profile has thresholds.marginal', () => {
            for (const key of ALL_ACTIVITY_KEYS) {
                expect(ACTIVITY_PROFILES[key].thresholds.marginal, `${key} missing marginal`).toBeDefined()
            }
        })

        it('every profile has thresholds.notRecommended', () => {
            for (const key of ALL_ACTIVITY_KEYS) {
                expect(ACTIVITY_PROFILES[key].thresholds.notRecommended, `${key} missing notRecommended`).toBeDefined()
            }
        })
    })

    // ---------------------------------------------------------------------------
    // Threshold non-overlap: good max < notRecommended min (for bounded vars)
    // ---------------------------------------------------------------------------

    describe('ACTIVITY_PROFILES — threshold non-overlap', () => {
        it('good.max and notRecommended.min do not overlap for each variable in each profile', () => {
            for (const key of ALL_ACTIVITY_KEYS) {
                const { good, notRecommended } = ACTIVITY_PROFILES[key].thresholds

                for (const variable of Object.keys(good)) {
                    const goodThreshold = good[variable]
                    const badThreshold = notRecommended[variable]
                    if (!badThreshold) continue // variable not constrained in notRecommended

                    // If good has a max and notRecommended has a min for the same variable,
                    // the max must be strictly less than the min (no overlap)
                    if (goodThreshold.max != null && badThreshold.min != null) {
                        expect(
                            goodThreshold.max,
                            `${key}.${variable}: good.max (${goodThreshold.max}) must be < notRecommended.min (${badThreshold.min})`
                        ).toBeLessThan(badThreshold.min)
                    }

                    // If good has a min and notRecommended has a max for the same variable,
                    // the good.min must be strictly greater than notRecommended.max
                    if (goodThreshold.min != null && badThreshold.max != null) {
                        expect(
                            goodThreshold.min,
                            `${key}.${variable}: good.min (${goodThreshold.min}) must be > notRecommended.max (${badThreshold.max})`
                        ).toBeGreaterThan(badThreshold.max)
                    }
                }
            }
        })
    })

    // ---------------------------------------------------------------------------
    // getActivityProfile
    // ---------------------------------------------------------------------------

    describe('getActivityProfile()', () => {
        it('returns the running profile for "running"', () => {
            const profile = getActivityProfile('running')
            expect(profile).toBeDefined()
            expect(profile.primaryVariables).toContain('feelsLike')
        })

        it('returns the cycling profile for "cycling"', () => {
            const profile = getActivityProfile('cycling')
            expect(profile).toBeDefined()
            expect(profile.primaryVariables).toContain('windSpeed')
        })

        it('returns undefined for an unknown key', () => {
            expect(getActivityProfile('teleportation')).toBeUndefined()
        })

        it('returns undefined for empty string', () => {
            expect(getActivityProfile('')).toBeUndefined()
        })

        it('does not throw for any string input', () => {
            expect(() => getActivityProfile('anything')).not.toThrow()
            expect(() => getActivityProfile('')).not.toThrow()
            expect(() => getActivityProfile(null)).not.toThrow()
            expect(() => getActivityProfile(undefined)).not.toThrow()
        })

        it('returns a profile with all three threshold keys for every valid key', () => {
            for (const key of ALL_ACTIVITY_KEYS) {
                const profile = getActivityProfile(key)
                expect(profile.thresholds.good).toBeDefined()
                expect(profile.thresholds.marginal).toBeDefined()
                expect(profile.thresholds.notRecommended).toBeDefined()
            }
        })
    })
})
