/**
 * useWeatherNotifications.test.js — Phase 3.3 + Phase 3.4
 *
 * Tests:
 * 1. Master gate: notifications.enabled=false → nothing fires
 * 2. Insight path: timing.notify=true + correct pref gate → fires
 * 3. Insight path: timing.notify=false → no notification
 * 4. Fallback path: hourly scan fires when no notifiable insights
 * 5. Legacy call signature preserved
 * 6. Preference gates per insight type
 * 7. Phase 3.4: schedulePreDepartureAlert gating and scheduling
 *
 * Uses vi.spyOn on the notifications module to avoid vi.mock hoisting
 * issues with module-level variables.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Create the spy reference using vi.hoisted so it exists before vi.mock runs ──
const mockSendNotification = vi.hoisted(() => vi.fn())

vi.mock('@/utils/notifications', () => ({
    sendNotification: mockSendNotification,
    requestNotificationPermission: vi.fn().mockResolvedValue(true)
}))

// ── Mock useUserContext via vi.mock (hoisted, uses factory returning fn) ──
let _mockPrefs = null

vi.mock('@/composables/useUserContext', () => ({
    useUserContext: () => ({
        userContext: {
            value: { preferences: { notifications: _mockPrefs } }
        }
    })
}))

// ── Mock generateDepartureBrief so pre-departure tests are deterministic ──
const mockGenerateDepartureBrief = vi.hoisted(() => vi.fn())

vi.mock('@/utils/departureBrief', () => ({
    generateDepartureBrief: mockGenerateDepartureBrief
}))

import { scheduleWeatherAlerts, schedulePreDepartureAlert, _resetPreDepartureKeys } from '@/composables/useWeatherNotifications'

// Unique counter so scheduledAlertKeys never dedupes across tests
let _slotCounter = 1000

function makeUniqueSlot(overrides = {}) {
    _slotCounter++
    return {
        dt: Math.floor((Date.now() + 5000 + _slotCounter * 3000) / 1000),
        pop: 0.9,
        main: { temp: 20 },
        ...overrides
    }
}

describe('useWeatherNotifications — Phase 3.3', () => {

    let sendSpy

    beforeEach(() => {
        vi.useFakeTimers()
        vi.clearAllMocks()
        sendSpy = mockSendNotification
        _mockPrefs = null
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    function makePrefs(overrides = {}) {
        return {
            enabled: true,
            commute: false,
            morningBriefing: false,
            activityAlerts: false,
            riskAlerts: false,
            preDeparture: false,
            ambient: false,
            ...overrides
        }
    }

    function makeInsight(overrides = {}) {
        return {
            id: `insight-${Date.now()}-${Math.random()}`,
            type: 'daily-planning',
            urgency: 'heads-up',
            content: 'Rain expected around 3 PM.',
            actionPath: 'Wrap up outdoor plans before 3 PM.',
            confidence: 'high',
            timing: { notify: false, windowStart: null, windowEnd: null, notifyAt: null },
            sourceContext: { usedLocation: true, usedRoutine: false, usedActivity: false, usedSensitivity: false },
            ...overrides
        }
    }

    // ── Master gate ─────────────────────────────────────────────────────

    it('does nothing when notifications.enabled is false', async () => {
        _mockPrefs = makePrefs({ enabled: false, riskAlerts: true })
        const insight = makeInsight({ timing: { notify: true, windowStart: null, windowEnd: null, notifyAt: null } })

        scheduleWeatherAlerts([insight], [])
        await vi.runAllTimersAsync()

        expect(sendSpy).not.toHaveBeenCalled()
    })

    it('does nothing when prefs are null', async () => {
        _mockPrefs = null
        scheduleWeatherAlerts([makeInsight()], [])
        await vi.runAllTimersAsync()
        expect(sendSpy).not.toHaveBeenCalled()
    })

    // ── Insight path ────────────────────────────────────────────────────

    it('does NOT fire when timing.notify is false', async () => {
        _mockPrefs = makePrefs({ enabled: true, riskAlerts: true })
        scheduleWeatherAlerts([makeInsight()], [])
        await vi.runAllTimersAsync()
        expect(sendSpy).not.toHaveBeenCalled()
    })

    it('fires when timing.notify=true and pref gate passes', async () => {
        _mockPrefs = makePrefs({ enabled: true, riskAlerts: true })
        const insight = makeInsight({
            timing: { notify: true, windowStart: null, windowEnd: null, notifyAt: null }
        })
        scheduleWeatherAlerts([insight], [])
        await vi.runAllTimersAsync()
        expect(sendSpy).toHaveBeenCalledOnce()
        expect(sendSpy.mock.calls[0][1]).toContain('Rain expected around 3 PM.')
    })

    it('does NOT fire when timing.notify=true but pref gate is false', async () => {
        _mockPrefs = makePrefs({ enabled: true, riskAlerts: false })
        const insight = makeInsight({
            type: 'daily-planning',
            timing: { notify: true, windowStart: null, windowEnd: null, notifyAt: null }
        })
        scheduleWeatherAlerts([insight], [])
        await vi.runAllTimersAsync()
        expect(sendSpy).not.toHaveBeenCalled()
    })

    // ── Preference gates ────────────────────────────────────────────────

    it('uses commute pref for commute insights', async () => {
        _mockPrefs = makePrefs({ enabled: true, commute: true, riskAlerts: false })
        const insight = makeInsight({
            type: 'commute',
            content: 'Rain at departure.',
            actionPath: 'Bring waterproofs.',
            timing: { notify: true, windowStart: null, windowEnd: null, notifyAt: null }
        })
        scheduleWeatherAlerts([insight], [])
        await vi.runAllTimersAsync()
        expect(sendSpy).toHaveBeenCalledOnce()
    })

    it('uses activityAlerts pref for activity insights', async () => {
        _mockPrefs = makePrefs({ enabled: true, activityAlerts: true, riskAlerts: false })
        const insight = makeInsight({
            type: 'activity',
            content: 'Running not recommended.',
            actionPath: 'Skip today.',
            timing: { notify: true, windowStart: null, windowEnd: null, notifyAt: null }
        })
        scheduleWeatherAlerts([insight], [])
        await vi.runAllTimersAsync()
        expect(sendSpy).toHaveBeenCalledOnce()
    })

    // ── Fallback path ───────────────────────────────────────────────────

    it('runs hourly fallback when insightSet is empty and hourly has rain >60%', async () => {
        _mockPrefs = makePrefs({ enabled: true, riskAlerts: true })
        const slot = makeUniqueSlot({ pop: 0.9 })
        scheduleWeatherAlerts([], [slot])
        await vi.runAllTimersAsync()
        expect(sendSpy).toHaveBeenCalled()
        expect(sendSpy.mock.calls[0][0]).toContain('Rain Alert')
    })

    it('runs hourly fallback when insightSet has no notify insights', async () => {
        _mockPrefs = makePrefs({ enabled: true, riskAlerts: true })
        const insight = makeInsight() // timing.notify = false
        const slot = makeUniqueSlot({ pop: 0.95 })
        scheduleWeatherAlerts([insight], [slot])
        await vi.runAllTimersAsync()
        expect(sendSpy).toHaveBeenCalled()
        expect(sendSpy.mock.calls[0][0]).toContain('Rain Alert')
    })

    // ── Legacy call signature ───────────────────────────────────────────

    it('handles legacy (hourlyForecast, userProfile) call without throwing', async () => {
        _mockPrefs = makePrefs({ enabled: true, riskAlerts: true })
        const slot = makeUniqueSlot({ pop: 0.9 })
        expect(() => scheduleWeatherAlerts([slot], 'general')).not.toThrow()
        await vi.runAllTimersAsync()
        expect(sendSpy).toHaveBeenCalled()
    })
})

// ---------------------------------------------------------------------------
// Phase 3.4 — schedulePreDepartureAlert
// ---------------------------------------------------------------------------

/**
 * Helper: returns an "HH:MM" departure time N minutes from now.
 * Used to produce a future departure that passes all gates.
 */
function futureDepartureTime(minutesFromNow = 45) {
    const d = new Date(Date.now() + minutesFromNow * 60 * 1000)
    const h = String(d.getHours()).padStart(2, '0')
    const m = String(d.getMinutes()).padStart(2, '0')
    return `${h}:${m}`
}

function makePreDeparturePrefs(overrides = {}) {
    return {
        enabled: true,
        preDeparture: true,
        riskAlerts: false,
        commute: false,
        morningBriefing: false,
        activityAlerts: false,
        ...overrides
    }
}

function makeDepartureBriefResult(overrides = {}) {
    return {
        title: '⚠️ Before you go',
        body: 'Rain at departure. Bring an umbrella.',
        urgency: 'heads-up',
        ...overrides
    }
}

describe('schedulePreDepartureAlert — Phase 3.4', () => {

    beforeEach(() => {
        vi.useFakeTimers()
        vi.clearAllMocks()
        mockGenerateDepartureBrief.mockReturnValue(makeDepartureBriefResult())
        _mockPrefs = null
        _resetPreDepartureKeys()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    // ── Master gate ───────────────────────────────────────────────────────

    it('does nothing when notifications.enabled is false', async () => {
        const prefs = makePreDeparturePrefs({ enabled: false })
        schedulePreDepartureAlert([], futureDepartureTime(), prefs)
        await vi.runAllTimersAsync()
        expect(mockSendNotification).not.toHaveBeenCalled()
    })

    it('does nothing when preDeparture preference is false', async () => {
        const prefs = makePreDeparturePrefs({ preDeparture: false })
        schedulePreDepartureAlert([], futureDepartureTime(), prefs)
        await vi.runAllTimersAsync()
        expect(mockSendNotification).not.toHaveBeenCalled()
    })

    it('does nothing when prefs is null', async () => {
        schedulePreDepartureAlert([], futureDepartureTime(), null)
        await vi.runAllTimersAsync()
        expect(mockSendNotification).not.toHaveBeenCalled()
    })

    // ── Departure time gate ───────────────────────────────────────────────

    it('does nothing when departureTime is null', async () => {
        const prefs = makePreDeparturePrefs()
        schedulePreDepartureAlert([], null, prefs)
        await vi.runAllTimersAsync()
        expect(mockSendNotification).not.toHaveBeenCalled()
    })

    it('does nothing when departureTime is invalid string', async () => {
        const prefs = makePreDeparturePrefs()
        schedulePreDepartureAlert([], 'not-a-time', prefs)
        await vi.runAllTimersAsync()
        expect(mockSendNotification).not.toHaveBeenCalled()
    })

    it('does nothing when departure time is in the past', async () => {
        const prefs = makePreDeparturePrefs()
        // Departure 90 minutes ago → notifyAt would be 120 min ago
        const past = new Date(Date.now() - 90 * 60 * 1000)
        const timeStr = `${String(past.getHours()).padStart(2, '0')}:${String(past.getMinutes()).padStart(2, '0')}`
        schedulePreDepartureAlert([], timeStr, prefs)
        await vi.runAllTimersAsync()
        expect(mockSendNotification).not.toHaveBeenCalled()
    })

    // ── Brief gate ────────────────────────────────────────────────────────

    it('does nothing when generateDepartureBrief returns null', async () => {
        mockGenerateDepartureBrief.mockReturnValue(null)
        const prefs = makePreDeparturePrefs()
        schedulePreDepartureAlert([], futureDepartureTime(), prefs)
        await vi.runAllTimersAsync()
        expect(mockSendNotification).not.toHaveBeenCalled()
    })

    // ── Fires correctly ───────────────────────────────────────────────────

    it('fires notification when all gates pass and brief is generated', async () => {
        const prefs = makePreDeparturePrefs()
        schedulePreDepartureAlert([], futureDepartureTime(45), prefs)
        await vi.runAllTimersAsync()
        expect(mockSendNotification).toHaveBeenCalledOnce()
    })

    it('sends the title and body from the departure brief', async () => {
        const brief = makeDepartureBriefResult({
            title: '🔴 Before you go',
            body: 'Thunderstorm active. Stay indoors.'
        })
        mockGenerateDepartureBrief.mockReturnValue(brief)
        const prefs = makePreDeparturePrefs()
        schedulePreDepartureAlert([], futureDepartureTime(45), prefs)
        await vi.runAllTimersAsync()
        expect(mockSendNotification).toHaveBeenCalledWith(
            '🔴 Before you go',
            'Thunderstorm active. Stay indoors.',
            '/favicon.ico'
        )
    })

    it('passes the insightSet to generateDepartureBrief', async () => {
        const insights = [{
            id: 'test', type: 'commute', urgency: 'heads-up',
            content: 'Rain.', actionPath: 'Umbrella.',
            timing: { notify: true }, confidence: 'high',
            sourceContext: { usedLocation: true, usedRoutine: false, usedActivity: false, usedSensitivity: false }
        }]
        const prefs = makePreDeparturePrefs()
        schedulePreDepartureAlert(insights, futureDepartureTime(45), prefs)
        await vi.runAllTimersAsync()
        expect(mockGenerateDepartureBrief).toHaveBeenCalledWith(insights)
    })

    // ── Deduplication ─────────────────────────────────────────────────────

    it('does not send duplicate notifications for the same departure time on the same day', async () => {
        const prefs = makePreDeparturePrefs()
        const sameTime = futureDepartureTime(50)
        // Call twice with the SAME departure time — second call is a no-op
        schedulePreDepartureAlert([], sameTime, prefs)
        schedulePreDepartureAlert([], sameTime, prefs)
        await vi.runAllTimersAsync()
        expect(mockSendNotification).toHaveBeenCalledTimes(1)
    })
})
