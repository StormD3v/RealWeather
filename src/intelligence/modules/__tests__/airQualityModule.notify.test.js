/**
 * airQualityModule.notify.test.js
 * Phase 3.4 — Notification Activation (Task 2.1)
 *
 * Validates that timing.notify is set correctly across all AQI urgency branches:
 *   - HEADS_UP: notify === isSensitive (true for sensitive users, false for standard)
 *   - ALERT:    notify === true (always)
 *   - USEFUL:   notify === false (defaults to false, no explicit field needed)
 *
 * Requirements covered: 2.1, 2.2, 2.3, 2.4
 */

import { describe, it, expect } from 'vitest'
import { airQualityModule } from '../airQualityModule.js'

// ---------------------------------------------------------------------------
// Minimal builders (as specified in the task)
// ---------------------------------------------------------------------------

const makeWeatherData = (airQuality) => ({
    current: {
        airQuality,
        temp: 20,
        feelsLike: 20,
        humidity: 50,
        windSpeed: 10,
        gustSpeed: 12,
        uvIndex: 3,
        condition: 'Clear',
        visibility: 10,
        precipProb: 0.1,
        pollenLevel: null
    }
})

const makeCtx = (airQualitySensitive) => ({
    sensitivities: {
        heat: false,
        cold: false,
        pollen: false,
        uv: false,
        airQuality: airQualitySensitive,
        precipitation: false
    },
    location: { primary: null }
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('airQualityModule — timing.notify flag', () => {
    // Test 1: Standard user, AQI=120 → heads-up → notify false
    it('standard user, AQI=120 (heads-up): timing.notify is false', () => {
        const result = airQualityModule(makeWeatherData(120), makeCtx(false))
        expect(result).not.toBeNull()
        expect(result.urgency).toBe('heads-up')
        expect(result.timing.notify).toBe(false)
    })

    // Test 2: Sensitive user, AQI=75 → heads-up → notify true
    it('sensitive user, AQI=75 (heads-up): timing.notify is true', () => {
        const result = airQualityModule(makeWeatherData(75), makeCtx(true))
        expect(result).not.toBeNull()
        expect(result.urgency).toBe('heads-up')
        expect(result.timing.notify).toBe(true)
    })

    // Test 3: Standard user, AQI=160 → alert → notify true
    it('standard user, AQI=160 (alert): timing.notify is true', () => {
        const result = airQualityModule(makeWeatherData(160), makeCtx(false))
        expect(result).not.toBeNull()
        expect(result.urgency).toBe('alert')
        expect(result.timing.notify).toBe(true)
    })

    // Test 4: Sensitive user, AQI=110 → alert → notify true
    it('sensitive user, AQI=110 (alert): timing.notify is true', () => {
        const result = airQualityModule(makeWeatherData(110), makeCtx(true))
        expect(result).not.toBeNull()
        expect(result.urgency).toBe('alert')
        expect(result.timing.notify).toBe(true)
    })

    // Test 5: Standard user, AQI=70 → useful → notify false
    it('standard user, AQI=70 (useful): timing.notify is false', () => {
        const result = airQualityModule(makeWeatherData(70), makeCtx(false))
        expect(result).not.toBeNull()
        expect(result.urgency).toBe('useful')
        expect(result.timing.notify).toBe(false)
    })
})
