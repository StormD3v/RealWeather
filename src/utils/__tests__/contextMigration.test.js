/**
 * contextMigration.test.js
 * Unit tests for src/utils/contextMigration.js — Phase 1, Task 5.3
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createDefaultContext } from '@/utils/contextDefaults.js'
import {
    CURRENT_SCHEMA_VERSION,
    needsMigration,
    migrateContext,
    migrateFromLegacySavedLocations
} from '@/utils/contextMigration.js'
import { readContext, writeContext } from '@/utils/contextStore.js'

const LEGACY_KEY = 'lumicast-saved-locations'

describe('contextMigration', () => {
    beforeEach(() => {
        localStorage.clear()
    })

    afterEach(() => {
        localStorage.clear()
    })

    // ---------------------------------------------------------------------------
    // needsMigration
    // ---------------------------------------------------------------------------

    describe('needsMigration()', () => {
        it('returns false for current schema version', () => {
            const ctx = createDefaultContext()
            expect(needsMigration(ctx)).toBe(false)
        })

        it('returns true for an older version string', () => {
            const ctx = createDefaultContext()
            ctx.meta.schemaVersion = '0.9.0'
            expect(needsMigration(ctx)).toBe(true)
        })

        it('returns true for a context with no schemaVersion', () => {
            const ctx = createDefaultContext()
            delete ctx.meta.schemaVersion
            expect(needsMigration(ctx)).toBe(true)
        })

        it('returns false for null or undefined input', () => {
            expect(needsMigration(null)).toBe(false)
            expect(needsMigration(undefined)).toBe(false)
        })
    })

    // ---------------------------------------------------------------------------
    // migrateContext
    // ---------------------------------------------------------------------------

    describe('migrateContext()', () => {
        it('returns context with current schemaVersion when no migrations needed', () => {
            const ctx = createDefaultContext()
            const result = migrateContext(ctx)
            expect(result.meta.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
        })

        it('returns defaultContext when migration throws', () => {
            // Pass a deliberately broken object to trigger failure path
            const result = migrateContext(null)
            expect(result.meta.contextQuality).toBe('none')
        })

        it('stamps current schema version on migrated context', () => {
            const ctx = createDefaultContext()
            ctx.meta.schemaVersion = '0.0.1'
            const result = migrateContext(ctx)
            expect(result.meta.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
        })
    })

    // ---------------------------------------------------------------------------
    // migrateFromLegacySavedLocations
    // ---------------------------------------------------------------------------

    describe('migrateFromLegacySavedLocations()', () => {
        it('does nothing when legacy key is absent', () => {
            migrateFromLegacySavedLocations()
            expect(localStorage.getItem(LEGACY_KEY)).toBeNull()
        })

        it('migrates non-null slots to location.saved', () => {
            localStorage.setItem(LEGACY_KEY, JSON.stringify({ home: 'London', school: null, work: 'Manchester' }))
            migrateFromLegacySavedLocations()
            const ctx = readContext()
            const savedIds = ctx.location.saved.map(s => s.id)
            expect(savedIds).toContain('saved-home')
            expect(savedIds).toContain('saved-work')
            expect(savedIds).not.toContain('saved-school')
        })

        it('sets correct name, null lat/lon, and urban locationType', () => {
            localStorage.setItem(LEGACY_KEY, JSON.stringify({ home: 'Paris', school: null, work: null }))
            migrateFromLegacySavedLocations()
            const ctx = readContext()
            const entry = ctx.location.saved.find(s => s.id === 'saved-home')
            expect(entry.name).toBe('Paris')
            expect(entry.lat).toBeNull()
            expect(entry.lon).toBeNull()
            expect(entry.locationType).toBe('urban')
        })

        it('removes legacy key after successful write', () => {
            localStorage.setItem(LEGACY_KEY, JSON.stringify({ home: 'Berlin', school: null, work: null }))
            migrateFromLegacySavedLocations()
            expect(localStorage.getItem(LEGACY_KEY)).toBeNull()
        })

        it('removes legacy key even when all slots are null', () => {
            localStorage.setItem(LEGACY_KEY, JSON.stringify({ home: null, school: null, work: null }))
            migrateFromLegacySavedLocations()
            expect(localStorage.getItem(LEGACY_KEY)).toBeNull()
        })

        it('is idempotent — running twice produces same result', () => {
            localStorage.setItem(LEGACY_KEY, JSON.stringify({ home: 'Tokyo', school: null, work: null }))
            migrateFromLegacySavedLocations()
            // Legacy key is gone now, but simulate a second call
            migrateFromLegacySavedLocations()
            const ctx = readContext()
            // Should still have exactly one saved entry for 'home'
            const homeEntries = ctx.location.saved.filter(s => s.id === 'saved-home')
            expect(homeEntries).toHaveLength(1)
        })

        it('handles malformed legacy JSON gracefully without throwing', () => {
            localStorage.setItem(LEGACY_KEY, '{ invalid json ,,')
            expect(() => migrateFromLegacySavedLocations()).not.toThrow()
        })

        it('does not overwrite existing saved entries with same id', () => {
            // Pre-populate context with an existing home entry
            writeContext({
                location: {
                    saved: [{ id: 'saved-home', name: 'ExistingHome', lat: 51, lon: 0, timezone: 'UTC', locationType: 'urban' }]
                }
            })
            localStorage.setItem(LEGACY_KEY, JSON.stringify({ home: 'NewHome', school: null, work: null }))
            migrateFromLegacySavedLocations()
            const ctx = readContext()
            const homeEntries = ctx.location.saved.filter(s => s.id === 'saved-home')
            expect(homeEntries).toHaveLength(1)
            expect(homeEntries[0].name).toBe('ExistingHome') // existing preserved
        })
    })
})
