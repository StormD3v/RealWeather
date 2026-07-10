/**
 * useTheme.test.js
 * Tests for Phase 2 changes to useTheme.js — verifies no regression
 * and that context sync paths work.
 *
 * jsdom does not implement window.matchMedia. The mock must be applied
 * before any import that calls getSystemPreference(), so it lives at
 * the very top of this file using vi.stubGlobal.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Stub matchMedia before any composable is imported
vi.stubGlobal('matchMedia', (query) => ({
    matches: false, // default: light preference
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
}))

import { useTheme } from '@/composables/useTheme.js'

const STORAGE_KEY = 'lumicast-theme'

describe('useTheme (Phase 2)', () => {
    beforeEach(() => {
        localStorage.clear()
        document.documentElement.classList.remove('dark', 'light')
    })

    afterEach(() => {
        localStorage.clear()
    })

    // ---------------------------------------------------------------------------
    // Existing behavior preserved (regression tests)
    // ---------------------------------------------------------------------------

    it('initTheme reads lumicast-theme from localStorage', () => {
        localStorage.setItem(STORAGE_KEY, 'light')
        const { initTheme, resolvedTheme } = useTheme()
        initTheme()
        expect(resolvedTheme.value).toBe('light')
    })

    it('initTheme defaults to system when no key stored', () => {
        const { initTheme, theme } = useTheme()
        initTheme()
        expect(theme.value).toBe('system')
    })

    it('setTheme dark applies dark class to documentElement', () => {
        const { setTheme } = useTheme()
        setTheme('dark')
        expect(document.documentElement.classList.contains('dark')).toBe(true)
    })

    it('setTheme light applies light class to documentElement', () => {
        const { setTheme } = useTheme()
        setTheme('light')
        expect(document.documentElement.classList.contains('light')).toBe(true)
    })

    it('setTheme writes to lumicast-theme localStorage key', () => {
        const { setTheme } = useTheme()
        setTheme('dark')
        expect(localStorage.getItem(STORAGE_KEY)).toBe('dark')
    })

    it('toggleTheme switches from dark to light', () => {
        const { setTheme, toggleTheme, resolvedTheme } = useTheme()
        setTheme('dark')
        toggleTheme()
        expect(resolvedTheme.value).toBe('light')
    })

    it('toggleTheme switches from light to dark', () => {
        const { setTheme, toggleTheme, resolvedTheme } = useTheme()
        setTheme('light')
        toggleTheme()
        expect(resolvedTheme.value).toBe('dark')
    })

    // ---------------------------------------------------------------------------
    // Phase 3.1 sync — setTheme is synchronous; context write is fire-and-forget
    // ---------------------------------------------------------------------------

    it('setTheme completes synchronously — does not block on context write', () => {
        const { setTheme, resolvedTheme } = useTheme()
        setTheme('light')
        expect(resolvedTheme.value).toBe('light')
    })

    it('initTheme reads context theme from lumi.context.v1 synchronously', () => {
        // Pre-populate context with light theme
        const ctx = {
            meta: { schemaVersion: '1.0.0', contextQuality: 'none', completeness: {}, createdAt: 0, lastModifiedAt: 0 },
            preferences: {
                theme: 'light',
                temperatureUnit: 'C', verbosity: 'concise',
                notifications: { enabled: false, commute: false, morningBriefing: false, activityAlerts: false, riskAlerts: false, preDeparture: false, ambient: false },
                intelligenceAreas: { dailyPlanning: true, activityRecommend: false, commuteIntelligence: false, routineAdaptation: true, environmentalAware: false }
            },
            location: { primary: null, saved: [], current: null },
            routines: { weekday: { departureTime: null, returnTime: null, outdoorWindows: [] }, weekend: { outdoorWindows: [] }, confidence: 'declared' },
            activities: { declared: [] },
            schedule: { manualEvents: [], calendarConnected: false },
            sensitivities: { heat: false, cold: false, pollen: false, uv: false, airQuality: false, precipitation: false }
        }
        localStorage.setItem('lumi.context.v1', JSON.stringify(ctx))

        // Set stored preference to dark first
        localStorage.setItem(STORAGE_KEY, 'dark')

        const { initTheme, resolvedTheme } = useTheme()
        initTheme()

        // initTheme now reads lumi.context.v1 synchronously.
        // Context says light and overrides the stored dark preference.
        expect(resolvedTheme.value).toBe('light')
    })
})
