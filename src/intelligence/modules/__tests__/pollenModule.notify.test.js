/**
 * pollenModule.notify.test.js
 * Phase 3.4 — Notification Activation (Task 4)
 *
 * Validates that timing.notify is set correctly across all pollen urgency branches:
 *   - HEADS_UP (standard user):  notify === false
 *   - HEADS_UP (sensitive user): notify === true
 *   - ALERT (any user):          notify === true
 *
 * Requirements covered: 4.1, 4.2, 4.3
 */

import { describe, it, expect } from 'vitest'
import { pollenModule } from '../pollenModule.js'

// ---------------------------------------------------------------------------
// Minimal builders
// ---------------------------------------------------------------------------

const makeWeatherData = (pollenLevel) => ({
    current: {
        pollenLevel,
        temp: 20,
        feelsLike: 20,
        humidity: 50,
        windSpeed: 10,
        gustSpeed: 12,
        uvIndex: 3,
        condition: 'Clear',
        visibility: 10,
        precipProb: 0.1,
        airQuality: null
    }
})

const makeCtx = (pollenSensitive) => ({
    sensitivities: {
        heat: false,
        cold: false,
        pollen: pollenSensitive,
        uv: false,
        airQuality: false,
        precipitation: false
    },
    location: { primary: null }
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('pollenModule — timing.notify flag', () => {
    // Test 1: Standard user, pollenLevel='high' → heads-up → notify false
    it('standard user, pollenLevel=high (heads-up): timing.notify is false', () => {
        const result = pollenModule(makeWeatherData('high'), makeCtx(false))
        expect(result).not.toBeNull()
        expect(result.urgency).toBe('heads-up')
        expect(result.timing.notify).toBe(false)
    })

    // Test 2: Sensitive user, pollenLevel='moderate' → heads-up → notify true
    it('sensitive user, pollenLevel=moderate (heads-up): timing.notify is true', () => {
        const result = pollenModule(makeWeatherData('moderate'), makeCtx(true))
        expect(result).not.toBeNull()
        expect(result.urgency).toBe('heads-up')
        expect(result.timing.notify).toBe(true)
    })

    // Test 3: Sensitive user, pollenLevel='high' → heads-up → notify true
    it('sensitive user, pollenLevel=high (heads-up): timing.notify is true', () => {
        const result = pollenModule(makeWeatherData('high'), makeCtx(true))
        expect(result).not.toBeNull()
        expect(result.urgency).toBe('heads-up')
        expect(result.timing.notify).toBe(true)
    })

    // Test 4: Standard user, pollenLevel='very-high' → alert → notify true
    it('standard user, pollenLevel=very-high (alert): timing.notify is true', () => {
        const result = pollenModule(makeWeatherData('very-high'), makeCtx(false))
        expect(result).not.toBeNull()
        expect(result.urgency).toBe('alert')
        expect(result.timing.notify).toBe(true)
    })

    // Test 5: Sensitive user, pollenLevel='very-high' → alert → notify true
    it('sensitive user, pollenLevel=very-high (alert): timing.notify is true', () => {
        const result = pollenModule(makeWeatherData('very-high'), makeCtx(true))
        expect(result).not.toBeNull()
        expect(result.urgency).toBe('alert')
        expect(result.timing.notify).toBe(true)
    })
})
