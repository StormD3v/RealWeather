/**
 * WeatherTrendCharts.test.js
 *
 * Unit tests for the pure helper functions exported from WeatherTrendCharts.vue.
 * Covers tasks 6.1 – 6.4 of the lumicast-v2-phase-2-6-visual-polish spec.
 *
 * Import strategy: named exports from the dual-<script> SFC are accessible
 * without mounting the Vue component — no Vue Test Utils or canvas mocking
 * required.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
    computeYScale,
    computeCurrentIndex,
    computePeakIndex,
    computePointArrays,
    computeTemperatureStory,
} from '@/components/charts/WeatherTrendCharts.vue'

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/**
 * Creates a minimal forecast point object matching the OWM shape used
 * by the component.
 *
 * @param {string} dtTxt  — e.g. '2025-01-01 12:00:00'
 * @param {number} temp
 */
function makePoint(dtTxt, temp) {
    return { dt_txt: dtTxt, main: { temp } }
}

/** Unix timestamp (ms) helpers for deterministic time-based tests */
const T = {
    // 2025-06-15 12:00:00 UTC → ms
    noon: new Date('2025-06-15T12:00:00').getTime(),
    past1: new Date('2025-06-15T09:00:00').getTime(),
    past2: new Date('2025-06-15T06:00:00').getTime(),
    fut1: new Date('2025-06-15T15:00:00').getTime(),
    fut2: new Date('2025-06-15T18:00:00').getTime(),
}

// Human-readable dt_txt strings matching the T timestamps above
const DT = {
    past2: '2025-06-15 06:00:00',
    past1: '2025-06-15 09:00:00',
    noon: '2025-06-15 12:00:00',
    fut1: '2025-06-15 15:00:00',
    fut2: '2025-06-15 18:00:00',
}

// CSS vars used by getChartTheme()
const CHART_CSS_VARS = [
    '--lc-accent',
    '--lc-bg',
    '--lc-warning',
    '--lc-border-subtle',
    '--lc-text-muted',
    '--lc-surface-raised',
    '--lc-text-primary',
    '--lc-text-secondary',
    '--lc-border',
]

function setChartCssVars() {
    document.documentElement.style.setProperty('--lc-accent', '#27c063')
    document.documentElement.style.setProperty('--lc-bg', '#06101e')
    document.documentElement.style.setProperty('--lc-warning', '#f59e0b')
    document.documentElement.style.setProperty('--lc-border-subtle', '#1e2d40')
    document.documentElement.style.setProperty('--lc-text-muted', '#8bacc8')
    document.documentElement.style.setProperty('--lc-surface-raised', '#0d1f33')
    document.documentElement.style.setProperty('--lc-text-primary', '#e2eaf4')
    document.documentElement.style.setProperty('--lc-text-secondary', '#94afc8')
    document.documentElement.style.setProperty('--lc-border', '#1e2d40')
}

function cleanChartCssVars() {
    for (const v of CHART_CSS_VARS) {
        document.documentElement.style.removeProperty(v)
    }
}

// ---------------------------------------------------------------------------
// Task 6.1 — computeYScale()
// ---------------------------------------------------------------------------

describe('computeYScale()', () => {
    it('returns { yMin: 0, yMax: 1 } for empty array', () => {
        expect(computeYScale([])).toEqual({ yMin: 0, yMax: 1 })
    })

    it('filters out non-finite values and falls back to { yMin: 0, yMax: 1 }', () => {
        expect(computeYScale([NaN, Infinity, -Infinity])).toEqual({ yMin: 0, yMax: 1 })
    })

    it('returns val-1 / val+1 for flat data (all equal values)', () => {
        expect(computeYScale([20, 20, 20])).toEqual({ yMin: 19, yMax: 21 })
    })

    it('returns val-1 / val+1 for single equal-valued pair', () => {
        expect(computeYScale([5, 5])).toEqual({ yMin: 4, yMax: 6 })
    })

    it('applies 10% padding for normal range', () => {
        // range = 10, padding = 1
        const result = computeYScale([10, 20])
        expect(result.yMin).toBeCloseTo(9)
        expect(result.yMax).toBeCloseTo(21)
    })

    it('applies 10% padding for a wider range', () => {
        // range = 30, padding = 3
        const result = computeYScale([0, 30])
        expect(result.yMin).toBeCloseTo(-3)
        expect(result.yMax).toBeCloseTo(33)
    })

    it('handles negative temperatures', () => {
        // min=-20, max=-10, range=10, padding=1
        const result = computeYScale([-20, -10])
        expect(result.yMin).toBeCloseTo(-21)
        expect(result.yMax).toBeCloseTo(-9)
    })

    it('handles mixed positive and negative temperatures', () => {
        // min=-5, max=15, range=20, padding=2
        const result = computeYScale([-5, 15])
        expect(result.yMin).toBeCloseTo(-7)
        expect(result.yMax).toBeCloseTo(17)
    })

    it('handles single value array (treated as flat data)', () => {
        expect(computeYScale([25])).toEqual({ yMin: 24, yMax: 26 })
    })

    it('ignores NaN values mixed with valid temps', () => {
        // Only [10, 20] are finite; range=10, padding=1
        const result = computeYScale([10, NaN, 20, NaN])
        expect(result.yMin).toBeCloseTo(9)
        expect(result.yMax).toBeCloseTo(21)
    })
})

// ---------------------------------------------------------------------------
// Task 6.2 — computeCurrentIndex()
// ---------------------------------------------------------------------------

describe('computeCurrentIndex()', () => {
    it('returns 0 for empty array', () => {
        expect(computeCurrentIndex([], T.noon)).toBe(0)
    })

    it('returns 0 if all points are in the future', () => {
        const points = [
            makePoint(DT.fut1, 22),
            makePoint(DT.fut2, 25),
        ]
        expect(computeCurrentIndex(points, T.noon)).toBe(0)
    })

    it('returns index of the latest point not after now', () => {
        const points = [
            makePoint(DT.past2, 18),
            makePoint(DT.past1, 20),
            makePoint(DT.noon, 22),
            makePoint(DT.fut1, 24),
        ]
        // noon <= T.noon, fut1 > T.noon → current is index 2
        expect(computeCurrentIndex(points, T.noon)).toBe(2)
    })

    it('returns last matching index when multiple points are in the past', () => {
        const points = [
            makePoint(DT.past2, 15),
            makePoint(DT.past1, 18),
            makePoint(DT.noon, 20),
        ]
        // All three are <= T.noon; the last one (idx 2) is "current"
        expect(computeCurrentIndex(points, T.noon)).toBe(2)
    })

    it('returns 0 for a single past point', () => {
        const points = [makePoint(DT.past1, 20)]
        expect(computeCurrentIndex(points, T.noon)).toBe(0)
    })

    it('includes a point whose timestamp exactly equals now', () => {
        const points = [
            makePoint(DT.past1, 18),
            makePoint(DT.noon, 22),  // ts === T.noon
        ]
        expect(computeCurrentIndex(points, T.noon)).toBe(1)
    })

    it('skips points with missing dt_txt', () => {
        const points = [
            { main: { temp: 10 } },               // no dt_txt
            makePoint(DT.past1, 20),
            makePoint(DT.fut1, 25),
        ]
        // Only past1 qualifies; index 1
        expect(computeCurrentIndex(points, T.noon)).toBe(1)
    })
})

// ---------------------------------------------------------------------------
// Task 6.3a — computePeakIndex()
// ---------------------------------------------------------------------------

describe('computePeakIndex()', () => {
    it('returns currentIndex fallback if no future points', () => {
        const points = [
            makePoint(DT.past2, 15),
            makePoint(DT.past1, 20),
            makePoint(DT.noon, 22),
        ]
        // All points <= T.noon, so computeCurrentIndex returns 2 (fallback)
        expect(computePeakIndex(points, T.noon)).toBe(2)
    })

    it('returns index of the point with max temp among future points', () => {
        const points = [
            makePoint(DT.past1, 18),
            makePoint(DT.noon, 22),
            makePoint(DT.fut1, 30),   // highest future temp
            makePoint(DT.fut2, 28),
        ]
        expect(computePeakIndex(points, T.noon)).toBe(2)
    })

    it('handles array where all points are past (falls back to current)', () => {
        const points = [
            makePoint(DT.past2, 10),
            makePoint(DT.past1, 12),
        ]
        const currentIdx = computeCurrentIndex(points, T.noon)
        expect(computePeakIndex(points, T.noon)).toBe(currentIdx)
    })

    it('handles single future point', () => {
        const points = [
            makePoint(DT.noon, 20),
            makePoint(DT.fut1, 25),
        ]
        expect(computePeakIndex(points, T.noon)).toBe(1)
    })

    it('picks the last index when two future points share the maximum temp', () => {
        const points = [
            makePoint(DT.noon, 20),
            makePoint(DT.fut1, 30),
            makePoint(DT.fut2, 30),   // equal max — first encountered wins (strict >)
        ]
        // Implementation uses strict >, so index 1 wins (first max found)
        expect(computePeakIndex(points, T.noon)).toBe(1)
    })

    it('returns 0 for empty array', () => {
        expect(computePeakIndex([], T.noon)).toBe(0)
    })
})

// ---------------------------------------------------------------------------
// Task 6.3b — computeTemperatureStory()
// ---------------------------------------------------------------------------

describe('computeTemperatureStory()', () => {
    it('returns null when both indices are equal (no movement)', () => {
        expect(computeTemperatureStory(2, 2, 25, 25, '3 PM')).toBeNull()
    })

    it('returns null when below both thresholds', () => {
        // currentIdx < peakIdx but delta is only 3 (below warming threshold of 4)
        expect(computeTemperatureStory(1, 2, 20, 23, '3 PM')).toBeNull()
    })

    it('returns "Cooling down now" when currentIdx > peakIdx and delta >= 2', () => {
        // peakTemp - currentTemp = 22 - 25 = -3 → peakTemp - currentTemp = -3
        // Wait — the condition is: currentIdx > peakIdx AND (peakTemp - currentTemp) >= 2
        // So peakTemp must be >= currentTemp + 2. E.g. currentTemp=25, peakTemp=27
        expect(computeTemperatureStory(3, 1, 25, 27, '9 AM')).toBe('Cooling down now')
    })

    it('returns "Cooling down now" exactly at the delta=2 boundary', () => {
        expect(computeTemperatureStory(2, 0, 20, 22, '6 AM')).toBe('Cooling down now')
    })

    it('returns null when cooling delta is 1 (below 2 threshold)', () => {
        expect(computeTemperatureStory(3, 1, 24, 25, '9 AM')).toBeNull()
    })

    it('returns warming message when peakIdx > currentIdx and delta >= 4', () => {
        const result = computeTemperatureStory(1, 3, 20, 25, '3 PM')
        expect(result).toBe('Warming through 3 PM')
    })

    it('includes peak time label in warming message', () => {
        const result = computeTemperatureStory(0, 2, 18, 24, '6 PM')
        expect(result).toContain('6 PM')
        expect(result).toBe('Warming through 6 PM')
    })

    it('returns null when warming delta is 3 (below 4 threshold)', () => {
        expect(computeTemperatureStory(1, 3, 20, 23, '3 PM')).toBeNull()
    })

    it('returns warming message exactly at the delta=4 boundary', () => {
        expect(computeTemperatureStory(0, 2, 20, 24, '3 PM')).toBe('Warming through 3 PM')
    })

    it('returns null when delta is 0 regardless of index ordering', () => {
        // Same temp — neither threshold met
        expect(computeTemperatureStory(0, 2, 25, 25, '3 PM')).toBeNull()
        expect(computeTemperatureStory(2, 0, 25, 25, '9 AM')).toBeNull()
    })
})

// ---------------------------------------------------------------------------
// Task 6.4 — computePointArrays()
// ---------------------------------------------------------------------------

describe('computePointArrays()', () => {
    beforeEach(setChartCssVars)
    afterEach(cleanChartCssVars)

    const threePoints = [
        makePoint(DT.past1, 18),
        makePoint(DT.noon, 22),
        makePoint(DT.fut1, 26),
    ]

    it('returns arrays of correct length matching points array', () => {
        const { pointRadii, pointStyles, pointBorderColors } = computePointArrays(threePoints, 1, 2)
        expect(pointRadii).toHaveLength(3)
        expect(pointStyles).toHaveLength(3)
        expect(pointBorderColors).toHaveLength(3)
    })

    it('sets pointRadius 5 at currentIdx', () => {
        const { pointRadii } = computePointArrays(threePoints, 1, 2)
        expect(pointRadii[1]).toBe(5)
    })

    it('sets pointRadius 6 at peakIdx', () => {
        const { pointRadii } = computePointArrays(threePoints, 1, 2)
        expect(pointRadii[2]).toBe(6)
    })

    it('sets radius 0 for all other points', () => {
        const { pointRadii } = computePointArrays(threePoints, 1, 2)
        expect(pointRadii[0]).toBe(0)
    })

    it('sets rectRot style at peakIdx', () => {
        const { pointStyles } = computePointArrays(threePoints, 1, 2)
        expect(pointStyles[2]).toBe('rectRot')
    })

    it('sets circle style at currentIdx', () => {
        const { pointStyles } = computePointArrays(threePoints, 1, 2)
        expect(pointStyles[1]).toBe('circle')
    })

    it('sets circle style at non-special points', () => {
        const { pointStyles } = computePointArrays(threePoints, 1, 2)
        expect(pointStyles[0]).toBe('circle')
    })

    it('uses currentPointColor (--lc-bg) at currentIdx border', () => {
        const { pointBorderColors } = computePointArrays(threePoints, 1, 2)
        // --lc-bg is set to '#06101e'
        expect(pointBorderColors[1]).toBe('#06101e')
    })

    it('uses peakPointColor (--lc-warning) at peakIdx border', () => {
        const { pointBorderColors } = computePointArrays(threePoints, 1, 2)
        // --lc-warning is set to '#f59e0b'
        expect(pointBorderColors[2]).toBe('#f59e0b')
    })

    it('uses lineColor (--lc-accent) as default border color for other points', () => {
        const { pointBorderColors } = computePointArrays(threePoints, 1, 2)
        // --lc-accent is set to '#27c063'
        expect(pointBorderColors[0]).toBe('#27c063')
    })

    it('returns empty arrays for empty points input', () => {
        const { pointRadii, pointStyles, pointBorderColors } = computePointArrays([], 0, 0)
        expect(pointRadii).toHaveLength(0)
        expect(pointStyles).toHaveLength(0)
        expect(pointBorderColors).toHaveLength(0)
    })

    it('handles currentIdx === peakIdx (peak overwrites current radius)', () => {
        // When both overlap, peakIdx assignment runs last → radius should be 6
        const singlePoint = [makePoint(DT.noon, 22)]
        const { pointRadii, pointStyles } = computePointArrays(singlePoint, 0, 0)
        expect(pointRadii[0]).toBe(6)
        expect(pointStyles[0]).toBe('rectRot')
    })

    it('handles five-point array with correct placements', () => {
        const fivePoints = [
            makePoint(DT.past2, 15),
            makePoint(DT.past1, 18),
            makePoint(DT.noon, 22),
            makePoint(DT.fut1, 28),
            makePoint(DT.fut2, 25),
        ]
        const { pointRadii, pointStyles } = computePointArrays(fivePoints, 2, 3)
        // Zeros at non-special indices
        expect(pointRadii[0]).toBe(0)
        expect(pointRadii[1]).toBe(0)
        expect(pointRadii[4]).toBe(0)
        // Current at 2
        expect(pointRadii[2]).toBe(5)
        expect(pointStyles[2]).toBe('circle')
        // Peak at 3
        expect(pointRadii[3]).toBe(6)
        expect(pointStyles[3]).toBe('rectRot')
    })
})
