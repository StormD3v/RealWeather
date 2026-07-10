# Design Document — LumiCast V2 Phase 2.6: Premium Data Visualization & Final Visual Polish

## Overview

Phase 2.6 brings the Temperature Today chart — and all other Chart.js visualisations — to the premium quality standard already achieved across the rest of LumiCast. The work is surgical: no new features, no routing changes, no store additions.

The driving design principle is that the chart must remain a **weather experience**, not an analytics dashboard. It should answer **"What will the temperature feel like today?"** — and beyond displaying values, it should communicate the **shape of the day**: when temperatures climb, when they peak, and when they cool. This storytelling is delivered through the visual form of the curve itself, the gradient fill, and the contextual summary — not through additional controls or data density. The visual quality target is `MorningBriefingCard.vue` — glass-morphism surfaces, token-only colours, and subtle motion.

The phase resolves all known deficiencies in `WeatherTrendCharts.vue`:

| Issue | Resolution |
|---|---|
| All colours hardcoded (`rgba`, hex literals) | Full token pipeline via `getChartTheme()` |
| `y.min: 0` — fixed, not data-driven | Dynamic formula: `min − 0.1 × range` |
| Chart.js legend shown | `plugins.legend.display: false` + custom summary |
| No contextual summary | Current / Peak temperature summary row |
| No animation | 800 ms `easeOutQuart` line draw |
| No theme reactivity | `watch(resolvedTheme)` → `chart.update()` |
| Static 220 px height | Responsive CSS breakpoint heights |
| No weather condition tinting | Condition-based gradient base colour |
| No current/peak point highlighting | Per-point `pointRadius`/`pointStyle` arrays |

---

## Architecture

### File Map

```
src/
├── utils/
│   └── chartTheme.js          ← NEW — getChartTheme() utility
└── components/
    └── charts/
        └── WeatherTrendCharts.vue  ← FULL REPLACEMENT
```

No new routes, no Pinia store changes, no new npm packages.

### Dependency Graph

```
WeatherDashboard.vue
  └── (defineAsyncComponent) WeatherTrendCharts.vue
        ├── vue-chartjs Line           (already installed)
        ├── chart.js 4.x              (already installed)
        ├── src/utils/chartTheme.js   ← new import
        ├── src/composables/useTheme.js  (resolvedTheme)
        └── src/composables/useWeatherFormatters.js  (formatHour, toDisplayTemp)
```

The async loading wrapper in `WeatherDashboard.vue` is **preserved unchanged**.

### Data Flow

Weather condition data passes through LumiCast's normalization layer before reaching the chart. The chart never consumes raw API-specific condition codes directly.

```
store.currentCondition (raw OWM string, e.g. 'Drizzle')
  └── resolveWeatherIconKey()  ← useWeatherIcons.js normalization layer
        └── normalized key (e.g. 'Rain')
              └── WeatherTrendCharts.vue prop: weatherCondition
                    └── getConditionColor(normalizedKey) in chartTheme.js

store.hourlyTrend (Array<ForecastPoint>)
  └── WeatherTrendCharts.vue props: points[], unitSymbol, weatherCondition
        ├── computed: labels[]             (x-axis tick labels)
        ├── computed: temperatureValues[]
        ├── computed: currentIndex         (nearest past timestamp)
        ├── computed: peakIndex            (max temp after now)
        ├── computed: temperatureStory     (warmest period, cooling label)
        ├── computed: pointRadii[]         (per-point radius array)
        ├── computed: pointStyles[]        (per-point style array)
        ├── computed: yMin / yMax          (dynamic scale)
        └── chartOptions                   (built from getChartTheme())
```

`WeatherDashboard.vue` applies `resolveWeatherIconKey(store.currentCondition)` before passing the value down, maintaining the normalization contract.

---

## Components and Interfaces

### `src/utils/chartTheme.js`

```js
/**
 * Reads the active CSS custom properties from document.documentElement
 * and returns a typed colour object for Chart.js configuration.
 * @returns {ChartTheme}
 */
export function getChartTheme() { ... }

/**
 * @typedef {Object} ChartTheme
 * @property {string} lineColor         — resolved --lc-accent
 * @property {string} gradientStart     — accent at 0.30 alpha (constructed by caller)
 * @property {string} gradientEnd       — transparent (constructed by caller)
 * @property {string} gridColor         — resolved --lc-border-subtle
 * @property {string} tickColor         — resolved --lc-text-muted
 * @property {string} tooltipBg         — resolved --lc-surface-raised
 * @property {string} tooltipTitle      — resolved --lc-text-primary
 * @property {string} tooltipBody       — resolved --lc-text-secondary
 * @property {string} tooltipBorder     — resolved --lc-border
 * @property {string} currentPointColor — resolved --lc-bg
 * @property {string} peakPointColor    — resolved --lc-warning
 */
```

Implementation reads all values via `getComputedStyle(document.documentElement).getPropertyValue('--lc-*').trim()`. Zero hardcoded literals.

**Condition colour resolver** (used for gradient tinting):

```js
/**
 * Maps a NORMALIZED LumiCast weather condition key to the appropriate
 * CSS custom property colour token.
 *
 * IMPORTANT: This function accepts only the normalized keys produced by
 * resolveWeatherIconKey() from useWeatherIcons.js — never raw OWM strings.
 *
 * Normalized key set: 'Clear' | 'Clouds' | 'Rain' | 'Thunderstorm' | 'Snow' | 'Fog'
 * Falls back to --lc-accent for unmapped or unknown normalized keys.
 *
 * @param {string} normalizedCondition — output of resolveWeatherIconKey()
 * @returns {string} resolved CSS colour value
 */
export function getConditionColor(normalizedCondition) { ... }
// Maps: 'Rain'         → --lc-rain-color
//       'Clear'        → --lc-sun-color
//       'Snow'         → --lc-snow-color
//       'Thunderstorm' → --lc-storm-color
//       'Clouds'|'Fog' → --lc-accent (neutral)
//       *              → --lc-accent  (safe fallback)
```

### `WeatherTrendCharts.vue` — Props Interface

```js
defineProps({
  points:           { type: Array,  default: () => [] },  // ForecastPoint[]
  unitSymbol:       { type: String, default: 'C' },
  weatherCondition: { type: String, default: 'Clear' }    // NEW — normalized key from resolveWeatherIconKey()
})
```

`weatherCondition` accepts only the normalized keys produced by `resolveWeatherIconKey()` (`'Clear'`, `'Clouds'`, `'Rain'`, `'Thunderstorm'`, `'Snow'`, `'Fog'`). `WeatherDashboard.vue` passes `resolveWeatherIconKey(store.currentCondition)` — the raw API value never enters the chart layer.

### `WeatherTrendCharts.vue` — Internal Computed Values

| Computed | Description |
|---|---|
| `labels` | `formatHour(p.dt_txt)` for each point |
| `temperatureValues` | `Number(p?.main?.temp ?? NaN)` for each point |
| `validTemps` | Filtered finite values only |
| `currentIndex` | Index of point whose `dt_txt` is nearest to (and not after) `Date.now()` |
| `peakIndex` | Index of max `main.temp` among points after `Date.now()` |
| `temperatureStory` | Object describing the day's shape: `warmestPeriodLabel` (e.g. "Warmest around 3 PM"), `isCoolingNow` (bool — temp trending down from peak), `transitionLabel` (e.g. "Cooling after 4 PM" if a significant drop ≥4°C is detected in future points) |
| `pointRadii` | Array: 5 at `currentIndex`, 6 at `peakIndex`, 0 elsewhere |
| `pointStyles` | Array: `'circle'` at `currentIndex`, `'rectRot'` at `peakIndex`, `'circle'` elsewhere |
| `pointBorderColors` | Array: `theme.currentPointColor` at current, `theme.peakPointColor` at peak, `theme.lineColor` elsewhere |
| `yMin` | `minVal − 0.1 × range` (or `minVal − 1` if range === 0) |
| `yMax` | `maxVal + 0.1 × range` (or `maxVal + 1` if range === 0) |
| `hasValidData` | `validTemps.length >= 2` |
| `currentTemp` | `temperatureValues[currentIndex]` |
| `peakTemp` | `temperatureValues[peakIndex]` |
| `peakTimeLabel` | `formatHour(points[peakIndex].dt_txt)` in 12-hour format |

### Temperature Storytelling — `temperatureStory` Detail

`temperatureStory` derives a lightweight narrative from the shape of the temperature curve. It surfaces at most **one contextual phrase** below the Current/Peak summary — chosen based on priority:

1. **Cooling context** (highest priority): if `currentIndex > peakIndex` and the difference `peakTemp − currentTemp ≥ 2°C`, show "Cooling down now".
2. **Warming context**: if `peakIndex > currentIndex` and the difference `peakTemp − currentTemp ≥ 4°C`, show "Warming through [peakTimeLabel]".
3. **Stable context**: if neither threshold is met, no phrase is shown (clean, uncluttered).

The phrase appears as a single line in muted text below the summary row. It never duplicates the peak time already shown in the summary. This is **not** a tooltip, badge, or new UI element — it is a single optional text line in the existing summary area. If the data doesn't support a meaningful phrase, nothing is shown. Clutter is avoided by design.

### `WeatherTrendCharts.vue` — Emitted Events

None. The component is display-only.

---

## Data Models

### ForecastPoint (existing, unchanged)

```js
{
  dt_txt: String,    // "2025-07-15 15:00:00"
  main: {
    temp: Number,    // Celsius
    // ...
  },
  weather: [{ main: String, ... }],
  pop: Number        // precipitation probability 0–1
}
```

### ChartTheme (new)

Defined in `chartTheme.js` JSDoc above. All values are non-empty strings resolved from CSS custom properties at call time.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: `getChartTheme()` returns all required keys with non-empty values

*For any* set of CSS custom property values applied to `document.documentElement`, calling `getChartTheme()` shall return an object containing all of the following keys — `lineColor`, `gradientStart`, `gradientEnd`, `gridColor`, `tickColor`, `tooltipBg`, `tooltipTitle`, `tooltipBody`, `tooltipBorder`, `currentPointColor`, `peakPointColor` — each with a non-empty string value.

**Validates: Requirements 5.1, 5.2**

---

### Property 2: `getChartTheme()` reflects CSS custom property values exactly

*For any* arbitrary string values assigned to `--lc-accent`, `--lc-border-subtle`, `--lc-text-muted`, `--lc-surface-raised`, `--lc-text-primary`, `--lc-text-secondary`, `--lc-border`, `--lc-bg`, and `--lc-warning` on `document.documentElement`, the corresponding fields in the object returned by `getChartTheme()` shall equal the values that were set, with no hardcoded fallback colours substituted.

**Validates: Requirements 5.1, 5.2**

---

### Property 3: Y-axis scale formula is correct for all valid temperature arrays

*For any* non-empty array of finite temperature values where `min_temp !== max_temp`, the computed `y.min` shall equal `min_temp − 0.1 × (max_temp − min_temp)` and `y.max` shall equal `max_temp + 0.1 × (max_temp − min_temp)`, ensuring the data always fits within the visible scale with consistent padding above and below.

**Validates: Requirements 6.4, 6.5**

---

### Property 4: Current and peak index identification is correct for all valid point arrays

*For any* array of hourly forecast points where at least one point has a `dt_txt` timestamp at or before the current wall-clock time, the computed `currentIndex` shall be the index of the point with the latest `dt_txt` that does not exceed `Date.now()`. For any array where at least one point has a `dt_txt` after `Date.now()`, the computed `peakIndex` shall be the index of the point with the maximum `main.temp` value among those future points.

**Validates: Requirements 2.1, 2.2, 3.4, 3.5**

---

### Property 5: Per-point radius and style arrays respect current/peak highlight contract

*For any* hourly forecast array with a valid `currentIndex` and `peakIndex`, the `pointRadii` array shall have value 5 at `currentIndex`, value 6 at `peakIndex`, and value 0 at all other indices; the `pointStyles` array shall have `'circle'` at `currentIndex`, `'rectRot'` at `peakIndex`, and `'circle'` at all other indices.

**Validates: Requirements 3.3, 3.4, 3.5**

---

### Property 6: Condition colour resolver maps all normalized keys and falls back for unknown keys

*For any* normalized LumiCast weather condition key (output of `resolveWeatherIconKey()`), `getConditionColor()` shall return the resolved value of `--lc-rain-color` for `'Rain'`, `--lc-sun-color` for `'Clear'`, `--lc-snow-color` for `'Snow'`, `--lc-storm-color` for `'Thunderstorm'`, and the resolved value of `--lc-accent` for any other string including `'Clouds'`, `'Fog'`, empty string, or unknown values. The function shall never accept raw OWM condition strings that have not passed through `resolveWeatherIconKey()`. The return value shall never be an empty string or a hardcoded colour literal.

**Validates: Requirements 7.2**

---

### Property 7: Summary display formats all temperature values correctly with any unit symbol

*For any* finite temperature value and any unit symbol string (`'C'`, `'F'`, or other), the formatted current temperature label shall be the rounded integer value followed by `°` and the unit symbol (e.g. `"24°C"`), and the peak label shall follow the same format. The label text shall never be an empty string when a valid temperature value exists.

**Validates: Requirements 2.1, 2.2**

---

## Error Handling

### Insufficient Data (fewer than 2 points)

When `points.length < 2`, the chart canvas is not mounted. A placeholder `<div class="chart-placeholder">` is shown instead with descriptive text. The summary area is also hidden. This prevents Chart.js from emitting warnings about insufficient data.

```
hasValidData === false
  → <template v-if="!hasValidData"> shows placeholder
  → <Line> component is NOT rendered (v-if gated)
```

### NaN / non-finite temperature values

`temperatureValues` filters through `Number.isFinite()` before any chart operations. If ALL values are non-finite, `hasValidData` is false and the placeholder path is taken. Individual NaN values are coerced gracefully by Chart.js (rendered as gaps in the line).

### Canvas gradient creation failure

Gradient construction (`createLinearGradient`) is called inside a Chart.js `beforeDraw` plugin callback, which always has access to the canvas 2D context. This avoids the `computed()` timing problem (canvas context is not available during Vue reactivity evaluation). If context is unavailable for any reason, the plugin no-ops and the fill falls back to a plain semi-transparent fill colour.

### Theme resolution failure

`getChartTheme()` uses `.trim()` on each property value. If a CSS custom property is not defined (returns empty string), the key is still present but empty. The chart options accept empty strings without throwing — colours simply render as `transparent` or browser default. This is an acceptable graceful degradation; the requirement is that no error is thrown.

### Chart instance lifecycle

`onBeforeUnmount` calls `chartInstance.destroy()` to prevent Chart.js from attempting to draw on a detached canvas. The vue-chartjs `<Line>` component handles this automatically, but explicit destruction is added as a safeguard when manually managing the instance for gradient plugins.

---

## Testing Strategy

### Dual Approach

Both unit tests (specific examples, edge cases, error conditions) and property-based tests (universal properties across generated inputs) are used. Unit tests catch concrete bugs; property tests verify general correctness that no finite set of examples can fully cover.

### Property-Based Testing Library

**[fast-check](https://github.com/dubzzz/fast-check)** (JavaScript PBT library, no TypeScript required). Each property test runs a minimum of **100 iterations**.

Install: `npm install --save-dev fast-check`

Tag format for property tests:
```
// Feature: lumicast-v2-phase-2-6-visual-polish, Property N: <property_text>
```

### Unit Tests — `src/utils/chartTheme.js`

| Test | Description |
|---|---|
| `getChartTheme() returns all required keys` | Assert all 11 keys present, all non-empty strings (Property 1 — example instantiation) |
| `getChartTheme() reads from CSS, not hardcoded` | Set `--lc-accent` to `#ff0000`; assert `lineColor === '#ff0000'` (Property 2) |
| `getConditionColor maps Rain` | Assert returns resolved `--lc-rain-color` |
| `getConditionColor maps Clear` | Assert returns resolved `--lc-sun-color` |
| `getConditionColor maps Snow` | Assert returns resolved `--lc-snow-color` |
| `getConditionColor maps Thunderstorm` | Assert returns resolved `--lc-storm-color` |
| `getConditionColor falls back to accent` | Assert unknown codes return resolved `--lc-accent` |

### Unit Tests — `WeatherTrendCharts.vue`

| Test | Description |
|---|---|
| `legend.display is false` | Assert `chartOptions.plugins.legend.display === false` |
| `responsive and maintainAspectRatio` | Assert `responsive: true`, `maintainAspectRatio: false` |
| `tension is 0.4` | Assert `dataset.tension === 0.4` |
| `borderWidth is 2.5` | Assert `dataset.borderWidth === 2.5` |
| `maxTicksLimit is 6` | Assert `scales.x.ticks.maxTicksLimit === 6` |
| `animation duration 800ms` | Assert `animation.duration === 800` |
| `animation easing easeOutQuart` | Assert `animation.easing === 'easeOutQuart'` |
| `reduced-motion sets duration 0` | Mock `matchMedia` returning reduce; assert `duration === 0` |
| `placeholder renders for < 2 points` | Mount with `[]` and `[onePoint]`; assert `.chart-placeholder` present, `canvas` absent |
| `title always renders` | Mount with empty and populated data; assert "Temperature Today" in DOM |
| `summary hidden when no valid data` | Mount with empty array; assert summary area absent |
| `currentIndex computation` | Pass array with known timestamps around mocked `Date.now()`; assert `currentIndex` correct |
| `peakIndex computation` | Pass array where max future temp is at known index; assert `peakIndex` correct |
| `pointHitRadius ≥ 22` | Assert `dataset.pointHitRadius >= 22` |
| `tooltip uses token keys` | Assert tooltip options contain non-empty string values from `getChartTheme()` |
| `yMin/yMax fallback for flat data` | Pass array of equal values; assert `y.min = val−1`, `y.max = val+1` |

### Property-Based Tests

Each test uses `fast-check` arbitraries and runs 100+ iterations.

```js
// Feature: lumicast-v2-phase-2-6-visual-polish, Property 1: getChartTheme returns all required keys
it('getChartTheme always returns all required keys', () => {
  fc.assert(fc.property(
    fc.record({ accent: fc.hexaString(), muted: fc.hexaString(), /* ... */ }),
    (cssValues) => {
      // Set CSS custom properties to generated values
      // Call getChartTheme()
      // Assert all 11 keys present and non-empty
    }
  ), { numRuns: 100 })
})
```

```js
// Feature: lumicast-v2-phase-2-6-visual-polish, Property 3: y-axis scale formula
it('yMin/yMax formula is correct for all finite temp arrays', () => {
  fc.assert(fc.property(
    fc.array(fc.float({ noNaN: true, noDefaultInfinity: true }), { minLength: 2 }),
    (temps) => {
      const min = Math.min(...temps)
      const max = Math.max(...temps)
      if (min === max) return true // edge case handled separately
      const range = max - min
      expect(computeYMin(temps)).toBeCloseTo(min - 0.1 * range)
      expect(computeYMax(temps)).toBeCloseTo(max + 0.1 * range)
    }
  ), { numRuns: 200 })
})
```

```js
// Feature: lumicast-v2-phase-2-6-visual-polish, Property 4: current/peak index identification
it('currentIndex is the latest non-future point for any valid array', () => {
  fc.assert(fc.property(
    fc.array(fc.record({ dt_txt: fc.date(), temp: fc.float({ noNaN: true }) }), { minLength: 1 }),
    fc.date(),
    (points, now) => {
      const idx = computeCurrentIndex(points, now)
      const past = points.filter(p => new Date(p.dt_txt) <= now)
      if (past.length === 0) return true
      expect(new Date(points[idx].dt_txt)).toBeLessThanOrEqualTo(now)
    }
  ), { numRuns: 150 })
})
```

```js
// Feature: lumicast-v2-phase-2-6-visual-polish, Property 5: per-point arrays respect highlight contract
it('pointRadii has correct values at current and peak indices', () => {
  fc.assert(fc.property(
    fc.array(validForecastPointArbitrary(), { minLength: 2 }),
    (points) => {
      const radii = computePointRadii(points)
      const currentIdx = computeCurrentIndex(points, Date.now())
      const peakIdx = computePeakIndex(points, Date.now())
      radii.forEach((r, i) => {
        if (i === currentIdx) expect(r).toBe(5)
        else if (i === peakIdx) expect(r).toBe(6)
        else expect(r).toBe(0)
      })
    }
  ), { numRuns: 100 })
})
```

```js
// Feature: lumicast-v2-phase-2-6-visual-polish, Property 6: condition colour resolver
it('getConditionColor never returns empty string or hardcoded literal', () => {
  fc.assert(fc.property(
    fc.string(),
    (conditionCode) => {
      const color = getConditionColor(conditionCode)
      expect(typeof color).toBe('string')
      expect(color.length).toBeGreaterThan(0)
      // Not a raw hex or rgba literal (must be a resolved token value)
      expect(color).not.toMatch(/^#[0-9a-f]{3,8}$/i)
      expect(color).not.toMatch(/^rgba?\\(/)
    }
  ), { numRuns: 100 })
})
```

```js
// Feature: lumicast-v2-phase-2-6-visual-polish, Property 7: summary formatting
it('formatted temperature label is correct for any finite temp and unit', () => {
  fc.assert(fc.property(
    fc.float({ noNaN: true, noDefaultInfinity: true, min: -100, max: 100 }),
    fc.constantFrom('C', 'F', 'K'),
    (temp, unit) => {
      const label = formatTempLabel(temp, unit)
      expect(label).toBe(`${Math.round(temp)}°${unit}`)
    }
  ), { numRuns: 200 })
})
```

### Manual Testing Checklist

- [ ] Dark → Light theme switch: all chart colours update without page reload
- [ ] Light → Dark theme switch: same
- [ ] 320 px viewport: no horizontal overflow, chart height ≥ 160 px
- [ ] 768 px viewport: chart height ≥ 260 px
- [ ] `prefers-reduced-motion` enabled: line appears instantly, no glow on current point
- [ ] Hover tooltip: correct styling, correct temperature value with unit
- [ ] Touch tap on mobile: tooltip appears within 24 px hit zone
- [ ] Empty data state: placeholder text shown, no console errors
- [ ] Thunderstorm condition: gradient tinted purple (`--lc-storm-color`)
- [ ] Rain condition: gradient tinted light blue (`--lc-rain-color`)
- [ ] Current point: filled circle with background-coloured ring visible
- [ ] Peak point: diamond shape with warning-coloured border visible

---

## Section Appendix: Design Decisions and Rationale

### Why a separate `chartTheme.js` utility?

Centralising token reads into a single function makes the chart fully testable in isolation — tests can set CSS custom properties on `document.documentElement` (jsdom supports this) and call `getChartTheme()` without mounting the Vue component. It also ensures `WeatherTrendCharts.vue` never needs to call `getComputedStyle` directly.

### Why `CanvasGradient` in a `beforeDraw` plugin rather than `computed()`?

Canvas gradients require a 2D rendering context. Vue's `computed()` functions run during reactive evaluation, before the canvas element exists in the DOM. The `beforeDraw` Chart.js lifecycle hook is always called with an active `ctx`, making it the correct place for gradient creation. The gradient is recreated on each `beforeDraw` call only when the chart dimensions change (guard with stored `width`/`height`).

### Why per-point arrays instead of Chart.js point plugins?

Chart.js 4's `pointRadius`, `pointStyle`, `pointBackgroundColor`, and `pointBorderColor` dataset options all accept arrays aligned to the data array. This is the official approach and requires zero custom DOM manipulation. A custom plugin would be needed only if the requirement was to render elements outside the chart canvas (e.g. floating labels), which is not required here.

### Why `watch(resolvedTheme)` instead of a CSS transition?

Chart.js renders to canvas. Canvas pixels don't participate in CSS transitions. The only way to update chart colours on theme change is to re-call `getChartTheme()` and call `chart.update()`. The `resolvedTheme` ref from `useTheme()` is the authoritative signal for theme changes in LumiCast.

### Why `easeOutQuart` for animation?

`--lc-ease-out` in tokens.css resolves to `cubic-bezier(0, 0, 0.2, 1)`. Chart.js doesn't accept custom cubic-bezier strings — it uses named easing presets. `easeOutQuart` is the closest named Chart.js easing to the LumiCast standard ease-out curve (strong deceleration, sharp start, smooth landing), matching the app's motion language without introducing a custom animation engine.

### Why `resolveWeatherIconKey()` is the normalization boundary for chart condition tinting

The chart's `getConditionColor()` maps normalized LumiCast condition keys (not raw OWM codes) to colour tokens. This enforces the three-layer architecture: `weather data → normalization layer (resolveWeatherIconKey) → chart visualization layer (getConditionColor)`. The chart layer is therefore decoupled from the OWM API — if LumiCast ever changes weather providers, only the normalization layer needs updating, not the chart.

Raw OWM codes like `'Drizzle'`, `'Mist'`, `'Haze'`, `'Smoke'` never reach `getConditionColor()`. `resolveWeatherIconKey()` already consolidates these into `'Rain'` and `'Fog'` respectively, meaning the chart always receives a clean, stable condition key from a controlled vocabulary.

### Why temperature storytelling uses a single optional text phrase — not visual annotations

The storytelling goal is to communicate the *shape* of the day (warming, cooling, stable) in the fewest possible words. A single muted phrase below the summary row achieves this without adding chart annotations, overlays, or additional controls that would push the chart toward an analytics dashboard aesthetic. The phrase appears only when the data warrants it (thresholds of 2°C for cooling, 4°C for warming) — no phrase is shown for stable or insufficient data, keeping the card clean by default.

### Why preserve the async-loading wrapper in `WeatherDashboard.vue`?

`WeatherTrendCharts.vue` imports Chart.js (a ~200 KB library). Keeping it async-loaded preserves the initial bundle size and maintains the existing loading skeleton behaviour. No changes to the async wrapper are needed — the new `weatherCondition` prop is simply added to the `<WeatherTrendCharts>` call in `WeatherDashboard.vue`.
