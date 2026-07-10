// Feature: lumicast-v2-phase-2-6-visual-polish
// Property-based tests for the pure computation helpers exported from WeatherTrendCharts.vue

import { computeYScale, computeCurrentIndex, computePeakIndex, computePointArrays } from '@/components/charts/WeatherTrendCharts.vue'
import { formatTempLabel } from '@/utils/chartTheme'
import * as fc from 'fast-check'

// Set up CSS custom properties required by getChartTheme() (called inside computePointArrays)
beforeAll(() => {
    document.documentElement.style.setProperty('--lc-accent', '#27c063')
    document.documentElement.style.setProperty('--lc-bg', '#06101e')
    document.documentElement.style.setProperty('--lc-warning', '#f59e0b')
    document.documentElement.style.setProperty('--lc-border-subtle', 'rgba(255,255,255,0.06)')
    document.documentElement.style.setProperty('--lc-text-muted', 'rgba(200,225,255,0.62)')
    document.documentElement.style.setProperty('--lc-surface-raised', 'rgba(10,22,48,0.92)')
    document.documentElement.style.setProperty('--lc-text-primary', '#f0f8ff')
    document.documentElement.style.setProperty('--lc-text-secondary', 'rgba(224,240,255,0.88)')
    document.documentElement.style.setProperty('--lc-border', 'rgba(255,255,255,0.10)')
})

// ─────────────────────────────────────────────────────────────────────────────
// Task 7.1 — Property 3: Y-axis scale formula is correct for all valid temperature arrays
// Validates: Requirements 3.1
// ─────────────────────────────────────────────────────────────────────────────
describe('computeYScale() — property tests', () => {
    it('yMin and yMax apply correct 10% padding for all finite temperature arrays', () => {
        fc.assert(
            fc.property(
                fc.array(
                    fc.float({ noNaN: true, noDefaultInfinity: true, min: -100, max: 100 }),
                    { minLength: 2 }
                ),
                (temps) => {
                    const finite = temps.filter(Number.isFinite)
                    if (finite.length < 1) return true

                    const min = Math.min(...finite)
                    const max = Math.max(...finite)

                    const { yMin, yMax } = computeYScale(temps)

                    if (min === max) {
                        // flat data fallback
                        expect(yMin).toBeCloseTo(min - 1)
                        expect(yMax).toBeCloseTo(max + 1)
                    } else {
                        const range = max - min
                        expect(yMin).toBeCloseTo(min - 0.1 * range, 5)
                        expect(yMax).toBeCloseTo(max + 0.1 * range, 5)
                    }
                }
            ),
            { numRuns: 50 }
        )
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// Task 7.2 — Property 4: Current and peak index identification is correct for all valid point arrays
// Validates: Requirements 4.1, 4.2
// ─────────────────────────────────────────────────────────────────────────────
describe('computeCurrentIndex() and computePeakIndex() — property tests', () => {
    // Build dt_txt from a safe integer timestamp to avoid Invalid Date edge cases
    // with fc.date() shrinking in fast-check v4.
    // Range: 2020-01-01T00:00:00Z → 2030-01-01T00:00:00Z
    const MIN_TS = new Date('2020-01-01T00:00:00Z').getTime()
    const MAX_TS = new Date('2030-01-01T00:00:00Z').getTime()

    const dtTxtArbitrary = fc.integer({ min: MIN_TS, max: MAX_TS })
        .map(ts => new Date(ts).toISOString().replace('T', ' ').substring(0, 19))

    const pointArbitrary = fc.record({
        dt_txt: dtTxtArbitrary,
        main: fc.record({ temp: fc.float({ noNaN: true, noDefaultInfinity: true, min: -50, max: 60 }) })
    })

    it('currentIndex always points to latest non-future point (or 0)', () => {
        fc.assert(
            fc.property(
                fc.array(pointArbitrary, { minLength: 1, maxLength: 20 }),
                fc.integer({ min: 1000000000000, max: 2000000000000 }), // timestamps in valid range
                (points, now) => {
                    const idx = computeCurrentIndex(points, now)

                    // idx must be valid
                    expect(idx).toBeGreaterThanOrEqual(0)
                    expect(idx).toBeLessThan(points.length)

                    const selected = points[idx]
                    const selectedTs = new Date(String(selected.dt_txt).replace(' ', 'T')).getTime()

                    // All points after idx must be in the future relative to now
                    // (or idx is the last valid past point)
                    for (let i = idx + 1; i < points.length; i++) {
                        const ts = new Date(String(points[i].dt_txt).replace(' ', 'T')).getTime()
                        if (ts <= now) {
                            // if there's a later past point, our idx should have been that one
                            // (unless the later point's ts <= selectedTs which would be weird ordering)
                            expect(ts).toBeLessThanOrEqual(selectedTs)
                        }
                    }
                }
            ),
            { numRuns: 40 }
        )
    })

    it('peakIndex always points to future point with max temp (or falls back)', () => {
        fc.assert(
            fc.property(
                fc.array(pointArbitrary, { minLength: 2, maxLength: 20 }),
                fc.integer({ min: 1000000000000, max: 2000000000000 }),
                (points, now) => {
                    const peakIdx = computePeakIndex(points, now)

                    expect(peakIdx).toBeGreaterThanOrEqual(0)
                    expect(peakIdx).toBeLessThan(points.length)

                    const futurePoints = points.filter(p => {
                        const ts = new Date(String(p.dt_txt).replace(' ', 'T')).getTime()
                        return ts > now && Number.isFinite(Number(p.main?.temp))
                    })

                    if (futurePoints.length === 0) {
                        // Falls back to currentIndex — just verify it's a valid index
                        return
                    }

                    const peakTemp = Number(points[peakIdx].main?.temp)
                    const maxFutureTemp = Math.max(...futurePoints.map(p => Number(p.main.temp)))
                    expect(peakTemp).toBeCloseTo(maxFutureTemp, 5)
                }
            ),
            { numRuns: 40 }
        )
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// Task 7.3 — Property 5: Per-point radius and style arrays respect current/peak highlight contract
// Validates: Requirements 5.1
// ─────────────────────────────────────────────────────────────────────────────
describe('computePointArrays() — property tests', () => {
    it('pointRadii and pointStyles always match the highlight contract', () => {
        // Build dt_txt from a safe integer timestamp to avoid Invalid Date edge cases
        const MIN_TS = new Date('2020-01-01T00:00:00Z').getTime()
        const MAX_TS = new Date('2030-01-01T00:00:00Z').getTime()

        const dtTxtArbitrary = fc.integer({ min: MIN_TS, max: MAX_TS })
            .map(ts => new Date(ts).toISOString().replace('T', ' ').substring(0, 19))

        const pointArbitrary = fc.record({
            dt_txt: dtTxtArbitrary,
            main: fc.record({ temp: fc.float({ noNaN: true, noDefaultInfinity: true, min: -50, max: 60 }) })
        })

        fc.assert(
            fc.property(
                fc.array(pointArbitrary, { minLength: 2, maxLength: 20 }),
                fc.integer({ min: 0, max: 19 }), // currentIdx
                fc.integer({ min: 0, max: 19 }), // peakIdx
                (points, rawCurrentIdx, rawPeakIdx) => {
                    const currentIdx = rawCurrentIdx % points.length
                    const peakIdx = rawPeakIdx % points.length

                    const { pointRadii, pointStyles } = computePointArrays(points, currentIdx, peakIdx)

                    expect(pointRadii).toHaveLength(points.length)
                    expect(pointStyles).toHaveLength(points.length)

                    for (let i = 0; i < points.length; i++) {
                        if (i === currentIdx && i === peakIdx) {
                            // When they coincide, peak takes priority (assigned last)
                            expect(pointRadii[i]).toBe(6)
                            expect(pointStyles[i]).toBe('rectRot')
                        } else if (i === currentIdx) {
                            expect(pointRadii[i]).toBe(5)
                            expect(pointStyles[i]).toBe('circle')
                        } else if (i === peakIdx) {
                            expect(pointRadii[i]).toBe(6)
                            expect(pointStyles[i]).toBe('rectRot')
                        } else {
                            expect(pointRadii[i]).toBe(0)
                            expect(pointStyles[i]).toBe('circle')
                        }
                    }
                }
            ),
            { numRuns: 30 }
        )
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// Task 7.4 — Property 7: Summary display formats all temperature values correctly with any unit symbol
// Validates: Requirements 7.1
// ─────────────────────────────────────────────────────────────────────────────
describe('formatTempLabel() — property tests', () => {
    it('always formats as rounded integer + degree symbol + unit', () => {
        fc.assert(
            fc.property(
                fc.float({ noNaN: true, noDefaultInfinity: true, min: -100, max: 100 }),
                fc.constantFrom('C', 'F', 'K'),
                (temp, unit) => {
                    const label = formatTempLabel(temp, unit)
                    expect(label).toBe(`${Math.round(temp)}°${unit}`)
                    expect(label.length).toBeGreaterThan(0)
                }
            ),
            { numRuns: 50 }
        )
    })
})
