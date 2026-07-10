import { describe, it, expect } from 'vitest'
import { createDefaultContext } from '@/utils/contextDefaults'

describe('createDefaultContext()', () => {
    it('returns an object with all required top-level keys', () => {
        const ctx = createDefaultContext()
        expect(ctx).toHaveProperty('location')
        expect(ctx).toHaveProperty('routines')
        expect(ctx).toHaveProperty('activities')
        expect(ctx).toHaveProperty('schedule')
        expect(ctx).toHaveProperty('preferences')
        expect(ctx).toHaveProperty('sensitivities')
        expect(ctx).toHaveProperty('meta')
    })

    it('returns contextQuality: none', () => {
        expect(createDefaultContext().meta.contextQuality).toBe('none')
    })

    it('returns notifications.enabled: false', () => {
        expect(createDefaultContext().preferences.notifications.enabled).toBe(false)
    })

    it('returns all sensitivity flags as false', () => {
        const { sensitivities } = createDefaultContext()
        expect(sensitivities.heat).toBe(false)
        expect(sensitivities.cold).toBe(false)
        expect(sensitivities.pollen).toBe(false)
        expect(sensitivities.uv).toBe(false)
        expect(sensitivities.airQuality).toBe(false)
        expect(sensitivities.precipitation).toBe(false)
    })

    it('returns schemaVersion 1.0.0', () => {
        expect(createDefaultContext().meta.schemaVersion).toBe('1.0.0')
    })

    it('returns all notification flags as false', () => {
        const { notifications } = createDefaultContext().preferences
        expect(notifications.commute).toBe(false)
        expect(notifications.morningBriefing).toBe(false)
        expect(notifications.activityAlerts).toBe(false)
        expect(notifications.riskAlerts).toBe(false)
        expect(notifications.preDeparture).toBe(false)
        expect(notifications.ambient).toBe(false)
    })

    it('returns dailyPlanning and routineAdaptation as true', () => {
        const { intelligenceAreas } = createDefaultContext().preferences
        expect(intelligenceAreas.dailyPlanning).toBe(true)
        expect(intelligenceAreas.routineAdaptation).toBe(true)
    })

    it('returns activity-dependent areas as false by default', () => {
        const { intelligenceAreas } = createDefaultContext().preferences
        expect(intelligenceAreas.activityRecommend).toBe(false)
        expect(intelligenceAreas.commuteIntelligence).toBe(false)
        expect(intelligenceAreas.environmentalAware).toBe(false)
    })

    it('returns location.primary as null', () => {
        expect(createDefaultContext().location.primary).toBeNull()
    })

    it('returns empty arrays for location.saved and activities.declared', () => {
        const ctx = createDefaultContext()
        expect(ctx.location.saved).toEqual([])
        expect(ctx.activities.declared).toEqual([])
    })

    it('returns calendarConnected: false', () => {
        expect(createDefaultContext().schedule.calendarConnected).toBe(false)
    })

    it('two calls return independent objects', () => {
        const a = createDefaultContext()
        const b = createDefaultContext()
        a.sensitivities.heat = true
        expect(b.sensitivities.heat).toBe(false)
    })

    it('mutating returned activities array does not affect next call', () => {
        const a = createDefaultContext()
        a.activities.declared.push({ id: 'test' })
        const b = createDefaultContext()
        expect(b.activities.declared).toHaveLength(0)
    })
})
