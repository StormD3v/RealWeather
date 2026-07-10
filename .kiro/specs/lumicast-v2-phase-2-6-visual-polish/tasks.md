# Implementation Plan: LumiCast V2 Phase 2.6 — Premium Data Visualization & Final Visual Polish

## Overview

This plan replaces `WeatherTrendCharts.vue` in full, introduces the new `src/utils/chartTheme.js` utility, updates `WeatherDashboard.vue` to pass the normalized condition key, installs `fast-check` as a dev dependency, and validates everything with unit tests and property-based tests. All 7 correctness properties from the design are covered. No routes, store, or other components are changed.

---

## Tasks

- [x] 1. Install `fast-check` dev dependency
  - Run `npm install --save-dev fast-check` to install the PBT library
  - Verify `fast-check` appears under `devDependencies` in `package.json`
  - _Requirements: 10.4, 10.5_

- [x] 2. Create `src/utils/chartTheme.js`
  - [x] 2.1 Implement `getChartTheme()`
    - Read all required CSS custom properties from `document.documentElement` via `getComputedStyle(...).getPropertyValue('--lc-*').trim()`
    - Return an object with all 11 required keys: `lineColor` (`--lc-accent`), `gradientStart` (accent at 0.30 alpha — constructed by caller), `gradientEnd` (transparent — constructed by caller), `gridColor` (`--lc-border-subtle`), `tickColor` (`--lc-text-muted`), `tooltipBg` (`--lc-surface-raised`), `tooltipTitle` (`--lc-text-primary`), `tooltipBody` (`--lc-text-secondary`), `tooltipBorder` (`--lc-border`), `currentPointColor` (`--lc-bg`), `peakPointColor` (`--lc-warning`)
    - Zero hardcoded colour literals in the function body
    - _Requirements: 5.1, 5.2_

  - [x] 2.2 Implement `getConditionColor(normalizedCondition)`
    - Accept only normalized keys produced by `resolveWeatherIconKey()`: `'Clear'`, `'Clouds'`, `'Rain'`, `'Thunderstorm'`, `'Snow'`, `'Fog'`
    - Map: `'Rain'` → resolved `--lc-rain-color`, `'Clear'` → resolved `--lc-sun-color`, `'Snow'` → resolved `--lc-snow-color`, `'Thunderstorm'` → resolved `--lc-storm-color`, `'Clouds'` | `'Fog'` | unknown → resolved `--lc-accent`
    - Return value must always be a non-empty resolved CSS value, never a hardcoded literal
    - _Requirements: 7.2_

  - [x]* 2.3 Write unit tests for `getChartTheme()`
    - Set CSS custom properties on `document.documentElement` (jsdom) and assert each key returns the set value
    - Assert all 11 keys are present and non-empty for any CSS state
    - Assert `lineColor` equals the set `--lc-accent` value (hardcoded-read regression test)
    - _Requirements: 5.1, 5.2_

  - [x]* 2.4 Write property test for `getChartTheme()` — Property 1 & 2
    - **Property 1: `getChartTheme()` returns all required keys with non-empty values**
    - **Property 2: `getChartTheme()` reflects CSS custom property values exactly**
    - **Validates: Requirements 5.1, 5.2**
    - Use `fc.record({ accent: fc.hexaString(), ... })` to generate CSS token values
    - Assert all 11 keys present and each value equals what was set; `numRuns: 100`
    - Tag: `// Feature: lumicast-v2-phase-2-6-visual-polish, Property 1 & 2`

  - [x]* 2.5 Write unit tests for `getConditionColor()`
    - Assert `'Rain'` → resolved `--lc-rain-color`
    - Assert `'Clear'` → resolved `--lc-sun-color`
    - Assert `'Snow'` → resolved `--lc-snow-color`
    - Assert `'Thunderstorm'` → resolved `--lc-storm-color`
    - Assert `'Clouds'` → resolved `--lc-accent`
    - Assert `'Fog'` → resolved `--lc-accent`
    - Assert unknown string → resolved `--lc-accent`
    - _Requirements: 7.2_

  - [x]* 2.6 Write property test for `getConditionColor()` — Property 6
    - **Property 6: Condition colour resolver maps all normalized keys and falls back for unknown keys**
    - **Validates: Requirements 7.2**
    - Use `fc.string()` to generate arbitrary condition codes
    - Assert return is always a non-empty string, never a hex/rgba literal
    - Assert all 6 canonical keys map to their expected token values
    - `numRuns: 100`
    - Tag: `// Feature: lumicast-v2-phase-2-6-visual-polish, Property 6`

- [x] 3. Fully replace `src/components/charts/WeatherTrendCharts.vue`
  - [x] 3.1 Scaffold the new component skeleton
    - Delete all existing content from `WeatherTrendCharts.vue`
    - Add `<script setup>`, `<template>`, and `<style scoped>` blocks
    - Register Chart.js: `CategoryScale`, `LinearScale`, `PointElement`, `LineElement`, `Filler`, `Tooltip` — `Legend` is NOT registered
    - Import `Line` from `vue-chartjs`
    - Import `getChartTheme`, `getConditionColor` from `@/utils/chartTheme`
    - Import `useTheme` from `@/composables/useTheme`
    - Import `formatHour` from `@/composables/useWeatherFormatters`
    - Define props: `points` (Array, default `[]`), `unitSymbol` (String, default `'C'`), `weatherCondition` (String, default `'Clear'`)
    - _Requirements: 1.1, 5.1, 8.1, 8.2_

  - [x] 3.2 Implement core computed values
    - `labels`: `formatHour(p.dt_txt)` for each point
    - `temperatureValues`: `Number(p?.main?.temp ?? NaN)` for each point
    - `validTemps`: filtered finite values (`Number.isFinite`)
    - `hasValidData`: `validTemps.length >= 2`
    - `currentIndex`: index of point with latest `dt_txt` not exceeding `Date.now()`; default `0` if none found
    - `peakIndex`: index of point with max `main.temp` among points after `Date.now()`; default `currentIndex` if no future points
    - `currentTemp`: `temperatureValues[currentIndex]`
    - `peakTemp`: `temperatureValues[peakIndex]`
    - `peakTimeLabel`: `formatHour(points[peakIndex]?.dt_txt)` in 12-hour format
    - _Requirements: 2.1, 2.2, 2.3, 3.4, 3.5_

  - [x] 3.3 Implement y-axis scale computed values
    - `yMin`: `minVal − 0.1 × range`; when `range === 0` use `minVal − 1`
    - `yMax`: `maxVal + 0.1 × range`; when `range === 0` use `maxVal + 1`
    - Derive from `validTemps`; fall back to `{ yMin: 0, yMax: 1 }` when `validTemps` is empty
    - _Requirements: 6.4, 6.5, 6.6_

  - [x] 3.4 Implement per-point highlight arrays
    - `pointRadii`: value `5` at `currentIndex`, `6` at `peakIndex`, `0` elsewhere
    - `pointStyles`: `'circle'` at `currentIndex`, `'rectRot'` at `peakIndex`, `'circle'` elsewhere
    - `pointBorderColors`: `theme.currentPointColor` at `currentIndex`, `theme.peakPointColor` at `peakIndex`, `theme.lineColor` elsewhere
    - `theme` is obtained by calling `getChartTheme()` once inside the computed (re-evaluates on reactive dep change)
    - `pointHoverRadius`: `6` for all points via dataset option
    - `pointHitRadius`: `22` for all points via dataset option (touch hit area ≥ 44 px diameter)
    - _Requirements: 3.3, 3.4, 3.5, 9.5_

  - [x] 3.5 Implement `temperatureStory` computed
    - Derive one optional muted phrase from the curve shape:
      1. If `currentIndex > peakIndex` AND `peakTemp − currentTemp ≥ 2°C` → `"Cooling down now"`
      2. Else if `peakIndex > currentIndex` AND `peakTemp − currentTemp ≥ 4°C` → `"Warming through [peakTimeLabel]"`
      3. Otherwise → `null` (no phrase shown)
    - Exposed as a single nullable string on the component, rendered only when non-null
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.6 Implement `chartOptions` computed using `getChartTheme()`
    - `responsive: true`, `maintainAspectRatio: false`
    - `plugins.legend.display: false`
    - `animation.duration`: `800` normally; `0` when `window.matchMedia('(prefers-reduced-motion: reduce)').matches`
    - `animation.easing`: `'easeOutQuart'`
    - Tooltip: `backgroundColor` → `theme.tooltipBg`, `titleColor` → `theme.tooltipTitle`, `bodyColor` → `theme.tooltipBody`, `borderColor` → `theme.tooltipBorder`, `borderWidth: 1`, `cornerRadius: 10`, `padding: 10`
    - Scales: `x.ticks.color` → `theme.tickColor`, `x.grid.color` → `theme.gridColor`, `x.ticks.maxTicksLimit: 6`, `x.ticks.font.size: 11`
    - Scales: `y.ticks.color` → `theme.tickColor`, `y.grid.color` → `theme.gridColor`, `y.min` → `yMin`, `y.max` → `yMax`, `y.ticks.font.size: 11`
    - _Requirements: 2.4, 4.1, 4.2, 5.1, 5.3, 5.4, 6.1, 6.2, 6.3, 6.7, 7.4, 8.2, 8.3, 8.4, 8.5_

  - [x] 3.7 Implement `chartData` computed
    - `labels`: `labels.value`
    - Dataset `data`: `temperatureValues.value`
    - Dataset `borderColor`: `theme.lineColor`
    - Dataset `backgroundColor`: `'transparent'` (gradient applied in `beforeDraw` plugin; `fill: true` is still set so Chart.js allocates fill region)
    - Dataset `tension: 0.4`, `borderWidth: 2.5`, `fill: true`
    - Dataset `pointRadius`: `pointRadii.value`
    - Dataset `pointStyle`: `pointStyles.value`
    - Dataset `pointBorderColor`: `pointBorderColors.value`
    - Dataset `pointBackgroundColor`: `theme.lineColor`
    - Dataset `pointHoverRadius: 6`, `pointHitRadius: 22`, `pointBorderWidth: 2`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 9.5_

  - [x] 3.8 Implement `beforeDraw` gradient plugin
    - Register a Chart.js inline plugin object with a `beforeDraw(chart)` hook
    - Inside `beforeDraw`, obtain `chart.ctx` and chart area dimensions (`chart.chartArea`)
    - Guard: if no chart area, no-op
    - Create a `createLinearGradient` from top of chart area to bottom
    - Base colour: `getConditionColor(props.weatherCondition)`; if unavailable, fall back to `getChartTheme().lineColor`
    - Gradient stop 0 (top): base colour at 0.30 opacity
    - Gradient stop 1 (bottom): base colour at 0.00 opacity
    - Assign the gradient to `chart.data.datasets[0].backgroundColor` then call `chart.update('none')` only when dimensions change (store last `width`/`height` to avoid infinite loops)
    - _Requirements: 3.6, 7.1, 7.2_

  - [x] 3.9 Implement theme reactivity
    - Import `resolvedTheme` from `useTheme()`
    - `watch(resolvedTheme, () => { chartOptions re-evaluates via reactive dep; call chartInstance.update() })`
    - Obtain chart instance ref via `ref(null)` and `@chart-rendered` emitted by vue-chartjs `<Line>` or via template ref
    - On `onBeforeUnmount`: call `chartInstance.value?.destroy()` as safeguard
    - _Requirements: 5.3_

  - [x] 3.10 Implement template and placeholder
    - Always render title "Temperature Today" and subtitle "Hourly temperature trend" (even when data is empty)
    - `v-if="hasValidData"`: render `<Line>` component with `chartData` and `chartOptions`
    - `v-else`: render `<div class="chart-placeholder">` with descriptive non-empty text (e.g. "Temperature data unavailable")
    - Summary area (`v-if="hasValidData"`): show Current label + formatted value, Peak label + formatted value + peak time phrase ("Peak expected around [peakTimeLabel]")
    - Story phrase: rendered as a single muted-text line below summary, only when `temperatureStory !== null`
    - _Requirements: 1.1, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 3.11 Implement responsive CSS
    - Default (mobile-first): `chart-container` height `180px`; minimum `160px` at 320 px via `@media (max-width: 320px) { min-height: 160px }`
    - `@media (min-width: 601px)`: height `240px`
    - `@media (min-width: 768px)`: height `260px`
    - Internal padding using `var(--lc-sp-4)` (top/sides) and `var(--lc-sp-5)` (bottom)
    - No hardcoded colour or spacing literals anywhere in the `<style>` block
    - _Requirements: 1.2, 1.3, 1.4, 9.1, 9.2, 9.4_

- [x] 4. Checkpoint — verify chart renders correctly
  - Ensure `vite build` passes with exit code 0 and zero errors after tasks 1–3
  - Verify no `console.error` or `console.warn` in browser with mocked data in both dark and light themes
  - _Requirements: 10.3, 10.4_

- [x] 5. Update `WeatherDashboard.vue` to pass normalized `weatherCondition` prop
  - In the `<WeatherTrendCharts>` call inside `WeatherDashboard.vue`, add `:weather-condition="weatherIconKey"` (the `weatherIconKey` computed already calls `resolveWeatherIconKey(store.currentCondition)` and is defined in the existing script setup)
  - Do NOT modify any other part of `WeatherDashboard.vue` — the async-loading wrapper, layout, and all other props remain unchanged
  - _Requirements: 7.2_

- [x] 6. Write unit tests for `WeatherTrendCharts.vue`
  - [x] 6.1 Write chart options and config unit tests
    - Assert `plugins.legend.display === false`
    - Assert `responsive: true` and `maintainAspectRatio: false`
    - Assert `dataset.tension === 0.4`
    - Assert `dataset.borderWidth === 2.5`
    - Assert `scales.x.ticks.maxTicksLimit === 6`
    - Assert `animation.duration === 800` (no reduced-motion)
    - Assert `animation.easing === 'easeOutQuart'`
    - Assert `dataset.pointHitRadius >= 22`
    - Assert tooltip `cornerRadius === 10`, `padding === 10`, `borderWidth === 1`
    - _Requirements: 3.1, 3.2, 3.3, 4.1, 4.2, 6.7, 7.4, 8.2, 8.3, 8.4, 9.5_

  - [x] 6.2 Write reduced-motion unit test
    - Mock `window.matchMedia` to return `matches: true` for `prefers-reduced-motion: reduce`
    - Assert `animation.duration === 0`
    - _Requirements: 4.2, 7.3_

  - [x] 6.3 Write data/state unit tests
    - Mount with `[]` → assert `.chart-placeholder` present, `canvas` absent, summary area absent
    - Mount with single point → same placeholder behaviour
    - Mount with populated points → assert "Temperature Today" in DOM; assert `canvas` present
    - Pass array with known `dt_txt` timestamps around mocked `Date.now()` → assert `currentIndex` correct
    - Pass array where max future temp is at known index → assert `peakIndex` correct
    - Pass array of equal values → assert `yMin = val−1`, `yMax = val+1`
    - _Requirements: 1.1, 1.5, 2.1, 2.2, 2.5, 6.4, 6.5, 6.6_

  - [x] 6.4 Write tooltip colour token unit test
    - Assert tooltip option values are non-empty strings resolved from `getChartTheme()` (not hardcoded literals)
    - _Requirements: 3.7, 5.4_

- [x] 7. Write property-based tests for pure computation functions
  - [x]* 7.1 Write property test for y-axis scale formula — Property 3
    - **Property 3: Y-axis scale formula is correct for all valid temperature arrays**
    - **Validates: Requirements 6.4, 6.5**
    - Extract `computeYMin` / `computeYMax` as pure helpers (or test via component computed logic)
    - Use `fc.array(fc.float({ noNaN: true, noDefaultInfinity: true }), { minLength: 2 })`
    - When `min !== max`: assert `yMin ≈ min − 0.1 × range`, `yMax ≈ max + 0.1 × range` (use `toBeCloseTo`)
    - When `min === max`: assert `yMin = val−1`, `yMax = val+1`
    - `numRuns: 200`
    - Tag: `// Feature: lumicast-v2-phase-2-6-visual-polish, Property 3`

  - [x]* 7.2 Write property test for current/peak index identification — Property 4
    - **Property 4: Current and peak index identification is correct for all valid point arrays**
    - **Validates: Requirements 2.1, 2.2, 3.4, 3.5**
    - Generate `fc.array` of forecast points with `fc.date()` for `dt_txt` and `fc.float` for `main.temp`
    - For `currentIndex`: assert selected point's timestamp is ≤ `now` and is the latest such point
    - For `peakIndex`: assert selected point has the maximum `main.temp` among points with timestamp > `now`
    - `numRuns: 150`
    - Tag: `// Feature: lumicast-v2-phase-2-6-visual-polish, Property 4`

  - [x]* 7.3 Write property test for per-point highlight arrays — Property 5
    - **Property 5: Per-point radius and style arrays respect current/peak highlight contract**
    - **Validates: Requirements 3.3, 3.4, 3.5**
    - Generate `fc.array` of valid forecast points with `minLength: 2`
    - Assert `pointRadii[currentIndex] === 5`, `pointRadii[peakIndex] === 6`, all others `=== 0`
    - Assert `pointStyles[currentIndex] === 'circle'`, `pointStyles[peakIndex] === 'rectRot'`, all others `=== 'circle'`
    - `numRuns: 100`
    - Tag: `// Feature: lumicast-v2-phase-2-6-visual-polish, Property 5`

  - [x]* 7.4 Write property test for temperature label formatting — Property 7
    - **Property 7: Summary display formats all temperature values correctly with any unit symbol**
    - **Validates: Requirements 2.1, 2.2**
    - Extract `formatTempLabel(temp, unit)` as a pure helper returning `"${Math.round(temp)}°${unit}"`
    - Use `fc.float({ noNaN: true, noDefaultInfinity: true, min: -100, max: 100 })` and `fc.constantFrom('C', 'F', 'K')`
    - Assert output equals `${Math.round(temp)}°${unit}`; assert non-empty
    - `numRuns: 200`
    - Tag: `// Feature: lumicast-v2-phase-2-6-visual-polish, Property 7`

- [x] 8. Checkpoint — run full test suite
  - Run `npm run test` (i.e. `vitest run`) and confirm all tests pass with zero failures
  - Confirm `fast-check` property tests each run their required minimum iterations
  - _Requirements: 10.5_

- [x] 9. Build verification
  - Run `vite build` and confirm exit code 0 with zero build errors
  - Confirm bundle does not regress (WeatherTrendCharts is still async-loaded via `defineAsyncComponent`)
  - _Requirements: 10.4_

- [ ] 10. Final manual testing checklist
  - [x] 10.1 Theme switching
    - Dark → Light theme switch: all chart colours update without page reload
    - Light → Dark theme switch: same
    - Verify no element displays a colour from the previous theme after the 350 ms transition
    - _Requirements: 5.3, 10.2_
  - [x] 10.2 Responsive heights
    - 320 px viewport: no horizontal overflow, chart height ≥ 160 px
    - 360–430 px viewport: tick labels legible, font size ≥ 10 px
    - 768 px viewport: chart height ≥ 260 px
    - _Requirements: 1.2, 1.3, 9.1, 9.2, 9.3, 9.4_
  - [x] 10.3 Motion and animation
    - With `prefers-reduced-motion` enabled: line appears instantly, current-point glow absent
    - Without reduced-motion: line animates over ~800 ms on mount and on data replacement
    - _Requirements: 4.1, 4.2, 7.3_
  - [x] 10.4 Interaction
    - Mouse hover: tooltip shows correct hour label and temperature with unit
    - Touch tap within 24 px of nearest point: tooltip appears
    - _Requirements: 3.7, 3.8_
  - [x] 10.5 Weather condition gradient tinting
    - Thunderstorm condition: gradient tinted purple (`--lc-storm-color`)
    - Rain condition: gradient tinted light blue (`--lc-rain-color`)
    - Clear condition: gradient tinted yellow (`--lc-sun-color`)
    - Snow condition: gradient tinted white-blue (`--lc-snow-color`)
    - _Requirements: 7.1, 7.2_
  - [x] 10.6 Point highlighting
    - Current point: filled circle with `--lc-bg`-coloured ring visible on the line
    - Peak point: diamond shape (`rectRot`) with `--lc-warning`-coloured border visible
    - All other points: invisible (radius 0)
    - _Requirements: 3.3, 3.4, 3.5_
  - [x] 10.7 Empty state
    - Empty data: placeholder text shown, no console errors, title/subtitle still visible
    - _Requirements: 1.1, 1.5, 2.5_
  - [x] 10.8 Zero console errors
    - Load dashboard in both dark and light mode: zero `console.error` / `console.warn` from Phase 2.6 changes
    - _Requirements: 10.3_

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- `fast-check` must be installed (task 1) before any `*`-marked PBT tasks are executed
- All test helper functions (`computeYMin`, `computeYMax`, `computeCurrentIndex`, `computePeakIndex`, `formatTempLabel`) should be extracted from `WeatherTrendCharts.vue` as module-level pure functions or tested via the computed outputs — whichever approach keeps the component testable without mounting
- The `beforeDraw` gradient plugin must guard against infinite update loops by storing the last rendered `width`/`height` and only calling `chart.update('none')` when dimensions change
- `weatherIconKey` is already computed in `WeatherDashboard.vue`; task 5 is a one-line prop addition only
- Property tests tag format: `// Feature: lumicast-v2-phase-2-6-visual-polish, Property N: <property_text>`
- Checkpoints (tasks 4, 8, 9) are required — do not skip them

---

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["2.1", "2.2"] },
    { "id": 1, "tasks": ["2.3", "2.4", "2.5", "2.6", "3.1"] },
    { "id": 2, "tasks": ["3.2", "3.3"] },
    { "id": 3, "tasks": ["3.4", "3.5", "3.6", "3.7"] },
    { "id": 4, "tasks": ["3.8", "3.9", "3.10"] },
    { "id": 5, "tasks": ["3.11", "5.1"] },
    { "id": 6, "tasks": ["6.1", "6.2", "6.3", "6.4"] },
    { "id": 7, "tasks": ["7.1", "7.2", "7.3", "7.4"] },
    { "id": 8, "tasks": ["10.1", "10.2", "10.3", "10.4", "10.5", "10.6", "10.7", "10.8"] }
  ]
}
```
