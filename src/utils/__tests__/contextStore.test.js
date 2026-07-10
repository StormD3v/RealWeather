/**
 * contextStore.test.js
 * Unit tests for src/utils/contextStore.js — Phase 1, Task 5.1
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createDefaultContext } from '@/utils/contextDefaults.js'

// We import contextStore after each localStorage reset so module state is fresh
// Note: contextMigration registers itself on import, so we import it here too.
let readContext, writeContext, validateContext, clearContext, initSignalStore

async function importFresh() {
    // Reset module registry between tests that need a clean state
    const storeModule = await import('@/utils/contextStore.js')
    const _migModule = await import('@/utils/contextMigration.js') // triggers registration
    readContext = storeModule.readContext
    writeContext = storeModule.writeContext
    validateContext = storeModule.validateContext
    clearContext = storeModule.clearContext
    initSignalStore = storeModule.initSignalStore
}

const CONTEXT_KEY = 'lumi.context.v1'
const SIGNALS_KEY = 'lumi.signals.v1'

function setStorage(key, value) {
    localStorage.setItem(key, JSON.stringify(value))
}

describe('contextStore', () => {
    beforeEach(async () => {
        localStorage.clear()
        await importFresh()
    })

    afterEach(() => {
        localStorage.clear()
    })

    // ---------------------------------------------------------------------------
    // readContext
    // ---------------------------------------------------------------------------

    describe('readContext()', () => {
        it('returns default context when storage is empty', () => {
            const ctx = readContext()
            expect(ctx.meta.contextQuality).toBe('none')
            expect(ctx.location.primary).toBeNull()
        })

        it('returns stored context when storage is populated', () => {
            const stored = createDefaultContext()
            stored.preferences.temperatureUnit = 'F'
            stored.meta.schemaVersion = '1.0.0'
            setStorage(CONTEXT_KEY, stored)
            const ctx = readContext()
            expect(ctx.preferences.temperatureUnit).toBe('F')
        })

        it('returns default context when stored JSON is malformed', () => {
            localStorage.setItem(CONTEXT_KEY, '{ not valid json ,,, }')
            const ctx = readContext()
            expect(ctx.meta.contextQuality).toBe('none')
        })

        it('returns default context when stored value is not an object', () => {
            localStorage.setItem(CONTEXT_KEY, '"just a string"')
            const ctx = readContext()
            expect(ctx.meta.contextQuality).toBe('none')
        })

        it('prunes past manual events', () => {
            const stored = createDefaultContext()
            stored.meta.schemaVersion = '1.0.0'
            stored.schedule.manualEvents = [
                { id: 'e1', label: 'Past', date: '2020-01-01', timeStart: null, timeEnd: null, isOutdoor: true, locationId: null },
                { id: 'e2', label: 'Future', date: '2099-12-31', timeStart: null, timeEnd: null, isOutdoor: true, locationId: null }
            ]
            setStorage(CONTEXT_KEY, stored)
            const ctx = readContext()
            expect(ctx.schedule.manualEvents).toHaveLength(1)
            expect(ctx.schedule.manualEvents[0].id).toBe('e2')
        })

        it('keeps future manual events', () => {
            const stored = createDefaultContext()
            stored.meta.schemaVersion = '1.0.0'
            stored.schedule.manualEvents = [
                { id: 'e1', label: 'Future', date: '2099-06-15', timeStart: null, timeEnd: null, isOutdoor: false, locationId: null }
            ]
            setStorage(CONTEXT_KEY, stored)
            const ctx = readContext()
            expect(ctx.schedule.manualEvents).toHaveLength(1)
        })
    })

    // ---------------------------------------------------------------------------
    // writeContext
    // ---------------------------------------------------------------------------

    describe('writeContext()', () => {
        it('writes full merged object and returns it', () => {
            const result = writeContext({ preferences: { temperatureUnit: 'F' } })
            expect(result.preferences.temperatureUnit).toBe('F')
            const stored = JSON.parse(localStorage.getItem(CONTEXT_KEY))
            expect(stored.preferences.temperatureUnit).toBe('F')
        })

        it('performs a single setItem call per write', () => {
            const spy = vi.spyOn(Storage.prototype, 'setItem')
            writeContext({ preferences: { temperatureUnit: 'F' } })
            // Only one call for lumi.context.v1 (other keys excluded)
            const contextCalls = spy.mock.calls.filter(c => c[0] === CONTEXT_KEY)
            expect(contextCalls).toHaveLength(1)
            spy.mockRestore()
        })

        it('updates meta.lastModifiedAt on every write', () => {
            const before = Date.now()
            const result = writeContext({ preferences: { temperatureUnit: 'C' } })
            expect(result.meta.lastModifiedAt).toBeGreaterThanOrEqual(before)
        })

        it('partial write does not clear other fields', () => {
            writeContext({ preferences: { temperatureUnit: 'F' } })
            writeContext({ sensitivities: { heat: true } })
            const stored = JSON.parse(localStorage.getItem(CONTEXT_KEY))
            expect(stored.preferences.temperatureUnit).toBe('F')
            expect(stored.sensitivities.heat).toBe(true)
        })

        it('rejects invalid lat without corrupting valid fields', () => {
            writeContext({ preferences: { temperatureUnit: 'F' } })
            const result = writeContext({
                location: {
                    primary: { name: 'Test', lat: 999, lon: 10, timezone: 'UTC', locationType: 'urban', confidence: 'declared' }
                }
            })
            // lat 999 is invalid → reset to null; lon valid but primary.lat is null now
            expect(result.location.primary.lat).toBeNull()
            // Other fields preserved
            expect(result.preferences.temperatureUnit).toBe('F')
        })

        it('rejects invalid activityKey without corrupting valid fields', () => {
            writeContext({ preferences: { temperatureUnit: 'F' } })
            const result = writeContext({
                activities: {
                    declared: [{ id: 'a1', activityKey: 'flying-carpet', label: 'Test', frequency: 'daily', seasonRange: null, profile: {} }]
                }
            })
            expect(result.activities.declared[0].activityKey).toBeNull()
            expect(result.preferences.temperatureUnit).toBe('F')
        })

        it('computes contextQuality: none when no location', () => {
            const result = writeContext({ sensitivities: { heat: true } })
            expect(result.meta.contextQuality).toBe('none')
        })

        it('computes contextQuality: minimal when only location set', () => {
            const result = writeContext({
                location: {
                    primary: { name: 'London', lat: 51.5, lon: -0.1, timezone: 'Europe/London', locationType: 'urban', confidence: 'declared' }
                }
            })
            expect(result.meta.contextQuality).toBe('minimal')
        })

        it('computes contextQuality: partial when location + departure time', () => {
            writeContext({
                location: {
                    primary: { name: 'London', lat: 51.5, lon: -0.1, timezone: 'Europe/London', locationType: 'urban', confidence: 'declared' }
                }
            })
            const result = writeContext({ routines: { weekday: { departureTime: '08:00', returnTime: null, outdoorWindows: [] } } })
            expect(result.meta.contextQuality).toBe('partial')
        })

        it('computes contextQuality: full when location + routine + activity + sensitivity', () => {
            writeContext({
                location: {
                    primary: { name: 'London', lat: 51.5, lon: -0.1, timezone: 'Europe/London', locationType: 'urban', confidence: 'declared' }
                }
            })
            writeContext({ routines: { weekday: { departureTime: '08:00', returnTime: null, outdoorWindows: [] } } })
            writeContext({ activities: { declared: [{ id: 'a1', activityKey: 'running', label: 'Running', frequency: 'daily', seasonRange: null, profile: {} }] } })
            const result = writeContext({ sensitivities: { heat: true } })
            expect(result.meta.contextQuality).toBe('full')
        })
    })

    // ---------------------------------------------------------------------------
    // validateContext
    // ---------------------------------------------------------------------------

    describe('validateContext()', () => {
        it('resets invalid departureTime format to null', () => {
            const ctx = createDefaultContext()
            ctx.routines.weekday.departureTime = '25:99'
            const { context } = validateContext(ctx)
            expect(context.routines.weekday.departureTime).toBeNull()
        })

        it('keeps valid departureTime', () => {
            const ctx = createDefaultContext()
            ctx.routines.weekday.departureTime = '08:30'
            const { context } = validateContext(ctx)
            expect(context.routines.weekday.departureTime).toBe('08:30')
        })

        it('resets invalid activityKey to null', () => {
            const ctx = createDefaultContext()
            ctx.activities.declared = [{ id: 'a1', activityKey: 'teleportation', label: 'T', frequency: 'daily', seasonRange: null, profile: {} }]
            const { context } = validateContext(ctx)
            expect(context.activities.declared[0].activityKey).toBeNull()
        })

        it('keeps valid activityKey', () => {
            const ctx = createDefaultContext()
            ctx.activities.declared = [{ id: 'a1', activityKey: 'cycling', label: 'C', frequency: 'daily', seasonRange: null, profile: {} }]
            const { context } = validateContext(ctx)
            expect(context.activities.declared[0].activityKey).toBe('cycling')
        })

        it('resets invalid lat to null without clearing lon', () => {
            const ctx = createDefaultContext()
            ctx.location.primary = { name: 'X', lat: 200, lon: 10, timezone: 'UTC', locationType: 'urban', confidence: 'declared' }
            const { context, valid } = validateContext(ctx)
            expect(valid).toBe(false)
            expect(context.location.primary.lat).toBeNull()
        })

        it('resets invalid temperatureUnit to C', () => {
            const ctx = createDefaultContext()
            ctx.preferences.temperatureUnit = 'K'
            const { context } = validateContext(ctx)
            expect(context.preferences.temperatureUnit).toBe('C')
        })

        it('resets non-boolean sensitivity to false', () => {
            const ctx = createDefaultContext()
            ctx.sensitivities.heat = 'yes'
            const { context } = validateContext(ctx)
            expect(context.sensitivities.heat).toBe(false)
        })
    })

    // ---------------------------------------------------------------------------
    // clearContext
    // ---------------------------------------------------------------------------

    describe('clearContext()', () => {
        it('removes lumi.context.v1 from localStorage', () => {
            writeContext({ preferences: { temperatureUnit: 'F' } })
            clearContext()
            expect(localStorage.getItem(CONTEXT_KEY)).toBeNull()
        })

        it('removes lumi.signals.v1 from localStorage', () => {
            localStorage.setItem(SIGNALS_KEY, JSON.stringify({ schemaVersion: '1.0.0', signals: [] }))
            clearContext()
            expect(localStorage.getItem(SIGNALS_KEY)).toBeNull()
        })

        it('returns a valid default context', () => {
            const result = clearContext()
            expect(result.meta.contextQuality).toBe('none')
            expect(result.location.primary).toBeNull()
        })
    })

    // ---------------------------------------------------------------------------
    // initSignalStore
    // ---------------------------------------------------------------------------

    describe('initSignalStore()', () => {
        it('creates lumi.signals.v1 when absent', () => {
            initSignalStore()
            const raw = localStorage.getItem(SIGNALS_KEY)
            expect(raw).not.toBeNull()
            const parsed = JSON.parse(raw)
            expect(parsed.signals).toEqual([])
            expect(parsed.schemaVersion).toBe('1.0.0')
        })

        it('does not overwrite existing valid signals store', () => {
            const existing = { schemaVersion: '1.0.0', signals: [{ type: 'app-open', timestamp: 1, metadata: {} }] }
            localStorage.setItem(SIGNALS_KEY, JSON.stringify(existing))
            initSignalStore()
            const parsed = JSON.parse(localStorage.getItem(SIGNALS_KEY))
            expect(parsed.signals).toHaveLength(1)
        })

        it('resets malformed signals store', () => {
            localStorage.setItem(SIGNALS_KEY, '{ broken json')
            initSignalStore()
            const parsed = JSON.parse(localStorage.getItem(SIGNALS_KEY))
            expect(parsed.signals).toEqual([])
        })
    })
})
