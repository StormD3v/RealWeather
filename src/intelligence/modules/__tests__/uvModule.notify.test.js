/**
 * uvModule.notify.test.js
 * Phase 3.4 — Notification Activation (Task 3)
 *
 * Validates that timing.notify is set correctly across all UV urgency branches:
 *   - HEADS_UP: notify === isSensitive (true for sensitive users, false for standard)
 *   - ALERT:    notify === true (always)
 *   - USEFUL:   notify === false (defaults to false, no explicit field needed)
 *
 * UV thresholds (from getUVThresholds):
 *   Standard user:  useful≥3, heads-up≥6, alert≥8
 *   Sensitive user: useful≥2, heads-up≥4, alert≥6
 *
 * Requirements covered: 3.1, 3.2, 3.3, 3.4
 */

import { describe, it, expect } from 'vitest'
import { uvModule } from '../uvModule.js'

// ---------------------------------------------------------------------------
// Minimal builders
// ---------------------------------------------------------------------------

const makeWeatherData = (uvIndex) => ({
    current: {
        uvIndex,
        temp: 22,
        feelsLike: 22,
        humidity: 50,
        windSpeed: 10,
        gustSpeed: 12,
        condition: 'Clear',
        visibility: 10,
        precipProb: 0.1,
        airQuality: null,
        pollenLevel: null
    },
    hourly: []
})

const makeCtx = (uvSensitive) => ({
    sensitivities: {
        heat: false,
        cold: false,
        pollen: false,
        uv: uvSensitive,
        airQuality: false,
        precipitation: false
    },
    location: { primary: null }
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('uvModule — timing.notify flag', () => {
    // Test 1: Standard user, UV=7 → heads-up → notify false
    it('standard user, UV=7 (heads-up): timing.notify is false', () => {
        const result = uvModule(makeWeatherData(7), makeCtx(false))
        expect(result).not.toBeNull()
        expect(result.urgency).toBe('heads-up')
        expect(result.timing.notify).toBe(false)
    })

    // Test 2: Sensitive user, UV=5 → heads-up → notify true
    it('sensitive user, UV=5 (heads-up): timing.notify is true', () => {
        const result = uvModule(makeWeatherData(5), makeCtx(true))
        expect(result).not.toBeNull()
        expect(result.urgency).toBe('heads-up')
        expect(result.timing.notify).toBe(true)
    })

    // Test 3: Standard user, UV=9 → alert → notify true
    it('standard user, UV=9 (alert): timing.notify is true', () => {
        const result = uvModule(makeWeatherData(9), makeCtx(false))
        expect(result).not.toBeNull()
        expect(result.urgency).toBe('alert')
        expect(result.timing.notify).toBe(true)
    })

    // Test 4: Sensitive user, UV=7 → alert (≥6 for sensitive) → notify true
    it('sensitive user, UV=7 (alert for sensitive ≥6): timing.notify is true', () => {
        const result = uvModule(makeWeatherData(7), makeCtx(true))
        expect(result).not.toBeNull()
        expect(result.urgency).toBe('alert')
        expect(result.timing.notify).toBe(true)
    })

    // Test 5: Standard user, UV=4 → useful → notify false
    it('standard user, UV=4 (useful): timing.notify is false', () => {
        const result = uvModule(makeWeatherData(4), makeCtx(false))
        expect(result).not.toBeNull()
        expect(result.urgency).toBe('useful')
        expect(result.timing.notify).toBe(false)
    })
})
