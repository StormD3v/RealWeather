/**
 * departureBrief.test.js — Phase 3.4
 *
 * Tests for generateDepartureBrief — the pure departure brief generator.
 *
 * Verifies:
 *   - Commute insight takes priority over all others as primary
 *   - Alert daily-planning/routine-adapt takes priority when no commute insight
 *   - Heads-up daily-planning used when no alert-tier present
 *   - Any heads-up/alert used as last resort
 *   - Null returned when all insights are ambient/useful
 *   - Null returned on empty input
 *   - Title prefix reflects urgency of primary insight
 *   - Body combines content + actionPath of primary
 *   - Secondary line added only when it adds distinct departure context
 *   - Ambient/useful insights are never included
 */

import { describe, it, expect } from 'vitest'
import { generateDepartureBrief } from '../departureBrief.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let _seq = 0
function makeInsight(type, urgency, overrides = {}) {
    return {
        id: `i-${++_seq}`,
        type,
        urgency,
        content: `${type} content`,
        actionPath: `${type} action`,
        timing: { notify: false, windowStart: null, windowEnd: null, notifyAt: null },
        confidence: 'high',
        sourceContext: { usedLocation: true, usedRoutine: false, usedActivity: false, usedSensitivity: false },
        ...overrides
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('generateDepartureBrief — Phase 3.4', () => {

    // ── Null / empty cases ────────────────────────────────────────────────

    it('returns null for empty insights array', () => {
        expect(generateDepartureBrief([])).toBeNull()
    })

    it('returns null for non-array input', () => {
        expect(generateDepartureBrief(null)).toBeNull()
        expect(generateDepartureBrief(undefined)).toBeNull()
    })

    it('returns null when all insights are ambient urgency', () => {
        const insights = [
            makeInsight('daily-planning', 'ambient'),
            makeInsight('activity', 'ambient'),
        ]
        expect(generateDepartureBrief(insights)).toBeNull()
    })

    it('returns null when all insights are useful urgency', () => {
        const insights = [
            makeInsight('daily-planning', 'useful'),
            makeInsight('comfort', 'useful'),
        ]
        expect(generateDepartureBrief(insights)).toBeNull()
    })

    it('returns null when only ambient and useful insights exist', () => {
        const insights = [
            makeInsight('daily-planning', 'ambient'),
            makeInsight('comfort', 'useful'),
            makeInsight('activity', 'useful'),
        ]
        expect(generateDepartureBrief(insights)).toBeNull()
    })

    // ── Priority: commute takes primary ──────────────────────────────────

    it('selects commute insight as primary regardless of urgency position', () => {
        const insights = [
            makeInsight('daily-planning', 'alert'),  // alert but not commute
            makeInsight('commute', 'heads-up'),       // commute — should win
        ]
        const brief = generateDepartureBrief(insights)
        expect(brief).not.toBeNull()
        expect(brief.body).toContain('commute content')
    })

    it('uses commute insight even when it is heads-up and others are alert', () => {
        const insights = [
            makeInsight('comfort', 'alert'),
            makeInsight('daily-planning', 'alert'),
            makeInsight('commute', 'heads-up'),
        ]
        const brief = generateDepartureBrief(insights)
        expect(brief.body).toContain('commute content')
        expect(brief.urgency).toBe('heads-up')
    })

    // ── Priority: alert daily-planning / routine-adapt ────────────────────

    it('selects alert daily-planning when no commute insight exists', () => {
        const insights = [
            makeInsight('comfort', 'heads-up'),
            makeInsight('daily-planning', 'alert'),
        ]
        const brief = generateDepartureBrief(insights)
        expect(brief).not.toBeNull()
        expect(brief.body).toContain('daily-planning content')
        expect(brief.urgency).toBe('alert')
    })

    it('selects alert routine-adapt when no commute or alert daily-planning', () => {
        const insights = [
            makeInsight('comfort', 'heads-up'),
            makeInsight('routine-adapt', 'alert'),
        ]
        const brief = generateDepartureBrief(insights)
        expect(brief.body).toContain('routine-adapt content')
        expect(brief.urgency).toBe('alert')
    })

    // ── Priority: heads-up daily-planning ────────────────────────────────

    it('selects heads-up daily-planning when no higher-priority insight exists', () => {
        const insights = [
            makeInsight('comfort', 'useful'),
            makeInsight('daily-planning', 'heads-up'),
        ]
        const brief = generateDepartureBrief(insights)
        expect(brief.body).toContain('daily-planning content')
        expect(brief.urgency).toBe('heads-up')
    })

    // ── Priority: any notifiable as last resort ───────────────────────────

    it('selects any heads-up insight when no priority insight exists', () => {
        const insights = [
            makeInsight('daily-planning', 'useful'),
            makeInsight('comfort', 'heads-up'),
        ]
        const brief = generateDepartureBrief(insights)
        expect(brief).not.toBeNull()
        expect(brief.urgency).toBe('heads-up')
    })

    it('selects any alert insight when no priority insight exists', () => {
        const insights = [
            makeInsight('environmental', 'alert', { subtype: 'uv' }),
        ]
        const brief = generateDepartureBrief(insights)
        expect(brief).not.toBeNull()
        expect(brief.urgency).toBe('alert')
    })

    // ── Title prefix reflects urgency ─────────────────────────────────────

    it('title includes alert indicator for alert urgency', () => {
        const insights = [makeInsight('daily-planning', 'alert')]
        const brief = generateDepartureBrief(insights)
        expect(brief.title).toContain('🔴')
    })

    it('title includes warning indicator for heads-up urgency', () => {
        const insights = [makeInsight('daily-planning', 'heads-up')]
        const brief = generateDepartureBrief(insights)
        expect(brief.title).toContain('⚠️')
    })

    it('title always contains "Before you go"', () => {
        const insights = [makeInsight('commute', 'alert')]
        const brief = generateDepartureBrief(insights)
        expect(brief.title).toContain('Before you go')
    })

    // ── Body format ───────────────────────────────────────────────────────

    it('body contains both content and actionPath of primary insight', () => {
        const insight = makeInsight('commute', 'alert', {
            content: 'Rain at departure.',
            actionPath: 'Bring waterproofs.'
        })
        const brief = generateDepartureBrief([insight])
        expect(brief.body).toContain('Rain at departure.')
        expect(brief.body).toContain('Bring waterproofs.')
    })

    // ── Secondary line logic ──────────────────────────────────────────────

    it('adds a severe weather secondary when primary is commute', () => {
        const commute = makeInsight('commute', 'heads-up', {
            content: 'Rain at departure.', actionPath: 'Bring umbrella.'
        })
        const severe = makeInsight('daily-planning', 'alert', {
            content: 'Thunderstorm active.', actionPath: 'Stay indoors.'
        })
        const brief = generateDepartureBrief([commute, severe])
        expect(brief.body).toContain('Rain at departure.')
        expect(brief.body).toContain('Thunderstorm active.')
    })

    it('does NOT add secondary when primary is commute and no other alert exists', () => {
        const commute = makeInsight('commute', 'heads-up', {
            content: 'Light rain.', actionPath: 'Bring umbrella.'
        })
        const headsUp = makeInsight('daily-planning', 'heads-up', {
            content: 'Cloudy day.', actionPath: 'Dress warm.'
        })
        const brief = generateDepartureBrief([commute, headsUp])
        // Body should only have commute content
        expect(brief.body).not.toContain('Cloudy day.')
    })

    it('adds commute note as secondary when primary is weather-based and commute exists', () => {
        const weather = makeInsight('daily-planning', 'alert', {
            content: 'Extreme heat.', actionPath: 'Stay hydrated.'
        })
        const commute = makeInsight('commute', 'heads-up', {
            content: 'Hot commute expected.', actionPath: 'Carry water.'
        })
        const brief = generateDepartureBrief([weather, commute])
        expect(brief.body).toContain('Extreme heat.')
        expect(brief.body).toContain('Hot commute expected.')
    })

    it('does NOT add secondary when primary is weather-based and no commute exists', () => {
        const weather = makeInsight('daily-planning', 'alert', {
            content: 'Heavy rain.', actionPath: 'Stay in.'
        })
        const comfort = makeInsight('comfort', 'heads-up', {
            content: 'Humid day.', actionPath: 'Light clothing.'
        })
        const brief = generateDepartureBrief([weather, comfort])
        // Body should only have weather content + actionPath
        expect(brief.body).not.toContain('Humid day.')
    })

    // ── Ambient/useful are never in the brief ─────────────────────────────

    it('filters out ambient from secondary consideration', () => {
        const main = makeInsight('daily-planning', 'heads-up', {
            content: 'Wind today.', actionPath: 'Secure items.'
        })
        const ambient = makeInsight('daily-planning', 'ambient', {
            content: 'Nice day.', actionPath: 'Enjoy outside.'
        })
        const brief = generateDepartureBrief([main, ambient])
        expect(brief.body).not.toContain('Nice day.')
    })

    // ── Output shape ──────────────────────────────────────────────────────

    it('returns an object with title, body, and urgency fields', () => {
        const insights = [makeInsight('commute', 'heads-up')]
        const brief = generateDepartureBrief(insights)
        expect(brief).toHaveProperty('title')
        expect(brief).toHaveProperty('body')
        expect(brief).toHaveProperty('urgency')
        expect(typeof brief.title).toBe('string')
        expect(typeof brief.body).toBe('string')
        expect(typeof brief.urgency).toBe('string')
    })

    it('urgency in output matches primary insight urgency', () => {
        const insights = [makeInsight('commute', 'alert')]
        const brief = generateDepartureBrief(insights)
        expect(brief.urgency).toBe('alert')
    })
})
