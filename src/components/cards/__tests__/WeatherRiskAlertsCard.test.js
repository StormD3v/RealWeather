/**
 * WeatherRiskAlertsCard.test.js — Phase 3.3
 *
 * Tests that the card maps alertInsights to existing severity CSS classes
 * and renders no weather reasoning of its own.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref, computed } from 'vue'
import WeatherRiskAlertsCard from '../WeatherRiskAlertsCard.vue'

// ── Mock useInsightEngine ─────────────────────────────────────────────────
const mockAlertInsights = ref([])

vi.mock('@/composables/useInsightEngine', () => ({
    useInsightEngine: () => ({
        alertInsights: computed(() => mockAlertInsights.value)
    })
}))

vi.mock('pinia', () => ({
    defineStore: vi.fn(),
    storeToRefs: vi.fn()
}))

function makeInsight(overrides = {}) {
    return {
        id: 'alert-1',
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

describe('WeatherRiskAlertsCard — Phase 3.3', () => {

    beforeEach(() => {
        mockAlertInsights.value = []
    })

    // ── Empty / no-alerts state ───────────────────────────────────────────

    it('shows no-alerts state when alertInsights is empty', () => {
        const wrapper = mount(WeatherRiskAlertsCard)
        expect(wrapper.find('.no-alerts').exists()).toBe(true)
        expect(wrapper.find('.alerts-content').exists()).toBe(false)
    })

    it('shows SVG icon in no-alerts state', () => {
        const wrapper = mount(WeatherRiskAlertsCard)
        expect(wrapper.find('.no-alerts-icon svg').exists()).toBe(true)
    })

    // ── Alert rendering ───────────────────────────────────────────────────

    it('renders alert items when alertInsights has entries', () => {
        mockAlertInsights.value = [makeInsight()]
        const wrapper = mount(WeatherRiskAlertsCard)
        expect(wrapper.find('.alerts-content').exists()).toBe(true)
        expect(wrapper.findAll('.alert-item')).toHaveLength(1)
    })

    it('renders insight content as alert title', () => {
        mockAlertInsights.value = [makeInsight({ content: 'Rain expected around 3 PM.' })]
        const wrapper = mount(WeatherRiskAlertsCard)
        expect(wrapper.find('.alert-title').text()).toBe('Rain expected around 3 PM.')
    })

    it('renders insight actionPath as alert description', () => {
        mockAlertInsights.value = [makeInsight({ actionPath: 'Wrap up outdoor plans before 3 PM.' })]
        const wrapper = mount(WeatherRiskAlertsCard)
        expect(wrapper.find('.alert-description').text()).toBe('Wrap up outdoor plans before 3 PM.')
    })

    // ── Urgency → CSS severity class mapping ─────────────────────────────

    it('maps urgency=heads-up to CSS class "high"', () => {
        mockAlertInsights.value = [makeInsight({ urgency: 'heads-up' })]
        const wrapper = mount(WeatherRiskAlertsCard)
        expect(wrapper.find('.alert-item').classes()).toContain('high')
        expect(wrapper.find('.alert-item').classes()).not.toContain('severe')
    })

    it('maps urgency=alert to CSS class "severe"', () => {
        mockAlertInsights.value = [makeInsight({ urgency: 'alert', content: 'Storm warning.', actionPath: 'Seek shelter.' })]
        const wrapper = mount(WeatherRiskAlertsCard)
        expect(wrapper.find('.alert-item').classes()).toContain('severe')
        expect(wrapper.find('.alert-item').classes()).not.toContain('high')
    })

    it('assigns correct SVG icon for heads-up urgency', () => {
        mockAlertInsights.value = [makeInsight({ urgency: 'heads-up' })]
        const wrapper = mount(WeatherRiskAlertsCard)
        expect(wrapper.find('.alert-icon svg').exists()).toBe(true)
    })

    it('assigns correct SVG icon for alert urgency', () => {
        mockAlertInsights.value = [makeInsight({ urgency: 'alert', content: 'Storm.', actionPath: 'Shelter.' })]
        const wrapper = mount(WeatherRiskAlertsCard)
        expect(wrapper.find('.alert-icon svg').exists()).toBe(true)
    })

    // ── Multiple alerts ───────────────────────────────────────────────────

    it('renders multiple alert items', () => {
        mockAlertInsights.value = [
            makeInsight({ id: 'a1', urgency: 'alert', content: 'Storm.', actionPath: 'Shelter.' }),
            makeInsight({ id: 'a2', urgency: 'heads-up', content: 'Rain.', actionPath: 'Umbrella.' })
        ]
        const wrapper = mount(WeatherRiskAlertsCard)
        expect(wrapper.findAll('.alert-item')).toHaveLength(2)
    })

    // ── No weather reasoning ──────────────────────────────────────────────

    it('accepts legacy props without throwing', () => {
        expect(() => mount(WeatherRiskAlertsCard, {
            props: {
                forecastData: [{ main: { temp: 36 }, wind: { speed: 10 }, rain: { chance: 80 } }],
                currentWeather: { main: { temp: 32 }, wind: { speed: 8 }, weather: [{ main: 'Clear' }] }
            }
        })).not.toThrow()
    })
})
