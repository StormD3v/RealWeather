/**
 * useWeatherFormatters.test.js
 * Tests for Phase 2 changes to useWeatherFormatters.js
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { setUnitFromContext, useTemperatureUnit } from '@/composables/useWeatherFormatters.js'

describe('useWeatherFormatters (Phase 2)', () => {

    beforeEach(() => {
        // Reset to Celsius before each test
        setUnitFromContext('C')
    })

    describe('setUnitFromContext()', () => {
        it('setUnitFromContext C makes toDisplayTemp return Celsius', () => {
            setUnitFromContext('C')
            const { toDisplayTemp } = useTemperatureUnit()
            expect(toDisplayTemp(100)).toBe(100)
        })

        it('setUnitFromContext F makes toDisplayTemp return Fahrenheit', () => {
            setUnitFromContext('F')
            const { toDisplayTemp } = useTemperatureUnit()
            // 0°C = 32°F
            expect(toDisplayTemp(0)).toBe(32)
            // 100°C = 212°F
            expect(toDisplayTemp(100)).toBe(212)
        })

        it('setUnitFromContext F updates unitSymbol to F', () => {
            setUnitFromContext('F')
            const { unitSymbol } = useTemperatureUnit()
            expect(unitSymbol.value).toBe('F')
        })

        it('setUnitFromContext C updates unitSymbol to C', () => {
            setUnitFromContext('C')
            const { unitSymbol } = useTemperatureUnit()
            expect(unitSymbol.value).toBe('C')
        })

        it('ignores unknown unit values — does not throw', () => {
            expect(() => setUnitFromContext('K')).not.toThrow()
            expect(() => setUnitFromContext(null)).not.toThrow()
            expect(() => setUnitFromContext(undefined)).not.toThrow()
        })
    })

    describe('useTemperatureUnit() — existing API preserved', () => {
        it('toggleUnit switches between C and F', () => {
            setUnitFromContext('C')
            const { toggleUnit, unitSymbol } = useTemperatureUnit()
            expect(unitSymbol.value).toBe('C')
            toggleUnit()
            expect(unitSymbol.value).toBe('F')
            toggleUnit()
            expect(unitSymbol.value).toBe('C')
        })

        it('toDisplayTemp rounds correctly in Celsius', () => {
            setUnitFromContext('C')
            const { toDisplayTemp } = useTemperatureUnit()
            expect(toDisplayTemp(22.7)).toBe(23)
        })

        it('toDisplayTemp converts correctly in Fahrenheit', () => {
            setUnitFromContext('F')
            const { toDisplayTemp } = useTemperatureUnit()
            // 20°C = 68°F
            expect(toDisplayTemp(20)).toBe(68)
        })
    })
})
