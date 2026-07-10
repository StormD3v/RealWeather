# Implementation Plan: Phase 3.4 Notification Activation

## Overview

Four surgical one-line or two-line fixes across four intelligence module files, plus a test suite validating the notification policy invariant. The notification infrastructure (`scheduleInsightAlerts`, `createInsight`, `useInsightEngine`) is already correct and is not touched.

## Tasks

- [x] 1. Fix dailyPlanningModule cold USEFUL bug
  - In `src/intelligence/modules/dailyPlanningModule.js`, locate the cold `URGENCY.USEFUL` branch (the `else` branch after the `coldUrgency === URGENCY.ALERT` check — the one that also handles `URGENCY.HEADS_UP` and falls through to USEFUL)
  - Change `notify: true` to `notify: false` on the `createInsight` call in that branch
  - Verify that the cold `URGENCY.ALERT` branch above it retains `notify: true` and the `URGENCY.HEADS_UP` branch retains `notify: true`
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x]* 1.1 Write unit tests for dailyPlanningModule cold notify values
    - Create `src/intelligence/modules/__tests__/dailyPlanningModule.notify.test.js`
    - Test: cold at USEFUL urgency produces `timing.notify === false` (regression fix verification)
    - Test: cold at HEADS_UP urgency produces `timing.notify === true`
    - Test: cold at ALERT urgency produces `timing.notify === true`
    - Test: thunderstorm path still produces `timing.notify === true` (regression guard)
    - Test: benign/ambient path still produces `timing.notify === false` (regression guard)
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2. Add notify flag to airQualityModule heads-up branch
  - In `src/intelligence/modules/airQualityModule.js`, locate the `URGENCY.HEADS_UP` branch's `createInsight` call
  - Add `notify: isSensitive` to that call (after `confidence: 'high'`)
  - The `URGENCY.ALERT` branch already has `notify: true` — do not change it
  - The `URGENCY.USEFUL` branch has no notify field (defaults to false) — do not change it
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x]* 2.1 Write unit tests for airQualityModule heads-up notify sensitivity gate
    - Create `src/intelligence/modules/__tests__/airQualityModule.notify.test.js`
    - Test: heads-up insight with `isSensitive = true` → `timing.notify === true`
    - Test: heads-up insight with `isSensitive = false` → `timing.notify === false`
    - Test: alert insight with `isSensitive = true` → `timing.notify === true`
    - Test: alert insight with `isSensitive = false` → `timing.notify === true`
    - Test: useful insight → `timing.notify === false`
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 3. Add notify flag to uvModule heads-up branch
  - In `src/intelligence/modules/uvModule.js`, locate the `URGENCY.HEADS_UP` branch's `createInsight` call
  - Add `notify: isSensitive` to that call (after `confidence: 'high'`)
  - The `URGENCY.ALERT` branch already has `notify: true` — do not change it
  - The `URGENCY.USEFUL` fallback `createInsight` has no notify field — do not change it
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x]* 3.1 Write unit tests for uvModule heads-up notify sensitivity gate
    - Create `src/intelligence/modules/__tests__/uvModule.notify.test.js`
    - Test: heads-up insight with `isSensitive = true` → `timing.notify === true`
    - Test: heads-up insight with `isSensitive = false` → `timing.notify === false`
    - Test: alert insight with `isSensitive = true` → `timing.notify === true`
    - Test: alert insight with `isSensitive = false` → `timing.notify === true`
    - Test: useful insight → `timing.notify === false`
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 4. Add notify flag to pollenModule heads-up branch
  - In `src/intelligence/modules/pollenModule.js`, locate the heads-up `createInsight` call (the final `return createInsight({...})` after the ALERT branch)
  - Add `notify: isSensitive` to that call (after `confidence: 'medium'`)
  - The `URGENCY.ALERT` branch already has `notify: true` — do not change it
  - _Requirements: 4.1, 4.2, 4.3_

  - [x]* 4.1 Write unit tests for pollenModule heads-up notify sensitivity gate
    - Create `src/intelligence/modules/__tests__/pollenModule.notify.test.js`
    - Test: heads-up insight with `isSensitive = true` → `timing.notify === true`
    - Test: heads-up insight with `isSensitive = false` → `timing.notify === false`
    - Test: alert insight (pollenLevel = 'very-high') with `isSensitive = true` → `timing.notify === true`
    - Test: alert insight (pollenLevel = 'very-high') with `isSensitive = false` → `timing.notify === true`
    - _Requirements: 4.1, 4.2, 4.3_

- [ ] 5. Checkpoint — Ensure all unit tests pass
  - Run the full test suite. Ensure all four new notify test files pass.
  - Ensure no regressions in existing module tests.
  - Ask the user if questions arise.

- [x] 6. Write cross-module property-based tests for the notify policy invariant
  - Create `src/intelligence/modules/__tests__/notifyPolicy.pbt.test.js`
  - Install `fast-check` if not already present (`npm install --save-dev fast-check`)
  - Import all eight module functions: `dailyPlanningModule`, `comfortModule`, `commuteModule`, `activityModule`, `routineModule`, `airQualityModule`, `uvModule`, `pollenModule`

  - [x]* 6.1 Write property-based test for Property 1: useful and ambient insights never notify
    - **Property 1: Useful and ambient insights never trigger notifications**
    - **Validates: Requirements 1.1, 5.1, 5.2**
    - Use `fc.record` generators to produce varied `weatherData` and `userContext` inputs
    - Run each of the eight modules against the generated inputs (100+ iterations)
    - For any non-null insight with urgency `useful` or `ambient`, assert `timing.notify === false`
    - Tag: `// Feature: phase-34-notification-activation, Property 1: useful/ambient insights never notify`

  - [ ]* 6.2 Write property-based test for Property 2: environmental heads-up follows isSensitive
    - **Property 2: Environmental heads-up notification follows isSensitive exactly**
    - **Validates: Requirements 2.1, 2.2, 3.1, 3.2, 4.1, 4.2**
    - Generate varied AQI, UV index, and pollen level values landing in the heads-up range
    - For each, generate `isSensitive` as both `true` and `false`
    - Run `airQualityModule`, `uvModule`, and `pollenModule` with those inputs
    - For any insight at `heads-up` urgency, assert `timing.notify === isSensitive`
    - Tag: `// Feature: phase-34-notification-activation, Property 2: environmental heads-up notify equals isSensitive`

  - [x]* 6.3 Write property-based test for Property 3: alert insights always notify
    - **Property 3: Alert insights always notify**
    - **Validates: Requirements 1.2, 1.3, 2.3, 3.3, 4.3, 5.3**
    - Generate weather data inputs that produce alert-tier insights across all modules
    - Run each module and collect non-null insights with urgency `alert`
    - Assert `timing.notify === true` for all of them
    - Tag: `// Feature: phase-34-notification-activation, Property 3: alert insights always notify`

- [x] 7. Final checkpoint — All tests pass
  - Run the full test suite including PBT tests.
  - Ensure all property-based tests pass with at least 100 iterations each.
  - Ask the user if questions arise.

## Task Dependency Graph

```json
{
  "waves": [
    { "wave": 1, "tasks": ["1", "2", "3", "4"] },
    { "wave": 2, "tasks": ["5"] },
    { "wave": 3, "tasks": ["6"] },
    { "wave": 4, "tasks": ["7"] }
  ]
}
```

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- The four code changes (Tasks 1–4) are each one or two lines — the implementation is intentionally minimal
- No changes to `comfortModule`, `commuteModule`, `activityModule`, `routineModule`, `useWeatherNotifications`, `insightValidator`, or `useInsightEngine`
- After Tasks 1–4 are complete, `scheduleInsightAlerts()` will dispatch real push notifications for the first time
- Property tests catch regressions if future module changes accidentally set `notify: true` on non-alertable tiers
