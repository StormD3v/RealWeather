/**
 * urgencyEngine.test.js
 * Tests for the Phase 3.2 urgency escalation engine.
 * Validates both default and sensitivity-adjusted thresholds.
 */

import { describe, it, expect } from 'vitest'
import {
    URGENCY,
    URGENCY_RANK,
    escalateHeat,
    escalateCold,
    escalateWind,
    escalateRain,
    escalateUV,
    maxUrgency,
    sortByUrgency,
    getHeatThresholds,
    getColdThresholds,
    getUVThresholds
} from '@/utils/urgencyEngine'

// ---------------------------------------------------------------------------
// URGENCY constants
// ---------------------------------------------------------------------------

describe('URGENCY constants', () => {
    it('defines the four urgency levels', () => {
        expect(URGENCY.AMBIENT).toBe('ambient')
        expect(URGENCY.USEFUL).toBe('useful')
        expect(URGENCY.HEADS_UP).toBe('heads-up')
        expect(URGENCY.ALERT).toBe('alert')
    })

    it('URGENCY_RANK increases from ambient to alert', () => {
        expect(URGENCY_RANK['ambient']).toBeLessThan(URGENCY_RANK['useful'])
        expect(URGENCY_RANK['useful']).toBeLessThan(URGENCY_RANK['heads-up'])
        expect(URGENCY_RANK['heads-up']).toBeLessThan(URGENCY_RANK['alert'])
    })
})

// ---------------------------------------------------------------------------
// escalateHeat — default thresholds (no sensitivity)
// ---------------------------------------------------------------------------

describe('escalateHeat() — default thresholds', () => {
    it('returns null below the useful threshold (< 30°C)', () => {
        expect(escalateHeat(29, null)).toBeNull()
        expect(escalateHeat(20, null)).toBeNull()
    })

    it('returns useful at >= 30°C', () => {
        expect(escalateHeat(30, null)).toBe(URGENCY.USEFUL)
        expect(escalateHeat(32, null)).toBe(URGENCY.USEFUL)
    })

    it('returns heads-up at >= 35°C', () => {
        expect(escalateHeat(35, null)).toBe(URGENCY.HEADS_UP)
        expect(escalateHeat(37, null)).toBe(URGENCY.HEADS_UP)
    })

    it('returns alert at >= 40°C', () => {
        expect(escalateHeat(40, null)).toBe(URGENCY.ALERT)
        expect(escalateHeat(45, null)).toBe(URGENCY.ALERT)
    })
})

// ---------------------------------------------------------------------------
// escalateHeat — heat-sensitive user
// ---------------------------------------------------------------------------

describe('escalateHeat() — heat-sensitive user', () => {
    const sensitive = { heat: true, cold: false, pollen: false, uv: false, airQuality: false, precipitation: false }

    it('alert threshold drops to 33°C for heat-sensitive users', () => {
        expect(escalateHeat(33, sensitive)).toBe(URGENCY.ALERT)
    })

    it('returns alert at 33°C (vs heads-up range for default)', () => {
        // Default: 33°C is between useful (30) and headsUp (35) → useful
        expect(escalateHeat(33, null)).toBe(URGENCY.USEFUL)
        // Sensitive: 33°C crosses the sensitive alert threshold (33) → alert
        expect(escalateHeat(33, sensitive)).toBe(URGENCY.ALERT)
    })

    it('returns heads-up below the sensitive alert threshold', () => {
        expect(escalateHeat(31, sensitive)).toBe(URGENCY.HEADS_UP)
    })
})

// ---------------------------------------------------------------------------
// escalateCold — default thresholds
// ---------------------------------------------------------------------------

describe('escalateCold() — default thresholds', () => {
    it('returns null above the useful threshold (> 5°C)', () => {
        expect(escalateCold(6, null)).toBeNull()
        expect(escalateCold(20, null)).toBeNull()
    })

    it('returns useful at <= 5°C', () => {
        expect(escalateCold(5, null)).toBe(URGENCY.USEFUL)
        expect(escalateCold(3, null)).toBe(URGENCY.USEFUL)
    })

    it('returns heads-up at <= -5°C', () => {
        expect(escalateCold(-5, null)).toBe(URGENCY.HEADS_UP)
        expect(escalateCold(-8, null)).toBe(URGENCY.HEADS_UP)
    })

    it('returns alert at <= -15°C', () => {
        expect(escalateCold(-15, null)).toBe(URGENCY.ALERT)
        expect(escalateCold(-20, null)).toBe(URGENCY.ALERT)
    })
})

// ---------------------------------------------------------------------------
// escalateCold — cold-sensitive user
// ---------------------------------------------------------------------------

describe('escalateCold() — cold-sensitive user', () => {
    const sensitive = { heat: false, cold: true, pollen: false, uv: false, airQuality: false, precipitation: false }

    it('alert threshold rises to -5°C for cold-sensitive users', () => {
        expect(escalateCold(-5, sensitive)).toBe(URGENCY.ALERT)
    })

    it('returns alert at -5°C (vs -15°C for default)', () => {
        expect(escalateCold(-5, null)).toBe(URGENCY.HEADS_UP)
        expect(escalateCold(-5, sensitive)).toBe(URGENCY.ALERT)
    })
})

// ---------------------------------------------------------------------------
// escalateWind
// ---------------------------------------------------------------------------

describe('escalateWind()', () => {
    it('returns null below 20 km/h', () => {
        expect(escalateWind(19, null)).toBeNull()
    })

    it('returns useful at >= 20 km/h', () => {
        expect(escalateWind(20, null)).toBe(URGENCY.USEFUL)
    })

    it('returns heads-up at >= 40 km/h', () => {
        expect(escalateWind(40, null)).toBe(URGENCY.HEADS_UP)
    })

    it('returns alert at >= 70 km/h', () => {
        expect(escalateWind(70, null)).toBe(URGENCY.ALERT)
    })
})

// ---------------------------------------------------------------------------
// escalateRain
// ---------------------------------------------------------------------------

describe('escalateRain()', () => {
    it('returns null below 30%', () => {
        expect(escalateRain(29, null)).toBeNull()
    })

    it('returns useful at >= 30%', () => {
        expect(escalateRain(30, null)).toBe(URGENCY.USEFUL)
    })

    it('returns heads-up at >= 60%', () => {
        expect(escalateRain(60, null)).toBe(URGENCY.HEADS_UP)
    })

    it('returns alert at >= 85%', () => {
        expect(escalateRain(85, null)).toBe(URGENCY.ALERT)
    })

    it('precipitation-sensitive user gets lower thresholds', () => {
        const sensitive = { precipitation: true }
        // default threshold 30 → sensitive 20
        expect(escalateRain(25, null)).toBeNull()
        expect(escalateRain(25, sensitive)).toBe(URGENCY.USEFUL)
    })
})

// ---------------------------------------------------------------------------
// escalateUV
// ---------------------------------------------------------------------------

describe('escalateUV()', () => {
    it('returns null below useful threshold (< 3)', () => {
        expect(escalateUV(2, null)).toBeNull()
    })

    it('returns useful at >= 3', () => {
        expect(escalateUV(3, null)).toBe(URGENCY.USEFUL)
    })

    it('returns heads-up at >= 6', () => {
        expect(escalateUV(6, null)).toBe(URGENCY.HEADS_UP)
    })

    it('returns alert at >= 8', () => {
        expect(escalateUV(8, null)).toBe(URGENCY.ALERT)
    })

    it('UV-sensitive user: alert drops to index 6', () => {
        const sensitive = { uv: true }
        // default: 6 → heads-up; sensitive: 6 → alert
        expect(escalateUV(6, null)).toBe(URGENCY.HEADS_UP)
        expect(escalateUV(6, sensitive)).toBe(URGENCY.ALERT)
    })
})

// ---------------------------------------------------------------------------
// maxUrgency
// ---------------------------------------------------------------------------

describe('maxUrgency()', () => {
    it('returns the higher urgency level', () => {
        expect(maxUrgency('ambient', 'alert')).toBe('alert')
        expect(maxUrgency('alert', 'useful')).toBe('alert')
        expect(maxUrgency('heads-up', 'heads-up')).toBe('heads-up')
    })
})

// ---------------------------------------------------------------------------
// sortByUrgency
// ---------------------------------------------------------------------------

describe('sortByUrgency()', () => {
    it('sorts descending by urgency rank', () => {
        const insights = [
            { urgency: 'useful', id: 'a' },
            { urgency: 'alert', id: 'b' },
            { urgency: 'ambient', id: 'c' },
            { urgency: 'heads-up', id: 'd' }
        ]
        const sorted = sortByUrgency(insights)
        expect(sorted.map(i => i.urgency)).toEqual(['alert', 'heads-up', 'useful', 'ambient'])
    })

    it('does not mutate the original array', () => {
        const original = [
            { urgency: 'useful' },
            { urgency: 'alert' }
        ]
        const sorted = sortByUrgency(original)
        expect(original[0].urgency).toBe('useful') // unchanged
        expect(sorted[0].urgency).toBe('alert')
    })
})

// ---------------------------------------------------------------------------
// Sensitivity threshold factories
// ---------------------------------------------------------------------------

describe('getHeatThresholds()', () => {
    it('returns default thresholds for null sensitivities', () => {
        const t = getHeatThresholds(null)
        expect(t.alert).toBe(40)
    })

    it('returns lower alert threshold for heat-sensitive users', () => {
        const t = getHeatThresholds({ heat: true })
        expect(t.alert).toBe(33)
        expect(t.alert).toBeLessThan(40)
    })
})

describe('getColdThresholds()', () => {
    it('returns default thresholds for null sensitivities', () => {
        const t = getColdThresholds(null)
        expect(t.alert).toBe(-15)
    })

    it('returns higher alert threshold for cold-sensitive users', () => {
        const t = getColdThresholds({ cold: true })
        expect(t.alert).toBe(-5)
        expect(t.alert).toBeGreaterThan(-15)
    })
})

describe('getUVThresholds()', () => {
    it('returns default thresholds for null sensitivities', () => {
        const t = getUVThresholds(null)
        expect(t.alert).toBe(8)
    })

    it('returns lower alert threshold for UV-sensitive users', () => {
        const t = getUVThresholds({ uv: true })
        expect(t.alert).toBe(6)
        expect(t.alert).toBeLessThan(8)
    })
})

// ---------------------------------------------------------------------------
// escalateAirQuality — Phase 3.5
// ---------------------------------------------------------------------------

import { escalateAirQuality, escalatePollen } from '@/utils/urgencyEngine'

describe('escalateAirQuality() — default thresholds', () => {
    it('returns null for AQI below 51 (good air quality)', () => {
        expect(escalateAirQuality(0, null)).toBeNull()
        expect(escalateAirQuality(50, null)).toBeNull()
    })

    it('returns useful at AQI 51 (moderate)', () => {
        expect(escalateAirQuality(51, null)).toBe(URGENCY.USEFUL)
        expect(escalateAirQuality(99, null)).toBe(URGENCY.USEFUL)
    })

    it('returns heads-up at AQI 100', () => {
        expect(escalateAirQuality(100, null)).toBe(URGENCY.HEADS_UP)
        expect(escalateAirQuality(149, null)).toBe(URGENCY.HEADS_UP)
    })

    it('returns alert at AQI 150', () => {
        expect(escalateAirQuality(150, null)).toBe(URGENCY.ALERT)
        expect(escalateAirQuality(300, null)).toBe(URGENCY.ALERT)
    })

    it('returns null when AQI is null', () => {
        expect(escalateAirQuality(null, null)).toBeNull()
    })

    it('returns null when AQI is undefined', () => {
        expect(escalateAirQuality(undefined, null)).toBeNull()
    })

    it('returns null when AQI is NaN', () => {
        expect(escalateAirQuality(NaN, null)).toBeNull()
    })
})

describe('escalateAirQuality() — airQuality-sensitive user', () => {
    const sensitive = { airQuality: true, heat: false, cold: false, pollen: false, uv: false, precipitation: false }

    it('returns null for AQI below 51 even for sensitive user', () => {
        expect(escalateAirQuality(50, sensitive)).toBeNull()
    })

    it('returns heads-up at AQI 51 (elevated from useful for sensitive)', () => {
        expect(escalateAirQuality(51, sensitive)).toBe(URGENCY.HEADS_UP)
        expect(escalateAirQuality(99, sensitive)).toBe(URGENCY.HEADS_UP)
    })

    it('returns alert at AQI 100 (earlier than default 150)', () => {
        expect(escalateAirQuality(100, sensitive)).toBe(URGENCY.ALERT)
    })

    it('default user at AQI 99 gets useful; sensitive gets heads-up', () => {
        expect(escalateAirQuality(99, null)).toBe(URGENCY.USEFUL)
        expect(escalateAirQuality(99, sensitive)).toBe(URGENCY.HEADS_UP)
    })
})

// ---------------------------------------------------------------------------
// escalatePollen — Phase 3.5
// ---------------------------------------------------------------------------

describe('escalatePollen() — default thresholds (standard user)', () => {
    it('returns null for low pollen', () => {
        expect(escalatePollen('low', null)).toBeNull()
    })

    it('returns null for moderate pollen (standard user)', () => {
        expect(escalatePollen('moderate', null)).toBeNull()
    })

    it('returns heads-up for high pollen', () => {
        expect(escalatePollen('high', null)).toBe(URGENCY.HEADS_UP)
    })

    it('returns alert for very-high pollen', () => {
        expect(escalatePollen('very-high', null)).toBe(URGENCY.ALERT)
    })

    it('returns null for unknown pollen level string', () => {
        expect(escalatePollen('extreme', null)).toBeNull()
        expect(escalatePollen('', null)).toBeNull()
        expect(escalatePollen(null, null)).toBeNull()
        expect(escalatePollen(undefined, null)).toBeNull()
    })
})

describe('escalatePollen() — pollen-sensitive user', () => {
    const sensitive = { pollen: true, heat: false, cold: false, uv: false, airQuality: false, precipitation: false }

    it('returns null for low pollen even when sensitive', () => {
        expect(escalatePollen('low', sensitive)).toBeNull()
    })

    it('returns heads-up for moderate pollen when sensitive (threshold shifts down)', () => {
        expect(escalatePollen('moderate', sensitive)).toBe(URGENCY.HEADS_UP)
    })

    it('returns heads-up for high pollen when sensitive', () => {
        expect(escalatePollen('high', sensitive)).toBe(URGENCY.HEADS_UP)
    })

    it('returns alert for very-high pollen when sensitive', () => {
        expect(escalatePollen('very-high', sensitive)).toBe(URGENCY.ALERT)
    })

    it('standard user silent at moderate; sensitive gets heads-up', () => {
        expect(escalatePollen('moderate', null)).toBeNull()
        expect(escalatePollen('moderate', sensitive)).toBe(URGENCY.HEADS_UP)
    })
})
