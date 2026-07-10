/**
 * context.test.js
 * Unit tests for src/stores/context.js — Phase 2, Task 5.6
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useContextStore } from '@/stores/context.js'

describe('useContextStore (session context)', () => {
    beforeEach(() => {
        setActivePinia(createPinia())
        localStorage.clear()
    })

    afterEach(() => {
        localStorage.clear()
    })

    it('initializes with gpsPosition: null', () => {
        const store = useContextStore()
        expect(store.gpsPosition).toBeNull()
    })

    it('initializes with isAtPrimary: null', () => {
        const store = useContextStore()
        expect(store.isAtPrimary).toBeNull()
    })

    it('initializes with non-null currentTimestamp', () => {
        const store = useContextStore()
        expect(typeof store.currentTimestamp).toBe('number')
        expect(store.currentTimestamp).toBeGreaterThan(0)
    })

    it('initializes with empty copilotHistory', () => {
        const store = useContextStore()
        expect(store.copilotHistory).toEqual([])
    })

    // ---------------------------------------------------------------------------
    // refreshTimestamp
    // ---------------------------------------------------------------------------

    it('refreshTimestamp updates currentTimestamp', async () => {
        const store = useContextStore()
        const before = store.currentTimestamp
        await new Promise(r => setTimeout(r, 5))
        store.refreshTimestamp()
        expect(store.currentTimestamp).toBeGreaterThanOrEqual(before)
    })

    it('refreshTimestamp updates currentDayOfWeek', () => {
        const store = useContextStore()
        store.refreshTimestamp()
        const expected = new Date().getDay()
        expect(store.currentDayOfWeek).toBe(expected)
    })

    // ---------------------------------------------------------------------------
    // isWeekday / formattedDayOfWeek getters
    // ---------------------------------------------------------------------------

    it('isWeekday is true for Mon-Fri', () => {
        const store = useContextStore()
        // Day 1 = Monday
        store.currentDayOfWeek = 1
        expect(store.isWeekday).toBe(true)
        store.currentDayOfWeek = 5
        expect(store.isWeekday).toBe(true)
    })

    it('isWeekday is false for Sat/Sun', () => {
        const store = useContextStore()
        store.currentDayOfWeek = 0
        expect(store.isWeekday).toBe(false)
        store.currentDayOfWeek = 6
        expect(store.isWeekday).toBe(false)
    })

    it('formattedDayOfWeek returns the day name', () => {
        const store = useContextStore()
        store.currentDayOfWeek = 1
        expect(store.formattedDayOfWeek).toBe('Monday')
        store.currentDayOfWeek = 0
        expect(store.formattedDayOfWeek).toBe('Sunday')
    })

    // ---------------------------------------------------------------------------
    // updateGpsPosition — isAtPrimary
    // ---------------------------------------------------------------------------

    it('sets isAtPrimary: null when no primary location stored', () => {
        const store = useContextStore()
        store.updateGpsPosition(51.5, -0.1)
        expect(store.isAtPrimary).toBeNull()
    })

    it('sets isAtPrimary: true when coords are within 2km of primary', () => {
        // Store a primary location in localStorage (London)
        const ctx = {
            meta: { schemaVersion: '1.0.0', contextQuality: 'minimal', completeness: {}, createdAt: 0, lastModifiedAt: 0 },
            location: { primary: { name: 'London', lat: 51.5074, lon: -0.1278, timezone: 'Europe/London', locationType: 'urban', confidence: 'declared' }, saved: [], current: null },
            routines: { weekday: { departureTime: null, returnTime: null, outdoorWindows: [] }, weekend: { outdoorWindows: [] }, confidence: 'declared' },
            activities: { declared: [] },
            schedule: { manualEvents: [], calendarConnected: false },
            preferences: { temperatureUnit: 'C', theme: 'dark', verbosity: 'concise', notifications: { enabled: false, commute: false, morningBriefing: false, activityAlerts: false, riskAlerts: false, preDeparture: false, ambient: false }, intelligenceAreas: { dailyPlanning: true, activityRecommend: false, commuteIntelligence: false, routineAdaptation: true, environmentalAware: false } },
            sensitivities: { heat: false, cold: false, pollen: false, uv: false, airQuality: false, precipitation: false }
        }
        localStorage.setItem('lumi.context.v1', JSON.stringify(ctx))

        const store = useContextStore()
        // Same coords as primary → 0km distance
        store.updateGpsPosition(51.5074, -0.1278)
        expect(store.isAtPrimary).toBe(true)
    })

    it('sets isAtPrimary: false when coords are far from primary', () => {
        const ctx = {
            meta: { schemaVersion: '1.0.0', contextQuality: 'minimal', completeness: {}, createdAt: 0, lastModifiedAt: 0 },
            location: { primary: { name: 'London', lat: 51.5074, lon: -0.1278, timezone: 'Europe/London', locationType: 'urban', confidence: 'declared' }, saved: [], current: null },
            routines: { weekday: { departureTime: null, returnTime: null, outdoorWindows: [] }, weekend: { outdoorWindows: [] }, confidence: 'declared' },
            activities: { declared: [] },
            schedule: { manualEvents: [], calendarConnected: false },
            preferences: { temperatureUnit: 'C', theme: 'dark', verbosity: 'concise', notifications: { enabled: false, commute: false, morningBriefing: false, activityAlerts: false, riskAlerts: false, preDeparture: false, ambient: false }, intelligenceAreas: { dailyPlanning: true, activityRecommend: false, commuteIntelligence: false, routineAdaptation: true, environmentalAware: false } },
            sensitivities: { heat: false, cold: false, pollen: false, uv: false, airQuality: false, precipitation: false }
        }
        localStorage.setItem('lumi.context.v1', JSON.stringify(ctx))

        const store = useContextStore()
        // Paris — ~340km from London
        store.updateGpsPosition(48.8566, 2.3522)
        expect(store.isAtPrimary).toBe(false)
    })

    // ---------------------------------------------------------------------------
    // clearSession
    // ---------------------------------------------------------------------------

    it('clearSession resets gpsPosition to null', () => {
        const store = useContextStore()
        store.updateGpsPosition(51.5, -0.1)
        store.clearSession()
        expect(store.gpsPosition).toBeNull()
    })

    it('clearSession resets isAtPrimary to null', () => {
        const store = useContextStore()
        store.isAtPrimary = true
        store.clearSession()
        expect(store.isAtPrimary).toBeNull()
    })

    it('clearSession resets copilotHistory to empty', () => {
        const store = useContextStore()
        store.copilotHistory.push({ role: 'user', content: 'hello' })
        store.clearSession()
        expect(store.copilotHistory).toEqual([])
    })

    // ---------------------------------------------------------------------------
    // No localStorage writes
    // ---------------------------------------------------------------------------

    it('does not write to localStorage on any action', () => {
        const spy = vi.spyOn(Storage.prototype, 'setItem')
        const store = useContextStore()
        store.updateGpsPosition(51.5, -0.1)
        store.refreshTimestamp()
        store.clearSession()
        expect(spy).not.toHaveBeenCalled()
        spy.mockRestore()
    })
})
