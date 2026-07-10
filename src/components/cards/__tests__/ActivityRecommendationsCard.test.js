/**
 * ActivityRecommendationsCard.test.js — Phase 3.3
 *
 * Tests all four rendering states:
 *   1. Has activities + engine has activity insights
 *   2. Has activities + no insights (benign conditions)
 *   3. Has profile but no declared activities
 *   4. No profile / context-free fallback
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref, computed } from 'vue'
import ActivityRecommendationsCard from '../ActivityRecommendationsCard.vue'

// ── Mock useInsightEngine ─────────────────────────────────────────────────
const mockActivityInsights = ref([])
const mockHasInsights = ref(false)

vi.mock('@/composables/useInsightEngine', () => ({
    useInsightEngine: () => ({
        insightsByType: (type) => computed(() =>
            type === 'activity' ? mockActivityInsights.value : []
        ),
        hasInsights: computed(() => mockHasInsights.value)
    })
}))

// ── Mock useUserContext ───────────────────────────────────────────────────
const mockUserContext = ref({
    activities: { declared: [] },
    meta: { contextQuality: 'none' }
})
const mockHasContext = ref(false)

vi.mock('@/composables/useUserContext', () => ({
    useUserContext: () => ({
        userContext: computed(() => mockUserContext.value),
        hasContext: computed(() => mockHasContext.value),
        contextQuality: computed(() => mockUserContext.value.meta.contextQuality)
    })
}))

vi.mock('pinia', () => ({
    defineStore: vi.fn(),
    storeToRefs: vi.fn()
}))

function makeActivity(overrides = {}) {
    return {
        id: 'act-1',
        activityKey: 'running',
        label: 'Morning Run',
        frequency: 'daily',
        seasonRange: null,
        ...overrides
    }
}

function makeInsight(overrides = {}) {
    return {
        id: 'insight-activity-1',
        type: 'activity',
        urgency: 'useful',
        content: 'Morning Run is possible today, but humidity makes conditions less than ideal.',
        actionPath: 'Aim for 6 AM for better conditions.',
        confidence: 'high',
        timing: { notify: false, windowStart: null, windowEnd: null, notifyAt: null },
        sourceContext: { usedLocation: true, usedRoutine: false, usedActivity: true, usedSensitivity: false },
        ...overrides
    }
}

describe('ActivityRecommendationsCard — Phase 3.3', () => {

    beforeEach(() => {
        mockActivityInsights.value = []
        mockHasInsights.value = false
        mockHasContext.value = false
        mockUserContext.value = { activities: { declared: [] }, meta: { contextQuality: 'none' } }
    })

    // ── State 1: Activities declared + engine has insights ────────────────

    it('renders activity insights when declared activities exist', () => {
        mockHasContext.value = true
        mockHasInsights.value = true
        mockUserContext.value = {
            activities: { declared: [makeActivity()] },
            meta: { contextQuality: 'partial' }
        }
        mockActivityInsights.value = [makeInsight()]

        const wrapper = mount(ActivityRecommendationsCard)
        expect(wrapper.find('.activity-insight-item').exists()).toBe(true)
        expect(wrapper.find('.activity-insight-content').text()).toContain('Morning Run is possible today')
        expect(wrapper.find('.activity-insight-action').text()).toContain('Aim for 6 AM')
    })

    it('maps urgency=useful to Check/yellow status tag', () => {
        mockHasContext.value = true
        mockHasInsights.value = true
        mockUserContext.value = { activities: { declared: [makeActivity()] }, meta: { contextQuality: 'partial' } }
        mockActivityInsights.value = [makeInsight({ urgency: 'useful' })]

        const wrapper = mount(ActivityRecommendationsCard)
        const tag = wrapper.find('.activity-status-tag')
        expect(tag.text()).toBe('Check')
        expect(tag.classes()).toContain('status-yellow')
    })

    it('maps urgency=alert to Avoid/red status tag', () => {
        mockHasContext.value = true
        mockHasInsights.value = true
        mockUserContext.value = { activities: { declared: [makeActivity()] }, meta: { contextQuality: 'partial' } }
        mockActivityInsights.value = [makeInsight({
            urgency: 'alert',
            content: 'Running not recommended — heat poses a risk.',
            actionPath: 'Skip today.'
        })]

        const wrapper = mount(ActivityRecommendationsCard)
        const tag = wrapper.find('.activity-status-tag')
        expect(tag.text()).toBe('Avoid')
        expect(tag.classes()).toContain('status-red')
    })

    it('maps urgency=ambient to Good/green status tag', () => {
        mockHasContext.value = true
        mockHasInsights.value = true
        mockUserContext.value = { activities: { declared: [makeActivity()] }, meta: { contextQuality: 'partial' } }
        mockActivityInsights.value = [makeInsight({ urgency: 'ambient', content: 'Good conditions for running.', actionPath: 'Go ahead.' })]

        const wrapper = mount(ActivityRecommendationsCard)
        const tag = wrapper.find('.activity-status-tag')
        expect(tag.text()).toBe('Good')
        expect(tag.classes()).toContain('status-green')
    })

    // ── State 2: Activities declared, no insights (all benign) ────────────

    it('shows benign message when activities declared but no insights from engine', () => {
        mockHasContext.value = true
        mockHasInsights.value = true
        mockActivityInsights.value = []
        mockUserContext.value = {
            activities: { declared: [makeActivity()] },
            meta: { contextQuality: 'partial' }
        }

        const wrapper = mount(ActivityRecommendationsCard)
        expect(wrapper.text()).toContain('Conditions look good for your declared activities today')
        expect(wrapper.find('.activity-insight-item').exists()).toBe(false)
    })

    it('shows declared activity labels in benign state', () => {
        mockHasContext.value = true
        mockHasInsights.value = true
        mockActivityInsights.value = []
        mockUserContext.value = {
            activities: { declared: [makeActivity({ label: 'Morning Run' }), makeActivity({ id: 'act-2', activityKey: 'cycling', label: 'Cycling' })] },
            meta: { contextQuality: 'partial' }
        }

        const wrapper = mount(ActivityRecommendationsCard)
        const tags = wrapper.findAll('.activity-tag')
        const tagTexts = tags.map(t => t.text())
        expect(tagTexts).toContain('Morning Run')
        expect(tagTexts).toContain('Cycling')
    })

    // ── State 3: Profile set, no activities ───────────────────────────────

    it('shows "add activities" prompt when profile set but no activities', () => {
        mockHasContext.value = true
        mockHasInsights.value = true
        mockActivityInsights.value = []
        mockUserContext.value = { activities: { declared: [] }, meta: { contextQuality: 'minimal' } }

        const wrapper = mount(ActivityRecommendationsCard)
        expect(wrapper.text()).toContain('Add activities to your profile')
    })

    // ── State 4: No context — fallback ────────────────────────────────────

    it('shows fallback message from recommendations prop when no context', () => {
        mockHasContext.value = false
        mockHasInsights.value = false
        mockActivityInsights.value = []
        mockUserContext.value = { activities: { declared: [] }, meta: { contextQuality: 'none' } }

        const wrapper = mount(ActivityRecommendationsCard, {
            props: { recommendations: ['Great day for outdoor workouts.', 'Cycling'], currentWeather: null }
        })
        expect(wrapper.text()).toContain('Great day for outdoor workouts.')
    })

    it('accepts legacy props without throwing', () => {
        expect(() => mount(ActivityRecommendationsCard, {
            props: {
                recommendations: ['Go outside.'],
                currentWeather: { main: { temp: 22 }, weather: [{ main: 'Clear' }], rain: { chance: 0.1 } }
            }
        })).not.toThrow()
    })
})
