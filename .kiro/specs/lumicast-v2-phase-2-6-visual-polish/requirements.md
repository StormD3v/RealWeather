# Requirements Document

## Introduction

Phase 2.6 is the final visual refinement pass for LumiCast before introducing major intelligence features. Phases 2 and 2.5 established the design system, theme architecture, component consistency, responsive improvements, and dark/light mode support. This phase brings all remaining visual elements — primarily the Temperature Today chart and all other Chart.js visualisations — to the same premium quality level already achieved throughout the application.

**Scope constraints (strictly enforced):**
- No new weather features are added.
- The application flow is not changed.
- The product is not redesigned.
- All work is limited to visualisation quality, polish, and consistency.

---

## Glossary

- **Chart_Card**: The card component that wraps the Temperature Today chart (`WeatherTrendCharts.vue`).
- **Chart_Theme_Helper**: A reusable utility function `getChartTheme()` that reads CSS custom property values from the active theme at runtime, located at `src/utils/chartTheme.js`.
- **Design_Token**: A CSS custom property defined in `tokens.css` under the `--lc-*` namespace.
- **Peak_Temperature**: The highest `main.temp` value among all data points in the hourly data set that occur after the current wall-clock time.
- **Current_Temperature**: The `main.temp` value from the hourly data point whose `dt_txt` timestamp is nearest to (and not after) the current wall-clock time.
- **Theme**: The active visual mode — either `dark` (default) or `light`, resolved via `useTheme`.
- **Breakpoint_xs**: Viewport width 320 px.
- **Breakpoint_sm**: Viewport width 360 px.
- **Breakpoint_md**: Viewport width 390 px.
- **Breakpoint_lg**: Viewport width 430 px.
- **Breakpoint_tablet**: Viewport width 768 px.
- **Breakpoint_desktop**: Viewport width 1024 px and above.
- **Reduced_Motion**: The `prefers-reduced-motion: reduce` media query state.
- **Hardcoded Style Literal**: Any raw colour (hex, rgb, rgba, hsl), spacing value (px, rem, em), shadow, radius, or duration value written directly in source instead of referencing a `var(--lc-*)` custom property.

---

## Requirements

### Requirement 1: Temperature Chart Card Layout

**User Story:** As a user viewing the weather dashboard, I want the Temperature Today chart to use its card space effectively, so that temperature data is visually prominent and easy to read at a glance.

#### Acceptance Criteria

1. THE Chart_Card SHALL render the title "Temperature Today" and subtitle "Hourly temperature trend" at all times, including when the hourly data set is empty.
2. WHILE the viewport width is greater than 600 px, THE Chart_Card SHALL allocate a minimum chart area height of 240 px.
3. WHILE the viewport width is 600 px or less, THE Chart_Card SHALL allocate a minimum chart area height of 180 px.
4. THE Chart_Card SHALL apply consistent internal padding using Design_Tokens `--lc-sp-4` (top and sides) and `--lc-sp-5` (bottom) so that no chart element is clipped by the card boundary.
5. WHEN the hourly data set contains fewer than two data points, THE Chart_Card SHALL display a visible, non-empty placeholder text region in place of the chart canvas rather than an empty or broken chart.

---

### Requirement 2: Contextual Data Summary (Legend Replacement)

**User Story:** As a user, I want the chart area to surface actionable weather insight instead of a raw data legend, so that I understand conditions at a glance without interpreting chart elements manually.

#### Acceptance Criteria

1. THE Chart_Card SHALL display the Current_Temperature value in the summary area at a font size at least 4 px larger than the surrounding label text, formatted with the active unit symbol (e.g. "24°C"), labelled "Current".
2. THE Chart_Card SHALL display the Peak_Temperature value in the summary area at the same size as the Current_Temperature value, formatted with the active unit symbol (e.g. "31°C"), labelled "Peak".
3. WHEN a Peak_Temperature data point exists in the hourly data set (i.e. at least one `main.temp` value occurs after the current wall-clock time), THE Chart_Card SHALL display the hour of Peak_Temperature in 12-hour format (e.g. "Peak expected around 3 PM").
4. THE Chart_Card SHALL NOT render the default Chart.js legend box (i.e. `plugins.legend.display` SHALL be `false`).
5. IF the hourly data set is empty or all `main.temp` values are non-finite numbers, THEN THE Chart_Card SHALL omit the data summary area entirely rather than displaying empty labels or zero values.

---

### Requirement 3: Chart Line and Point Styling

**User Story:** As a user, I want the temperature chart to feel polished and alive, so that it communicates data with visual personality matching the rest of LumiCast.

#### Acceptance Criteria

1. THE Chart_Card SHALL render the temperature line with a cubic interpolation tension of exactly 0.4 to produce smooth curves.
2. THE Chart_Card SHALL render the temperature line with a `borderWidth` of 2.5 px.
3. THE Chart_Card SHALL render all non-highlighted data points with a default `pointRadius` of 0 (hidden) and a `pointHoverRadius` of 6 px.
4. THE Chart_Card SHALL highlight the Current_Temperature data point with a filled circle of `pointRadius` 5 px and a `pointBorderColor` equal to the resolved value of `--lc-bg` (the page background token), creating visible contrast against the line colour.
5. THE Chart_Card SHALL highlight the Peak_Temperature data point with a `pointRadius` of 6 px, a `pointStyle` of `'rectRot'` (diamond), and a `pointBorderWidth` of 2 px using the resolved value of `--lc-warning` as the border colour, making it visually distinct from all other points.
6. THE Chart_Card SHALL render a vertical gradient fill beneath the temperature line using a `CanvasGradient` that transitions from the accent colour at 30 % opacity at the top of the chart area to 0 % opacity at the baseline.
7. WHEN a user hovers over a data point, THE Chart_Card SHALL display a tooltip containing the x-axis hour label and the temperature value formatted with the unit symbol (e.g. "3 PM — 28°C"), using `backgroundColor` from `--lc-surface-raised`, `titleColor` from `--lc-text-primary`, `bodyColor` from `--lc-text-secondary`, `borderColor` from `--lc-border`, `borderWidth` 1, `cornerRadius` matching `--lc-radius-md` (10 px), and `padding` of 10 px.
8. IF the application is rendered on a device whose browser reports at least one touch point via the Touch Events API, THE Chart_Card SHALL respond to a single tap within a 24 px radius of the nearest data point by showing the same tooltip as on mouse hover.

---

### Requirement 4: Animated Chart Drawing

**User Story:** As a user loading the dashboard, I want the temperature chart to animate into view, so that the experience feels dynamic and premium.

#### Acceptance Criteria

1. WHEN the Chart_Card mounts and the hourly data set contains two or more data points, THE Chart_Card SHALL animate the temperature line drawing from a zero-length state at the left edge to its full extent over a duration of 800 ms, using the ease-out easing curve resolved from `--lc-ease-out`.
2. IF the browser reports `prefers-reduced-motion: reduce`, THEN THE Chart_Card SHALL set the Chart.js animation duration to 0 ms, causing the line to render in its final state within one frame (≤ 16 ms) with no progressive drawing.
3. WHEN the `points` prop array reference is replaced with a new array (not mutated in place), THE Chart_Card SHALL clear the previous line state and re-animate from a zero-length state at the left edge using the same 800 ms ease-out animation.

---

### Requirement 5: Theme-Aware Chart Colours

**User Story:** As a user who switches between dark and light themes, I want all chart colours to update automatically, so that charts always remain readable and visually consistent with the active theme.

#### Acceptance Criteria

1. THE Chart_Theme_Helper SHALL expose a `getChartTheme()` function that derives all return values exclusively by reading computed CSS custom properties from `document.documentElement` at call time, with no hardcoded colour literals in its source.
2. WHEN `getChartTheme()` is called, THE Chart_Theme_Helper SHALL return an object containing all of the following keys with non-empty string values: `lineColor`, `gradientStart`, `gradientEnd`, `gridColor`, `tickColor`, `tooltipBg`, `tooltipTitle`, `tooltipBody`, `currentPointColor`, and `peakPointColor`.
3. WHEN the Theme changes (i.e. the `html` element class toggles between `light` and the default dark state), THE Chart_Card SHALL call `getChartTheme()` and call `chart.update()` to re-apply all colour values to the live Chart.js instance without requiring a page reload.
4. THE Chart_Card SHALL reference only Design_Token-derived values (via `getChartTheme()` or `var(--lc-*)`) for every colour assigned to any Chart.js dataset option, scale option, or plugin option.
5. FOR EACH Theme value (`dark`, `light`), the contrast ratio between the chart line colour and the resolved `--lc-surface` background colour SHALL be at least 3 : 1, as measured by the WCAG relative luminance formula.

---

### Requirement 6: Axis Label and Grid Readability

**User Story:** As a user reading temperature values from the chart, I want axis labels and grid lines to be clear and unobtrusive, so that I can interpret data accurately without visual noise.

#### Acceptance Criteria

1. THE Chart_Card SHALL set the x-axis `ticks.color` to the resolved computed value of `--lc-text-muted` for the active Theme at the time the chart is rendered or updated.
2. THE Chart_Card SHALL set the y-axis `ticks.color` to the resolved computed value of `--lc-text-muted` for the active Theme at the time the chart is rendered or updated.
3. THE Chart_Card SHALL set both x-axis and y-axis `grid.color` to the resolved computed value of `--lc-border-subtle` for the active Theme at the time the chart is rendered or updated.
4. THE Chart_Card SHALL set `scales.y.min` to `min_temp − 0.1 × (max_temp − min_temp)`, where `min_temp` and `max_temp` are the minimum and maximum values in the current temperature data array.
5. THE Chart_Card SHALL set `scales.y.max` to `max_temp + 0.1 × (max_temp − min_temp)`.
6. IF all temperature values in the data array are equal (i.e. `max_temp − min_temp` equals 0), THEN THE Chart_Card SHALL set `scales.y.min` to `min_temp − 1` and `scales.y.max` to `max_temp + 1` as a fixed fallback.
7. THE Chart_Card SHALL display at most 6 x-axis tick labels by setting `scales.x.ticks.maxTicksLimit` to 6; IF the data set contains 6 or fewer points THEN all points' labels SHALL be shown; IF the data set contains more than 6 points THEN labels SHALL be sampled at equally spaced index positions (first, last, and up to 4 intermediate).

---

### Requirement 7: Weather Personality Elements

**User Story:** As a user, I want the chart to feel like a LumiCast visualisation rather than a generic chart, so that it reinforces the product's premium identity.

#### Acceptance Criteria

1. THE Chart_Card SHALL construct the gradient fill `CanvasGradient` using the resolved value of `--lc-accent` as the base colour; the gradient SHALL start at opacity 0.30 at the chart top and end at opacity 0.00 at the chart bottom.
2. IF the active weather condition maps to one of the tokens `--lc-rain-color`, `--lc-sun-color`, `--lc-snow-color`, or `--lc-storm-color` (i.e. the condition code passed via props matches the groups Rain, Clear/Sunny, Snow, or Thunderstorm respectively), THEN THE Chart_Card SHALL use that condition token value instead of `--lc-accent` as the gradient base colour.
3. THE Chart_Card SHALL overlay the Current_Temperature highlight point with a CSS `filter: drop-shadow()` effect using the resolved value of `--lc-accent` at opacity 0.45, with a blur radius of 6 px and zero x/y offset; IF `prefers-reduced-motion: reduce` is active, THE Chart_Card SHALL omit this glow effect entirely.
4. WHEN the chart animates on mount or on data replacement, THE Chart_Card SHALL configure Chart.js `animation.easing` to `'easeOutQuart'` (the closest named Chart.js easing to the cubic-bezier defined in `--lc-ease-out`).

---

### Requirement 8: Chart.js Visualisation Audit

**User Story:** As a developer maintaining LumiCast, I want all Chart.js visualisations to share consistent styling standards, so that the application has a unified visual language across all charts.

#### Acceptance Criteria

1. WHILE the application contains any Vue component file in `src/components/` that calls `ChartJS.register()` or imports from `vue-chartjs`, THAT component SHALL be included in the Phase 2.6 audit scope and have the remaining criteria of this requirement applied to it.
2. FOR EACH chart component in audit scope, THE component SHALL import and call `getChartTheme()` from `src/utils/chartTheme.js` to resolve all colour values, and SHALL contain no Hardcoded Style Literals for any colour property.
3. FOR EACH chart component in audit scope, THE component's Chart.js options object SHALL set `responsive: true` and `maintainAspectRatio: false`.
4. FOR EACH chart component in audit scope, THE component SHALL set `plugins.legend.display` to `false` in its Chart.js options object.
5. WHILE the viewport width is 320 px or greater, FOR EACH chart component in audit scope, THE component SHALL set axis `ticks.font.size` to a value of 11 px or greater so that tick labels remain legible.

---

### Requirement 9: Mobile Chart Optimisation

**User Story:** As a user on a mobile device, I want charts to render without clipping, oversized whitespace, or illegible labels, so that I can read weather data comfortably on small screens.

#### Acceptance Criteria

1. WHILE the viewport width is 320 px (Breakpoint_xs), THE Chart_Card SHALL render without horizontal scroll or overflow, and SHALL reduce x-axis label density (via `maxTicksLimit` or label rotation) if labels would otherwise overflow the chart bounds.
2. WHILE the viewport width is 320 px (Breakpoint_xs), THE Chart_Card SHALL maintain a minimum chart canvas height of 160 px.
3. WHILE the viewport width is between 360 px (Breakpoint_sm) and 430 px (Breakpoint_lg) inclusive, THE Chart_Card SHALL set x-axis and y-axis `ticks.font.size` to a minimum of 10 px.
4. WHILE the viewport width is 768 px (Breakpoint_tablet) or above, THE Chart_Card SHALL set the chart container's minimum height to 260 px.
5. IF the device reports at least one touch point via the browser Touch Events API, THEN for each interactive data point THE Chart_Card SHALL provide a hit area of at least 44 × 44 px centred on the point, implemented via Chart.js `pointHitRadius` set to at least 22 px.

---

### Requirement 10: Final Visual Consistency Audit

**User Story:** As a product stakeholder, I want the entire LumiCast application to feel like a single unified product after Phase 2.6, so that every visual element — cards, charts, icons, typography, spacing, animations, and theme switching — is cohesive.

#### Acceptance Criteria

1. THE application SHALL contain no Hardcoded Style Literals (as defined in the Glossary) in any `.vue` or `.js` source file within `src/`; all colour, spacing, radius, shadow, and duration values SHALL reference a `var(--lc-*)` custom property or be derived via `getChartTheme()`.
2. WHEN the Theme changes from dark to light or from light to dark, all audited elements (surfaces, text, borders, and chart colours) SHALL begin their transition within the same animation frame and SHALL reach their final resolved colour values within 350 ms, with no element displaying a resolved colour from the previous theme after the transition completes.
3. THE application SHALL produce zero `console.error` or `console.warn` outputs attributable to Phase 2.6 changes when loaded and operated (including a theme toggle) in both dark and light modes in a Chromium browser.
4. THE application SHALL complete `vite build` with exit code 0 and zero build errors after all Phase 2.6 changes are applied.
5. WHEN `vitest run` is executed against the Phase 2.6 codebase, THE test suite SHALL produce the same number of passing tests as the pre-Phase-2.6 baseline run, and SHALL introduce zero new test failures.
6. THE application SHALL maintain a WCAG AA contrast ratio of at least 4.5 : 1 for all body text and at least 3 : 1 for icon fills, chart lines, and badge backgrounds, in both Theme states after the audit.
