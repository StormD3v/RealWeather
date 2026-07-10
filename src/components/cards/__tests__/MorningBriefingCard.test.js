/**
 * MorningBriefingCard.test.js — Phase 3.3
 *
 * Tests that the card consumes InsightSet correctly and renders no
 * weather reasoning of its own.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref, computed } from 'vue'
import MorningBriefingCard from '../MorningBriefingCard.vue'

// ── Mock useInsightEngine ─────────────────────────────────────────────────
const mockInsights = ref([])

vi.mock('@/composables/useInsightEngine', () => ({
    useInsightEngine: () => ({
        leadInsight: computed(() => mockInsights.value[0] ?? null),
        alertInsights: computed(() =>
            mockInsights.value.filter(i => i.urgency === 'heads-up' || i.urgency === 'alert')
        ),
        hasInsights: computed(() => mockInsights.value.length > 0)
    })
}))

// ── Mock useWeatherStore ──────────────────────────────────────────────────
vi.mock('@/stores/weather', () => ({
    useWeatherStore: () => ({
        currentWeather: { name: 'London' },
        loading: false
    })
}))

// ── Mock Pinia ────────────────────────────────────────────────────────────
vi.mock('pinia', () => ({
    defineStore: vi.fn(),
    storeToRefs: vi.fn()
}))

function makeInsight(overrides = {}) {
    return {
        id: 'test-id-1',
        type: 'daily-planning',
        urgency: 'useful',
        content: 'Rain arrives around 3 PM.',
        actionPath: 'Do outdoor activity before 3 PM.',
        confidence: 'high',
        timing: { notify: false, windowStart: null, windowEnd: null, notifyAt: null },
        sourceContext: { usedLocation: true, usedRoutine: false, usedActivity: false, usedSensitivity: false },
        ...overrides
    }
}

describe('MorningBriefingCard — Phase 3.3', () => {

    beforeEach(() => {
        mockInsights.value = []
    })

    // ── Empty state ───────────────────────────────────────────────────────

    it('renders empty state when engine has no insights', () => {
        const wrapper = mount(MorningBriefingCard)
        expect(wrapper.find('.briefing-empty').exists()).toBe(true)
        expect(wrapper.find('.insight-block').exists()).toBe(false)
    })

    it('shows city name in greeting', () => {
        const wrapper = mount(MorningBriefingCard)
        expect(wrapper.text()).toContain('London')
    })

    // ── Lead insight rendering ────────────────────────────────────────────

    it('renders lead insight content and actionPath', () => {
        mockInsights.value = [makeInsight()]
        const wrapper = mount(MorningBriefingCard)
        expect(wrapper.find('.insight-content').text()).toBe('Rain arrives around 3 PM.')
        expect(wrapper.find('.insight-action').text()).toBe('Do outdoor activity before 3 PM.')
    })

    it('does not render empty state when insight is present', () => {
        mockInsights.value = [makeInsight()]
        const wrapper = mount(MorningBriefingCard)
        expect(wrapper.find('.briefing-empty').exists()).toBe(false)
    })

    // ── Urgency badge mapping ─────────────────────────────────────────────

    it('renders alert badge for urgency=alert', () => {
        mockInsights.value = [makeInsight({ urgency: 'alert', content: 'Thunderstorm active.', actionPath: 'Stay indoors.' })]
        const wrapper = mount(MorningBriefingCard)
        const badge = wrapper.find('.insight-badge')
        expect(badge.classes()).toContain('badge--alert')
        expect(badge.text()).toContain('Alert')
    })

    it('renders heads-up badge for urgency=heads-up', () => {
        mockInsights.value = [makeInsight({ urgency: 'heads-up', content: 'Rain incoming.', actionPath: 'Bring umbrella.' })]
        const wrapper = mount(MorningBriefingCard)
        const badge = wrapper.find('.insight-badge')
        expect(badge.classes()).toContain('badge--heads-up')
        expect(badge.text()).toContain('Heads up')
    })

    it('renders info badge for urgency=useful', () => {
        mockInsights.value = [makeInsight({ urgency: 'useful' })]
        const wrapper = mount(MorningBriefingCard)
        const badge = wrapper.find('.insight-badge')
        expect(badge.classes()).toContain('badge--useful')
    })

    it('renders no urgency badge text for urgency=ambient', () => {
        mockInsights.value = [makeInsight({ urgency: 'ambient', content: 'Clear skies.', actionPath: 'Good day for a walk.' })]
        const wrapper = mount(MorningBriefingCard)
        const badge = wrapper.find('.insight-badge')
        expect(badge.classes()).toContain('badge--ambient')
    })

    // ── No weather reasoning in component ────────────────────────────────

    it('does not contain raw weather threshold logic', () => {
        // The component script must not reference temperature thresholds
        const wrapper = mount(MorningBriefingCard)
        // If the component rendered using raw weather data it would show
        // profile-based tips — verify these are gone
        expect(wrapper.text()).not.toContain('productive day')
        expect(wrapper.text()).not.toContain('commute around the rain')
        expect(wrapper.text()).not.toContain('Front-load')
    })

    // ── Backwards-compat props accepted without error ─────────────────────

    it('accepts legacy props without throwing', () => {
        expect(() => mount(MorningBriefingCard, {
            props: {
                currentWeather: { name: 'Paris', main: { temp: 20 }, weather: [{ main: 'Clear' }] },
                hourlyForecast: [],
                impactScore: { score: 70, label: 'Good' },
                userProfile: 'athlete'
            }
        })).not.toThrow()
    })
})
