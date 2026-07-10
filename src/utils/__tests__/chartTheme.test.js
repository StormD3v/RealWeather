/**
 * chartTheme.test.js
 *
 * Unit and property-based tests for src/utils/chartTheme.js
 * Covers tasks 2.3 – 2.6 of the lumicast-v2-phase-2-6-visual-polish spec.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fc from 'fast-check'
import { getChartTheme, getConditionColor, formatTempLabel } from '@/utils/chartTheme'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CSS_VARS = [
    '--lc-accent',
    '--lc-border-subtle',
    '--lc-text-muted',
    '--lc-surface-raised',
    '--lc-text-primary',
    '--lc-text-secondary',
    '--lc-border',
    '--lc-bg',
    '--lc-warning',
    '--lc-rain-color',
    '--lc-sun-color',
    '--lc-snow-color',
    '--lc-storm-color',
]

function cleanCssVars() {
    for (const v of CSS_VARS) {
        document.documentElement.style.removeProperty(v)
    }
}

// ---------------------------------------------------------------------------
// Task 2.3 — Unit tests for getChartTheme()
// ---------------------------------------------------------------------------

describe('getChartTheme()', () => {
    const REQUIRED_KEYS = [
        'lineColor',
        'gradientStart',
        'gradientEnd',
        'gridColor',
        'tickColor',
        'tooltipBg',
        'tooltipTitle',
        'tooltipBody',
        'tooltipBorder',
        'currentPointColor',
        'peakPointColor',
    ]

    afterEach(cleanCssVars)

    it('returns all 11 required keys', () => {
        const theme = getChartTheme()
        for (const key of REQUIRED_KEYS) {
            expect(theme).toHaveProperty(key)
        }
        expect(Object.keys(theme)).toHaveLength(11)
    })

    it('reads --lc-accent into lineColor', () => {
        document.documentElement.style.setProperty('--lc-accent', '#ff0000')
        const theme = getChartTheme()
        expect(theme.lineColor).toBe('#ff0000')
    })

    it('reads --lc-accent into gradientStart', () => {
        document.documentElement.style.setProperty('--lc-accent', '#00ff00')
        const theme = getChartTheme()
        expect(theme.gradientStart).toBe('#00ff00')
    })

    it('returns gradientEnd as empty string (transparent sentinel)', () => {
        const theme = getChartTheme()
        expect(theme.gradientEnd).toBe('')
    })

    it('reads --lc-border-subtle into gridColor', () => {
        document.documentElement.style.setProperty('--lc-border-subtle', '#aabbcc')
        const theme = getChartTheme()
        expect(theme.gridColor).toBe('#aabbcc')
    })

    it('reads --lc-text-muted into tickColor', () => {
        document.documentElement.style.setProperty('--lc-text-muted', '#112233')
        const theme = getChartTheme()
        expect(theme.tickColor).toBe('#112233')
    })

    it('reads --lc-surface-raised into tooltipBg', () => {
        document.documentElement.style.setProperty('--lc-surface-raised', '#ffffff')
        const theme = getChartTheme()
        expect(theme.tooltipBg).toBe('#ffffff')
    })

    it('reads --lc-text-primary into tooltipTitle', () => {
        document.documentElement.style.setProperty('--lc-text-primary', '#f0f8ff')
        const theme = getChartTheme()
        expect(theme.tooltipTitle).toBe('#f0f8ff')
    })

    it('reads --lc-text-secondary into tooltipBody', () => {
        document.documentElement.style.setProperty('--lc-text-secondary', '#ccddee')
        const theme = getChartTheme()
        expect(theme.tooltipBody).toBe('#ccddee')
    })

    it('reads --lc-border into tooltipBorder', () => {
        document.documentElement.style.setProperty('--lc-border', '#334455')
        const theme = getChartTheme()
        expect(theme.tooltipBorder).toBe('#334455')
    })

    it('reads --lc-bg into currentPointColor', () => {
        document.documentElement.style.setProperty('--lc-bg', '#010101')
        const theme = getChartTheme()
        expect(theme.currentPointColor).toBe('#010101')
    })

    it('reads --lc-warning into peakPointColor', () => {
        document.documentElement.style.setProperty('--lc-warning', '#f59e0b')
        const theme = getChartTheme()
        expect(theme.peakPointColor).toBe('#f59e0b')
    })

    it('all keys (except gradientEnd) are non-empty strings when tokens are set', () => {
        document.documentElement.style.setProperty('--lc-accent', '#aabbcc')
        document.documentElement.style.setProperty('--lc-border-subtle', '#aabbcc')
        document.documentElement.style.setProperty('--lc-text-muted', '#aabbcc')
        document.documentElement.style.setProperty('--lc-surface-raised', '#aabbcc')
        document.documentElement.style.setProperty('--lc-text-primary', '#aabbcc')
        document.documentElement.style.setProperty('--lc-text-secondary', '#aabbcc')
        document.documentElement.style.setProperty('--lc-border', '#aabbcc')
        document.documentElement.style.setProperty('--lc-bg', '#aabbcc')
        document.documentElement.style.setProperty('--lc-warning', '#aabbcc')

        const theme = getChartTheme()
        for (const key of REQUIRED_KEYS) {
            if (key === 'gradientEnd') continue
            expect(typeof theme[key]).toBe('string')
            expect(theme[key].length).toBeGreaterThan(0)
        }
    })
})

// ---------------------------------------------------------------------------
// Task 2.4 — Property tests for getChartTheme() — Properties 1 & 2
// ---------------------------------------------------------------------------

/**
 * Validates: Requirements 1.1, 1.2
 * Feature: lumicast-v2-phase-2-6-visual-polish
 * Property 1: getChartTheme always returns all 11 required keys
 * Property 2: returned values reflect what was set on documentElement
 */
describe('getChartTheme() — property tests', () => {
    const REQUIRED_KEYS = [
        'lineColor',
        'gradientStart',
        'gradientEnd',
        'gridColor',
        'tickColor',
        'tooltipBg',
        'tooltipTitle',
        'tooltipBody',
        'tooltipBorder',
        'currentPointColor',
        'peakPointColor',
    ]

    afterEach(cleanCssVars)

    it('always returns all required keys with the values set on documentElement', () => {
        const hexColor = fc.stringMatching(/^[0-9a-f]{6}$/).map(h => `#${h}`)

        fc.assert(
            fc.property(
                fc.record({
                    accent: hexColor,
                    borderSubtle: hexColor,
                    textMuted: hexColor,
                    surfaceRaised: hexColor,
                    textPrimary: hexColor,
                    textSecondary: hexColor,
                    border: hexColor,
                    bg: hexColor,
                    warning: hexColor,
                }),
                (vals) => {
                    document.documentElement.style.setProperty('--lc-accent', vals.accent)
                    document.documentElement.style.setProperty('--lc-border-subtle', vals.borderSubtle)
                    document.documentElement.style.setProperty('--lc-text-muted', vals.textMuted)
                    document.documentElement.style.setProperty('--lc-surface-raised', vals.surfaceRaised)
                    document.documentElement.style.setProperty('--lc-text-primary', vals.textPrimary)
                    document.documentElement.style.setProperty('--lc-text-secondary', vals.textSecondary)
                    document.documentElement.style.setProperty('--lc-border', vals.border)
                    document.documentElement.style.setProperty('--lc-bg', vals.bg)
                    document.documentElement.style.setProperty('--lc-warning', vals.warning)

                    const theme = getChartTheme()

                    // Property 1: all 11 keys are present
                    for (const key of REQUIRED_KEYS) {
                        expect(theme).toHaveProperty(key)
                        // gradientEnd is intentionally '' (transparent) — skip non-empty check
                        if (key !== 'gradientEnd') {
                            expect(typeof theme[key]).toBe('string')
                            expect(theme[key].length).toBeGreaterThan(0)
                        }
                    }

                    // Property 2: values reflect what was set on documentElement
                    expect(theme.lineColor).toBe(vals.accent)
                    expect(theme.gradientStart).toBe(vals.accent)
                    expect(theme.gridColor).toBe(vals.borderSubtle)
                    expect(theme.tickColor).toBe(vals.textMuted)
                    expect(theme.tooltipBg).toBe(vals.surfaceRaised)
                    expect(theme.tooltipTitle).toBe(vals.textPrimary)
                    expect(theme.tooltipBody).toBe(vals.textSecondary)
                    expect(theme.tooltipBorder).toBe(vals.border)
                    expect(theme.currentPointColor).toBe(vals.bg)
                    expect(theme.peakPointColor).toBe(vals.warning)
                }
            ),
            { numRuns: 100 }
        )
    })
})

// ---------------------------------------------------------------------------
// Task 2.5 — Unit tests for getConditionColor()
// ---------------------------------------------------------------------------

describe('getConditionColor()', () => {
    beforeEach(() => {
        document.documentElement.style.setProperty('--lc-rain-color', '#4fc3f7')
        document.documentElement.style.setProperty('--lc-sun-color', '#ffd166')
        document.documentElement.style.setProperty('--lc-snow-color', '#bde0ff')
        document.documentElement.style.setProperty('--lc-storm-color', '#a855f7')
        document.documentElement.style.setProperty('--lc-accent', '#27c063')
    })

    afterEach(cleanCssVars)

    it("maps 'Rain' to --lc-rain-color", () => {
        expect(getConditionColor('Rain')).toBe('#4fc3f7')
    })

    it("maps 'Clear' to --lc-sun-color", () => {
        expect(getConditionColor('Clear')).toBe('#ffd166')
    })

    it("maps 'Snow' to --lc-snow-color", () => {
        expect(getConditionColor('Snow')).toBe('#bde0ff')
    })

    it("maps 'Thunderstorm' to --lc-storm-color", () => {
        expect(getConditionColor('Thunderstorm')).toBe('#a855f7')
    })

    it("maps 'Clouds' to --lc-accent (fallback)", () => {
        expect(getConditionColor('Clouds')).toBe('#27c063')
    })

    it("maps 'Fog' to --lc-accent (fallback)", () => {
        expect(getConditionColor('Fog')).toBe('#27c063')
    })

    it("maps unknown string to --lc-accent (fallback)", () => {
        expect(getConditionColor('Unknown')).toBe('#27c063')
    })

    it("maps empty string to --lc-accent (fallback)", () => {
        expect(getConditionColor('')).toBe('#27c063')
    })
})

// ---------------------------------------------------------------------------
// Task 2.6 — Property test for getConditionColor() — Property 6
// ---------------------------------------------------------------------------

/**
 * Validates: Requirements 1.6
 * Feature: lumicast-v2-phase-2-6-visual-polish
 * Property 6: Condition colour resolver maps all normalized keys and falls back
 *             for unknown keys — never returns an empty string
 */
describe('getConditionColor() — property tests', () => {
    beforeEach(() => {
        document.documentElement.style.setProperty('--lc-rain-color', '#4fc3f7')
        document.documentElement.style.setProperty('--lc-sun-color', '#ffd166')
        document.documentElement.style.setProperty('--lc-snow-color', '#bde0ff')
        document.documentElement.style.setProperty('--lc-storm-color', '#a855f7')
        document.documentElement.style.setProperty('--lc-accent', '#27c063')
    })

    afterEach(cleanCssVars)

    it('never returns empty string regardless of input', () => {
        fc.assert(
            fc.property(fc.string(), (conditionCode) => {
                const color = getConditionColor(conditionCode)
                expect(typeof color).toBe('string')
                expect(color.length).toBeGreaterThan(0)
            }),
            { numRuns: 100 }
        )
    })
})

// ---------------------------------------------------------------------------
// formatTempLabel() — unit tests
// ---------------------------------------------------------------------------

describe('formatTempLabel()', () => {
    it('rounds and formats temperature with unit', () => {
        expect(formatTempLabel(23.7, 'C')).toBe('24°C')
        expect(formatTempLabel(0, 'F')).toBe('0°F')
        expect(formatTempLabel(-5.5, 'C')).toBe('-5°C')
    })

    it('handles positive rounding', () => {
        expect(formatTempLabel(99.4, 'F')).toBe('99°F')
        expect(formatTempLabel(99.5, 'F')).toBe('100°F')
    })

    it('formats integer temperatures without change', () => {
        expect(formatTempLabel(22, 'C')).toBe('22°C')
    })

    it('handles arbitrary unit strings', () => {
        expect(formatTempLabel(300, 'K')).toBe('300°K')
    })
})
