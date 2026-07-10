/**
 * dailyPlanningModule.notify.test.js
 * Phase 3.4 — Notification Activation
 *
 * Verifies the notify flag on cold-path insights and key regression guards.
 * Requirements: 1.1, 1.2, 1.3, 1.4
 *
 * Cold thresholds (default, no sensitivity):
 *   feelsLike ≤  5 → USEFUL   (notify: false)
 *   feelsLike ≤ -5 → HEADS_UP (notify: true)
 *   feelsLike ≤ -15 → ALERT   (notify: true)
 */

import { describe, it, expect } from 'vitest'
import { dailyPlanningModule } from '@/intelligence/modules/dailyPlanningModule.js'

// ---------------------------------------------------------------------------
// Minimal mock helpers
// ---------------------------------------------------------------------------

const makeWeatherData = (feelsLike, condition = 'Clear', precipProb = 0, windSpeed = 5) => ({
    current: {
        feelsLike,
        temp: feelsLike,
        condition,
        precipProb,
        windSpeed,
        humidity: 50,
        uvIndex: 0,
        visibility: 10,
        gustSpeed: 5
    },
    hourly: []
})

const baseCtx = { sensitivities: null, location: { primary: null } }

// ---------------------------------------------------------------------------
// Cold path — notify flag
// ---------------------------------------------------------------------------

describe('dailyPlanningModule — cold notify flag', () => {
    it('cold USEFUL (feelsLike=3) → timing.notify is false', () => {
        // feelsLike 3 is below the useful threshold (5) but above heads-up (-5)
        const result = dailyPlanningModule(makeWeatherData(3), baseCtx)
        expect(result).not.toBeNull()
        expect(result.urgency).toBe('useful')
        expect(result.timing.notify).toBe(false)
    })

    it('cold HEADS_UP (feelsLike=-6) → timing.notify is true', () => {
        // feelsLike -6 is below heads-up threshold (-5) but above alert (-15)
        const result = dailyPlanningModule(makeWeatherData(-6), baseCtx)
        expect(result).not.toBeNull()
        expect(result.urgency).toBe('heads-up')
        expect(result.timing.notify).toBe(true)
    })

    it('cold ALERT (feelsLike=-16) → timing.notify is true', () => {
        // feelsLike -16 is below alert threshold (-15)
        const result = dailyPlanningModule(makeWeatherData(-16), baseCtx)
        expect(result).not.toBeNull()
        expect(result.urgency).toBe('alert')
        expect(result.timing.notify).toBe(true)
    })
})

// ---------------------------------------------------------------------------
// Regression guards
// ---------------------------------------------------------------------------

describe('dailyPlanningModule — notify regression guards', () => {
    it('thunderstorm path → timing.notify is true', () => {
        const result = dailyPlanningModule(makeWeatherData(15, 'Thunderstorm'), baseCtx)
        expect(result).not.toBeNull()
        expect(result.urgency).toBe('alert')
        expect(result.timing.notify).toBe(true)
    })

    it('benign/ambient path (clear, comfortable) → timing.notify is false', () => {
        // feelsLike 20, low precipProb, low windSpeed — should produce ambient insight
        const result = dailyPlanningModule(makeWeatherData(20, 'Clear', 0.05, 8), baseCtx)
        expect(result).not.toBeNull()
        expect(result.urgency).toBe('ambient')
        expect(result.timing.notify).toBe(false)
    })
})
