/**
 * useUserContext.test.js
 * Unit tests for src/composables/useUserContext.js — Phase 2, Task 5.5
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// contextMigration must be imported to register itself before contextStore is used
import '@/utils/contextMigration.js'

const CONTEXT_KEY = 'lumi.context.v1'

function setValidContextWithLocation() {
    const ctx = {
        meta: { schemaVersion: '1.0.0', contextQuality: 'minimal', completeness: { hasLocation: true, hasRoutine: false, hasActivities: false, hasSensitivities: false, hasPreferences: true }, createdAt: 0, lastModifiedAt: 0 },
        location: { primary: { name: 'London', lat: 51.5, lon: -0.1, timezone: 'Europe/London', locationType: 'urban', confidence: 'declared' }, saved: [], current: null },
        routines: { weekday: { departureTime: null, returnTime: null, outdoorWindows: [] }, weekend: { outdoorWindows: [] }, confidence: 'declared' },
        activities: { declared: [] },
        schedule: { manualEvents: [], calendarConnected: false },
        preferences: { temperatureUnit: 'C', theme: 'dark', verbosity: 'concise', notifications: { enabled: false, commute: false, morningBriefing: false, activityAlerts: false, riskAlerts: false, preDeparture: false, ambient: false }, intelligenceAreas: { dailyPlanning: true, activityRecommend: false, commuteIntelligence: false, routineAdaptation: true, environmentalAware: false } },
        sensitivities: { heat: false, cold: false, pollen: false, uv: false, airQuality: false, precipitation: false }
    }
    localStorage.setItem(CONTEXT_KEY, JSON.stringify(ctx))
    return ctx
}

describe('useUserContext', () => {
    beforeEach(() => {
        setActivePinia(createPinia())
        localStorage.clear()
        // Reset the singleton between tests by clearing storage
        // (module state persists across tests — we test against the live singleton)
    })

    afterEach(() => {
        localStorage.clear()
    })

    async function getComposable() {
        // Dynamically import to get current module state
        const mod = await import('@/composables/useUserContext.js')
        return mod.useUserContext()
    }

    // ---------------------------------------------------------------------------
    // Basic singleton and reactivity
    // ---------------------------------------------------------------------------

    it('returns the same object on multiple calls (singleton)', async () => {
        const mod = await import('@/composables/useUserContext.js')
        const a = mod.useUserContext()
        const b = mod.useUserContext()
        // Both share the same underlying _persistentContext singleton —
        // a mutation via one should be visible through the other
        a.setContext({ preferences: { temperatureUnit: 'F' } })
        expect(b.persistentContext.value.preferences.temperatureUnit).toBe('F')
        // Clean up
        a.setContext({ preferences: { temperatureUnit: 'C' } })
    })

    it('setContext partial update does not clear other fields', async () => {
        const { setContext, persistentContext } = await getComposable()
        setContext({ preferences: { temperatureUnit: 'F' } })
        setContext({ sensitivities: { heat: true } })
        // temperatureUnit and heat should both be set
        expect(persistentContext.value.preferences.temperatureUnit).toBe('F')
        expect(persistentContext.value.sensitivities.heat).toBe(true)
    })

    it('setContext with invalid data does not corrupt stored context', async () => {
        const { setContext, persistentContext } = await getComposable()
        setContext({ preferences: { temperatureUnit: 'F' } })
        // Write invalid lat — should be rejected, unit should stay
        setContext({ location: { primary: { name: 'X', lat: 999, lon: 10, timezone: 'UTC', locationType: 'urban', confidence: 'declared' } } })
        expect(persistentContext.value.preferences.temperatureUnit).toBe('F')
        expect(persistentContext.value.location.primary?.lat).toBeNull()
    })

    it('clearContext resets to default state', async () => {
        const { setContext, clearContext, contextQuality, persistentContext } = await getComposable()
        setContext({ preferences: { temperatureUnit: 'F' } })
        clearContext()
        expect(contextQuality.value).toBe('none')
        expect(persistentContext.value.preferences.temperatureUnit).toBe('C')
    })

    // ---------------------------------------------------------------------------
    // contextQuality
    // ---------------------------------------------------------------------------

    it('contextQuality is none when no location stored', async () => {
        const { contextQuality, clearContext } = await getComposable()
        clearContext()
        expect(contextQuality.value).toBe('none')
    })

    it('contextQuality is minimal when only location set', async () => {
        const { setContext, contextQuality } = await getComposable()
        setContext({
            location: { primary: { name: 'London', lat: 51.5, lon: -0.1, timezone: 'Europe/London', locationType: 'urban', confidence: 'declared' } }
        })
        expect(contextQuality.value).toBe('minimal')
    })

    it('contextQuality is partial when location + departure time', async () => {
        const { setContext, contextQuality } = await getComposable()
        setContext({ location: { primary: { name: 'London', lat: 51.5, lon: -0.1, timezone: 'Europe/London', locationType: 'urban', confidence: 'declared' } } })
        setContext({ routines: { weekday: { departureTime: '08:00', returnTime: null, outdoorWindows: [] } } })
        expect(contextQuality.value).toBe('partial')
    })

    it('contextQuality is full when location + routine + activity + sensitivity', async () => {
        const { setContext, contextQuality } = await getComposable()
        setContext({ location: { primary: { name: 'London', lat: 51.5, lon: -0.1, timezone: 'Europe/London', locationType: 'urban', confidence: 'declared' } } })
        setContext({ routines: { weekday: { departureTime: '08:00', returnTime: null, outdoorWindows: [] } } })
        setContext({ activities: { declared: [{ id: 'a1', activityKey: 'running', label: 'Run', frequency: 'daily', seasonRange: null, profile: {} }] } })
        setContext({ sensitivities: { heat: true } })
        expect(contextQuality.value).toBe('full')
    })

    // ---------------------------------------------------------------------------
    // hasContext and isFirstRun
    // ---------------------------------------------------------------------------

    it('hasContext is false when contextQuality is none', async () => {
        const { clearContext, hasContext } = await getComposable()
        clearContext()
        expect(hasContext.value).toBe(false)
    })

    it('hasContext is true when contextQuality is not none', async () => {
        const { setContext, hasContext } = await getComposable()
        setContext({ location: { primary: { name: 'London', lat: 51.5, lon: -0.1, timezone: 'Europe/London', locationType: 'urban', confidence: 'declared' } } })
        expect(hasContext.value).toBe(true)
    })

    // ---------------------------------------------------------------------------
    // userContext exposes location.current from session store
    // ---------------------------------------------------------------------------

    it('userContext.location.current is null when no GPS session data', async () => {
        const { userContext } = await getComposable()
        // No GPS has been set in session store
        expect(userContext.value.location.current).toBeNull()
    })

    // ---------------------------------------------------------------------------
    // persistentContext does not include GPS (session isolation)
    // ---------------------------------------------------------------------------

    it('persistentContext.location.current is null (GPS is session-only)', async () => {
        const { persistentContext } = await getComposable()
        expect(persistentContext.value.location.current).toBeNull()
    })
})
