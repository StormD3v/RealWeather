# Requirements Document

## Introduction

LumiCast's intelligence engine (`useInsightEngine`) already produces insights via eight modules, and `scheduleInsightAlerts()` in `useWeatherNotifications.js` is fully wired to dispatch push notifications for any insight whose `timing.notify` flag is `true`. However, `notify` defaults to `false` in the `createInsight` factory, so no notification is ever dispatched today — `scheduleInsightAlerts` is a structural no-op.

Phase 3.4 activates end-to-end push-notification delivery by correcting the `notify` field in the four intelligence modules that require changes, based on a pre-audited notification policy across all eight modules. Five modules (`comfortModule`, `commuteModule`, `activityModule`, `routineModule`, `useWeatherNotifications`) are already correct and are not changed.

### Notification Policy Summary

| Urgency tier | Standard user notification | Sensitive user override |
|---|---|---|
| **Alert** | Always `notify: true` | Same — already alert-level |
| **Heads-up** | `notify: true` for planning/commute/routine/activity modules | `notify: isSensitive` for environmental modules (air quality, UV, pollen) |
| **Useful** | Always `notify: false` | No override — still `false` |
| **Ambient** | Always `notify: false` | No override — still `false` |

## Glossary

- **Insight**: A structured object produced by an intelligence module, containing `type`, `urgency`, `content`, `actionPath`, and `timing` (including `timing.notify`).
- **InsightSet**: The array of `Insight` objects returned by `useInsightEngine().insights.value` for the current session.
- **notify flag**: The boolean field `timing.notify` on an `Insight`. When `true`, `scheduleInsightAlerts()` dispatches a push notification for that insight.
- **isSensitive**: A boolean derived from `userContext.sensitivities[domain]` (e.g. `sensitivities.uv`, `sensitivities.airQuality`, `sensitivities.pollen`). Indicates the user has declared a personal sensitivity for that environmental domain.
- **Urgency tier**: One of `alert`, `heads-up`, `useful`, or `ambient`, as defined in `URGENCY` from `urgencyEngine.js`.
- **Environmental module**: A module that assesses airborne/environmental conditions — `airQualityModule`, `uvModule`, `pollenModule`. Subject to the sensitivity exception for `heads-up` tier.
- **scheduleInsightAlerts**: The function in `useWeatherNotifications.js` that iterates the InsightSet and dispatches push notifications for insights where `timing.notify === true`.
- **createInsight**: The factory function in `insightValidator.js` that constructs a well-formed `Insight` object. Accepts an optional `notify` parameter (defaults to `false`).

## Requirements

### Requirement 1: Fix dailyPlanningModule cold USEFUL bug

**User Story:** As a LumiCast user, I want to receive notifications only for actionable weather disruptions, so that I am not interrupted by display-only informational insights.

#### Acceptance Criteria

1. WHEN `dailyPlanningModule` produces a cold insight at `URGENCY.USEFUL`, THE Module SHALL set `timing.notify` to `false` on that insight.
2. WHEN `dailyPlanningModule` produces a cold insight at `URGENCY.ALERT`, THE Module SHALL set `timing.notify` to `true` on that insight.
3. WHEN `dailyPlanningModule` produces a cold insight at `URGENCY.HEADS_UP`, THE Module SHALL set `timing.notify` to `true` on that insight.
4. THE `dailyPlanningModule` SHALL NOT change `notify` values on any non-cold insight path (thunderstorm, rain, heat, wind, benign, far-rain).

### Requirement 2: Activate airQualityModule heads-up notification with sensitivity gate

**User Story:** As a LumiCast user with a declared air quality sensitivity, I want to receive a push notification when air quality is in the heads-up tier, so that I can plan my outdoor activity before conditions worsen.

#### Acceptance Criteria

1. WHEN `airQualityModule` produces a heads-up insight AND `isSensitive` is `true`, THE Module SHALL set `timing.notify` to `true` on that insight.
2. WHEN `airQualityModule` produces a heads-up insight AND `isSensitive` is `false`, THE Module SHALL set `timing.notify` to `false` on that insight.
3. WHEN `airQualityModule` produces an alert insight, THE Module SHALL set `timing.notify` to `true` on that insight regardless of `isSensitive`.
4. WHEN `airQualityModule` produces a useful insight, THE Module SHALL set `timing.notify` to `false` on that insight regardless of `isSensitive`.

### Requirement 3: Activate uvModule heads-up notification with sensitivity gate

**User Story:** As a LumiCast user with a declared UV sensitivity, I want to receive a push notification when UV is in the heads-up tier, so that I can apply sun protection before going outside.

#### Acceptance Criteria

1. WHEN `uvModule` produces a heads-up insight AND `isSensitive` is `true`, THE Module SHALL set `timing.notify` to `true` on that insight.
2. WHEN `uvModule` produces a heads-up insight AND `isSensitive` is `false`, THE Module SHALL set `timing.notify` to `false` on that insight.
3. WHEN `uvModule` produces an alert insight, THE Module SHALL set `timing.notify` to `true` on that insight regardless of `isSensitive`.
4. WHEN `uvModule` produces a useful insight, THE Module SHALL set `timing.notify` to `false` on that insight regardless of `isSensitive`.

### Requirement 4: Activate pollenModule heads-up notification with sensitivity gate

**User Story:** As a LumiCast user with a declared pollen sensitivity, I want to receive a push notification when pollen is in the heads-up tier, so that I can take antihistamines before going outdoors.

#### Acceptance Criteria

1. WHEN `pollenModule` produces a heads-up insight AND `isSensitive` is `true`, THE Module SHALL set `timing.notify` to `true` on that insight.
2. WHEN `pollenModule` produces a heads-up insight AND `isSensitive` is `false`, THE Module SHALL set `timing.notify` to `false` on that insight.
3. WHEN `pollenModule` produces an alert insight, THE Module SHALL set `timing.notify` to `true` on that insight regardless of `isSensitive`.

### Requirement 5: Enforce the notify policy invariant across all modules

**User Story:** As a developer, I want a verified guarantee that no useful or ambient insight ever triggers a push notification, so that users are never interrupted by display-only insights.

#### Acceptance Criteria

1. FOR ALL insights produced by any intelligence module at `URGENCY.USEFUL`, THE Insight SHALL have `timing.notify === false`.
2. FOR ALL insights produced by any intelligence module at `URGENCY.AMBIENT`, THE Insight SHALL have `timing.notify === false`.
3. FOR ALL insights produced at `URGENCY.ALERT` in planning, commute, routine, and activity modules, THE Insight SHALL have `timing.notify === true`.

### Requirement 6: No changes to unaffected modules or infrastructure

**User Story:** As a developer, I want the changes scoped to the four affected modules only, so that working code in other modules and wiring files is not accidentally disrupted.

#### Acceptance Criteria

1. THE `comfortModule` SHALL NOT be modified as part of this feature.
2. THE `commuteModule` SHALL NOT be modified as part of this feature.
3. THE `activityModule` SHALL NOT be modified as part of this feature.
4. THE `routineModule` SHALL NOT be modified as part of this feature.
5. THE `useWeatherNotifications` composable SHALL NOT be modified as part of this feature.
6. THE `insightValidator` factory SHALL NOT be modified as part of this feature.
7. THE `useInsightEngine` orchestrator SHALL NOT be modified as part of this feature.
