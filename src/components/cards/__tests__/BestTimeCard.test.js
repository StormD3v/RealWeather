/**
 * BestTimeCard.test.js — Phase 3.3
 *
 * Tests that the card renders insight.content and insight.actionPath directly
 * without parsing or extracting times from strings.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref, computed } from 'vue'
import BestTimeCard from '../BestTimeCard.vue'

// ── Mock useInsightEngine ─────────────────────────────────────────────────
const mockAllInsights = ref([])
const mockHasInsights = ref(false)

vi.mock('@/composables/useInsightEngine', () => ({
    useInsightEngine: () => ({
        insightsByType: (type) => computed(() =>
            mockAllInsights.value.filter(i => i.type === type)
        ),
        insights: computed(() => mockAllInsights.value),
        hasInsights: computed(() => mockHasInsights.value)
    })
}))

vi.mock('pinia', () => ({
    defineStore: vi.fn(),
    storeToRefs: vi.fn()
}))

function makeInsight(overrides = {}) {
    return {
        id: 'plan-1',
        type: 'daily-planning',
        urgency: 'useful',
        content: "Rain arrives around 3 PM. There's a good outdoor window before it.",
        actionPath: 'Do any outdoor activity before 3 PM. After that, expect wet conditions.',
        confidence: 'high',
        timing: { notify: false, windowStart: null, windowEnd: null, notifyAt: null },
        sourceContext: { usedLocation: true, usedRoutine: false, usedActivity: false, usedSensitivity: false },
        ...overrides
    }
}

describe('BestTimeCard — Phase 3.3', () => {

    beforeEach(() => {
        mockAllInsights.value = []
        mockHasInsights.value = false
    })

    // ── Empty state ───────────────────────────────────────────────────────

    it('renders empty state when engine has no insights', () => {
        const wrapper = mount(BestTimeCard)
        expect(wrapper.text()).toContain('Search a city to see timing recommendations')
    })

    // ── Insight rendering ─────────────────────────────────────────────────

    it('renders planning insight content and actionPath directly', () => {
        mockHasInsights.value = true
        mockAllInsights.value = [makeInsight()]

        const wrapper = mount(BestTimeCard)
        expect(wrapper.find('.window-content').text()).toContain("Rain arrives around 3 PM")
        expect(wrapper.find('.window-action').text()).toContain('Do any outdoor activity before 3 PM')
    })

    it('does not parse times from actionPath string', () => {
        // The component must not try to extract "3 PM" from the string and
        // use it as a timestamp — it just renders the string as-is.
        mockHasInsights.value = true
        mockAllInsights.value = [makeInsight({
            content: 'Rain arrives around 3 PM.',
            actionPath: 'Do outdoor activity before 3 PM.'
        })]

        const wrapper = mount(BestTimeCard)
        // If time extraction were happening, we'd see a formatted time value
        // like "3:00 PM" in a `.time` element — that element should not exist
        expect(wrapper.find('.time').exists()).toBe(false)
        // The raw text should be rendered intact
        expect(wrapper.text()).toContain('Do outdoor activity before 3 PM.')
    })

    // ── Urgency → condition tag mapping ──────────────────────────────────

    it('shows Alert condition tag for urgency=alert', () => {
        mockHasInsights.value = true
        mockAllInsights.value = [makeInsight({ urgency: 'alert', content: 'Thunderstorm.', actionPath: 'Stay indoors.' })]

        const wrapper = mount(BestTimeCard)
        const tag = wrapper.find('.condition-tag')
        expect(tag.text()).toBe('Alert')
        expect(tag.classes()).toContain('condition-red')
    })

    it('shows Caution condition tag for urgency=heads-up', () => {
        mockHasInsights.value = true
        mockAllInsights.value = [makeInsight({ urgency: 'heads-up', content: 'Rain coming.', actionPath: 'Plan accordingly.' })]

        const wrapper = mount(BestTimeCard)
        const tag = wrapper.find('.condition-tag')
        expect(tag.text()).toBe('Caution')
        expect(tag.classes()).toContain('condition-yellow')
    })

    it('shows Good condition tag for urgency=useful', () => {
        mockHasInsights.value = true
        mockAllInsights.value = [makeInsight({ urgency: 'useful' })]

        const wrapper = mount(BestTimeCard)
        const tag = wrapper.find('.condition-tag')
        expect(tag.text()).toBe('Good')
        expect(tag.classes()).toContain('condition-green')
    })

    // ── Activity insight section ──────────────────────────────────────────

    it('renders activity insight section when activity insight present', () => {
        mockHasInsights.value = true
        mockAllInsights.value = [
            makeInsight({ type: 'daily-planning' }),
            makeInsight({
                id: 'act-1',
                type: 'activity',
                urgency: 'useful',
                content: 'Morning Run is possible today.',
                actionPath: 'Aim for 7 AM for better conditions.'
            })
        ]

        const wrapper = mount(BestTimeCard)
        const windows = wrapper.findAll('.time-window')
        expect(windows.length).toBe(2)
        expect(windows[1].text()).toContain('Morning Run is possible today.')
        expect(windows[1].text()).toContain('Aim for 7 AM')
    })

    it('shows only planning section when no activity insight', () => {
        mockHasInsights.value = true
        mockAllInsights.value = [makeInsight({ type: 'daily-planning' })]

        const wrapper = mount(BestTimeCard)
        expect(wrapper.findAll('.time-window')).toHaveLength(1)
        expect(wrapper.text()).toContain('Today\'s Outlook')
    })

    // ── Backwards compat ──────────────────────────────────────────────────

    it('accepts legacy props without throwing', () => {
        expect(() => mount(BestTimeCard, {
            props: {
                hourlyForecast: [{ dt: 1700000000, main: { temp: 22 }, wind: { speed: 5 }, pop: 0.1 }],
                currentWeather: { main: { temp: 20 } }
            }
        })).not.toThrow()
    })
})
