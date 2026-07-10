# LumiCast Context Architecture
## Technical Foundation for Phase 3.1 — Context Foundation
### Phase 3 Foundation Document · v1.0

*Companion document to `LUMI_INTELLIGENCE_PHILOSOPHY.md`, `LUMI_MEMORY_AND_CONTEXT_MODEL.md`, and `LUMI_INTELLIGENCE_ROADMAP.md`.*
*This document translates the context model into a concrete technical architecture for Phase 3.1 implementation.*

---

## 1. Context Architecture Overview

The context system is a pipeline, not a database. Its job is not to store personal data — it is to make personal data available to reasoning at the right moment, in the right shape, with the right confidence level attached.

The full flow from user declaration to recommendation looks like this:

```
User declares context (profile setup, preference settings)
  ↓
Context Store (persistent localStorage, schema-versioned)
  ↓
useUserContext composable (reactive accessor layer)
  ↓
Intelligence modules (pure functions — context in, Insight out)
  ↓
useInsightEngine coordinator (ranking, deduplication, urgency)
  ↓
UI card components (Insight objects in, rendered content out)
  ↓
User sees actionable guidance
```

Each boundary in this pipeline has a defined contract. Violating those contracts — for example, a card component reading from the context store directly, or an insight module calling the weather API — breaks the architecture and reintroduces the coupling that the layered design is meant to prevent.

### The Three Boundaries

**Boundary 1: User → Store**
The user declares context through profile UI. The store writes it. This is the only path by which data enters persistent memory. No other mechanism writes to the persistent context store.

**Boundary 2: Store → Composable**
`useUserContext` is the only access point to stored context. Intelligence modules do not read from localStorage, do not import the Pinia store directly, and do not access Vue component state. They receive a context object as a function parameter.

**Boundary 3: Composable → Module**
Each intelligence module receives two inputs: a weather data object and a user context object. It returns either a typed `Insight` object or `null`. The module has no side effects. It does not mutate state, does not read global stores, and does not make network requests.

### Why These Boundaries Matter

When an intelligence module is a pure function, it is trivially testable. When context is accessed only through `useUserContext`, the entire context system can be mocked in one place for testing, and migrated in one place for future changes. When cards only consume `Insight` objects, they contain no reasoning — making them replaceable without risk.

The architecture is designed to keep intelligence logic away from rendering, and user data away from intelligence logic. Both separations are essential for the system to remain maintainable as it grows through Phases 3.2–3.5.


---

## 2. Context Data Model

This section defines the shape of every context structure that flows through the system. These are not database schemas — they are the typed objects that `useUserContext` returns and that intelligence modules consume.

All structures are defined here as annotated object shapes. Implementation uses JSDoc typedefs; TypeScript types are equivalent if the project migrates.

### 2.1 The Root Context Object

`useUserContext` returns a single `UserContext` object. This is the complete picture of what Lumi knows about the user at the current moment. It is the only input intelligence modules need beyond weather data.

```
UserContext {
  location:     LocationContext        — where the user is and their saved places
  routines:     RoutineContext         — when they are typically active
  activities:   ActivityContext        — what they do outdoors
  schedule:     ScheduleContext        — specific upcoming events
  preferences:  PreferenceContext      — how Lumi should communicate
  sensitivities: SensitivityContext    — environmental thresholds
  meta:         ContextMeta            — confidence, completeness, timestamps
}
```

The `meta` field is system-managed. It is never written by the user. Every other field is populated exclusively from declared profile data during Phase 3.1.

### 2.2 LocationContext

```
LocationContext {
  primary: {
    name:        string          — display name ("Home", "London", etc.)
    lat:         number
    lon:         number
    timezone:    string          — IANA timezone string ("Europe/London")
    locationType: 'urban' | 'suburban' | 'rural'
    confidence:  'declared' | 'inferred'  — always 'declared' in Phase 3.1
  }
  saved: Array<{
    id:          string          — stable identifier
    name:        string
    lat:         number
    lon:         number
    timezone:    string
    locationType: 'urban' | 'suburban' | 'rural'
  }>
  current: {
    lat:         number | null   — null if GPS permission not granted
    lon:         number          
    isAtPrimary: boolean         — true if within ~2km of primary location
    permissionState: 'granted' | 'denied' | 'not-requested'
  } | null
}
```

`current` is session-only. It is never persisted. It is populated at app open if GPS permission is already granted, and updated on significant movement. It is discarded on session end.

`isAtPrimary` is a computed field derived from distance between `current` and `primary`. When `isAtPrimary` is `false`, routine-based intelligence is suspended (per Context Model Section 5.1).

### 2.3 RoutineContext

```
RoutineContext {
  weekday: {
    departureTime:   string | null   — "HH:MM" 24h format, null if not set
    returnTime:      string | null   — "HH:MM" 24h format, null if not set
    outdoorWindows:  Array<TimeWindow>
  }
  weekend: {
    outdoorWindows:  Array<TimeWindow>
  }
  confidence: 'declared' | 'inferred'   — always 'declared' in Phase 3.1
}

TimeWindow {
  startTime:   string       — "HH:MM" 24h format
  endTime:     string       — "HH:MM" 24h format
  label:       string       — human label ("Morning run", "Dog walk", etc.)
  daysOfWeek:  Array<0..6>  — 0=Sunday, 6=Saturday; empty = all days
}
```

`departureTime` and `returnTime` are the highest-priority routine fields for commute intelligence. `outdoorWindows` are used for activity and routine adaptation modules.

Absence of a `departureTime` means commute intelligence is not activated — Lumi does not guess. The field exists or it does not.

### 2.4 ActivityContext

```
ActivityContext {
  declared: Array<DeclaredActivity>
}

DeclaredActivity {
  id:           string                    — stable identifier
  activityKey:  ActivityKey               — canonical key from system catalogue
  label:        string                    — display name ("Morning run", etc.)
  frequency:    'daily' | 'several-weekly' | 'occasional' | 'seasonal'
  seasonRange: {
    startMonth:  1..12 | null             — null = year-round
    endMonth:    1..12 | null
  } | null
  profile:      ActivitySensitivityProfile  — system-defined, not user-configured
}

ActivityKey:
  'running' | 'cycling' | 'hiking' | 'gardening' | 'photography' |
  'golf' | 'outdoor-dining' | 'dog-walking' | 'swimming' | 'sailing'
  (extensible in Phase 3.5+)

ActivitySensitivityProfile {
  primaryVariables:   Array<WeatherVariable>   — variables this activity cares about most
  thresholds: {
    good:             ThresholdSet   — conditions where activity is recommended
    marginal:         ThresholdSet   — conditions where activity is possible but suboptimal
    notRecommended:   ThresholdSet   — conditions where activity should be avoided
  }
}

WeatherVariable:
  'temperature' | 'feelsLike' | 'humidity' | 'windSpeed' | 'gustSpeed' |
  'precipitation' | 'uvIndex' | 'visibility' | 'airQuality' | 'pollen'

ThresholdSet {
  [variable: WeatherVariable]: { min?: number, max?: number }
}
```

`ActivitySensitivityProfile` is defined by the system for each `ActivityKey`. It is not user-configurable. When a user declares "running," they receive the system's running profile — they do not configure what "good" conditions mean for running. This is intentional: activity profiles encode subject-matter knowledge, not user preference.

### 2.5 ScheduleContext

```
ScheduleContext {
  manualEvents: Array<ManualEvent>
  calendarConnected: boolean   — always false in Phase 3.1
}

ManualEvent {
  id:          string
  label:       string          — e.g. "Outdoor wedding"
  date:        string          — ISO 8601 date ("2025-08-12")
  timeStart:   string | null   — "HH:MM", null if all-day
  timeEnd:     string | null
  isOutdoor:   boolean
  locationId:  string | null   — references saved location ID, or null for primary
}
```

`ManualEvent` entries are forward-looking. Past events are not retained — they serve no intelligence purpose and their storage would constitute unnecessary data retention. The store purges events whose `date` has passed.

In Phase 3.1, `calendarConnected` is always `false`. The field exists so that Phase 3.5 calendar integration does not require a schema migration.

### 2.6 PreferenceContext

```
PreferenceContext {
  temperatureUnit:  'C' | 'F'
  theme:            'dark' | 'light'
  verbosity:        'concise' | 'extended'   — default 'concise'
  notifications: {
    enabled:          boolean
    commute:          boolean
    morningBriefing:  boolean
    activityAlerts:   boolean
    riskAlerts:       boolean
    preDeparture:     boolean   — Phase 3.4 field; false by default in Phase 3.1
    ambient:          boolean   — Phase 3.5 field; false by default in Phase 3.1
  }
  intelligenceAreas: {
    dailyPlanning:        boolean   — default true
    activityRecommend:    boolean   — default true if activities declared, else false
    commuteIntelligence:  boolean   — default true if departureTime declared, else false
    routineAdaptation:    boolean   — default true
    environmentalAware:   boolean   — default false (Phase 3.5)
  }
}
```

Default values for `intelligenceAreas` are derived from the completeness of the user's profile: a user with no declared activities has `activityRecommend: false` by default. This prevents empty-state cards from appearing for users who haven't configured the relevant context.

Future fields (`preDeparture`, `ambient`, `environmentalAware`) are included in Phase 3.1 with their defaults set to `false`. They activate in their respective phases without requiring a schema migration.

### 2.7 SensitivityContext

```
SensitivityContext {
  heat:           boolean   — default false
  cold:           boolean   — default false
  pollen:         boolean   — default false
  uv:             boolean   — default false
  airQuality:     boolean   — default false
  precipitation:  boolean   — default false
}
```

Sensitivities are binary flags. The urgency thresholds associated with each flag are system-defined constants (documented in Context Model Section 5.5) — they are not stored in the sensitivity context itself. When `heat: true`, the urgency engine applies the heat-sensitivity threshold set. The threshold values live in the urgency engine, not in the user's profile.

This is intentional: if medical evidence suggests adjusting a threshold, the system-level constant is updated, and the adjustment applies to all sensitive users immediately — without requiring any user action.

### 2.8 ContextMeta

```
ContextMeta {
  schemaVersion:      string        — semantic version ("1.0.0")
  createdAt:          number        — Unix timestamp
  lastModifiedAt:     number        — Unix timestamp
  completeness: {
    hasLocation:      boolean
    hasRoutine:       boolean
    hasActivities:    boolean
    hasSensitivities: boolean
    hasPreferences:   boolean
  }
  contextQuality: 'full' | 'partial' | 'minimal' | 'none'
}
```

`contextQuality` is a computed roll-up used by the insight coordinator to determine which intelligence layers are available:
- `full`: location + routine + activities + sensitivities declared → all modules active
- `partial`: location + at least one of (routine, activities) declared → core modules active
- `minimal`: location only → Layer 2 environmental intelligence only
- `none`: no location → no personalized intelligence; app operates in generic weather display mode

`schemaVersion` is critical for future migrations. If the stored schema version does not match the current application schema version, the migration layer runs before `useUserContext` returns any data.


---

## 3. Memory Layers

The context system maintains three distinct memory layers. They differ in persistence, confidence, and how they are read. The separation is not academic — mixing them would make the system untrustworthy.

### 3.1 Persistent Context Layer

**What it is:** Everything the user has explicitly declared. The ground truth of Lumi's personal knowledge.

**Storage location:** `localStorage` under the key `lumi.context.v1` (schema-versioned).

**Written by:** Profile setup flow and profile editing UI only. No other code path writes to this layer.

**Read by:** `useUserContext` composable only. No component, module, or store reads localStorage directly.

**Lifetime:** Indefinite. The data survives app closes, device restarts, and browser cache clears (within localStorage limits). It is deleted only by explicit user action (context reset) or by clearing browser data.

**Mutation rules:**
- Writes are atomic — the entire context object is serialized and written in one operation. Partial writes do not occur.
- Before writing, the new object is validated against the schema. Invalid writes are rejected and the existing data is preserved.
- A write timestamp is recorded in `ContextMeta.lastModifiedAt` on every mutation.

**What belongs here:** All six context category structures defined in Section 2.

**What does not belong here:** Session state, behavioral signals, weather data, computed values, cached API responses.

### 3.2 Session Context Layer

**What it is:** Short-lived state that is relevant only within the current app session. It enriches the context object for the duration of the session without polluting persistent storage.

**Storage location:** In-memory only. Implemented as a reactive Pinia store slice (not persisted to localStorage).

**Written by:** The app runtime — GPS position updates, current screen state, session-scoped weather query cache, WeatherCopilot conversation history.

**Read by:** `useUserContext` composable, which merges session context into the returned `UserContext` object. Consumers see a unified object — they do not know or care which layer a given field came from.

**Lifetime:** Discarded when the app is closed or the Vue app instance is destroyed. Never written to storage.

**Key session fields:**
- `location.current` — live GPS position (enriches `LocationContext.current`)
- `isAtPrimary` — computed from GPS vs. primary location (enriches `LocationContext`)
- `currentTimestamp` — current wall-clock time (used by all timing-sensitive modules)
- `currentDayOfWeek` — derived from timestamp (used for weekday/weekend routing)
- `copilotHistory` — WeatherCopilot conversation turns (discarded on session end)

**Merge rule:** When `useUserContext` assembles the `UserContext` object, session fields overlay persistent fields where they exist. The persistent layer is never mutated by session data. GPS position is always session-only and never written back to the primary location.

### 3.3 Behavioral Signal Layer

**What it is:** Low-confidence, time-windowed observations about user behavior. Used only to adjust ranking weights within the intelligence coordinator — never as input to declared-context fields.

**Storage location:** `localStorage` under the key `lumi.signals.v1`, separate from context storage. This separation is intentional: users can clear behavioral signals independently of their declared context, and vice versa.

**Written by:** The behavioral signal collector (Phase 3.4). In Phase 3.1, this layer is defined but empty. The schema is established now so Phase 3.4 can activate it without a migration.

**Read by:** `useInsightEngine` coordinator (Phase 3.2+). Not read by `useUserContext` — behavioral signals are not part of the `UserContext` object. They are a separate, parallel input to the insight coordinator.

**Lifetime:** Signals older than 90 days are automatically pruned when the layer is read. The layer enforces its own retention window.

**Schema (established in Phase 3.1, populated in Phase 3.4):**
```
SignalStore {
  schemaVersion:  string
  signals:        Array<BehavioralSignal>
}

BehavioralSignal {
  type:       'app-open' | 'insight-engage' | 'card-scroll' | 'card-expand'
  timestamp:  number          — Unix timestamp
  metadata: {
    insightType?: string      — for 'insight-engage' events
    cardId?:      string      — for card interaction events
  }
}
```

**Why defined in Phase 3.1 if not populated until Phase 3.4:** The signal store key must exist and the schema must be established before the behavioral collector writes to it. If Phase 3.4 introduces a new key without establishing it in Phase 3.1, there is no migration path for users upgrading from Phase 3.1 to Phase 3.4 without data loss. Defining the schema early costs nothing and prevents a future migration problem.


---

## 4. Storage Strategy

### 4.1 What Should Be Stored (Persistent Layer)

The test for storing a piece of data persistently is simple: if this data is missing when the user next opens the app, does a currently-implemented intelligence feature produce noticeably worse output? If yes, store it. If no, do not.

Applying this test:

| Data | Store persistently? | Reason |
|---|---|---|
| Primary location (lat/lon/timezone) | Yes | All weather data loading depends on this |
| Saved locations | Yes | User would have to re-add them each session |
| Departure time | Yes | Commute intelligence degrades to generic without it |
| Declared outdoor windows | Yes | Routine intelligence degrades to generic without it |
| Declared activities + frequency | Yes | Activity module cannot run without this |
| Sensitivity flags | Yes | Urgency thresholds are mis-calibrated without this |
| Temperature unit preference | Yes | Every number displayed is wrong unit without this |
| Notification preferences | Yes | Notification behavior would reset each session |
| Intelligence area toggles | Yes | Cards appear for irrelevant areas without this |
| Schema version | Yes | Required for migration safety |
| Created / modified timestamps | Yes | Required for context auditing (user-visible) |

### 4.2 What Should Not Be Stored (Persistent Layer)

| Data | Store persistently? | Reason |
|---|---|---|
| GPS coordinates (current position) | Never | Session-only; storing creates a location history |
| Weather API responses | Never | Stale data is harmful; re-fetch on session |
| Computed insight objects | Never | Stale insights are misleading; re-compute each session |
| Past manual events | Never | Events past their date have no intelligence value |
| Behavioral signals with content | Never | Signal type only — never content of the interaction |
| WeatherCopilot conversation history | Never | Session-only; past conversations have no future value |
| Notification send history | Never | Not needed for any current intelligence function |
| Inferred routine values | Never | Inferences are never promoted to persistent memory |

### 4.3 What Should Be Stored (Signal Layer)

| Data | Store in signal layer? | Reason |
|---|---|---|
| App open timestamps | Yes (Phase 3.4) | Used for pre-departure timing optimization |
| Insight type engagement (which type, not content) | Yes (Phase 3.4) | Used for relevance ranking |
| Card expand/collapse pattern | Yes (Phase 3.4) | Used for relevance fade |

### 4.4 What Should Not Be Stored (Signal Layer)

| Data | Store in signal layer? | Reason |
|---|---|---|
| Insight content text | Never | Content is personal; timing type is sufficient |
| Location at time of app open | Never | Creates location history without value |
| Weather conditions at signal time | Never | Correlating signals to conditions is behavioral profiling |
| User identity or device ID | Never | Signals are anonymous by design |

### 4.5 Local vs. Remote Considerations

**Phase 3.1: Local only.** All context and signal data stays on device. No network request is made for context data. The only network requests are weather API calls, which are made with coordinates — not with user profile data.

**Future cloud sync (post-Phase 3.1):** If the user opts in to multi-device sync, context data is transmitted to a backend. This opt-in must be:
- Explicit (not enabled by default)
- Clearly explained ("Your profile will be stored on LumiCast servers to sync across your devices")
- Reversible (disabling sync deletes the server-side copy)

The local copy always remains authoritative. The remote copy is a sync mirror, not the source of truth.

**What is never sent remotely, regardless of sync settings:** Behavioral signals, GPS history, current location, session state, WeatherCopilot conversation history.

**API request privacy:** When calling the weather API, coordinates are sent. No user identity, profile data, or sensitivity information is included in API requests. The API knows a location was queried — it does not know who queried it.


---

## 5. Context Lifecycle

This section defines how each piece of context is created, updated, validated, and removed. Each lifecycle event has a defined trigger, actor, and outcome.

### 5.1 Context Creation

**Trigger:** First-run profile setup, or manual profile setup by a returning user who skipped onboarding.

**Actor:** The user, through the profile setup UI.

**Flow:**
1. User completes profile setup step(s)
2. UI constructs a partial `UserContext` object from inputs
3. Schema validator runs — any invalid fields are rejected; partial context is still saved
4. Full `UserContext` (with defaults for omitted fields) is written to `localStorage`
5. `ContextMeta.schemaVersion` is set to current application schema version
6. `ContextMeta.createdAt` and `ContextMeta.lastModifiedAt` are set to current timestamp
7. `useUserContext` reactive state is updated — all consuming components and modules re-evaluate immediately

**Minimum valid context:** A `UserContext` is valid for storage with only `location.primary` set. All other fields may be null/empty/default. A user who only provides their location receives Layer 2 intelligence. They do not receive errors.

**First-run default state:** Before the user completes any profile setup, `useUserContext` returns a `UserContext` where all declared fields are null and `contextQuality` is `'none'`. The application renders the weather dashboard without personalized intelligence. The profile setup prompt is visible but not blocking.

### 5.2 Context Update

**Trigger:** User edits any profile field through `UserProfileSelector.vue` or the settings UI.

**Actor:** The user only. No automated process writes to the persistent context layer.

**Flow:**
1. User modifies a field in the profile UI
2. The change is validated immediately (inline validation, not form-submit)
3. On save, the changed field is merged into the existing `UserContext` object
4. The full merged object is written atomically to `localStorage`
5. `ContextMeta.lastModifiedAt` is updated
6. `useUserContext` reactive state updates — intelligence output changes within the same session

**Atomic writes:** The entire context object is serialized and written in a single `localStorage.setItem` call. There is no partial-write state. If the write fails (e.g., storage quota exceeded), the existing data is preserved and the user is shown an error.

**Immediate effect:** Context updates take effect within the current session without a page reload. A user who adds "cycling" to their activities while looking at the Activity Recommendations card sees the card update immediately.

### 5.3 Context Validation

**Trigger:** On every read from localStorage (app open, context update) and on every write.

**Validation rules:**

| Field | Validation |
|---|---|
| `location.primary.lat` | Number in range [-90, 90] |
| `location.primary.lon` | Number in range [-180, 180] |
| `location.primary.timezone` | Valid IANA timezone string |
| `routines.weekday.departureTime` | "HH:MM" format, 00:00–23:59, or null |
| `routines.*.outdoorWindows[].startTime` | "HH:MM" format |
| `routines.*.outdoorWindows[].endTime` | After startTime |
| `activities[].activityKey` | Must be in defined `ActivityKey` enum |
| `schedule.manualEvents[].date` | Valid ISO 8601 date, not in the past |
| `preferences.temperatureUnit` | 'C' or 'F' |
| `sensitivities.*` | Boolean |

**On validation failure:** Individual invalid fields are set to their default (null or false). The rest of the context is preserved. Validation errors are logged internally — they are not surfaced to the user unless the invalid field was just entered (in which case inline validation catches it at input time).

**Schema version mismatch (migration):** If `ContextMeta.schemaVersion` in storage does not match the current application schema version, the migration layer runs before returning context. Migration functions are additive — they add new fields with defaults, they never remove fields. If migration fails, the system falls back to a minimal context state and prompts the user to review their profile.

### 5.4 Context Removal

**Trigger:** User explicitly initiates context deletion from the profile screen.

**Actor:** The user only. Context is never auto-deleted, never expires, and is never removed by the system outside of user-initiated reset.

**Full context reset flow:**
1. User navigates to "Clear all my data" in profile settings
2. A confirmation dialog is shown: "This will remove all your profile data. Lumi will return to default settings."
3. On confirmation:
   - `lumi.context.v1` is removed from localStorage
   - `lumi.signals.v1` is removed from localStorage (behavioral signals cleared simultaneously)
   - Session state is reset
   - `useUserContext` returns the default empty state
   - The application behaves as if it is a new installation

**Partial removal flow (single field or category):**
1. User deletes a specific field (e.g., removes an activity, clears departure time)
2. That field is set to null/empty/default in the context object
3. The updated context object is written to localStorage
4. Intelligence that depended on that field degrades gracefully to the next available context quality level

**What happens after removal:** Intelligence output immediately reflects the absence of the removed context. There is no grace period, no "undo" window beyond normal browser back behavior, and no server-side copy to restore from.

**Past events:** `ManualEvent` entries with past dates are automatically pruned from `schedule.manualEvents` on each context read. This is not user-initiated removal — it is automatic data hygiene for data that has become factually stale (a past event cannot be acted on).


---

## 6. Recommendation Pipeline

This section defines how context flows through the intelligence system from raw data to rendered output. It is the architectural expression of the Intelligence Hierarchy from the Philosophy document.

### 6.1 The Full Pipeline

```
Weather Store (Pinia)           useUserContext composable
  │ WeatherData object               │ UserContext object
  └──────────────┬───────────────────┘
                 ↓
        Intelligence Modules (pure functions)
        ┌──────────────────────────────────────┐
        │ dailyPlanningModule(weather, context) │ → Insight | null
        │ comfortModule(weather, context)       │ → Insight | null
        │ commuteModule(weather, context)       │ → Insight | null
        │ activityModule(weather, context)      │ → Insight[] | null
        │ routineModule(weather, context)       │ → Insight | null
        └──────────────────────────────────────┘
                 ↓
        useInsightEngine coordinator
        ├── Collect non-null insights
        ├── Apply urgency engine (SensitivityContext → thresholds)
        ├── Deduplicate overlapping insights
        ├── Apply signal weights (Phase 3.4+; identity weights in 3.1)
        ├── Sort by: urgency tier DESC, relevance score DESC, timing ASC
        └── Return InsightSet
                 ↓
        Card Components (Vue)
        ├── MorningBriefingCard   ← consumes lead + supporting insights
        ├── ActivityRecCard       ← consumes activity insights
        ├── RiskAlertsCard        ← consumes Alert + Heads-up tier insights
        └── BestTimeCard          ← consumes timing insights
                 ↓
        Notification Dispatcher (useWeatherNotifications)
        └── Dispatches insights where timing.notify === true
```

### 6.2 The WeatherData Object

Intelligence modules receive a normalized weather data object — not the raw API response. The weather store (Pinia) is responsible for the normalization. Modules never parse raw API structures.

```
WeatherData {
  current: {
    temp:           number      — Celsius
    feelsLike:      number      — Celsius
    humidity:       number      — 0-100
    windSpeed:      number      — km/h
    gustSpeed:      number      — km/h
    uvIndex:        number      — 0-11+
    condition:      string      — normalized key from resolveWeatherIconKey()
    visibility:     number      — km
    precipProb:     number      — 0-1
  }
  hourly:   Array<HourlyPoint>  — next 48 hours, 1h intervals
  daily:    Array<DailyPoint>   — next 7 days
  fetchedAt: number             — Unix timestamp
  location: {
    lat: number
    lon: number
  }
}
```

The shape is stable and will not change between API provider changes — that is the normalization layer's job.

### 6.3 The Insight Object

Every intelligence module returns either `null` or an `Insight` object. This is the contract that makes all modules interoperable with the coordinator.

```
Insight {
  id:           string          — stable identifier for deduplication
  type:         InsightType     — which intelligence domain produced this
  urgency:      UrgencyLevel    — Ambient | Useful | Heads-up | Alert
  timing: {
    windowStart:  number | null — Unix timestamp; null = "now"
    windowEnd:    number | null — Unix timestamp; null = "open-ended"
    notify:       boolean       — whether this insight should trigger a notification
    notifyAt:     number | null — Unix timestamp for scheduled notification
  }
  content:      string          — the rendered insight text (action-connected)
  actionPath:   string          — what the user should do (MUST be non-empty)
  confidence:   'high' | 'medium' | 'low'
  sourceContext: {
    usedLocation:    boolean
    usedRoutine:     boolean
    usedActivity:    boolean
    usedSensitivity: boolean
  }
}

InsightType:
  'daily-planning' | 'comfort' | 'commute' | 'activity' |
  'routine-adapt' | 'risk-alert' | 'environmental' | 'ambient'

UrgencyLevel:
  'ambient' | 'useful' | 'heads-up' | 'alert'
```

The `actionPath` field is the mandatory gate from the Philosophy document. The coordinator rejects any `Insight` where `actionPath` is empty or null before it can reach a card component.

`sourceContext` is used for two purposes: transparent explanation ("Lumi is suggesting this because of your declared departure time") and quality assurance (ensuring that insights claiming to be personalized actually consumed context).

### 6.4 Context Quality Routing

Before running any modules, the coordinator evaluates `UserContext.meta.contextQuality` and routes accordingly:

| contextQuality | Modules active |
|---|---|
| `'none'` | No intelligence modules run. Cards render in generic weather display mode. |
| `'minimal'` | `dailyPlanningModule` and `comfortModule` only (require only weather + location). No routine, activity, or commute modules. |
| `'partial'` | Modules for declared categories only. Undeclared categories produce `null` (correctly handled, not an error). |
| `'full'` | All applicable modules run. |

This routing ensures that users with incomplete profiles receive the best intelligence their context supports — not errors or empty states.

### 6.5 Module Guard Pattern

Each module begins with a guard that checks whether the required context is present. If required context is absent, the module returns `null` immediately without attempting to reason.

```
Pseudocode — commuteModule guard:

if (context.routines.weekday.departureTime === null) return null
if (!isCurrentlyWeekday(sessionTimestamp)) return null
if (!context.location.current?.isAtPrimary) return null
// ... rest of module logic
```

Guards are the module's contract enforcement. They do not log errors — returning `null` is the correct, expected behavior when context is absent. The coordinator handles `null` results transparently.

### 6.6 Urgency Engine Integration

The urgency engine is not a module — it is a service consumed by modules when they need to assign an urgency level to a condition. It encapsulates all threshold logic so that no individual module hardcodes threshold values.

```
urgencyFor(variable: WeatherVariable, value: number, sensitivity: SensitivityContext): UrgencyLevel
```

Example:
```
urgencyFor('feelsLike', 34, { heat: true }) → 'heads-up'
urgencyFor('feelsLike', 34, { heat: false }) → 'useful'
urgencyFor('feelsLike', 42, { heat: false }) → 'alert'
```

All threshold values are defined as named constants in the urgency engine — never inline in module code. When a threshold needs to change, there is exactly one place to change it.


---

## 7. Privacy Boundaries

Privacy in this architecture is not enforced by policy alone — it is enforced by structure. The boundaries defined in Section 1 make certain privacy violations architecturally impossible rather than merely prohibited.

### 7.1 Data Minimization by Architecture

The mandatory gate for storing any field is: *does a currently-implemented intelligence feature become measurably worse if this field is absent?* This test is applied at design time, not at audit time.

The result is that the context schema contains exactly what Lumi uses and nothing more. Fields are not added speculatively ("we might need this later"). Future capabilities are addressed by schema versioning and migration — not by pre-collecting data.

**Enforcement mechanism:** The `useUserContext` composable is the single reader of the context store. Any new field added to the schema must also appear in `useUserContext`'s output object. If it does not appear in the output, it has no consumer. If it has no consumer, it should not be in the schema.

### 7.2 Sensitivity Data Handling

Sensitivity flags carry additional care requirements because they imply health-related characteristics.

**Collection rule:** Sensitivity flags are presented to users as opt-in choices with plain-language explanations of what each flag does. "I'm more sensitive to heat" — not "cardiovascular condition" or "medical flag."

**Storage rule:** Sensitivity flags are stored as booleans. No elaboration, no detail, no reasoning for why the user selected them. The system does not know *why* the user declared heat sensitivity — only that they did.

**Inference rule:** Sensitivity flags are never inferred from behavioral signals. A user who consistently avoids opening the app on high-UV days has not declared UV sensitivity. The inference is never made.

**Transmission rule:** Sensitivity flags are never included in any outbound network request — not in weather API calls, not in error reports, not in analytics. They are local-only in all phases.

### 7.3 Location Data Handling

Location is the context category most likely to create a privacy concern if mishandled.

**Primary location:** Stored as coordinates + timezone. It is used exclusively to determine which weather data to load. It is never correlated with any other data source. It is never sent in a request with any user-identifying information.

**Current GPS position:** Session-only. Never written to localStorage. Never transmitted. Used only to compute `isAtPrimary` (a boolean) for the current session. After the app is closed, the position is gone.

**Location history:** Not created. LumiCast does not maintain a record of where the user has been. Each session's GPS position is independent.

**Saved locations:** Stored as named coordinates. The user's association between a name and a place (e.g., "Work" → [lat, lon]) is local-only. No external service learns that the user named a location "Work."

### 7.4 Behavioral Signal Boundaries

Behavioral signals (Phase 3.4) are pre-bounded by the schema defined in Phase 3.1.

The schema permits:
- App open timestamp (number only)
- Insight type engaged (string key — not content)
- Card identifier scrolled past or expanded (component ID — not rendered content)

The schema explicitly excludes:
- What the weather was at the time of the signal
- What location the user was at
- What the insight said
- Any device identifier

This exclusion is structural — the `BehavioralSignal` type has no field for this data. It cannot be accidentally added later without a schema change, which requires a deliberate decision and a schema version increment.

### 7.5 The No-Assumption Rule in Architecture

The Context Model's "never assume" rules translate directly into architectural constraints:

**Never assume a sensitivity not declared:** Sensitivity thresholds in the urgency engine are only applied when the corresponding boolean in `SensitivityContext` is `true`. The urgency engine does not inspect behavioral signals or weather history to estimate sensitivity. The code path for sensitivity adjustment is gated by a boolean check — there is no inference path.

**Never assume a schedule from behavior:** The `ScheduleContext.manualEvents` array is populated only by user action. The behavioral signal collector (Phase 3.4) writes only to `lumi.signals.v1` — it has no write path to `lumi.context.v1`. An inferred schedule event cannot enter the context store because there is no code path that does this.

**Never assume a location is permanent:** The GPS position in `LocationContext.current` is computed fresh each session. There is no write path from `current` to `primary`. A function that sets `primary` exists in the profile write layer only — it is not callable from session update code.

**Never degrade persistent memory from signal absence:** The context store has no TTL, no "last seen" logic, and no decay mechanism. A user who stops using the app for a month returns to find their declared routines exactly as they left them.

### 7.6 User Visibility and Control

The user's ability to see and remove their data is not a secondary concern — it is a first-class feature of the context architecture.

**What the user can see:** The profile UI exposes the complete `UserContext` in human-readable form. Every stored field has a visible representation. There are no hidden fields.

**What the user can edit:** Every field in the persistent context layer is editable from the profile UI. No field is read-only after it is set (except `ContextMeta` fields, which are system-managed and informational).

**What the user can delete:** Any individual field, any category, or the entire context. Deletion is immediate. There is no soft-delete or retention period.

**Signal transparency (Phase 3.4):** The behavioral signal store is viewable from a dedicated "Signal data" section within profile settings. The view shows the count of each signal type and the date range covered. Individual signals are not displayed (there is no user value in seeing a list of timestamps), but the aggregate is visible. The entire signal store is deletable independently of the declared context.

**Context audit trail:** `ContextMeta.lastModifiedAt` gives the user a timestamp of the last change. This is not a full audit log — it is a single timestamp. Full audit logs are not implemented; they would constitute unnecessary data storage.


---

## 8. MVP Architecture for Phase 3.1

This section defines exactly what Phase 3.1 builds, in what order, and what it deliberately defers. It is the implementation contract for the Context Foundation phase.

### 8.1 What Phase 3.1 Actually Builds

Phase 3.1 delivers four things: the data model, the store, the accessor composable, and the profile UI. Everything else in this document is infrastructure that Phase 3.1 establishes the foundation for — but does not fully implement.

**1. Context Store Implementation**

The `lumi.context.v1` localStorage key with the full `UserContext` schema from Section 2.

Specific implementation scope:
- Schema definition and JSDoc typedefs for all context structures
- Read/write functions with atomic writes and schema validation
- Schema version field and a minimal migration harness (even if no migrations exist yet)
- Default context factory (returns a valid empty `UserContext` with all fields at defaults)
- Past-event pruning for `schedule.manualEvents` (runs on every context read)

The `lumi.signals.v1` key is established with its schema but left empty. No signal writing occurs in Phase 3.1.

**2. `useUserContext` Composable**

The reactive accessor that is the single interface to context for all consumers.

Specific implementation scope:
- Reads from `lumi.context.v1` on initialization
- Merges session context (current timestamp, day-of-week, GPS position if available) into the returned object
- Returns a typed `UserContext` object with a `meta.contextQuality` field
- Is reactive — when the context store is updated, all consumers re-evaluate
- Exposes a `setContext(partial)` function for use by the profile UI
- Exposes a `clearContext()` function for use by the reset flow
- Does not read behavioral signals — signal reading is a Phase 3.4 concern

**3. Profile Setup Flow**

The first-run onboarding sequence for new users.

Specific implementation scope:
- Step 1: Primary location (reuses existing city search infrastructure from `useCitySearch.js`)
- Step 2: Departure time (time picker, skippable)
- Step 3: Declare activities (multi-select from `ActivityKey` catalogue, skippable)
- Step 4: Sensitivity flags (opt-in checkboxes with plain-language labels, skippable)
- Step 5: Notification preferences (which intelligence areas to receive notifications for)
- Completion: writes context, shows immediate demonstration of a personalized insight
- Skip at any step: stores partial context and skips to dashboard
- Re-accessible: the full setup flow is available from the profile screen at any time

The setup flow does not introduce new design tokens or new card components. It uses the existing LumiCast component library (`BaseButton`, `BaseCard`, `LoadingSkeleton`, etc.) exclusively.

**4. `UserProfileSelector.vue` Upgrade**

The existing component becomes the persistent profile management surface.

Specific implementation scope:
- Displays current context state (all declared values) in a readable format
- Allows editing of any declared field
- Provides access to the full setup flow for users who skipped steps
- Contains the "Clear all my data" action with confirmation dialog
- Provides a "Signal data" section placeholder (empty in Phase 3.1, populated in Phase 3.4)

### 8.2 What Phase 3.1 Establishes But Does Not Implement

These are architectural decisions that Phase 3.1 makes permanent — by defining schemas, establishing keys, and creating the composable contract — without writing the full implementation.

| Capability | Established in 3.1 | Implemented in |
|---|---|---|
| Behavioral signal schema | Schema defined, key created | Phase 3.4 |
| Signal weighting in coordinator | `signalWeights` parameter slot in coordinator interface | Phase 3.4 |
| Pre-departure notification timing | `preferences.notifications.preDeparture` field (default false) | Phase 3.4 |
| Ambient enrichment insights | `preferences.notifications.ambient` field (default false) | Phase 3.5 |
| Environmental intelligence areas | `preferences.intelligenceAreas.environmentalAware` (default false) | Phase 3.5 |
| Calendar connection flag | `schedule.calendarConnected: false` | Phase 3.5+ |
| Schema migration harness | Empty migration array, version check on read | Used from Phase 3.2 onward |
| Cloud sync opt-in field | Not present in Phase 3.1 schema | Future |

### 8.3 What Phase 3.1 Explicitly Defers

**Behavioral signal collection:** The signal store key exists, but nothing writes to it. No event listeners are attached. No user behavior is recorded. This is correct — there is no insight coordinator yet to consume signals.

**Intelligence modules:** `useInsightEngine` does not exist in Phase 3.1. The `useUserContext` composable is built, but nothing calls it for intelligence purposes yet. The personalization improvement during Phase 3.1 comes from cards that can read the context directly for display purposes (e.g., showing a user's declared activity in the Activity Recommendations card header) — not from fully-formed insight objects.

**Calendar integration:** The `calendarConnected` flag is in the schema. The UI does not offer a "connect calendar" option in Phase 3.1. The field is a placeholder.

**Cloud sync:** Not designed for in Phase 3.1. Local-only architecture only.

**Multi-person household:** Not in schema. Single-user model only.

**Seasonal context profiles:** Not in schema for Phase 3.1. `DeclaredActivity.seasonRange` is in the schema to avoid a future migration, but no UI exists to set it in Phase 3.1. It defaults to null (year-round) for all declared activities.

### 8.4 Existing Component Alignment

Before Phase 3.1 ships, three existing components must be audited and aligned with the new context architecture:

**`SavedLocations.vue`**
Currently manages saved locations independently. In Phase 3.1, saved locations are migrated into `LocationContext.saved` in the context store. `SavedLocations.vue` reads from and writes to `useUserContext` — not from its own internal state. The existing `useSearchHistory.js` search history (which is distinct from saved locations) is unaffected.

**`UserProfileSelector.vue`**
Currently handles display name / user type selection. This is replaced by the full context management surface described in Section 8.1. The component is upgraded, not replaced — its visual shell and placement in the layout are preserved.

**`useWeatherNotifications.js`**
Currently sends notifications as raw strings. In Phase 3.1, the composable is upgraded to accept and respect `PreferenceContext.notifications` flags. If `morningBriefing` is `false`, morning briefing notifications are suppressed. The full typed `Insight` object interface comes in Phase 3.3 — Phase 3.1 only adds preference gating.

### 8.5 Phase 3.1 Success Criteria (Technical)

- `useUserContext` returns a fully-typed `UserContext` object with `contextQuality` populated
- Writing to the context store and reading back produces byte-identical results
- Schema validation rejects invalid fields without corrupting valid data
- A context object with schema version `1.0.0` can be read back by any Phase 3.1 application build
- `clearContext()` removes all context data and returns `useUserContext` to the default empty state within the same session
- The profile setup flow completes in under 3 minutes for a user who fills in all steps
- All profile UI interactions are keyboard-navigable and WCAG AA compliant
- Zero personal data (no coordinates, no sensitivity flags, no profile fields) appears in any network request during Phase 3.1

---

## 9. Composable and Module Dependency Map

This map shows which composables depend on which, and what each one is responsible for. It is the canonical reference for import decisions during Phase 3.1 and beyond.

```
localStorage
  └── lumi.context.v1 ──────────────────────────────────┐
  └── lumi.signals.v1 (empty in Phase 3.1) ─────────── ─┐
                                                          │
Pinia Weather Store                                        │
  └── weatherStore                                        │
        └── (normalized WeatherData object)               │
                                                          │
useUserContext (Phase 3.1)                                │
  ├── reads lumi.context.v1 ←──────────────────────────── ┘
  ├── reads session GPS state
  ├── computes contextQuality, isAtPrimary
  └── exposes: UserContext, setContext(), clearContext()
        ↓
useInsightEngine (Phase 3.2)
  ├── consumes: UserContext from useUserContext
  ├── consumes: WeatherData from weatherStore
  ├── runs: insight modules (pure functions)
  ├── runs: urgency engine
  └── returns: InsightSet
        ↓
Card Components (Phase 3.3 upgrades)
  ├── MorningBriefingCard ← consumes InsightSet
  ├── ActivityRecommendationsCard ← consumes InsightSet + UserContext
  ├── WeatherRiskAlertsCard ← consumes InsightSet
  └── BestTimeCard ← consumes InsightSet
        ↓
useWeatherNotifications
  ├── consumes: InsightSet timing fields
  └── dispatches: browser notifications

useSignalCollector (Phase 3.4)
  ├── writes: lumi.signals.v1
  └── reads: UserContext.preferences.notifications.enabled (opt-in gate)
```

**Forbidden imports (enforced by code review, not by tooling in Phase 3.1):**
- Card components must not import from `lumi.context.v1` directly
- Intelligence modules must not import from any Pinia store
- Intelligence modules must not call any composable — they are pure functions that receive all inputs as parameters
- `useUserContext` must not import from `useInsightEngine` (no circular dependency)

---

*LumiCast Context Architecture v1.0 — Phase 3.1 Foundation*
*This document governs the technical implementation of Phase 3.1 — Context Foundation.*
*Read in conjunction with the full Phase 3 foundation document set.*
*Schema changes require a version increment in `ContextMeta.schemaVersion` and a corresponding migration function.*
*Changes to the composable boundary contracts require review against all downstream consumers listed in Section 9.*
