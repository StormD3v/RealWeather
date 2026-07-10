/**
 * useBehavioralSignals.test.js — Phase 3.4
 *
 * Tests for the behavioral signal composable:
 *   - recordAppOpen / recordInsightEngage write to signal store
 *   - 90-day retention is enforced on each write
 *   - getSignalWeights produces correct normalized weights
 *   - Empty weights returned when learning is disabled or no data
 *   - clearSignals empties the store
 *   - Signal collection is independent of notifications.enabled
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { computed, ref } from 'vue'

// ---------------------------------------------------------------------------
// Mock useUserContext — inline control ref so tests can flip the pref
// ---------------------------------------------------------------------------
const _mockCtx = ref({
    preferences: {
        intelligence: { behavioralLearning: true },
        notifications: { enabled: false }  // deliberately off — learning is independent
    }
})

vi.mock('@/composables/useUserContext.js', () => ({
    useUserContext: () => ({
        userContext: computed(() => _mockCtx.value)
    })
}))

// ---------------------------------------------------------------------------
// Mock contextStore — use real in-memory storage so we can inspect writes
// ---------------------------------------------------------------------------
let _signalStore = { schemaVersion: '1.0.0', signals: [] }

vi.mock('@/utils/contextStore.js', () => ({
    readSignalStore: () => JSON.parse(JSON.stringify(_signalStore)),
    appendSignal: (signal) => {
        const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000
        const pruned = _signalStore.signals.filter(s => s.timestamp >= cutoff)
        pruned.push(signal)
        _signalStore = { schemaVersion: '1.0.0', signals: pruned }
    },
    clearSignalStore: () => {
        _signalStore = { schemaVersion: '1.0.0', signals: [] }
    },
    // Re-export others used by useUserContext import path (not used in this test)
    initSignalStore: vi.fn(),
    readContext: vi.fn(() => ({})),
    writeContext: vi.fn((p) => p),
    clearContext: vi.fn(() => ({}))
}))

import { useBehavioralSignals, SIGNAL_TYPES } from '../useBehavioralSignals.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeInsight(type = 'daily-planning', urgency = 'heads-up') {
    return { type, urgency }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useBehavioralSignals — Phase 3.4', () => {

    beforeEach(() => {
        _signalStore = { schemaVersion: '1.0.0', signals: [] }
        _mockCtx.value = {
            preferences: {
                intelligence: { behavioralLearning: true },
                notifications: { enabled: false } // learning ≠ notifications
            }
        }
    })

    // ── recordAppOpen ─────────────────────────────────────────────────────

    it('recordAppOpen writes an app-open signal', () => {
        const { recordAppOpen } = useBehavioralSignals()
        recordAppOpen()
        expect(_signalStore.signals).toHaveLength(1)
        expect(_signalStore.signals[0].type).toBe(SIGNAL_TYPES.APP_OPEN)
        expect(typeof _signalStore.signals[0].timestamp).toBe('number')
        expect(_signalStore.signals[0].metadata).toEqual({})
    })

    it('recordAppOpen writes timestamp close to now', () => {
        const before = Date.now()
        const { recordAppOpen } = useBehavioralSignals()
        recordAppOpen()
        const after = Date.now()
        const ts = _signalStore.signals[0].timestamp
        expect(ts).toBeGreaterThanOrEqual(before)
        expect(ts).toBeLessThanOrEqual(after)
    })

    // ── recordInsightEngage ───────────────────────────────────────────────

    it('recordInsightEngage writes an insight-engage signal', () => {
        const { recordInsightEngage } = useBehavioralSignals()
        recordInsightEngage('daily-planning', 'alert')
        expect(_signalStore.signals).toHaveLength(1)
        expect(_signalStore.signals[0].type).toBe(SIGNAL_TYPES.INSIGHT_ENGAGE)
        expect(_signalStore.signals[0].metadata.insightType).toBe('daily-planning')
        expect(_signalStore.signals[0].metadata.urgency).toBe('alert')
    })

    it('recordInsightEngage ignores unknown insight types', () => {
        const { recordInsightEngage } = useBehavioralSignals()
        recordInsightEngage('not-a-real-type', 'alert')
        expect(_signalStore.signals).toHaveLength(0)
    })

    it('recordInsightEngage accepts all valid insight types', () => {
        const { recordInsightEngage } = useBehavioralSignals()
        const types = ['daily-planning', 'comfort', 'commute', 'activity',
            'routine-adapt', 'risk-alert', 'environmental', 'ambient']
        for (const t of types) {
            recordInsightEngage(t, 'useful')
        }
        expect(_signalStore.signals).toHaveLength(types.length)
    })

    // ── Learning disabled ─────────────────────────────────────────────────

    it('recordAppOpen is a no-op when behavioralLearning is false', () => {
        _mockCtx.value = {
            preferences: {
                intelligence: { behavioralLearning: false },
                notifications: { enabled: true }
            }
        }
        const { recordAppOpen } = useBehavioralSignals()
        recordAppOpen()
        expect(_signalStore.signals).toHaveLength(0)
    })

    it('recordInsightEngage is a no-op when behavioralLearning is false', () => {
        _mockCtx.value = {
            preferences: {
                intelligence: { behavioralLearning: false },
                notifications: { enabled: true }
            }
        }
        const { recordInsightEngage } = useBehavioralSignals()
        recordInsightEngage('activity', 'alert')
        expect(_signalStore.signals).toHaveLength(0)
    })

    it('learningEnabled defaults to true when preference field is missing', () => {
        _mockCtx.value = { preferences: {} }  // no intelligence key
        const { learningEnabled, recordAppOpen } = useBehavioralSignals()
        expect(learningEnabled.value).toBe(true)
        recordAppOpen()
        expect(_signalStore.signals).toHaveLength(1)
    })

    // ── Learning is independent of notifications.enabled ──────────────────

    it('records signals when notifications are off but learning is on', () => {
        // notifications.enabled = false but behavioralLearning = true
        _mockCtx.value = {
            preferences: {
                intelligence: { behavioralLearning: true },
                notifications: { enabled: false }
            }
        }
        const { recordAppOpen } = useBehavioralSignals()
        recordAppOpen()
        expect(_signalStore.signals).toHaveLength(1)
    })

    it('does NOT record signals when learning is off even if notifications are on', () => {
        _mockCtx.value = {
            preferences: {
                intelligence: { behavioralLearning: false },
                notifications: { enabled: true }
            }
        }
        const { recordAppOpen } = useBehavioralSignals()
        recordAppOpen()
        expect(_signalStore.signals).toHaveLength(0)
    })

    // ── 90-day retention ──────────────────────────────────────────────────

    it('prunes signals older than 90 days on write', () => {
        const ninetyOneDaysAgo = Date.now() - (91 * 24 * 60 * 60 * 1000)
        // Pre-seed an old signal
        _signalStore = {
            schemaVersion: '1.0.0',
            signals: [{
                type: 'app-open',
                timestamp: ninetyOneDaysAgo,
                metadata: {}
            }]
        }
        const { recordAppOpen } = useBehavioralSignals()
        recordAppOpen()
        // Old signal should be pruned; only the new one remains
        expect(_signalStore.signals).toHaveLength(1)
        expect(_signalStore.signals[0].timestamp).toBeGreaterThan(ninetyOneDaysAgo)
    })

    it('retains signals within 90 days', () => {
        const eightyNineDaysAgo = Date.now() - (89 * 24 * 60 * 60 * 1000)
        _signalStore = {
            schemaVersion: '1.0.0',
            signals: [{
                type: 'app-open',
                timestamp: eightyNineDaysAgo,
                metadata: {}
            }]
        }
        const { recordAppOpen } = useBehavioralSignals()
        recordAppOpen()
        expect(_signalStore.signals).toHaveLength(2)
    })

    // ── getSignalWeights ──────────────────────────────────────────────────

    it('returns empty Map when no signals recorded', () => {
        const { getSignalWeights } = useBehavioralSignals()
        const weights = getSignalWeights()
        expect(weights).toBeInstanceOf(Map)
        expect(weights.size).toBe(0)
    })

    it('returns empty Map when learning is disabled', () => {
        _mockCtx.value = { preferences: { intelligence: { behavioralLearning: false } } }
        // Pre-seed some signals
        _signalStore = {
            schemaVersion: '1.0.0',
            signals: [{
                type: 'insight-engage',
                timestamp: Date.now(),
                metadata: { insightType: 'activity', urgency: 'alert' }
            }]
        }
        const { getSignalWeights } = useBehavioralSignals()
        expect(getSignalWeights().size).toBe(0)
    })

    it('assigns weight 1.0 to the most-engaged type', () => {
        // activity engaged 3 times, daily-planning engaged 1 time
        const now = Date.now()
        _signalStore = {
            schemaVersion: '1.0.0',
            signals: [
                { type: 'insight-engage', timestamp: now, metadata: { insightType: 'activity', urgency: 'alert' } },
                { type: 'insight-engage', timestamp: now, metadata: { insightType: 'activity', urgency: 'heads-up' } },
                { type: 'insight-engage', timestamp: now, metadata: { insightType: 'activity', urgency: 'alert' } },
                { type: 'insight-engage', timestamp: now, metadata: { insightType: 'daily-planning', urgency: 'useful' } },
            ]
        }
        const { getSignalWeights } = useBehavioralSignals()
        const weights = getSignalWeights()
        expect(weights.get('activity')).toBe(1.0)
        expect(weights.get('daily-planning')).toBeCloseTo(1 / 3)
    })

    it('ignores signals outside the 30-day weight window', () => {
        const thirtyOneDaysAgo = Date.now() - (31 * 24 * 60 * 60 * 1000)
        _signalStore = {
            schemaVersion: '1.0.0',
            signals: [
                // Old signal — outside 30-day window
                { type: 'insight-engage', timestamp: thirtyOneDaysAgo, metadata: { insightType: 'activity', urgency: 'alert' } },
                // Recent signal
                { type: 'insight-engage', timestamp: Date.now(), metadata: { insightType: 'commute', urgency: 'heads-up' } },
            ]
        }
        const { getSignalWeights } = useBehavioralSignals()
        const weights = getSignalWeights()
        expect(weights.has('activity')).toBe(false)
        expect(weights.get('commute')).toBe(1.0)
    })

    it('ignores app-open signals when computing weights', () => {
        _signalStore = {
            schemaVersion: '1.0.0',
            signals: [
                { type: 'app-open', timestamp: Date.now(), metadata: {} },
                { type: 'app-open', timestamp: Date.now(), metadata: {} },
            ]
        }
        const { getSignalWeights } = useBehavioralSignals()
        expect(getSignalWeights().size).toBe(0)
    })

    it('all weights are in 0–1 range', () => {
        const now = Date.now()
        _signalStore = {
            schemaVersion: '1.0.0',
            signals: [
                { type: 'insight-engage', timestamp: now, metadata: { insightType: 'activity', urgency: 'alert' } },
                { type: 'insight-engage', timestamp: now, metadata: { insightType: 'activity', urgency: 'alert' } },
                { type: 'insight-engage', timestamp: now, metadata: { insightType: 'commute', urgency: 'heads-up' } },
                { type: 'insight-engage', timestamp: now, metadata: { insightType: 'comfort', urgency: 'useful' } },
            ]
        }
        const { getSignalWeights } = useBehavioralSignals()
        const weights = getSignalWeights()
        for (const [, w] of weights) {
            expect(w).toBeGreaterThanOrEqual(0)
            expect(w).toBeLessThanOrEqual(1)
        }
    })

    // ── getSignalSummary ──────────────────────────────────────────────────

    it('getSignalSummary counts recent app-opens and engagements', () => {
        const now = Date.now()
        _signalStore = {
            schemaVersion: '1.0.0',
            signals: [
                { type: 'app-open', timestamp: now, metadata: {} },
                { type: 'app-open', timestamp: now, metadata: {} },
                { type: 'insight-engage', timestamp: now, metadata: { insightType: 'activity', urgency: 'alert' } },
            ]
        }
        const { getSignalSummary } = useBehavioralSignals()
        const summary = getSignalSummary()
        expect(summary.appOpens).toBe(2)
        expect(summary.insightEngagements).toBe(1)
        expect(summary.totalSignals).toBe(3)
    })

    it('getSignalSummary excludes signals older than 30 days', () => {
        const thirtyOneDaysAgo = Date.now() - (31 * 24 * 60 * 60 * 1000)
        _signalStore = {
            schemaVersion: '1.0.0',
            signals: [
                { type: 'app-open', timestamp: thirtyOneDaysAgo, metadata: {} },
                { type: 'app-open', timestamp: Date.now(), metadata: {} },
            ]
        }
        const { getSignalSummary } = useBehavioralSignals()
        const summary = getSignalSummary()
        expect(summary.appOpens).toBe(1)
    })

    // ── clearSignals ──────────────────────────────────────────────────────

    it('clearSignals empties the signal store', () => {
        _signalStore = {
            schemaVersion: '1.0.0',
            signals: [
                { type: 'app-open', timestamp: Date.now(), metadata: {} },
                { type: 'insight-engage', timestamp: Date.now(), metadata: { insightType: 'activity', urgency: 'alert' } }
            ]
        }
        const { clearSignals } = useBehavioralSignals()
        clearSignals()
        expect(_signalStore.signals).toHaveLength(0)
    })

    it('getSignalWeights returns empty Map after clearSignals', () => {
        _signalStore = {
            schemaVersion: '1.0.0',
            signals: [
                { type: 'insight-engage', timestamp: Date.now(), metadata: { insightType: 'activity', urgency: 'alert' } }
            ]
        }
        const { clearSignals, getSignalWeights } = useBehavioralSignals()
        clearSignals()
        expect(getSignalWeights().size).toBe(0)
    })

    // ── getRecentSignals ──────────────────────────────────────────────────

    it('getRecentSignals returns signals within the default 30-day window', () => {
        const now = Date.now()
        const old = now - (31 * 24 * 60 * 60 * 1000)
        _signalStore = {
            schemaVersion: '1.0.0',
            signals: [
                { type: 'app-open', timestamp: old, metadata: {} },
                { type: 'app-open', timestamp: now, metadata: {} }
            ]
        }
        const { getRecentSignals } = useBehavioralSignals()
        const recent = getRecentSignals()
        expect(recent).toHaveLength(1)
        expect(recent[0].timestamp).toBe(now)
    })
})
