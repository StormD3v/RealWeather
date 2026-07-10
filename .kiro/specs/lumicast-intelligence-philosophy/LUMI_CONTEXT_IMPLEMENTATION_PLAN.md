# LumiCast Context Implementation Plan
## Phase 3.1 — Context Foundation: What Gets Built and How
### Phase 3 Foundation Document · v1.0

*Translates `LUMI_CONTEXT_ARCHITECTURE.md` into concrete implementation scope for Phase 3.1.*
*Read in conjunction with the full Phase 3 foundation document set.*

---

## 1. Phase 3.1 Implementation Scope

Phase 3.1 has one job: establish the context infrastructure that every subsequent Phase 3 feature depends on. No intelligence features are built here. No cards change their reasoning. The user experience improvement is real but subtle — profile-aware rendering in existing components and better notification gating — while the architectural improvement is foundational.

### What Phase 3.1 Delivers

**For users:**
- A profile setup flow where they can declare their location, departure time, activities, and sensitivities
- Notification preferences that are respected immediately (no more alerts for intelligence areas the user has turned off)
- Saved locations integrated into a unified profile rather than a standalone component
- A "Clear all my data" control that actually clears everything

**For the codebase:**
- A typed, reactive, schema-versioned context store as the single source of truth for user context
- A `useUserContext` composable that is the only interface to context for all future consumers
- JSDoc typedef definitions for every context structure (compatible with future TypeScript migration)
- A migration harness for safe schema evolution
- A signal store key established (empty, not written to) for Phase 3.4 compatibility
- Existing components (`SavedLocations.vue`, `UserProfileSelector.vue`, `useWeatherNotifications.js`) aligned to the new context architecture

### What Phase 3.1 Does Not Do

Phase 3.1 does not build the Decision Engine (`useInsightEngine`). It does not build intelligence modules. It does not change how any card derives its content. The morning briefing, activity recommendations, and risk alerts cards continue to work exactly as they do today — they simply gain the ability to read user preferences through `useUserContext` for display-level personalization (e.g., showing the user's declared unit, showing their declared activities in the activity card header).

Full intelligence transformation is Phase 3.2 and 3.3.


---

## 2. Project Structure Changes

### 2.1 New Folders

No new top-level folders are required. Phase 3.1 works within the existing `src/` structure. Three existing folders gain new files.

```
src/
├── composables/
│   └── useUserContext.js          ← NEW — context accessor composable
├── stores/
│   ├── weather.js                  (existing — unchanged)
│   └── context.js                  ← NEW — session context Pinia store
├── types/
│   └── context.js                  ← NEW — JSDoc typedef definitions
├── utils/
│   ├── contextStore.js             ← NEW — localStorage read/write/validate
│   ├── contextMigration.js         ← NEW — schema migration harness
│   ├── contextDefaults.js          ← NEW — default UserContext factory
│   └── activityProfiles.js         ← NEW — system-defined ActivitySensitivityProfiles
└── components/
    └── ui/
        ├── UserProfileSelector.vue  (existing — upgraded)
        ├── SavedLocations.vue       (existing — upgraded, reads from context store)
        └── profile/                 ← NEW FOLDER
            ├── ProfileSetupFlow.vue ← NEW — first-run onboarding steps
            ├── ProfileStep1Location.vue
            ├── ProfileStep2Routine.vue
            ├── ProfileStep3Activities.vue
            ├── ProfileStep4Sensitivities.vue
            └── ProfileStep5Preferences.vue
```

### 2.2 File Responsibilities Summary

| File | Responsibility | Phase |
|---|---|---|
| `src/types/context.js` | JSDoc typedef definitions for all context structures | 3.1 |
| `src/utils/contextDefaults.js` | Factory that returns a valid default `UserContext` | 3.1 |
| `src/utils/contextStore.js` | Read/write/validate context to/from `lumi.context.v1` | 3.1 |
| `src/utils/contextMigration.js` | Schema version check and migration runner | 3.1 |
| `src/utils/activityProfiles.js` | System-defined thresholds per `ActivityKey` | 3.1 |
| `src/stores/context.js` | Pinia store for session-only context (GPS, timestamp, copilot) | 3.1 |
| `src/composables/useUserContext.js` | Reactive accessor merging persistent + session context | 3.1 |
| `src/components/ui/profile/ProfileSetupFlow.vue` | Multi-step onboarding shell | 3.1 |
| `src/components/ui/profile/ProfileStep*.vue` | Individual onboarding steps | 3.1 |
| `src/components/ui/UserProfileSelector.vue` | Full profile management surface (upgraded) | 3.1 |
| `src/components/ui/SavedLocations.vue` | Reads/writes saved locations via `useUserContext` (upgraded) | 3.1 |

### 2.3 Files That Do Not Change

The following existing files are explicitly out of scope for Phase 3.1 and must not be modified beyond the integration points defined in Section 5:

- `src/stores/weather.js` — reads only; no modifications
- `src/services/weatherApi.js`, `weatherNormalizer.js`, `weatherInsights.js`, `weatherIntelligence.js` — no changes
- All card components in `src/components/cards/` — no logic changes; display-only preference reads added where applicable
- `src/components/layout/WeatherDashboard.vue` — minor: passes `useUserContext` to child components where needed
- `src/composables/useWeatherFormatters.js`, `useWeatherIcons.js` — no changes
- `src/router/index.js` — no changes; no new routes needed


---

## 3. Context Data Implementation

This section maps the architecture's data model to concrete implementation decisions for Phase 3.1.

### 3.1 Type Definitions — `src/types/context.js`

All typedef definitions live in one file. This is the canonical source of truth for context structure. Any file that works with context imports from here.

The file defines JSDoc typedefs only — no runtime code. This makes it zero-cost to import and compatible with the existing JavaScript codebase while enabling IDE type checking and being ready for a future TypeScript migration without changes.

Types to define:
- `UserContext` (root object)
- `LocationContext`, `SavedLocation`, `CurrentLocation`
- `RoutineContext`, `TimeWindow`
- `ActivityContext`, `DeclaredActivity`, `ActivitySensitivityProfile`, `ThresholdSet`
- `ScheduleContext`, `ManualEvent`
- `PreferenceContext`
- `SensitivityContext`
- `ContextMeta`
- `SignalStore`, `BehavioralSignal` (schema established, not yet populated)
- `ActivityKey` (string union type)
- `WeatherVariable` (string union type)
- `ContextQuality` (string union: `'full' | 'partial' | 'minimal' | 'none'`)

### 3.2 Default Context Factory — `src/utils/contextDefaults.js`

A single exported function `createDefaultContext()` that returns a valid `UserContext` object with all fields at their defined defaults.

Defaults by field:
- All location fields: `null`
- All routine fields: `null` / empty arrays
- `activities.declared`: `[]`
- `schedule.manualEvents`: `[]`, `calendarConnected: false`
- `preferences.temperatureUnit`: `'C'`
- `preferences.theme`: reads current `useTheme` resolved value at call time
- `preferences.verbosity`: `'concise'`
- All `preferences.notifications.*`: `false` (user must opt in)
- `preferences.intelligenceAreas.dailyPlanning`: `true`
- `preferences.intelligenceAreas.activityRecommend`: `false` (enabled when activities declared)
- `preferences.intelligenceAreas.commuteIntelligence`: `false` (enabled when departure time declared)
- `preferences.intelligenceAreas.routineAdaptation`: `true`
- `preferences.intelligenceAreas.environmentalAware`: `false`
- All `sensitivities.*`: `false`
- `meta.schemaVersion`: `'1.0.0'`
- `meta.createdAt`: `Date.now()` at call time
- `meta.lastModifiedAt`: `Date.now()` at call time
- `meta.completeness.*`: all `false`
- `meta.contextQuality`: `'none'`

The default factory is used in two places: when no context exists in localStorage (first-run), and as the fallback base when schema migration fails.

### 3.3 Context Store Utilities — `src/utils/contextStore.js`

Four exported functions:

**`readContext()`**
Reads `lumi.context.v1` from localStorage. Runs schema version check — if version mismatch, calls migration runner. Runs validation on returned object. Runs past-event pruning on `schedule.manualEvents`. Returns a valid `UserContext`. If storage is empty or corrupted, returns `createDefaultContext()`.

**`writeContext(partialContext)`**
Merges `partialContext` into the current stored context. Validates the merged result. If valid, writes the full merged object atomically to `lumi.context.v1`. Updates `meta.lastModifiedAt`. Updates `meta.completeness` fields. Recomputes `meta.contextQuality`. Returns the written context object.

**`validateContext(context)`**
Applies all validation rules from Architecture Section 5.3. Returns `{ valid: boolean, context: UserContext }` — invalid fields are reset to defaults, the rest is preserved. Never throws.

**`clearContext()`**
Removes both `lumi.context.v1` and `lumi.signals.v1` from localStorage. Returns `createDefaultContext()`.

These utilities are the only code that touches localStorage directly. No other file calls `localStorage.getItem` or `localStorage.setItem` for context data.

### 3.4 Activity Profiles — `src/utils/activityProfiles.js`

A lookup map from `ActivityKey` to `ActivitySensitivityProfile`. This encodes the system's environmental knowledge about each activity type.

Each profile defines:
- `primaryVariables`: which weather variables this activity is most sensitive to
- `thresholds.good`: the condition ranges where the activity is fully recommended
- `thresholds.marginal`: the ranges where it is possible but suboptimal
- `thresholds.notRecommended`: the ranges where it should be avoided

Example entries (values are illustrative — final values require domain review):

```
running: {
  primaryVariables: ['feelsLike', 'humidity', 'precipitation', 'windSpeed'],
  thresholds: {
    good: { feelsLike: { min: 10, max: 24 }, humidity: { max: 65 }, precipitation: { max: 0.1 } },
    marginal: { feelsLike: { min: 5, max: 30 }, humidity: { max: 80 } },
    notRecommended: { feelsLike: { min: 35 }, precipitation: { min: 2 } }
  }
}

cycling: {
  primaryVariables: ['windSpeed', 'gustSpeed', 'precipitation', 'feelsLike'],
  thresholds: {
    good: { windSpeed: { max: 25 }, gustSpeed: { max: 35 }, precipitation: { max: 0.2 } },
    marginal: { windSpeed: { max: 40 }, precipitation: { max: 3 } },
    notRecommended: { windSpeed: { min: 50 }, gustSpeed: { min: 60 } }
  }
}
```

All ten `ActivityKey` values must have a defined profile. This file is the authoritative source — activity threshold decisions are never scattered across card components or services.

### 3.5 Migration Harness — `src/utils/contextMigration.js`

Two exported functions:

**`needsMigration(storedContext)`**
Returns `true` if `storedContext.meta.schemaVersion` does not match the current application schema version constant (`'1.0.0'` in Phase 3.1).

**`migrateContext(storedContext)`**
Runs the stored context through an ordered array of migration functions. Each migration function transforms a context from version N to version N+1. In Phase 3.1, the array is empty (no migrations exist yet — the initial schema version IS `1.0.0`). The harness exists so future schema additions (Phase 3.4, 3.5) have a clean path.

Migration functions are additive only: they add missing fields with defaults, they never remove fields. If any migration function throws, `migrateContext` returns `createDefaultContext()` and logs a warning.

### 3.6 User Preferences Implementation Notes

**Temperature unit:** `preferences.temperatureUnit` is consumed immediately by all display components. The existing `useWeatherFormatters.js` composable already handles `'C'`/`'F'` — it needs to read the value from `useUserContext` rather than from its current source (to be determined during Phase 3.1 integration).

**Theme:** `preferences.theme` is stored in context but the active theme is managed by the existing `useTheme.js` composable. The integration: at context write time, if `preferences.theme` is set, call `useTheme`'s setter to synchronize. At context read time, if `preferences.theme` differs from the current resolved theme, the theme is updated. The theme preference migrates into the context store — the existing separate `localStorage` key for theme is deprecated after Phase 3.1.

**Notifications:** `preferences.notifications.*` flags gate `useWeatherNotifications.js`. The integration is described in Section 5.


---

## 4. Vue Architecture

### 4.1 Pinia Stores

Phase 3.1 introduces one new Pinia store and leaves the existing weather store unchanged.

**`src/stores/context.js` — Session Context Store (NEW)**

Manages the in-memory, non-persisted portion of context: live GPS position, current timestamp, and session-scoped UI state. This store is intentionally minimal — it holds only what cannot be persisted.

```
State:
  gpsPosition: { lat, lon, permissionState } | null
  currentTimestamp: number          — updated on app focus, every 5 minutes
  currentDayOfWeek: 0..6            — derived from timestamp
  copilotHistory: Array             — session-only, always empty on start
  isAtPrimary: boolean | null       — computed from gpsPosition vs primary location

Actions:
  updateGpsPosition(lat, lon)       — called by useGeolocationSearch on GPS update
  refreshTimestamp()                — called on app focus and on interval
  clearSession()                    — called on full context reset
```

The session store is never persisted. It does not use Pinia's `persist` plugin. `clearSession()` simply resets state to initial values.

**`src/stores/weather.js` — Weather Store (EXISTING, UNCHANGED)**

No modifications. Phase 3.1 reads from the weather store but does not write to it. The normalized weather data shape it exposes is already suitable for future intelligence module consumption in Phase 3.2.

One audit item: verify that `useWeatherStore.fetchWeatherByParams` does not include any user profile data in its API requests. Based on the existing code, it does not — requests use only coordinates or city name. This is the correct behavior and must not change.

### 4.2 Composable Responsibilities

**`src/composables/useUserContext.js` — Context Accessor (NEW)**

This is the most important new file in Phase 3.1. It is the single interface to context for everything in the application.

Responsibilities:
- Calls `readContext()` from `contextStore.js` on initialization (once per app session)
- Holds the persistent context as a reactive ref (`persistentContext`)
- Watches `persistentContext` and writes changes back to `contextStore.js` via `writeContext()`
- Reads from `src/stores/context.js` to get session fields (GPS, timestamp)
- Merges persistent + session into a unified `UserContext` computed ref
- Recomputes `meta.contextQuality` reactively when fields change
- Exposes:
  - `userContext` — readonly computed `UserContext`
  - `setContext(partial)` — merges a partial update into persistent context
  - `clearContext()` — clears all context, resets to defaults
  - `contextQuality` — shorthand computed for `userContext.meta.contextQuality`
  - `hasContext` — `true` if `contextQuality` is not `'none'`

Composable is called with `useUserContext()` (no arguments). It uses a shared singleton pattern — all calls to `useUserContext()` return the same reactive state. This means context changes in the profile UI are immediately visible to any card that reads `userContext`.

**`src/composables/useGeolocationSearch.js` — Upgraded**

Currently handles geolocation searches. In Phase 3.1, when a GPS position is obtained, it calls `useContextStore().updateGpsPosition(lat, lon)` to update the session context. This is a small addition to the existing composable's success handler — not a rewrite.

**`src/composables/useWeatherNotifications.js` — Upgraded**

Currently sends notifications as raw strings without preference gating. In Phase 3.1, the composable is updated to:
1. Import `useUserContext`
2. Check `userContext.preferences.notifications.enabled` before sending any notification
3. Check the specific flag (`morningBriefing`, `riskAlerts`, `activityAlerts`, `commute`) before sending each notification type
4. The typed `Insight` interface is NOT added in Phase 3.1 — that is Phase 3.3. Phase 3.1 only adds preference gating.

**`src/composables/useTheme.js` — Minor Upgrade**

Currently stores theme in its own localStorage key. In Phase 3.1:
- After `useUserContext` is initialized, `useTheme` checks if `userContext.preferences.theme` is set and synchronizes if it differs from the current resolved theme
- When the user changes theme via `useTheme`'s setter, the change is also written to `userContext.preferences.theme` via `setContext({ preferences: { theme: newValue } })`
- The old standalone theme localStorage key continues to work as a fallback for the duration of Phase 3.1, and is formally deprecated

**`src/composables/useWeatherFormatters.js` — Minor Upgrade**

Currently has a temperature unit setting. In Phase 3.1, the unit is sourced from `userContext.preferences.temperatureUnit` rather than from wherever it currently reads. The composable's public API does not change — only its internal unit source changes.

### 4.3 Data Flow

```
App mount
  ↓
useUserContext() initializes:
  ├── readContext() from localStorage (or returns default)
  ├── runs migration if needed
  └── returns reactive UserContext ref
  ↓
Session store initializes:
  ├── refreshTimestamp() — sets currentTimestamp + currentDayOfWeek
  └── updateGpsPosition() — if GPS permission already granted
  ↓
useUserContext merges persistent + session → computed UserContext
  ↓
WeatherDashboard renders:
  ├── passes userContext to child cards (display-level only in Phase 3.1)
  └── calls weatherStore.fetchWeatherByParams(location.primary.lat, location.primary.lon)
      if location.primary is set — otherwise falls back to existing city search behavior
  ↓
Cards render using:
  ├── weatherStore data (unchanged)
  └── userContext preferences (unit display, activity labels) [Phase 3.1 display only]
```

The critical constraint: in Phase 3.1, no card derives its intelligence content from context. Cards use context only for display-level personalization (unit formatting, activity name display). Intelligence content derivation begins in Phase 3.2.


---

## 5. Integration Points

This section defines exactly how Phase 3.1 connects to existing LumiCast systems. Each integration point is named, the existing behavior is described, the change is described, and the risk is assessed.

### 5.1 Weather Store Integration

**Existing behavior:** `WeatherDashboard.vue` calls `weatherStore.fetchWeather(city)` or `weatherStore.fetchWeatherByCoords(lat, lon)` based on user search or geolocation. The city/coords come from the search bar or GPS, not from a stored profile.

**Phase 3.1 change:** When `userContext.location.primary` is set (non-null), `WeatherDashboard.vue` uses `location.primary.lat` and `location.primary.lon` as the default load target when no search has been performed in the current session. This gives users with a configured primary location an automatic load on app open without requiring a search.

**Implementation:** In `WeatherDashboard.vue`, on mount: if `weatherStore.currentWeather` is null AND `userContext.location.primary` is set, call `weatherStore.fetchWeatherByCoords(primary.lat, primary.lon)`. Existing search behavior takes precedence — a new search always overrides the profile location for the current session.

**Risk:** Low. The existing behavior is preserved — if no primary location is set, nothing changes. The new behavior only fires when the profile has a location and no weather has been loaded yet.

### 5.2 SavedLocations.vue Integration

**Existing behavior:** `SavedLocations.vue` manages its own localStorage key (`lumicast-saved-locations`). It stores city name strings for three fixed slots (home, school, work). It writes and reads independently of all other state.

**Phase 3.1 change:** `SavedLocations.vue` is upgraded to read and write saved locations through `useUserContext` rather than through its own localStorage operations.

- `loadSavedLocations()` is replaced by reading `userContext.location.saved`
- `saveSavedLocations()` is replaced by calling `setContext({ location: { saved: [...] } })`
- The visual behavior (three slots, icons, long-press-to-clear) is preserved unchanged
- The emitted `load-location` event is preserved unchanged

**Migration:** On first load after Phase 3.1, `contextStore.js` reads the old `lumicast-saved-locations` key and migrates its values into `location.saved` in the context store. The old key is then removed. This migration runs once.

**Risk:** Low with the migration. The user's saved locations are not lost. The component's external API (emitted events, visual behavior) does not change.

### 5.3 UserProfileSelector.vue Integration

**Existing behavior:** `UserProfileSelector.vue` shows a horizontal pill list of user type archetypes (Student, Office Worker, etc.). It stores a single string in `lumicast-user-profile` and emits `profile-changed`. The selected profile affects `generateActivityRecommendations()` in `weatherProductMetrics.js`.

**Phase 3.1 change:** This component is substantially upgraded. The archetype pill list is replaced with a full profile management surface. The component becomes the primary UI for viewing and editing all context categories.

The new `UserProfileSelector.vue`:
- Shows a summary of the user's declared context (location name, departure time, declared activities, sensitivity flags)
- Provides an "Edit profile" entry point that opens `ProfileSetupFlow.vue` for any step
- Contains the "Clear all my data" action
- Contains the "Signal data" placeholder section (empty in Phase 3.1)
- Emits no events — it writes directly to context via `setContext()`

**Legacy archetype behavior:** The existing archetype selection (student, athlete, etc.) is deprecated. `generateActivityRecommendations()` in `weatherProductMetrics.js` continues to function using its existing logic through Phase 3.1 — it is not connected to the new context system yet. That connection happens in Phase 3.2 when the activity intelligence module is built. The old `lumicast-user-profile` localStorage key continues to be read by `weatherProductMetrics.js` through Phase 3.1 to avoid a regression.

**Risk:** Medium. This is the most visible component change in Phase 3.1. The visual upgrade must match the LumiCast design system and all breakpoints. The fallback — if `userContext` has no declared context — must render a clean "Set up your profile" state, not an empty or broken component.

### 5.4 useWeatherNotifications.js Integration

**Existing behavior:** The composable sends notifications based on weather thresholds. There is no preference gating — any notification-worthy condition triggers a notification regardless of user settings.

**Phase 3.1 change:** Before dispatching any notification, the composable checks:
1. `userContext.preferences.notifications.enabled` — if `false`, no notification is sent
2. The appropriate type flag (`morningBriefing`, `riskAlerts`, `activityAlerts`, `commute`) — if `false`, that category of notification is suppressed

No other changes. The existing threshold logic, the `utils/notifications.js` utility, and the browser notification permission flow are unchanged.

**Risk:** Low. The change is a gate at the front of the notification dispatch path. If `useUserContext` is not yet initialized (race condition on first load), the default is `notifications.enabled: false` — which means no notification fires until context is ready. This is the correct safe default.

### 5.5 Intelligence Cards — Display-Level Integration

In Phase 3.1, cards do not change their intelligence content. They may read from `useUserContext` for two specific display-level uses:

**Temperature unit:** Any card displaying a temperature value should read `userContext.preferences.temperatureUnit` via `useWeatherFormatters.js` (which is upgraded to source its unit from context). No direct `useUserContext` calls in card components are needed for this — `useWeatherFormatters` abstracts it.

**Activity card header:** `ActivityRecommendationsCard.vue` may display the user's declared activity names in its header or section labels (e.g., "Conditions for Running" rather than "Running conditions"). This is a read of `userContext.activities.declared[].label` — display only, no reasoning.

**No other card changes are in scope for Phase 3.1.**

### 5.6 First-Run Detection

Phase 3.1 introduces a first-run experience. Detection logic:

- On app mount, `useUserContext` checks if `lumi.context.v1` exists in localStorage
- If it does not exist, `contextQuality` is `'none'`
- `WeatherDashboard.vue` reads `contextQuality` and renders a non-blocking profile setup prompt when `contextQuality === 'none'`
- The prompt is dismissible — users who dismiss it go directly to the weather dashboard
- The prompt re-appears on the next session if no context has been set (it is not a permanent dismiss)

The profile setup prompt does not block the weather dashboard from loading. The two render in parallel.


---

## 6. Migration Strategy

Phase 3.1 introduces new storage keys and changes how two existing components manage their data. The strategy ensures that no user loses data during the upgrade and that the application continues to function if any migration step fails.

### 6.1 Migration Principles

- All migrations are read-then-write: read the old format, transform, write the new format, delete the old key only after successful write
- All migrations are idempotent: running a migration twice produces the same result as running it once
- All migrations fail safe: if a migration fails, the application continues with default context (not broken state)
- No migration is run until it is needed: migrations trigger on first app load after an upgrade, not at install time

### 6.2 Saved Locations Migration

**Old format:** `lumicast-saved-locations` key in localStorage, JSON object `{ home: string|null, school: string|null, work: string|null }`.

**New format:** Part of `UserContext.location.saved` array in `lumi.context.v1`.

**Migration trigger:** Phase 3.1 ships. On first app load, `contextStore.js` checks for the existence of `lumicast-saved-locations`. If found, migration runs.

**Migration steps:**
1. Read `lumicast-saved-locations` value
2. Parse the JSON; if invalid, skip migration
3. For each non-null slot (home, school, work), create a `SavedLocation` entry with:
   - `id`: stable generated ID (e.g., `saved-home`, `saved-school`, `saved-work`)
   - `name`: the stored city name string
   - `lat`/`lon`: `null` (the old format stored city names, not coordinates)
   - `timezone`: `null`
   - `locationType`: `'urban'` (safe default)
4. Merge the resulting `SavedLocation` array into the new context store via `writeContext`
5. Remove `lumicast-saved-locations` from localStorage

**Limitation:** The old format stored city name strings only — no coordinates. Migrated saved locations have names but no lat/lon. They appear as named entries in the new profile UI, but cannot be used for automatic weather loading until the user re-selects them (which triggers a coord lookup). This is acceptable — the user's saved names are preserved; coordinates are restored on next use.

### 6.3 User Profile Archetype Migration

**Old format:** `lumicast-user-profile` key in localStorage, a single string value (e.g., `'athlete'`, `'student'`).

**New format:** Not directly migrated. The archetype system is deprecated in Phase 3.1. The mapping from archetype to context is lossy (an "athlete" archetype cannot be cleanly mapped to specific declared activities without user confirmation). A forced migration would violate the "never assume" principle.

**Migration steps:**
1. Read `lumicast-user-profile` value
2. If it maps to an activity-related archetype (`'athlete'`, `'delivery_rider'`), display a suggestion in the profile setup prompt: "It looks like you previously selected [archetype]. Would you like to add related activities to your profile?"
3. The user confirms or declines — no automatic write
4. The `lumicast-user-profile` key is retained through Phase 3.1 for `weatherProductMetrics.js` compatibility
5. The key is removed in Phase 3.2 when `weatherProductMetrics.js` is updated to use context

### 6.4 Theme Preference Migration

**Old format:** Theme stored by `useTheme.js` in its own key (implementation-dependent on current `useTheme` logic).

**New format:** `preferences.theme` in `UserContext`.

**Migration steps:**
1. On context store initialization, check if `preferences.theme` is not yet set in the stored context (null/undefined)
2. If so, read the current resolved theme from `useTheme` and write it to `preferences.theme`
3. From this point, theme changes are written to both `useTheme`'s key (for backwards compatibility through Phase 3.1) and to `preferences.theme`
4. In Phase 3.2, `useTheme`'s own storage key is removed and it reads exclusively from context

### 6.5 Schema Version Migration

**Initial schema version:** `'1.0.0'`

When Phase 3.4 ships, the schema version will increment to `'1.1.0'` and the migration harness will add `preDeparture: false` to `preferences.notifications` for any stored context with version `'1.0.0'`. This migration writes are already safe because the field exists in the Phase 3.1 schema with a default of `false` — the migration is a no-op for users who already have the field.

The same pattern applies for Phase 3.5 additions. Because Phase 3.1 pre-populates future fields with their defaults, most "migrations" will be no-ops in practice. The harness exists for the edge cases where they are not.

### 6.6 Rollback Safety

If Phase 3.1 is rolled back (a version is deployed that does not include the context system), the application gracefully degrades:
- `lumi.context.v1` in localStorage is ignored (no code reads it)
- The old `lumicast-saved-locations` key, if restored by the migration rollback, continues to work with the old `SavedLocations.vue`
- The old `lumicast-user-profile` key continues to work with the old `UserProfileSelector.vue`
- Weather functionality is unaffected

Rollback safety does not require a code change — it is a property of the non-destructive migration approach.


---

## 7. Testing Strategy

Testing for Phase 3.1 is concentrated in the utility layer — the pure functions that read, write, validate, and migrate context. These are the highest-value tests in the phase because they protect the integrity of the data layer that all future intelligence depends on.

### 7.1 Testing Philosophy

- Unit tests cover all utility functions and the `useUserContext` composable
- Integration tests cover the critical migration paths (saved locations, schema version)
- Component tests cover the profile setup flow — specifically, that context is written correctly after each step
- No property-based testing is introduced in Phase 3.1 (PBT is planned for Phase 3.2 intelligence modules)

Tests live alongside their implementation files in `__tests__` subdirectories, following the existing pattern established by `src/utils/__tests__/chartTheme.test.js`.

### 7.2 `src/utils/contextStore.js` — Core Tests

These are the most critical tests in Phase 3.1. Every function must be covered.

| Test | What it verifies |
|---|---|
| `readContext()` returns default when storage is empty | First-run state is correct |
| `readContext()` returns stored context when storage is populated | Persistence works |
| `readContext()` returns default when stored JSON is malformed | Corruption is handled gracefully |
| `readContext()` runs migration when schema version mismatches | Migration trigger fires correctly |
| `readContext()` prunes past manual events | Past events are not retained |
| `writeContext()` writes full merged object atomically | No partial writes |
| `writeContext()` updates `meta.lastModifiedAt` on every write | Timestamp is maintained |
| `writeContext()` rejects a write with invalid lat (out of range) | Validation gates bad data |
| `writeContext()` preserves valid fields when one field is invalid | Partial invalidity is isolated |
| `writeContext()` updates `meta.contextQuality` after write | Quality computation is current |
| `validateContext()` resets invalid `departureTime` to null | HH:MM validation works |
| `validateContext()` resets invalid `activityKey` to null | Enum validation works |
| `clearContext()` removes both `lumi.context.v1` and `lumi.signals.v1` | Full clear is complete |
| `clearContext()` returns a valid default context | Post-clear state is usable |

### 7.3 `src/utils/contextDefaults.js` — Core Tests

| Test | What it verifies |
|---|---|
| `createDefaultContext()` returns an object with all required top-level keys | Schema completeness |
| `createDefaultContext()` returns `contextQuality: 'none'` | Default quality is correct |
| `createDefaultContext()` returns `notifications.enabled: false` | Default is opt-out |
| `createDefaultContext()` returns `sensitivities.*: false` for all flags | Default is no sensitivity |
| `createDefaultContext()` returns `schemaVersion: '1.0.0'` | Version is stamped correctly |
| Calling `createDefaultContext()` twice returns independent objects | No shared reference mutation |

### 7.4 `src/utils/contextMigration.js` — Migration Tests

| Test | What it verifies |
|---|---|
| `needsMigration()` returns `false` for current schema version | No false positives |
| `needsMigration()` returns `true` for a stored version < current | Migration triggers correctly |
| `migrateContext()` returns default context when migration fails | Failure is safe |
| Saved locations migration writes names to `location.saved` | Location data is preserved |
| Saved locations migration removes the old key after successful write | No stale key left behind |
| Running migration twice produces the same result | Idempotence |

### 7.5 `src/utils/activityProfiles.js` — Profile Tests

| Test | What it verifies |
|---|---|
| Every `ActivityKey` value has a defined profile | No missing profiles |
| Every profile has `primaryVariables`, `good`, `marginal`, `notRecommended` | Schema completeness |
| `good` thresholds do not overlap with `notRecommended` thresholds for any variable | Internal consistency |
| Profile lookup returns `undefined` for an unknown key (no throwing) | Graceful miss handling |

### 7.6 `src/composables/useUserContext.js` — Composable Tests

These tests use `@vue/test-utils` and a jsdom environment (same setup as the existing `WeatherTrendCharts.test.js`).

| Test | What it verifies |
|---|---|
| `userContext` is reactive — change propagates without reload | Reactivity contract |
| `contextQuality` is `'none'` when no context is stored | Empty state is correct |
| `contextQuality` is `'minimal'` when only location is set | Quality roll-up is correct |
| `contextQuality` is `'full'` when all categories are set | Quality roll-up is correct |
| `setContext()` with a partial update does not clear other fields | Merge behavior |
| `setContext()` with invalid data does not corrupt stored context | Validation gate at composable level |
| `clearContext()` resets `userContext` to default state reactively | Clear propagates to consumers |
| Session GPS position appears in `userContext.location.current` | Session merge works |
| GPS position is not present in `persistentContext` after session GPS update | Session isolation |
| Multiple calls to `useUserContext()` return the same reactive state | Singleton behavior |

### 7.7 Profile Setup Flow — Component Tests

These tests verify that the setup flow correctly writes context after each step.

| Test | What it verifies |
|---|---|
| Completing Step 1 (location) writes `location.primary` to context | Step writes correctly |
| Skipping Step 1 writes nothing to `location` | Skip is truly a skip |
| Completing Step 2 (departure time) writes `routines.weekday.departureTime` | Time input writes correctly |
| Completing Step 3 (activities) writes to `activities.declared` | Activity selection persists |
| Activity entries include the system-defined profile (not null) | Profile is attached on declare |
| Completing Step 4 (sensitivities) writes correct boolean flags | Sensitivity flags write correctly |
| Completing Step 5 (preferences) writes `notifications.*` flags | Preference writes correctly |
| Completing all steps produces `contextQuality: 'full'` | Full setup produces full quality |
| Completing only Step 1 produces `contextQuality: 'minimal'` | Partial setup is handled |
| The "Clear all my data" action triggers `clearContext()` | Reset flow works |

### 7.8 Notification Preference Gating — Integration Tests

| Test | What it verifies |
|---|---|
| Notification is not sent when `notifications.enabled: false` | Master gate works |
| Morning briefing notification not sent when `morningBriefing: false` | Type gate works |
| Risk alert notification is sent when `riskAlerts: true` and condition is met | Gate allows when enabled |
| Notification gate reads from `useUserContext` (not hardcoded) | Integration is correct |

### 7.9 What Is Not Tested in Phase 3.1

- Intelligence module outputs (Phase 3.2)
- Insight content correctness (Phase 3.2)
- Urgency threshold calibration (Phase 3.2)
- Activity profile threshold accuracy (subjective — validated through use, not tests)
- Profile UI visual appearance (manual testing against design system)
- Accessibility compliance (manual testing with screen reader and keyboard navigation)


---

## 8. MVP Boundary

### 8.1 Implement Now — Required Foundation

These items must be complete before Phase 3.2 can begin. They are the contractual deliverables of Phase 3.1.

**Infrastructure (no user-visible feature, but blocks everything downstream):**
- `src/types/context.js` — all typedef definitions
- `src/utils/contextDefaults.js` — default factory
- `src/utils/contextStore.js` — read/write/validate/clear
- `src/utils/contextMigration.js` — migration harness with saved locations migration
- `src/utils/activityProfiles.js` — all 10 activity profiles defined
- `src/stores/context.js` — session context Pinia store
- `src/composables/useUserContext.js` — reactive context accessor

**Profile UI (user-visible, enables profile configuration):**
- `ProfileSetupFlow.vue` and all five step components
- `UserProfileSelector.vue` upgrade — full profile management surface
- `SavedLocations.vue` upgrade — reads/writes via `useUserContext`

**Integrations (connects context to existing systems):**
- `useWeatherNotifications.js` — preference gating added
- `useWeatherFormatters.js` — unit sourced from context
- `useTheme.js` — theme preference synchronized to context
- `WeatherDashboard.vue` — auto-loads from primary location if set; first-run prompt

**Signal store establishment (zero user-visible effect, prevents future migration):**
- `lumi.signals.v1` key initialized with empty schema on first app load
- `BehavioralSignal` typedef defined in `context.js`

### 8.2 Delay — Advanced Features

These are explicitly out of scope for Phase 3.1. They are listed here to prevent scope creep — any PR that adds these features to Phase 3.1 is incorrectly scoped.

**Behavioral signal collection and processing (Phase 3.4):**
- App-open event logging
- Insight engagement tracking
- Signal weighting in insight coordinator
- Routine refinement suggestions based on signals
- Pre-departure notification timing from behavioral patterns

**Intelligence modules (Phase 3.2):**
- `useInsightEngine` coordinator
- `dailyPlanningModule`, `comfortModule`, `commuteModule`, `activityModule`, `routineModule`
- Urgency engine with sensitivity-adjusted thresholds
- Insight deduplication and ranking

**Card intelligence upgrades (Phase 3.3):**
- `MorningBriefingCard.vue` consuming insight objects
- `ActivityRecommendationsCard.vue` consuming activity module outputs
- `WeatherRiskAlertsCard.vue` with sensitivity-adjusted alert thresholds
- `BestTimeCard.vue` with activity-aware window calculation
- Notification delivery via typed `Insight` objects

**External data integrations (Phase 3.5):**
- Air quality index API adapter
- Pollen count data integration
- UV intelligence upgrade to action-connected insight

**Future capabilities (post-Phase 3):**
- Calendar integration (`calendarConnected` field exists in schema; implementation is future)
- Cloud sync and multi-device profile
- Multi-person household context
- Wearable/sensor integration
- Travel mode intelligent context
- Seasonal activity profiles (field exists in schema; UI is future)

### 8.3 The Complete Phase 3.1 Deliverable in One Statement

When Phase 3.1 is complete, a user can set up their profile in under 3 minutes, their notification preferences are respected immediately, their saved locations are part of their profile, the app auto-loads weather for their home location, and the entire context system is in place — ready to power the intelligence features that begin in Phase 3.2.

---

## 9. Implementation Sequence

Work should proceed in this order to minimize integration risk and ensure each piece is testable before the next depends on it.

```
Step 1: Types and defaults
  src/types/context.js
  src/utils/contextDefaults.js
  → Can be written and tested with no dependencies

Step 2: Storage utilities
  src/utils/contextStore.js
  src/utils/contextMigration.js
  → Depends on: types, defaults
  → Fully unit-testable with jsdom localStorage mock

Step 3: Activity profiles
  src/utils/activityProfiles.js
  → Depends on: types (WeatherVariable, ThresholdSet)
  → No runtime dependencies; fully testable in isolation

Step 4: Pinia session store
  src/stores/context.js
  → Depends on: nothing beyond Pinia
  → Tested with Pinia test utilities

Step 5: useUserContext composable
  src/composables/useUserContext.js
  → Depends on: contextStore.js, contextDefaults.js, stores/context.js
  → Fully unit-testable; can mock localStorage

Step 6: Profile setup flow
  src/components/ui/profile/*.vue
  → Depends on: useUserContext, existing UI components (BaseButton, BaseCard)
  → Component tests verify context writes

Step 7: UserProfileSelector upgrade
  src/components/ui/UserProfileSelector.vue
  → Depends on: useUserContext, profile setup flow
  → Component tests verify display and edit flows

Step 8: Existing component upgrades
  SavedLocations.vue, useWeatherNotifications.js,
  useWeatherFormatters.js, useTheme.js
  → Depends on: useUserContext
  → Integration tests verify correct behavior

Step 9: WeatherDashboard integration
  src/components/layout/WeatherDashboard.vue (minor changes)
  → Depends on: useUserContext, context quality check
  → Manual + integration test for auto-load and first-run prompt

Step 10: Signal store initialization
  Initialize lumi.signals.v1 on first app load
  → Depends on: contextStore.js
  → Verified by checking localStorage after first load
```

Each step is independently reviewable and deployable. Steps 1–5 can be merged as infrastructure without any user-visible change. Steps 6–9 introduce user-visible behavior and should be reviewed together for design consistency.

---

*LumiCast Context Implementation Plan v1.0 — Phase 3.1*
*This document is the engineering specification for Phase 3.1 — Context Foundation.*
*Read in conjunction with the full Phase 3 foundation document set.*
*Implementation must not begin before Phase 2.6 is complete.*
*Phase 3.2 must not begin before all items in Section 8.1 are complete and passing tests.*
