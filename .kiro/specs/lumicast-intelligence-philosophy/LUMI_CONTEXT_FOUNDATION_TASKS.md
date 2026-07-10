# LumiCast Context Foundation — Engineering Task List
## Phase 3.1 Implementation Tasks
### Derived from `LUMI_CONTEXT_IMPLEMENTATION_PLAN.md`

*This document converts the implementation plan into a concrete, ordered engineering task list.*
*Each task is independently reviewable and testable.*
*Tasks are ordered by dependency — later tasks depend on earlier tasks being complete.*
*Do not begin implementation until Phase 2.6 is complete and all visual polish tasks pass.*

---

## Constraints (Enforced Across All Tasks)

These constraints apply to every task in this list. Any implementation that violates them is out of scope.

- Do not build AI behavior, inference, or reasoning
- Do not add chatbot functionality or conversational UI
- Do not replace or modify `src/stores/weather.js`
- Do not remove `lumicast-user-profile` or `lumicast-saved-locations` localStorage keys (migration handles this)
- Do not change how any card component derives its intelligence content
- Do not add behavioral signal collection (Phase 3.4)
- Do not connect activity profiles to intelligence modules (Phase 3.2)
- Every change must be backwards-compatible: the app must work identically for users who skip profile setup

---

## Phase 0 — Preparation

*Establishes the structural foundation before any runtime code is written. No user-visible changes. No dependencies on other Phase 3.1 tasks.*

---

### Task 0.1 — Create project folder structure

**Purpose:** Create the `src/components/ui/profile/` directory and verify `src/types/` exists and is empty-ready. Establishes the file layout before any files are written to it.

**Files affected:**
- `src/components/ui/profile/` — new folder (create empty `.gitkeep` or first component file)
- `src/types/` — already exists; verify it is empty and ready

**Dependencies:** None

**Acceptance criteria:**
- `src/components/ui/profile/` directory exists
- `src/types/` directory is confirmed accessible
- No existing files are modified

**Testing requirements:** None — structural task only

---

### Task 0.2 — Define all JSDoc typedefs in `src/types/context.js`

**Purpose:** Create the single source of truth for all context data structures. Every file that works with context will import types from here. This is zero runtime cost — JSDoc only.

**Files affected:**
- `src/types/context.js` — NEW

**Types to define (all as `@typedef`):**
- `UserContext` — root object with six category fields + meta
- `LocationContext` — primary, saved array, current (session-only marker)
- `SavedLocation` — id, name, lat, lon, timezone, locationType
- `CurrentLocation` — lat, lon, isAtPrimary, permissionState
- `RoutineContext` — weekday/weekend with departure, return, outdoor windows
- `TimeWindow` — startTime, endTime, label, daysOfWeek
- `ActivityContext` — declared array
- `DeclaredActivity` — id, activityKey, label, frequency, seasonRange, profile
- `ActivitySensitivityProfile` — primaryVariables, thresholds (good/marginal/notRecommended)
- `ThresholdSet` — map of WeatherVariable to {min?, max?}
- `ScheduleContext` — manualEvents, calendarConnected
- `ManualEvent` — id, label, date, timeStart, timeEnd, isOutdoor, locationId
- `PreferenceContext` — temperatureUnit, theme, verbosity, notifications, intelligenceAreas
- `SensitivityContext` — heat, cold, pollen, uv, airQuality, precipitation (all boolean)
- `ContextMeta` — schemaVersion, createdAt, lastModifiedAt, completeness, contextQuality
- `SignalStore` — schemaVersion, signals array (established now, populated Phase 3.4)
- `BehavioralSignal` — type enum, timestamp, metadata
- `ActivityKey` — string union of all 10 activity identifiers
- `WeatherVariable` — string union of all weather variables
- `ContextQuality` — `'full' | 'partial' | 'minimal' | 'none'`
- `UrgencyLevel` — `'ambient' | 'useful' | 'heads-up' | 'alert'` (used by Phase 3.2; defined now)

**Dependencies:** Task 0.1

**Acceptance criteria:**
- File exports no runtime values — only JSDoc `@typedef` annotations
- Every field in every type has a `@type` annotation
- All types used by other types are defined in the same file
- File can be imported into any other `.js` file with zero side effects
- IDE type checking resolves all types correctly (verify with a `/** @type {UserContext} */` annotation in a test file)

**Testing requirements:** No runtime tests. Verified by IDE type resolution and code review.

---

### Task 0.3 — Create `src/utils/contextDefaults.js`

**Purpose:** Provide the canonical factory for a valid default `UserContext`. Used as the base for first-run state and as the safe fallback when storage is corrupted or migration fails.

**Files affected:**
- `src/utils/contextDefaults.js` — NEW

**Exports:**
- `createDefaultContext()` — returns a fresh `UserContext` with all fields at defined defaults

**Default values (per implementation plan Section 3.2):**
- All location fields: `null`
- Routine fields: `null` / empty arrays
- `activities.declared`: `[]`
- `schedule`: `{ manualEvents: [], calendarConnected: false }`
- `preferences.temperatureUnit`: `'C'`
- `preferences.theme`: `'dark'` (default; synchronized to `useTheme` at composable layer)
- `preferences.verbosity`: `'concise'`
- All `preferences.notifications.*`: `false`
- `preferences.intelligenceAreas.dailyPlanning`: `true`
- `preferences.intelligenceAreas.activityRecommend`: `false`
- `preferences.intelligenceAreas.commuteIntelligence`: `false`
- `preferences.intelligenceAreas.routineAdaptation`: `true`
- `preferences.intelligenceAreas.environmentalAware`: `false`
- `preferences.intelligenceAreas.preDeparture`: `false`
- `preferences.intelligenceAreas.ambient`: `false`
- All `sensitivities.*`: `false`
- `meta.schemaVersion`: `'1.0.0'`
- `meta.createdAt`: `Date.now()`
- `meta.lastModifiedAt`: `Date.now()`
- `meta.completeness.*`: all `false`
- `meta.contextQuality`: `'none'`

**Dependencies:** Task 0.2 (types must exist for JSDoc annotations)

**Acceptance criteria:**
- `createDefaultContext()` returns an object matching the full `UserContext` shape
- Every call returns a new independent object (no shared references between calls)
- `meta.schemaVersion` is always `'1.0.0'`
- `meta.contextQuality` is always `'none'` on a fresh default
- All notification flags default to `false`

**Testing requirements:**
- `createDefaultContext()` returns all required top-level keys
- `contextQuality` is `'none'`
- `notifications.enabled` is `false`
- All sensitivity flags are `false`
- `schemaVersion` is `'1.0.0'`
- Two calls return independent objects (mutating one does not affect the other)


---

## Phase 1 — Context Core

*Builds the storage layer: validation, persistence, migration, and activity knowledge. All pure JavaScript — no Vue, no Pinia. Fully testable in isolation with a jsdom localStorage mock.*

---

### Task 1.1 — Create `src/utils/contextStore.js`

**Purpose:** Provide the only code path that reads from and writes to `lumi.context.v1` in localStorage. Every other file that needs context data goes through this module. Enforces atomicity, validation, and migration on every read/write.

**Files affected:**
- `src/utils/contextStore.js` — NEW

**Exports:**
- `readContext()` — reads `lumi.context.v1`, runs migration check, runs validation, prunes past events, returns `UserContext`
- `writeContext(partialContext)` — merges partial into stored, validates, writes atomically, returns written context
- `validateContext(context)` — validates all fields per rules, resets invalid fields to defaults, returns `{ valid, context }`
- `clearContext()` — removes `lumi.context.v1` and `lumi.signals.v1`, returns `createDefaultContext()`

**Validation rules (from Architecture Section 5.3):**

| Field | Rule |
|---|---|
| `location.primary.lat` | Number in range [-90, 90] |
| `location.primary.lon` | Number in range [-180, 180] |
| `location.primary.timezone` | Non-empty string |
| `routines.weekday.departureTime` | Matches `HH:MM` pattern or `null` |
| `routines.*.outdoorWindows[].startTime` | Matches `HH:MM` pattern |
| `routines.*.outdoorWindows[].endTime` | Matches `HH:MM` and is after startTime |
| `activities[].activityKey` | Must be in `ActivityKey` enum |
| `schedule.manualEvents[].date` | Valid ISO 8601 date string |
| `preferences.temperatureUnit` | `'C'` or `'F'` |
| `sensitivities.*` | Boolean |

**Past-event pruning:** `readContext()` removes any `ManualEvent` from `schedule.manualEvents` where the `date` field is before today's date (ISO date comparison).

**contextQuality computation:** `writeContext()` recomputes `meta.contextQuality` after every write:
- `'none'`: `location.primary` is null
- `'minimal'`: `location.primary` is set, no routine or activities
- `'partial'`: location + at least one of (routine.weekday.departureTime, activities.declared.length > 0)
- `'full'`: location + routine departure time + at least one activity + at least one sensitivity declared

**meta.completeness computation:** `writeContext()` updates all five completeness boolean fields after every write.

**Dependencies:** Task 0.2 (types), Task 0.3 (defaults)

**Acceptance criteria:**
- `readContext()` returns `createDefaultContext()` when `lumi.context.v1` is absent
- `readContext()` returns `createDefaultContext()` when stored JSON is malformed
- `readContext()` calls `migrateContext()` when schema version mismatches (integration with Task 1.2)
- `writeContext()` writes the full merged object in a single `setItem` call
- `writeContext()` never writes a partial object
- `validateContext()` resets an invalid `lat` value to `null` without clearing other fields
- `validateContext()` resets an invalid `activityKey` to `null` without clearing other fields
- `clearContext()` removes both `lumi.context.v1` and `lumi.signals.v1`
- No function in this module calls `localStorage` for any key other than `lumi.context.v1` and `lumi.signals.v1`

**Testing requirements:**
- `readContext()` returns default when storage is empty
- `readContext()` returns stored context when storage is populated
- `readContext()` returns default when stored JSON is malformed
- `readContext()` prunes past manual events
- `writeContext()` writes full merged object atomically (single `setItem` call verifiable by mock)
- `writeContext()` updates `meta.lastModifiedAt` on every write
- `writeContext()` rejects invalid `lat` without corrupting valid fields
- `writeContext()` rejects invalid `activityKey` without corrupting valid fields
- `writeContext()` updates `meta.contextQuality` correctly after write
- `validateContext()` resets invalid `departureTime` format to `null`
- `validateContext()` resets invalid `activityKey` to `null`
- `clearContext()` removes both storage keys
- `clearContext()` returns valid default context

---

### Task 1.2 — Create `src/utils/contextMigration.js`

**Purpose:** Provide a safe, versioned migration harness so that future schema changes can be applied to stored context without data loss. In Phase 3.1, the migrations array is empty (no migrations yet), but the harness and the saved locations migration are both implemented here.

**Files affected:**
- `src/utils/contextMigration.js` — NEW

**Exports:**
- `CURRENT_SCHEMA_VERSION` — exported constant `'1.0.0'`
- `needsMigration(storedContext)` — returns `true` if stored schema version differs from `CURRENT_SCHEMA_VERSION`
- `migrateContext(storedContext)` — runs migration pipeline, returns migrated context or `createDefaultContext()` on failure
- `migrateFromLegacySavedLocations()` — reads `lumicast-saved-locations`, migrates to `location.saved` format, removes old key

**Migration pipeline design:**
- An ordered array of `{ from: version, to: version, migrate: fn }` migration steps
- `migrateContext` iterates the array, applying each step in sequence until stored version matches current
- Each migration function is additive only: adds missing fields, never removes fields
- If any migration step throws, function returns `createDefaultContext()` and logs a warning
- After all steps, `meta.schemaVersion` is updated to `CURRENT_SCHEMA_VERSION`

**Saved locations migration logic:**
1. Check if `lumicast-saved-locations` exists in localStorage
2. If not, return immediately (migration not needed)
3. Parse JSON; if invalid, log and return
4. For each non-null slot (`home`, `school`, `work`), create a `SavedLocation` with `id: saved-${slot}`, `name: value`, `lat: null`, `lon: null`, `timezone: null`, `locationType: 'urban'`
5. Call `writeContext({ location: { saved: [...existing, ...migrated] } })`
6. Remove `lumicast-saved-locations` from localStorage

**Dependencies:** Task 0.2 (types), Task 0.3 (defaults), Task 1.1 (writeContext)

**Acceptance criteria:**
- `needsMigration()` returns `false` for a context with `schemaVersion: '1.0.0'`
- `needsMigration()` returns `true` for a context with any other version
- `migrateContext()` returns `createDefaultContext()` if a migration step throws
- `migrateFromLegacySavedLocations()` writes migrated entries to `location.saved`
- `migrateFromLegacySavedLocations()` removes `lumicast-saved-locations` after successful write
- `migrateFromLegacySavedLocations()` is idempotent (safe to call twice)
- `migrateFromLegacySavedLocations()` does not throw if `lumicast-saved-locations` is absent

**Testing requirements:**
- `needsMigration()` returns `false` for current version
- `needsMigration()` returns `true` for a version string < current
- `migrateContext()` returns default context when migration throws
- Saved locations migration writes city names to `location.saved`
- Saved locations migration removes old key after successful write
- Running migration twice produces the same result (idempotence)

---

### Task 1.3 — Create `src/utils/activityProfiles.js`

**Purpose:** Define system-level environmental thresholds for all ten declared activity types. This is the authoritative source of activity knowledge. No intelligence reasoning happens here — these are static data profiles used by Phase 3.2 modules. Defined now so that Phase 3.1 can attach profiles to declared activities at declaration time.

**Files affected:**
- `src/utils/activityProfiles.js` — NEW

**Exports:**
- `ACTIVITY_PROFILES` — a map from `ActivityKey` to `ActivitySensitivityProfile`
- `getActivityProfile(activityKey)` — returns the profile for a given key, or `undefined` for unknown keys (no throwing)
- `ALL_ACTIVITY_KEYS` — exported array of all valid `ActivityKey` values

**Activity keys to define profiles for:**
`'running'`, `'cycling'`, `'hiking'`, `'gardening'`, `'photography'`, `'golf'`, `'outdoor-dining'`, `'dog-walking'`, `'swimming'`, `'sailing'`

**Profile structure per activity (illustrative values — final thresholds require domain review before Phase 3.2 uses them):**

```
running:        primaryVars: feelsLike, humidity, precipitation, windSpeed
cycling:        primaryVars: windSpeed, gustSpeed, precipitation, feelsLike
hiking:         primaryVars: feelsLike, precipitation, windSpeed, visibility
gardening:      primaryVars: precipitation, feelsLike, uvIndex
photography:    primaryVars: visibility, precipitation, uvIndex
golf:           primaryVars: windSpeed, precipitation, feelsLike
outdoor-dining: primaryVars: feelsLike, windSpeed, precipitation
dog-walking:    primaryVars: feelsLike, precipitation, windSpeed
swimming:       primaryVars: feelsLike, uvIndex, windSpeed
sailing:        primaryVars: windSpeed, gustSpeed, visibility, precipitation
```

**Dependencies:** Task 0.2 (ActivityKey, WeatherVariable, ActivitySensitivityProfile types)

**Acceptance criteria:**
- Every value in `ALL_ACTIVITY_KEYS` has an entry in `ACTIVITY_PROFILES`
- Every profile has non-empty `primaryVariables` array
- Every profile has `thresholds.good`, `thresholds.marginal`, `thresholds.notRecommended`
- `good` threshold ranges and `notRecommended` threshold ranges do not overlap for the same variable
- `getActivityProfile('running')` returns the running profile
- `getActivityProfile('unknown-key')` returns `undefined` without throwing

**Testing requirements:**
- Every `ActivityKey` has a defined profile
- Every profile has required structure keys
- `good` and `notRecommended` thresholds are non-overlapping per variable (exhaustive check)
- `getActivityProfile` returns `undefined` for unknown key
- `getActivityProfile` does not throw for any input


---

## Phase 2 — Composable Layer

*Builds the reactive Vue layer on top of the storage utilities. Introduces the Pinia session store and the `useUserContext` composable. After Phase 2, the full context pipeline exists and is testable end-to-end.*

---

### Task 2.1 — Create `src/stores/context.js` (Session Context Pinia Store)

**Purpose:** Hold the in-memory, non-persisted portion of user context: live GPS position, current timestamp, and session state. This store is never written to localStorage. It provides the session layer that `useUserContext` merges into the full context object.

**Files affected:**
- `src/stores/context.js` — NEW

**Store state:**
- `gpsPosition: null` — `{ lat: number, lon: number, permissionState: 'granted' | 'denied' | 'not-requested' } | null`
- `currentTimestamp: Date.now()` — updated on app focus and on a 5-minute interval
- `currentDayOfWeek: new Date().getDay()` — derived from timestamp (0=Sunday, 6=Saturday)
- `copilotHistory: []` — WeatherCopilot session turns (always empty on start)
- `isAtPrimary: null` — `boolean | null` — computed when GPS position is available

**Store actions:**
- `updateGpsPosition(lat, lon)` — sets `gpsPosition`, computes `isAtPrimary` by comparing against primary location in the persistent context. `isAtPrimary` is `true` if distance is ≤ 2km.
- `refreshTimestamp()` — updates `currentTimestamp` and `currentDayOfWeek`
- `clearSession()` — resets all state to initial values

**Store getters:**
- `isWeekday` — `true` if `currentDayOfWeek` is 1–5
- `formattedDayOfWeek` — string name for current day

**Not persisted:** This store must not use any persistence plugin. State is transient by design.

**Distance computation:** `isAtPrimary` uses a haversine distance function. The primary location coordinates come from reading the persistent context store directly (one-time read, not a reactive subscription — avoids circular dependency with `useUserContext`).

**Dependencies:** Phase 1 tasks complete (types defined)

**Acceptance criteria:**
- Store initializes with `gpsPosition: null` and `isAtPrimary: null`
- `refreshTimestamp()` updates both `currentTimestamp` and `currentDayOfWeek`
- `updateGpsPosition()` sets `isAtPrimary: true` when coords are within 2km of primary location
- `updateGpsPosition()` sets `isAtPrimary: false` when coords are > 2km from primary location
- `updateGpsPosition()` sets `isAtPrimary: null` when no primary location is stored
- `clearSession()` resets all state — `gpsPosition` becomes `null`, `isAtPrimary` becomes `null`
- Store state is NOT present in localStorage after any action

**Testing requirements:**
- Store initializes correctly with all default values
- `updateGpsPosition()` with coords near primary sets `isAtPrimary: true`
- `updateGpsPosition()` with coords far from primary sets `isAtPrimary: false`
- `updateGpsPosition()` with no primary location sets `isAtPrimary: null`
- `clearSession()` resets all fields to initial state
- No localStorage write occurs on any action (verify with mock)

---

### Task 2.2 — Create `src/composables/useUserContext.js`

**Purpose:** The single interface to user context for all consumers in the application. Merges persistent context (from `contextStore.js`) with session context (from `stores/context.js`) into a unified reactive `UserContext`. This is the most critical file in Phase 3.1 — every future intelligence feature depends on this interface.

**Files affected:**
- `src/composables/useUserContext.js` — NEW

**Singleton pattern:** The composable creates its reactive state once at module level (outside the returned function body). Every call to `useUserContext()` returns the same reactive refs. This ensures that a context change in the profile UI is immediately visible to any card or composable that imports `useUserContext`.

**Exposed interface:**
- `userContext` — `readonly ComputedRef<UserContext>` — the merged persistent + session context
- `persistentContext` — `readonly Ref<UserContext>` — the stored (non-session) portion only
- `setContext(partial)` — merges partial into `persistentContext`, triggers `writeContext()`, triggers recompute
- `clearContext()` — calls `contextStore.clearContext()`, calls `contextStore.clearSession()`, resets `persistentContext` to default
- `contextQuality` — `ComputedRef<ContextQuality>` — shorthand for `userContext.meta.contextQuality`
- `hasContext` — `ComputedRef<boolean>` — `true` if `contextQuality !== 'none'`
- `isFirstRun` — `ComputedRef<boolean>` — `true` if `lumi.context.v1` did not exist on initialization

**Merge logic:** `userContext` is a computed ref that takes `persistentContext` and overlays session context fields:
- `location.current` ← `contextStore.gpsPosition` + `contextStore.isAtPrimary`
- `meta` fields recalculated fresh (timestamps, quality) — not taken from stored meta

**Initialization:** On first call (module load), reads context via `readContext()`. Also calls `migrateFromLegacySavedLocations()` to handle the saved locations migration.

**Watch:** Watches `persistentContext` for deep changes, debounced at 200ms, and calls `writeContext()` on each change.

**Dependencies:** Task 1.1 (contextStore), Task 1.2 (contextMigration), Task 0.3 (defaults), Task 2.1 (session store)

**Acceptance criteria:**
- `userContext` is reactive — changing `persistentContext` propagates within the same tick (after watcher flush)
- `contextQuality` returns `'none'` when no context is stored
- `contextQuality` returns `'minimal'` when only location is set
- `contextQuality` returns `'full'` when location + departure time + activity + sensitivity all set
- `setContext({ preferences: { temperatureUnit: 'F' } })` updates only `temperatureUnit`, leaves all other fields intact
- `setContext()` with an invalid lat value does not corrupt existing valid location data
- `clearContext()` resets `userContext` to default state reactively
- `userContext.location.current` reflects `contextStore.gpsPosition` without being written to localStorage
- Multiple calls to `useUserContext()` in different components return the same reactive state
- `isFirstRun` is `true` on a clean device, `false` after profile setup completes

**Testing requirements:**
- `userContext` is reactive — change propagates without reload
- `contextQuality` is `'none'` when no context stored
- `contextQuality` is `'minimal'` when only location set
- `contextQuality` is `'full'` when all categories set
- `setContext()` with partial update does not clear other fields
- `setContext()` with invalid data does not corrupt stored context
- `clearContext()` resets `userContext` to default state reactively
- Session GPS position appears in `userContext.location.current`
- GPS position is not present in `persistentContext` after session GPS update
- Multiple calls return the same reactive state (singleton behavior)

---

### Task 2.3 — Upgrade `src/composables/useGeolocationSearch.js`

**Purpose:** Connect GPS position updates to the session context store so that `useUserContext` can compute `isAtPrimary`. This is a minimal addition to the existing composable — not a rewrite.

**Files affected:**
- `src/composables/useGeolocationSearch.js` — MODIFIED (additive only)

**Change:** In the success callback of the geolocation API call, after obtaining `lat` and `lon`, call `useContextStore().updateGpsPosition(lat, lon)`.

**What does not change:**
- The existing composable's public API (all existing emits, returns, and arguments)
- The error handling flow
- The `useWeatherStore.fetchWeatherByCoords()` call
- Any existing behavior

**Dependencies:** Task 2.1 (session store must exist)

**Acceptance criteria:**
- After a successful geolocation fetch, `contextStore.gpsPosition` is updated
- Existing geolocation behavior (weather fetch, error handling) is unchanged
- If `useContextStore` is unavailable (store not initialized), the geolocation flow does not throw

**Testing requirements:**
- GPS position is updated in session store after successful geolocation
- Existing geolocation-triggered weather fetch still fires correctly
- A geolocation error does not update the session store

---

### Task 2.4 — Upgrade `src/composables/useWeatherFormatters.js`

**Purpose:** Source the temperature unit from user context rather than from its current source, so that all temperature displays automatically reflect the user's declared preference.

**Files affected:**
- `src/composables/useWeatherFormatters.js` — MODIFIED (additive only)

**Change:** Import `useUserContext` and read `userContext.preferences.temperatureUnit` when formatting temperatures. The composable's existing public API — `formatTemp()`, `toDisplayTemp()`, etc. — does not change. Only the source of the unit changes.

**Backwards compatibility:** If `userContext` is not yet initialized or `preferences.temperatureUnit` is null, fall back to the existing default unit (`'C'`).

**Dependencies:** Task 2.2 (`useUserContext` must exist)

**Acceptance criteria:**
- When `preferences.temperatureUnit` is `'F'`, `formatTemp()` returns Fahrenheit values
- When `preferences.temperatureUnit` is `'C'`, `formatTemp()` returns Celsius values
- When context is not initialized, `formatTemp()` returns Celsius (safe default)
- All existing callers of `useWeatherFormatters` work without modification

**Testing requirements:**
- `formatTemp()` returns Fahrenheit when `temperatureUnit: 'F'` is set in context
- `formatTemp()` returns Celsius when `temperatureUnit: 'C'`
- `formatTemp()` returns Celsius when context is unavailable (no throw)

---

### Task 2.5 — Upgrade `src/composables/useTheme.js`

**Purpose:** Synchronize the theme preference between `useTheme`'s existing storage and the new context store, so that theme preference is preserved when context is exported or the context store is used as the authoritative source in Phase 3.2.

**Files affected:**
- `src/composables/useTheme.js` — MODIFIED (additive only)

**Changes (two-way sync):**
1. On `useTheme` initialization: if `userContext.preferences.theme` is set and differs from the current resolved theme, apply the context theme value
2. When the user changes theme via `useTheme`'s setter: also call `setContext({ preferences: { theme: newValue } })`
3. The existing theme localStorage key continues to work as the primary store through Phase 3.1 — this is deprecation preparation only

**What does not change:**
- The existing theme toggle behavior
- The resolved theme value computation
- Any component that uses `useTheme`

**Dependencies:** Task 2.2 (`useUserContext`)

**Acceptance criteria:**
- Changing theme via `useTheme` setter also writes to `preferences.theme` in context
- A user with `preferences.theme: 'light'` in context sees the light theme on next app load
- If context has no theme set, `useTheme` falls back to its existing behavior

**Testing requirements:**
- Theme change via `useTheme` setter writes `preferences.theme` to context
- App loads with light theme when `preferences.theme: 'light'` is stored
- No regression in existing theme toggle behavior


---

## Phase 3 — UI Integration

*Builds the user-facing profile system. All tasks in this phase depend on Phase 2 being complete. These are the only tasks with visible UI changes.*

---

### Task 3.1 — Create `ProfileStep1Location.vue`

**Purpose:** Step 1 of the profile setup flow. Allows the user to declare their primary location using the existing city search infrastructure.

**Files affected:**
- `src/components/ui/profile/ProfileStep1Location.vue` — NEW

**Behavior:**
- Reuses `useCitySearch.js` for city lookup (same infrastructure as `SearchBar.vue`)
- When the user selects a city, calls `setContext({ location: { primary: { name, lat, lon, timezone, locationType: 'urban', confidence: 'declared' } } })`
- Shows current primary location if already set (edit flow, not just first-run)
- Step can be skipped — skip button calls the `skip` emit without writing context
- Emits: `complete` (location set), `skip` (user skipped this step)

**Design constraints:**
- Uses `BaseButton.vue`, `BaseCard.vue`, existing input styles
- No new design tokens
- Must render correctly at all LumiCast breakpoints (320px to 1024px+)
- WCAG AA: all interactive elements keyboard-navigable, aria labels present

**Dependencies:** Task 2.2 (`useUserContext`), existing `useCitySearch.js`

**Acceptance criteria:**
- Selecting a city and confirming writes `location.primary` to context
- Skipping does not write to context
- Existing primary location is shown when the step opens in edit mode
- Step is keyboard-navigable (tab order, enter to confirm)

**Testing requirements:**
- Completing step writes `location.primary` to context
- Skipping writes nothing to `location` in context

---

### Task 3.2 — Create `ProfileStep2Routine.vue`

**Purpose:** Step 2. Allows the user to declare their weekday departure time and up to three outdoor time windows.

**Files affected:**
- `src/components/ui/profile/ProfileStep2Routine.vue` — NEW

**Behavior:**
- Time picker for `routines.weekday.departureTime` (HH:MM, 24h format internally; display in user's locale)
- Optional time picker for `routines.weekday.returnTime`
- Up to 3 outdoor window slots: each has a label, start time, and end time
- On confirm: calls `setContext({ routines: { weekday: { departureTime, returnTime, outdoorWindows } } })`
- Emits: `complete`, `skip`

**Design constraints:** Same constraints as Task 3.1

**Dependencies:** Task 2.2

**Acceptance criteria:**
- Selecting a departure time and confirming writes `routines.weekday.departureTime` to context
- Invalid time input (e.g., `25:00`) is rejected with inline validation feedback
- End time before start time in an outdoor window shows an inline error
- Skipping does not write to routine context

**Testing requirements:**
- Valid departure time writes to `routines.weekday.departureTime`
- Skipping writes nothing to routines
- Invalid time format shows validation error and does not write

---

### Task 3.3 — Create `ProfileStep3Activities.vue`

**Purpose:** Step 3. Allows the user to select their declared activities from the system catalogue.

**Files affected:**
- `src/components/ui/profile/ProfileStep3Activities.vue` — NEW

**Behavior:**
- Displays all 10 `ActivityKey` values as selectable cards/pills with icon and label
- User selects one or more activities
- Each selected activity is given a frequency selector (`daily`, `several-weekly`, `occasional`)
- On confirm: for each selected activity, creates a `DeclaredActivity` object:
  - `id`: generated UUID or `activity-${activityKey}-${timestamp}`
  - `activityKey`: the selected key
  - `label`: a human label derived from the activity key
  - `frequency`: the selected frequency
  - `seasonRange`: `null` (seasonal range is a future feature)
  - `profile`: looked up from `getActivityProfile(activityKey)` (from `activityProfiles.js`)
- Calls `setContext({ activities: { declared: [...newActivities] } })`
- If activities already declared (edit mode), pre-selects them
- Emits: `complete`, `skip`

**Design constraints:** Same constraints as Task 3.1

**Dependencies:** Task 2.2, Task 1.3 (`activityProfiles.js`)

**Acceptance criteria:**
- Selecting `running` and confirming writes a `DeclaredActivity` with `activityKey: 'running'` and attached `ActivitySensitivityProfile`
- The attached profile is the system profile from `activityProfiles.js` — not null, not user-configured
- Frequency is written correctly for each activity
- Skipping writes nothing to activities
- Already-declared activities are pre-selected in edit mode

**Testing requirements:**
- Completing step writes `activities.declared` to context
- Each declared activity has a non-null `profile` from `activityProfiles.js`
- Skipping writes nothing

---

### Task 3.4 — Create `ProfileStep4Sensitivities.vue`

**Purpose:** Step 4. Allows the user to declare their environmental sensitivities.

**Files affected:**
- `src/components/ui/profile/ProfileStep4Sensitivities.vue` — NEW

**Behavior:**
- Six checkboxes/toggles, one per sensitivity: Heat, Cold, Pollen, UV, Air Quality, Precipitation
- Each has a plain-language description (e.g., "I'm more sensitive to heat than most people")
- No medical language, no diagnosis framing
- On confirm: calls `setContext({ sensitivities: { heat, cold, pollen, uv, airQuality, precipitation } })`
- All default to unchecked — this is an opt-in step
- Emits: `complete`, `skip`

**Design constraints:** Same constraints as Task 3.1

**Dependencies:** Task 2.2

**Acceptance criteria:**
- Checking "Heat" and confirming writes `sensitivities.heat: true` to context
- All unselected sensitivities write as `false`
- Skipping does not write to sensitivities
- All checkboxes are accessible (label associated with input, keyboard-toggleable)

**Testing requirements:**
- Selected sensitivities write correct boolean flags to context
- Unselected sensitivities write `false`
- Skipping writes nothing

---

### Task 3.5 — Create `ProfileStep5Preferences.vue`

**Purpose:** Step 5. Captures temperature unit and notification preferences.

**Files affected:**
- `src/components/ui/profile/ProfileStep5Preferences.vue` — NEW

**Behavior:**
- Temperature unit toggle: Celsius / Fahrenheit
- Master notifications toggle: enabled / disabled
- When master toggle is on, show per-category toggles:
  - Morning Briefing
  - Commute Alerts
  - Activity Alerts
  - Risk Alerts
- On confirm: calls `setContext({ preferences: { temperatureUnit, notifications: { enabled, morningBriefing, commute, activityAlerts, riskAlerts } } })`
- Pre-populates from existing context values in edit mode
- Emits: `complete`, `skip`

**Dependencies:** Task 2.2

**Acceptance criteria:**
- Selecting Fahrenheit and confirming writes `temperatureUnit: 'F'` to context
- Toggling master notifications off writes `notifications.enabled: false` to context
- Individual notification toggles are only accessible when master toggle is enabled
- Skipping does not write to preferences

**Testing requirements:**
- Temperature unit selection writes to context
- Notification flags write correctly when enabled
- Skipping writes nothing

---

### Task 3.6 — Create `ProfileSetupFlow.vue`

**Purpose:** Multi-step onboarding shell that orchestrates the five step components. Used both for first-run setup and for profile editing.

**Files affected:**
- `src/components/ui/profile/ProfileSetupFlow.vue` — NEW

**Behavior:**
- Step indicator showing current step and progress (1 of 5, 2 of 5, etc.)
- Renders the current step component
- Handles `complete` and `skip` emits from each step
- Advances to the next step on `complete` or `skip`
- On final step completion: emits `setup-complete`
- Back navigation: allows returning to a previous step
- Can be opened to any specific step (prop: `startStep?: number`) for the edit flow

**First-run vs. edit mode:** If `isFirstRun` is `true` (from `useUserContext`), flow shows all steps in order. If opened from profile edit, starts at the specified step.

**Design constraints:** Same constraints as Task 3.1. The shell uses `BaseCard.vue` as its outer container.

**Dependencies:** Tasks 3.1–3.5, Task 2.2

**Acceptance criteria:**
- Completing all steps emits `setup-complete`
- Skipping all steps emits `setup-complete` (user has seen the flow, even if nothing was set)
- Back navigation returns to the previous step without clearing what was written
- Opening at `startStep: 3` shows Step 3 first
- Progress indicator reflects the current step accurately

**Testing requirements:**
- Completing all steps emits `setup-complete`
- Skipping all steps emits `setup-complete`
- Completing Step 1 and skipping the rest results in `contextQuality: 'minimal'`
- Completing all steps results in `contextQuality: 'full'` if all required fields were set

---

### Task 3.7 — Upgrade `src/components/ui/UserProfileSelector.vue`

**Purpose:** Replace the archetype pill list with a full profile management surface. This is the most visible component change in Phase 3.1.

**Files affected:**
- `src/components/ui/UserProfileSelector.vue` — MODIFIED (full upgrade, not additive)

**New behavior:**
- Shows a compact summary of the user's declared context:
  - Location: primary location name, or "Not set"
  - Departure: departure time, or "Not set"
  - Activities: names of declared activities (up to 3 listed), or "None declared"
  - Sensitivities: count of declared sensitivities, or "None declared"
- "Edit profile" button — opens `ProfileSetupFlow.vue`
- "Set up profile" button — shown when `contextQuality === 'none'` — opens `ProfileSetupFlow.vue` at Step 1
- "Clear all my data" section — with a confirmation dialog before clearing
- "Signal data" placeholder section — empty in Phase 3.1 (just a section header with "No signal data recorded yet")

**Legacy archetype preservation:** The old `lumicast-user-profile` localStorage key is NOT read by this component. It continues to be read by `weatherProductMetrics.js` only. The component does not emit `profile-changed`.

**Design constraints:** Must use only existing LumiCast design tokens (`--lc-*`). Must render at all breakpoints. The "Clear all my data" confirmation dialog must use `BaseCard.vue` or equivalent — no browser `alert()`.

**Dependencies:** Tasks 3.6 (ProfileSetupFlow), Task 2.2

**Acceptance criteria:**
- User with no context sees "Set up profile" state cleanly (no empty or broken content)
- User with full context sees a readable summary of all declared items
- "Edit profile" opens the setup flow at Step 1
- "Clear all my data" shows a confirmation dialog before acting
- Confirming clear resets context and shows "Set up profile" state
- The component does not access `lumicast-user-profile` localStorage key
- The component does not emit `profile-changed`

**Testing requirements:**
- Component renders "Set up profile" state when `contextQuality === 'none'`
- Component renders summary when `contextQuality !== 'none'`
- "Clear all my data" calls `clearContext()` after confirmation

---

### Task 3.8 — Upgrade `src/components/ui/SavedLocations.vue`

**Purpose:** Replace the component's internal localStorage management with reads/writes through `useUserContext`, and run the one-time migration of the old `lumicast-saved-locations` key.

**Files affected:**
- `src/components/ui/SavedLocations.vue` — MODIFIED

**Changes:**
- Remove `loadSavedLocations()` and `saveSavedLocations()` internal functions
- Replace with reads from `userContext.location.saved`
- Replace saves with calls to `setContext({ location: { saved: [...] } })`
- The `lumicast-saved-locations` key is no longer read or written by this component
- The migration in `contextMigration.js` (Task 1.2) handles the one-time data transfer

**What does not change:**
- Visual behavior: three slots (home, school, work), icons, long-press-to-clear
- Emitted events: `load-location` is preserved
- The city-name-only limitation (migrated entries have names but no lat/lon)

**Dependencies:** Task 2.2, Task 1.2 (migration must run before this component's first render to avoid empty slots)

**Acceptance criteria:**
- Component reads saved locations from `userContext.location.saved`
- Saving a location calls `setContext()` (not `localStorage.setItem` directly)
- Clearing a location calls `setContext()` with the updated array
- The `load-location` emit fires with the city name as before
- The component does not read or write `lumicast-saved-locations` after Phase 3.1
- Users who had saved locations in the old format see them preserved after migration

**Testing requirements:**
- Saving a location updates `userContext.location.saved`
- Clearing a location removes it from `userContext.location.saved`
- `load-location` event fires with city name when a filled slot is clicked
- Component renders correctly when `location.saved` is empty

---

### Task 3.9 — Upgrade `src/composables/useWeatherNotifications.js`

**Purpose:** Gate all notification dispatch on the user's declared notification preferences from context.

**Files affected:**
- `src/composables/useWeatherNotifications.js` — MODIFIED (additive only)

**Changes:**
- Import `useUserContext`
- Before dispatching any notification, check `userContext.preferences.notifications.enabled`
- Before dispatching a specific notification type, check the appropriate type flag:
  - Morning briefing → `notifications.morningBriefing`
  - Risk alerts → `notifications.riskAlerts`
  - Activity alerts → `notifications.activityAlerts`
  - Commute → `notifications.commute`
- If `useUserContext` is not yet initialized, default to `notifications.enabled: false` (no notification fires)

**What does not change:**
- Existing threshold logic
- `utils/notifications.js` utility
- Browser permission flow
- The typed `Insight` interface is NOT added (Phase 3.3)

**Dependencies:** Task 2.2

**Acceptance criteria:**
- No notification fires when `notifications.enabled: false`
- Morning briefing notification does not fire when `morningBriefing: false`
- Risk alert fires when `riskAlerts: true` and the threshold condition is met
- No regression: notifications work correctly for existing users who have no context set (defaults to `enabled: false`, which is the safe state)

**Testing requirements:**
- Notification suppressed when `notifications.enabled: false`
- Morning briefing suppressed when `morningBriefing: false`
- Risk alert fires when `riskAlerts: true` and condition met
- No notification fires when context not yet initialized


---

## Phase 4 — Lumi Integration Preparation

*Exposes context safely to future intelligence modules without building any intelligence. Creates the input contracts that Phase 3.2 modules will consume. After Phase 4, the system is ready for intelligence development to begin.*

---

### Task 4.1 — Integrate `useUserContext` into `WeatherDashboard.vue`

**Purpose:** Connect the context system to the main dashboard so that (a) the app auto-loads weather for the user's primary location, and (b) the first-run profile setup prompt is shown for new users.

**Files affected:**
- `src/components/layout/WeatherDashboard.vue` — MODIFIED (additive only)

**Changes:**
- Import `useUserContext`
- On mount: if `weatherStore.currentWeather === null` AND `userContext.location.primary` is set, call `weatherStore.fetchWeatherByCoords(primary.lat, primary.lon)`
- Render a non-blocking profile setup prompt when `contextQuality === 'none'`:
  - Positioned as a dismissible banner or card above the main content
  - Contains a "Set up your profile" CTA that opens `ProfileSetupFlow.vue`
  - Dismissible — user can close it; it re-appears next session if context is still `'none'`
  - Does NOT block the weather dashboard from rendering
- Pass `userContext` to `UserProfileSelector.vue` (already in the layout — no routing change)

**What does not change:**
- Existing city search behavior
- Existing geolocation behavior
- Any card component rendering
- The weather store fetch logic

**Dependencies:** Tasks 3.6, 3.7, Task 2.2

**Acceptance criteria:**
- On app load with a configured primary location and no cached weather, weather loads automatically
- On app load without a configured primary location, the existing empty state / search prompt is unchanged
- `contextQuality === 'none'` shows the profile setup prompt as a non-blocking banner
- Dismissing the prompt hides it for the current session (re-appears on next session if still unconfigured)
- A new search overrides the auto-loaded location for the session

**Testing requirements:**
- Auto-load fires when `location.primary` is set and weather is null
- Auto-load does not fire when weather is already loaded
- Auto-load does not fire when `location.primary` is null
- Profile setup prompt renders when `contextQuality === 'none'`
- Profile setup prompt does not block weather dashboard rendering

---

### Task 4.2 — Initialize signal store schema

**Purpose:** Establish the `lumi.signals.v1` localStorage key with an empty but valid schema on first app load. This prevents Phase 3.4 from needing a migration — the key and structure already exist.

**Files affected:**
- `src/utils/contextStore.js` — MODIFIED (additive: add `initSignalStore()` function)

**Change:** Add an `initSignalStore()` function that:
1. Checks if `lumi.signals.v1` exists in localStorage
2. If not, writes `{ schemaVersion: '1.0.0', signals: [] }` to `lumi.signals.v1`
3. If it exists, reads and validates the structure; if invalid, rewrites the empty schema

Call `initSignalStore()` from `useUserContext.js` on initialization (once per session).

**Dependencies:** Task 1.1 (contextStore base), Task 2.2 (calls it on init)

**Acceptance criteria:**
- After first app load, `lumi.signals.v1` exists in localStorage with `{ schemaVersion: '1.0.0', signals: [] }`
- After subsequent loads, existing `lumi.signals.v1` is not overwritten
- If `lumi.signals.v1` is malformed, it is reset to the empty schema (not left corrupt)
- No signals are written — the array is always empty in Phase 3.1

**Testing requirements:**
- `lumi.signals.v1` exists after first `initSignalStore()` call
- `lumi.signals.v1` is not overwritten on second `initSignalStore()` call
- Malformed `lumi.signals.v1` is reset to empty schema

---

### Task 4.3 — Define the `WeatherData` normalized type in `src/types/context.js`

**Purpose:** Add the `WeatherData` typedef to the types file so that Phase 3.2 intelligence modules have a typed contract for their weather input. This is a documentation and type safety task — no runtime code.

**Files affected:**
- `src/types/context.js` — MODIFIED (additive: new typedef)

**Type to add:**

```
WeatherData {
  current: {
    temp:        number    — Celsius
    feelsLike:   number    — Celsius
    humidity:    number    — 0–100
    windSpeed:   number    — km/h
    gustSpeed:   number    — km/h
    uvIndex:     number    — 0–11+
    condition:   string    — normalized key from resolveWeatherIconKey()
    visibility:  number    — km
    precipProb:  number    — 0–1
  }
  hourly:    Array<HourlyPoint>
  daily:     Array<DailyPoint>
  fetchedAt: number
  location: { lat: number, lon: number }
}
```

Also add `HourlyPoint` and `DailyPoint` typedefs matching the existing `weatherNormalizer.js` output shape.

**Purpose of doing this in Phase 3.1:** Intelligence modules in Phase 3.2 will be typed against `WeatherData`. Defining the type now means Phase 3.2 can immediately use it without modifying Phase 3.1 files.

**Dependencies:** Task 0.2 (existing types file)

**Acceptance criteria:**
- `WeatherData` typedef is defined and exported
- `HourlyPoint` and `DailyPoint` typedefs match the shape produced by `weatherNormalizer.js`
- No runtime code is added

**Testing requirements:** IDE type resolution only — no runtime tests.

---

### Task 4.4 — Define the `Insight` type in `src/types/context.js`

**Purpose:** Add the `Insight` typedef — the output contract for all Phase 3.2 intelligence modules. Defining it in Phase 3.1 allows Phase 3.2 to build against a pre-existing contract and allows `useWeatherNotifications.js` upgrade in Phase 3.3 to have a clear target shape.

**Files affected:**
- `src/types/context.js` — MODIFIED (additive: new typedef)

**Type to add:**

```
Insight {
  id:           string
  type:         InsightType
  urgency:      UrgencyLevel
  timing: {
    windowStart:  number | null
    windowEnd:    number | null
    notify:       boolean
    notifyAt:     number | null
  }
  content:      string
  actionPath:   string          — MUST be non-empty (mandatory gate)
  confidence:   'high' | 'medium' | 'low'
  sourceContext: {
    usedLocation:    boolean
    usedRoutine:     boolean
    usedActivity:    boolean
    usedSensitivity: boolean
  }
}

InsightType: 'daily-planning' | 'comfort' | 'commute' | 'activity' |
             'routine-adapt' | 'risk-alert' | 'environmental' | 'ambient'
```

**Dependencies:** Task 0.2, Task 4.3

**Acceptance criteria:**
- `Insight` typedef is defined and exported
- `InsightType` string union is complete
- `actionPath` has a JSDoc comment noting it is mandatory (non-empty required)

**Testing requirements:** IDE type resolution only — no runtime tests.


---

## Phase 5 — Testing

*Validates all Phase 3.1 work. Tests are written alongside implementation (not after). Every utility function, every composable, and every migration must have tests passing before Phase 3.2 begins.*

---

### Task 5.1 — Write tests for `src/utils/contextStore.js`

**Purpose:** Validate the most critical utility in Phase 3.1 — the storage layer. These tests protect every future intelligence feature that depends on correct context persistence.

**Files affected:**
- `src/utils/__tests__/contextStore.test.js` — NEW

**Test environment:** Vitest + jsdom (existing test setup). Mock `localStorage` using `vi.stubGlobal` or jsdom's built-in localStorage.

**Test cases (from Implementation Plan Section 7.2):**

| Test | Assertion |
|---|---|
| `readContext()` returns default when storage empty | `contextQuality === 'none'` |
| `readContext()` returns stored context when populated | Returns stored values |
| `readContext()` returns default when JSON is malformed | No throw, returns default |
| `readContext()` triggers migration when version mismatches | `migrateContext()` is called |
| `readContext()` prunes past manual events | Past events not in returned context |
| `writeContext()` writes full merged object | Single `setItem` call with full object |
| `writeContext()` updates `meta.lastModifiedAt` | Timestamp changes on every write |
| `writeContext()` rejects invalid lat | `location.primary.lat` reset to null |
| `writeContext()` preserves valid fields with one invalid field | Other fields unchanged |
| `writeContext()` updates `meta.contextQuality` | Quality matches new state |
| `validateContext()` resets invalid `departureTime` | Field becomes null |
| `validateContext()` resets invalid `activityKey` | Field becomes null |
| `clearContext()` removes `lumi.context.v1` | Key absent after clear |
| `clearContext()` removes `lumi.signals.v1` | Key absent after clear |
| `clearContext()` returns valid default | Returned object passes validation |

**Dependencies:** Tasks 1.1 complete

**Acceptance criteria:** All 15 tests pass. Zero console errors during test run.

---

### Task 5.2 — Write tests for `src/utils/contextDefaults.js`

**Files affected:**
- `src/utils/__tests__/contextDefaults.test.js` — NEW

**Test cases (from Implementation Plan Section 7.3):**

| Test | Assertion |
|---|---|
| Returns all required top-level keys | All six categories + meta present |
| `contextQuality` is `'none'` | Default quality |
| `notifications.enabled` is `false` | Default opt-out |
| All sensitivity flags are `false` | Default no sensitivity |
| `schemaVersion` is `'1.0.0'` | Correct version stamped |
| Two calls return independent objects | Mutating one does not affect other |

**Dependencies:** Task 0.3 complete

**Acceptance criteria:** All 6 tests pass.

---

### Task 5.3 — Write tests for `src/utils/contextMigration.js`

**Files affected:**
- `src/utils/__tests__/contextMigration.test.js` — NEW

**Test cases (from Implementation Plan Section 7.4):**

| Test | Assertion |
|---|---|
| `needsMigration()` returns `false` for current version | No false positive |
| `needsMigration()` returns `true` for older version | Trigger fires |
| `migrateContext()` returns default when migration throws | Safe failure |
| Saved locations migration writes names to `location.saved` | Data preserved |
| Saved locations migration removes old key | No stale key |
| Running migration twice produces same result | Idempotence |

**Dependencies:** Tasks 1.1, 1.2 complete

**Acceptance criteria:** All 6 tests pass.

---

### Task 5.4 — Write tests for `src/utils/activityProfiles.js`

**Files affected:**
- `src/utils/__tests__/activityProfiles.test.js` — NEW

**Test cases (from Implementation Plan Section 7.5):**

| Test | Assertion |
|---|---|
| Every `ActivityKey` has a profile | No missing entries |
| Every profile has required structure | `primaryVariables`, `good`, `marginal`, `notRecommended` present |
| `good` and `notRecommended` thresholds do not overlap | Internal consistency |
| `getActivityProfile` returns `undefined` for unknown key | No throw on miss |

**Dependencies:** Task 1.3 complete

**Acceptance criteria:** All 4 tests pass.

---

### Task 5.5 — Write tests for `src/composables/useUserContext.js`

**Files affected:**
- `src/composables/__tests__/useUserContext.test.js` — NEW

**Test environment:** Vitest + `@vue/test-utils` + `@pinia/testing`. Mock localStorage for contextStore reads.

**Test cases (from Implementation Plan Section 7.6):**

| Test | Assertion |
|---|---|
| `userContext` is reactive | Change propagates without reload |
| `contextQuality` is `'none'` with empty storage | Empty state correct |
| `contextQuality` is `'minimal'` with location only | Quality roll-up correct |
| `contextQuality` is `'full'` with all categories | Quality roll-up correct |
| `setContext()` partial update preserves other fields | Merge behavior |
| `setContext()` invalid data does not corrupt context | Validation gate |
| `clearContext()` resets to default reactively | Clear propagates |
| Session GPS appears in `userContext.location.current` | Session merge |
| GPS not in `persistentContext` after session update | Session isolation |
| Multiple calls return same reactive state | Singleton behavior |

**Dependencies:** Tasks 2.1, 2.2 complete

**Acceptance criteria:** All 10 tests pass.

---

### Task 5.6 — Write tests for `src/stores/context.js`

**Files affected:**
- `src/stores/__tests__/context.test.js` — NEW

**Test cases:**

| Test | Assertion |
|---|---|
| Store initializes with `gpsPosition: null` | Default state |
| `updateGpsPosition()` near primary sets `isAtPrimary: true` | Proximity detection |
| `updateGpsPosition()` far from primary sets `isAtPrimary: false` | Distance check |
| `updateGpsPosition()` with no primary sets `isAtPrimary: null` | No primary case |
| `clearSession()` resets all state | Full reset |
| No localStorage write on any action | Session isolation |

**Dependencies:** Task 2.1 complete

**Acceptance criteria:** All 6 tests pass.

---

### Task 5.7 — Write profile setup flow component tests

**Files affected:**
- `src/components/ui/profile/__tests__/ProfileSetupFlow.test.js` — NEW

**Test cases (from Implementation Plan Section 7.7):**

| Test | Assertion |
|---|---|
| Completing Step 1 writes `location.primary` | Context updated |
| Skipping Step 1 writes nothing | Skip is clean |
| Completing Step 2 writes `routines.weekday.departureTime` | Routine updated |
| Completing Step 3 writes `activities.declared` with profiles attached | Activities have profiles |
| Completing Step 4 writes correct sensitivity flags | Booleans correct |
| Completing Step 5 writes notification preferences | Prefs updated |
| Completing all steps produces `contextQuality: 'full'` | Quality correct |
| Completing only Step 1 produces `contextQuality: 'minimal'` | Partial quality correct |
| "Clear all my data" calls `clearContext()` | Reset fires |

**Dependencies:** Tasks 3.1–3.6, Task 2.2 complete

**Acceptance criteria:** All 9 tests pass.

---

### Task 5.8 — Write notification preference gating tests

**Files affected:**
- `src/composables/__tests__/useWeatherNotifications.test.js` — NEW (or add to existing if tests exist)

**Test cases (from Implementation Plan Section 7.8):**

| Test | Assertion |
|---|---|
| Notification not sent when `enabled: false` | Master gate works |
| Morning briefing not sent when `morningBriefing: false` | Type gate works |
| Risk alert sent when `riskAlerts: true` and condition met | Positive case |
| No notification when context not initialized | Safe default |

**Dependencies:** Task 3.9, Task 2.2 complete

**Acceptance criteria:** All 4 tests pass.

---

### Task 5.9 — Manual testing checklist

**Purpose:** Verify user-facing behaviors that cannot be fully covered by automated tests.

**Files affected:** None — verification task

**Checklist:**

**Profile setup:**
- [ ] First-run prompt appears on clean device, does not block weather dashboard
- [ ] Profile setup completes in under 3 minutes (all 5 steps)
- [ ] Skipping all steps leaves weather dashboard functional
- [ ] Profile summary in `UserProfileSelector.vue` shows correct values after setup

**Saved locations migration:**
- [ ] User who had saved locations in old format sees them preserved after upgrade
- [ ] `lumicast-saved-locations` key is removed from localStorage after migration
- [ ] Saving a new location in the upgraded component works correctly

**Context persistence:**
- [ ] Context survives a page reload
- [ ] Context survives clearing browser cache (within localStorage limits)
- [ ] "Clear all my data" removes all context and returns to first-run state

**Auto-load:**
- [ ] App with configured primary location loads weather on open without a search
- [ ] A new search overrides the primary location for the session
- [ ] App without configured location shows the existing empty state (no regression)

**Notification gating:**
- [ ] User with `notifications.enabled: false` receives no notifications
- [ ] User with `riskAlerts: false` does not receive risk alert notifications
- [ ] User with all notifications enabled receives the expected notifications

**Breakpoints:**
- [ ] Profile setup flow renders correctly at 320px, 390px, 768px, 1024px
- [ ] `UserProfileSelector.vue` renders correctly at all breakpoints
- [ ] No horizontal overflow at any breakpoint

**Accessibility:**
- [ ] All profile setup steps are keyboard-navigable (tab order, enter to confirm)
- [ ] All form inputs have associated labels
- [ ] Confirmation dialog for "Clear all my data" is accessible

**Dependencies:** All Phase 3, 4 tasks complete

**Acceptance criteria:** All checklist items pass before Phase 3.2 begins.

---

## Task Dependency Graph

```
Phase 0
  0.1 (folders) ──→ 0.2 (types) ──→ 0.3 (defaults)
                         ↓
Phase 1
              1.1 (contextStore) ←── 0.2, 0.3
              1.2 (migration)    ←── 0.2, 0.3, 1.1
              1.3 (activityProfiles) ←── 0.2
                         ↓
Phase 2
              2.1 (session store) ←── Phase 1 complete
              2.2 (useUserContext) ←── 1.1, 1.2, 0.3, 2.1
              2.3 (geolocation)   ←── 2.1
              2.4 (formatters)    ←── 2.2
              2.5 (theme)         ←── 2.2
                         ↓
Phase 3
              3.1–3.5 (step components) ←── 2.2
              3.6 (setup flow)  ←── 3.1–3.5
              3.7 (ProfileSelector upgrade) ←── 3.6, 2.2
              3.8 (SavedLocations upgrade)  ←── 2.2, 1.2
              3.9 (notifications upgrade)  ←── 2.2
                         ↓
Phase 4
              4.1 (WeatherDashboard) ←── 3.6, 3.7, 2.2
              4.2 (signal store init) ←── 1.1, 2.2
              4.3 (WeatherData type) ←── 0.2
              4.4 (Insight type)    ←── 0.2, 4.3
                         ↓
Phase 5 (tests run alongside implementation of each phase)
              5.1–5.2 ←── Phase 1
              5.3–5.4 ←── Phase 1
              5.5–5.6 ←── Phase 2
              5.7     ←── Phase 3
              5.8     ←── Phase 3.9
              5.9     ←── Phase 4 complete
```

---

## Phase 3.1 Complete Definition

Phase 3.1 is complete when all of the following are true:

1. All tasks in Phases 0–5 are marked done
2. All automated tests pass (`vitest run` exits with code 0)
3. All items in the manual testing checklist (Task 5.9) pass
4. `lumi.context.v1` and `lumi.signals.v1` are established in localStorage on first app load
5. `lumicast-saved-locations` is absent from localStorage after migration
6. `lumicast-user-profile` is still present (Phase 3.2 removes it)
7. No intelligence modules exist — no `useInsightEngine`, no reasoning functions
8. No behavioral signal collection occurs
9. All existing weather functionality works identically for users without a profile

When these criteria are met, Phase 3.2 (Decision Engine) may begin.

---

*LumiCast Context Foundation Tasks v1.0*
*Derived from `LUMI_CONTEXT_IMPLEMENTATION_PLAN.md`*
*Do not begin Phase 3.2 until all Phase 3.1 completion criteria above are satisfied.*
