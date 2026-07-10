/**
 * insightValidator.test.js
 * Tests for the mandatory insight gate and insight factory.
 */

import { describe, it, expect } from 'vitest'
import {
    createInsight,
    validateInsight,
    filterValidInsights
} from '@/utils/insightValidator'
import { URGENCY } from '@/utils/urgencyEngine'

// ---------------------------------------------------------------------------
// createInsight — happy path
// ---------------------------------------------------------------------------

describe('createInsight() — happy path', () => {
    it('creates a well-formed insight with all required fields', () => {
        const insight = createInsight({
            type: 'comfort',
            urgency: URGENCY.USEFUL,
            content: 'It feels warm this afternoon.',
            actionPath: 'Bring a water bottle and wear light clothing.'
        })

        expect(insight.id).toBeTruthy()
        expect(insight.type).toBe('comfort')
        expect(insight.urgency).toBe(URGENCY.USEFUL)
        expect(insight.content).toBe('It feels warm this afternoon.')
        expect(insight.actionPath).toBe('Bring a water bottle and wear light clothing.')
        expect(insight.confidence).toBe('medium') // default
        expect(insight.timing.notify).toBe(false) // default
        expect(insight.timing.windowStart).toBeNull()
        expect(insight.timing.windowEnd).toBeNull()
    })

    it('generates unique ids for successive calls', () => {
        const a = createInsight({ type: 'risk-alert', urgency: URGENCY.ALERT, content: 'Storm coming.', actionPath: 'Seek shelter.' })
        const b = createInsight({ type: 'risk-alert', urgency: URGENCY.ALERT, content: 'Storm coming.', actionPath: 'Seek shelter.' })
        expect(a.id).not.toBe(b.id)
    })

    it('trims whitespace from content and actionPath', () => {
        const insight = createInsight({
            type: 'ambient',
            urgency: URGENCY.AMBIENT,
            content: '  Beautiful visibility tonight.  ',
            actionPath: '  Great conditions for stargazing.  '
        })
        expect(insight.content).toBe('Beautiful visibility tonight.')
        expect(insight.actionPath).toBe('Great conditions for stargazing.')
    })

    it('accepts custom confidence and timing fields', () => {
        const now = Date.now()
        const insight = createInsight({
            type: 'commute',
            urgency: URGENCY.HEADS_UP,
            content: 'Rain during your commute window.',
            actionPath: 'Leave 15 minutes early.',
            confidence: 'high',
            windowStart: now,
            windowEnd: now + 3600000,
            notify: true,
            notifyAt: now + 1800000
        })

        expect(insight.confidence).toBe('high')
        expect(insight.timing.windowStart).toBe(now)
        expect(insight.timing.notify).toBe(true)
        expect(insight.timing.notifyAt).toBe(now + 1800000)
    })

    it('records which context categories were used', () => {
        const insight = createInsight({
            type: 'activity',
            urgency: URGENCY.USEFUL,
            content: 'Good morning for running.',
            actionPath: 'Head out before 10 AM.',
            usedLocation: true,
            usedActivity: true,
            usedRoutine: false,
            usedSensitivity: false
        })

        expect(insight.sourceContext.usedLocation).toBe(true)
        expect(insight.sourceContext.usedActivity).toBe(true)
        expect(insight.sourceContext.usedRoutine).toBe(false)
        expect(insight.sourceContext.usedSensitivity).toBe(false)
    })
})

// ---------------------------------------------------------------------------
// createInsight — mandatory gate enforcement
// ---------------------------------------------------------------------------

describe('createInsight() — mandatory gate', () => {
    it('throws when actionPath is empty string', () => {
        expect(() => createInsight({
            type: 'comfort',
            urgency: URGENCY.USEFUL,
            content: 'Some insight.',
            actionPath: ''
        })).toThrow(/actionPath is empty/)
    })

    it('throws when actionPath is whitespace only', () => {
        expect(() => createInsight({
            type: 'comfort',
            urgency: URGENCY.USEFUL,
            content: 'Some insight.',
            actionPath: '   '
        })).toThrow(/actionPath is empty/)
    })

    it('throws when actionPath is missing', () => {
        expect(() => createInsight({
            type: 'comfort',
            urgency: URGENCY.USEFUL,
            content: 'Some insight.'
        })).toThrow(/actionPath is empty/)
    })

    it('throws when content is empty', () => {
        expect(() => createInsight({
            type: 'comfort',
            urgency: URGENCY.USEFUL,
            content: '',
            actionPath: 'Do something.'
        })).toThrow(/content is empty/)
    })
})

// ---------------------------------------------------------------------------
// validateInsight
// ---------------------------------------------------------------------------

describe('validateInsight()', () => {
    it('returns valid: true for a well-formed insight', () => {
        const insight = createInsight({
            type: 'daily-planning',
            urgency: URGENCY.USEFUL,
            content: 'Clear day ahead.',
            actionPath: 'No changes needed for your plans.'
        })
        expect(validateInsight(insight).valid).toBe(true)
    })

    it('returns valid: false for non-object input', () => {
        expect(validateInsight(null).valid).toBe(false)
        expect(validateInsight('string').valid).toBe(false)
        expect(validateInsight(42).valid).toBe(false)
    })

    it('returns valid: false when actionPath is empty', () => {
        const broken = {
            id: 'x',
            type: 'comfort',
            urgency: 'useful',
            content: 'Some content.',
            actionPath: '',
            confidence: 'medium',
            timing: { windowStart: null, windowEnd: null, notify: false, notifyAt: null },
            sourceContext: { usedLocation: false, usedRoutine: false, usedActivity: false, usedSensitivity: false }
        }
        const result = validateInsight(broken)
        expect(result.valid).toBe(false)
        expect(result.reason).toMatch(/actionPath/)
    })

    it('returns valid: false for unknown insight type', () => {
        const insight = createInsight({
            type: 'comfort',
            urgency: URGENCY.USEFUL,
            content: 'Some insight.',
            actionPath: 'Do something.'
        })
        const broken = { ...insight, type: 'unknown-type' }
        expect(validateInsight(broken).valid).toBe(false)
    })

    it('returns valid: false for unknown urgency level', () => {
        const insight = createInsight({
            type: 'comfort',
            urgency: URGENCY.USEFUL,
            content: 'Some insight.',
            actionPath: 'Do something.'
        })
        const broken = { ...insight, urgency: 'critical' }
        expect(validateInsight(broken).valid).toBe(false)
    })
})

// ---------------------------------------------------------------------------
// filterValidInsights
// ---------------------------------------------------------------------------

describe('filterValidInsights()', () => {
    it('keeps only valid insights from a mixed array', () => {
        const valid = createInsight({
            type: 'comfort',
            urgency: URGENCY.USEFUL,
            content: 'Warm afternoon.',
            actionPath: 'Wear light clothing.'
        })
        const broken = { type: 'comfort', urgency: 'useful', content: 'no action', actionPath: '' }

        const result = filterValidInsights([valid, null, undefined, broken])
        expect(result).toHaveLength(1)
        expect(result[0].id).toBe(valid.id)
    })

    it('returns empty array for all-null input', () => {
        expect(filterValidInsights([null, null, undefined])).toHaveLength(0)
    })

    it('returns empty array for empty input', () => {
        expect(filterValidInsights([])).toHaveLength(0)
    })

    it('passes all valid insights through unchanged', () => {
        const a = createInsight({ type: 'risk-alert', urgency: URGENCY.ALERT, content: 'Thunderstorm.', actionPath: 'Seek shelter immediately.' })
        const b = createInsight({ type: 'comfort', urgency: URGENCY.USEFUL, content: 'Warm day.', actionPath: 'Stay hydrated.' })
        const result = filterValidInsights([a, b])
        expect(result).toHaveLength(2)
    })
})

// ---------------------------------------------------------------------------
// createInsight — subtype support (Phase 3.5)
// ---------------------------------------------------------------------------

describe('createInsight() — subtype', () => {
    it('includes subtype when provided', () => {
        const insight = createInsight({
            type: 'environmental',
            subtype: 'uv',
            urgency: URGENCY.HEADS_UP,
            content: 'UV is high today.',
            actionPath: 'Apply sunscreen before going out.'
        })
        expect(insight.subtype).toBe('uv')
    })

    it('includes subtype air-quality when provided', () => {
        const insight = createInsight({
            type: 'environmental',
            subtype: 'air-quality',
            urgency: URGENCY.USEFUL,
            content: 'Air quality is moderate.',
            actionPath: 'Consider reducing outdoor exercise intensity.'
        })
        expect(insight.subtype).toBe('air-quality')
    })

    it('does not include subtype property when not provided', () => {
        const insight = createInsight({
            type: 'comfort',
            urgency: URGENCY.USEFUL,
            content: 'Warm and humid.',
            actionPath: 'Wear breathable clothing.'
        })
        expect('subtype' in insight).toBe(false)
    })

    it('does not include subtype property when undefined', () => {
        const insight = createInsight({
            type: 'daily-planning',
            subtype: undefined,
            urgency: URGENCY.USEFUL,
            content: 'Clear day.',
            actionPath: 'No changes needed.'
        })
        expect('subtype' in insight).toBe(false)
    })

    it('validateInsight passes for environmental insight with subtype', () => {
        const insight = createInsight({
            type: 'environmental',
            subtype: 'pollen',
            urgency: URGENCY.HEADS_UP,
            content: 'High pollen count today.',
            actionPath: 'Take antihistamines before going outside.'
        })
        expect(validateInsight(insight).valid).toBe(true)
    })

    it('validateInsight passes for environmental insight without subtype', () => {
        const insight = createInsight({
            type: 'environmental',
            urgency: URGENCY.USEFUL,
            content: 'Environmental conditions are elevated.',
            actionPath: 'Monitor conditions before extended outdoor activity.'
        })
        expect(validateInsight(insight).valid).toBe(true)
    })

    it('existing module insights are unaffected by subtype addition', () => {
        const insight = createInsight({
            type: 'commute',
            urgency: URGENCY.ALERT,
            content: 'Heavy rain at departure.',
            actionPath: 'Bring waterproof gear.',
            usedRoutine: true
        })
        expect('subtype' in insight).toBe(false)
        expect(validateInsight(insight).valid).toBe(true)
        expect(insight.sourceContext.usedRoutine).toBe(true)
    })
})
