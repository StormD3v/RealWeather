# LumiCast Intelligence Roadmap
## Phase 3: Weather Intelligence 2.0
### Phase 3 Foundation Document · v1.0

*Companion document to `LUMI_INTELLIGENCE_PHILOSOPHY.md` and `LUMI_MEMORY_AND_CONTEXT_MODEL.md`.*
*This document translates philosophy and context model into a sequenced implementation plan.*

---

## 1. Phase 3 Vision

Phase 2 established LumiCast as a visually premium, technically sound weather application.
Phase 2.6 completed the visual foundation — a unified design system with no loose ends.

Phase 3 is where LumiCast becomes something different.

The shift is not cosmetic. It is not a new set of cards or a redesigned layout. It is the introduction of a reasoning layer — a system that takes everything LumiCast already displays and transforms it from data into guidance. From "here is the weather" into "here is what the weather means for your day."

That system is Lumi.

By the end of Phase 3, a user who opens LumiCast in the morning should not need to interpret anything. They should receive a clear, personal answer to the question they were already asking when they opened the app:

> *"What should I do differently because of the weather today?"*

### What Changes

**Before Phase 3:** LumiCast shows weather data beautifully. The user interprets it.
**After Phase 3:** Lumi interprets the weather. The user acts.

The dashboard surfaces shift from displaying conditions to surfacing decisions. The Morning Briefing card stops being a summary of weather data and becomes a personal daily briefing. The Activity Recommendations card stops listing outdoor options and starts telling the user whether *their* activities are viable *today*. Alerts stop being generic weather warnings and start being personal — triggered by context, not just by thresholds.

### What Does Not Change

Weather remains the foundation. The visual system built in Phase 2 is not replaced — it is elevated. The data is still there for users who want to look at it. Lumi adds a layer above it; it does not remove the layer below.

The product does not become a chatbot. It does not grow a conversational interface. It does not ask the user questions. It learns from what the user tells it and applies that knowledge silently and continuously.


---

## 2. Roadmap Overview

Phase 3 is organized into five sequential implementation phases. Each phase builds on the previous one — the architecture established in Phase 3.1 is the substrate that makes Phase 3.5 possible. Phases are not interchangeable in order.

```
Phase 3.1 — Context Foundation
  ↓ Establishes user context store and profile system
Phase 3.2 — Decision Engine
  ↓ Builds the intelligence reasoning layer
Phase 3.3 — Personal Weather Briefings
  ↓ Delivers personalized daily intelligence to the user
Phase 3.4 — Adaptive Intelligence
  ↓ Lumi learns and improves from behavioral signals
Phase 3.5 — Environmental Intelligence Expansion
  ↓ Extends intelligence into new environmental domains
```

Each phase has a defined MVP boundary: what must ship in that phase for the next phase to be buildable, and what can wait without blocking progression.

The guiding principle for sequencing: **never ship a phase that depends on context that hasn't been collected yet.** Intelligence that cannot be personalized because the context infrastructure doesn't exist yet is worse than no intelligence — it surfaces generic output under a personal-sounding label, which erodes trust faster than a plain weather display would.


---

## 3. Phase 3.1 — Context Foundation

### Vision

Nothing in Phase 3 is possible without this phase. Context Foundation establishes the infrastructure that every subsequent intelligence feature depends on: the user profile system, the persistent context store, and the framework that makes Lumi's reasoning personal rather than generic.

This phase is invisible to most users — there is no dramatic new feature. But for users who configure their profile, the payoff is immediate: insights that speak to their actual situation begin appearing before Phase 3.2 is even complete.

### User Value

A user who completes a profile setup in Phase 3.1 will begin receiving insights calibrated to their location, departure time, and declared activities. The difference between a configured and unconfigured experience becomes immediately apparent — which is the primary motivation for profile completion.

### Features

**User Profile System**
A structured profile that captures the six context categories defined in the Context Model: location, routines, activities, schedules, preferences, and environmental sensitivities. The profile UI is minimal and purposeful — each field has a visible reason for existing. No field is collected speculatively.

**Profile Setup Flow**
A first-run onboarding sequence that guides new users through the most impactful context inputs: primary location, departure time, and at least one declared activity. Completion is rewarded with an immediate demonstration of personalized intelligence, not a generic welcome screen.

**Context Store**
Local-first persistent storage for all declared context. All data stays on device by default. The store is the single source of truth for all Lumi reasoning — no intelligence function queries the raw profile directly; they query the context store, which applies the appropriate memory model (persistent vs. session vs. behavioral signals).

**UserProfileSelector Component (existing) — Upgraded**
The existing `UserProfileSelector.vue` component becomes the management surface for the context store: edit routines, add activities, manage sensitivities, control notification preferences.

**Context Availability API**
A composable (e.g., `useUserContext`) that exposes the current context state to any intelligence function. Returns a structured context object with confidence levels for each field. Intelligence functions consume this API — they never read the profile store directly.

### Required Data

- User-declared: primary location, departure time, typical outdoor windows, activities, sensitivities, preferences
- System-derived: current time of day, day of week, current location (if GPS permission granted)
- No weather API data beyond what is already loaded for the dashboard

### Technical Requirements

- Context store must be reactive — changes to profile propagate immediately to all active intelligence functions
- Context store must be serializable to localStorage with schema versioning (for future migrations)
- `useUserContext` composable must return a typed context object with a `confidence` field per category
- Profile UI must be accessible (WCAG AA), keyboard-navigable, and functional at all LumiCast breakpoints
- First-run onboarding must be skippable — users who skip receive Layer 2 (general environmental) intelligence, not broken personalized intelligence
- Context store must support graceful reduction — removing a field immediately removes its influence from all outputs

### Dependencies

- Phase 2.6 must be complete (design system and token architecture are required for profile UI)
- Existing `SavedLocations.vue`, `UserProfileSelector.vue`, and `useSearchHistory.js` components must be audited and aligned with the context store architecture before Phase 3.1 ships

### Success Criteria

- A user can complete profile setup in under 3 minutes
- A user who sets a departure time and one activity receives a visibly more specific morning insight than a user with no profile
- Context changes take effect within the same session without requiring a reload
- Zero personal data leaves the device during Phase 3.1
- Profile data survives an app close and reopen with full fidelity

### MVP Boundary

**Must ship in Phase 3.1:**
- Context store with persistent + session memory tiers
- Profile setup for location, departure time, and activities
- `useUserContext` composable
- Sensitivity declarations (heat, cold, UV, pollen, air quality)
- Preference settings (units, notification opt-in/out per intelligence area)

**Can wait:**
- Behavioral signal tracking (Phase 3.4)
- Calendar integration (Phase 3.5+)
- Multi-person household profiles (future)
- Cloud sync (future)


---

## 4. Phase 3.2 — Decision Engine

### Vision

The Decision Engine is Lumi's brain. It is the reasoning layer that sits between raw weather data and user-facing output — the implementation of the full five-layer Intelligence Hierarchy defined in the Philosophy document.

This phase produces no new UI. It produces the infrastructure that makes all future UI meaningful.

The Decision Engine is a set of composable reasoning modules — pure functions that take environmental data and user context as inputs and return structured insight objects as outputs. Each module corresponds to one intelligence domain. Modules are independent; they do not call each other. A coordinator selects which modules to run, collects their outputs, applies priority and urgency ranking, and returns an ordered set of insights for the current context.

### User Value

Users will not see a new screen. They will notice that the insights already appearing on their dashboard become more precise, more timely, and more directly connected to their situation. The Morning Briefing card begins producing genuinely personalized content. The Risk Alerts card begins triggering on thresholds calibrated to the user's declared sensitivities rather than population defaults.

### Features

**Insight Module Architecture**
Each intelligence domain (daily planning, activity, commute, comfort, routine, environmental) is a self-contained composable module. Each module:
- Accepts: weather data object + user context object
- Returns: an `Insight` object with `type`, `urgency`, `timing`, `content`, `confidence`, and `actionPath` fields
- Returns `null` if no insight is warranted (absence of an insight is a valid, intentional output)

**Insight Coordinator**
A central composable (`useInsightEngine`) that:
- Receives current weather data and user context
- Runs all applicable insight modules
- Filters null outputs
- Ranks results by urgency and personal relevance
- Returns an ordered `InsightSet` for the current moment

**Urgency Engine**
Applies the four-level urgency system (Ambient / Useful / Heads-up / Alert) with sensitivity-adjusted thresholds from the Context Model. A single source of truth for all urgency decisions — no module sets its own urgency independently.

**Confidence Propagation**
Each insight carries a `confidence` value derived from: forecast horizon (near-term is higher confidence), data completeness (full context vs. sparse context), and model certainty (deterministic rules vs. probabilistic inference). Confidence is used by rendering layers to decide how to frame uncertainty — it is not hidden.

**Insight Deduplication**
When multiple modules would produce insights about the same condition (e.g., rain affecting both commute and a declared activity), the coordinator merges them into a single, combined insight rather than surfacing two separate notes about the same rain event.

**Null Context Fallback**
When context is absent or incomplete, modules fall back to Layer 2 (Environmental Context) quality output — still action-connected, still human-meaningful, just not personalized. The fallback is never "no insight" for conditions that warrant one.

### Required Data

- Full weather data object (current conditions + hourly forecast + 7-day forecast)
- Full user context object from `useUserContext` (Phase 3.1 dependency)
- Current timestamp (for timing calculations)
- Insight schema definition (types, urgency levels, output fields)

### Technical Requirements

- Each insight module must be a pure function (no side effects, no direct store access)
- Modules must be independently testable in isolation with mock weather data and mock context objects
- `useInsightEngine` must be reactive — re-runs when weather data or context changes
- The `Insight` type must be formally defined and enforced (JSDoc typedef at minimum)
- Insight content strings are generated by modules as templates with variable substitution — they are not hardcoded sentences
- The coordinator must enforce the mandatory insight gate: every insight must have a non-empty `actionPath` field, or it is rejected before output

### Dependencies

- Phase 3.1 (Context Foundation) must be complete — the Decision Engine is useless without context input
- Existing weather data store (Pinia) must expose a clean, typed weather data object consumable by insight modules
- Existing `useWeatherFormatters.js` and `useWeatherIcons.js` composables are available for data normalization within modules

### Success Criteria

- Each insight module can be tested in isolation with 100% of its logic covered by unit tests
- The coordinator never surfaces an insight with an empty `actionPath`
- Sensitivity-adjusted thresholds produce measurably different urgency outputs compared to default thresholds, verifiable in tests
- Deduplication ensures that a scenario with rain + cyclist user + declared morning ride produces one combined insight, not three separate rain references
- The engine runs in under 50ms for a full insight set on a mid-range mobile device

### MVP Boundary

**Must ship in Phase 3.2:**
- Insight type definition and schema
- Urgency engine with sensitivity adjustment
- Modules for: daily planning, comfort optimization, commute (declared routine required)
- `useInsightEngine` coordinator
- Null context fallback for all modules

**Can wait:**
- Activity-specific modules beyond the core set (Phase 3.3 will surface them)
- Behavioral signal weighting of insight ranking (Phase 3.4)
- Environmental expansion modules — pollen, air quality (Phase 3.5)


---

## 5. Phase 3.3 — Personal Weather Briefings

### Vision

Phase 3.3 is where the intelligence becomes visible. With context collected (3.1) and reasoning built (3.2), this phase connects the Decision Engine to the surfaces users already interact with — transforming existing cards from data displays into personal briefings.

This is the phase users will notice. The Morning Briefing card goes from "here are the weather numbers for today" to "here is what today means for you." The Activity Recommendations card stops showing generic outdoor activity options and starts reflecting what this specific user actually does. Alerts become personal rather than meteorological.

### User Value

A user who has completed a profile and opens LumiCast in the morning receives:
- A morning briefing that answers "what do I need to know for my day?" without interpretation effort
- An activity status that tells them whether their usual activity is viable today and, if not, when it will be
- Commute guidance that accounts for their mode of transport, their departure time, and what conditions they will actually encounter
- A clothing/preparation recommendation that accounts for humidity, wind, and their sensitivity profile — not just raw temperature

### Features

**Morning Briefing Card — Phase 3 Upgrade**
The existing `MorningBriefingCard.vue` is upgraded to consume insights from `useInsightEngine` rather than deriving its own content from raw weather data. Output hierarchy:
1. Lead insight: the single most important thing for the user's morning (commute alert, extreme condition, or best activity window)
2. Supporting insight: the second-most relevant item (day shape, comfort note, or preparation reminder)
3. Confirmation: if conditions are benign, a clean "clear day" confirmation is still surfaced — absence of bad news is news

The card never surfaces more than three insights. Specificity over comprehensiveness.

**Activity Recommendations Card — Phase 3 Upgrade**
The existing `ActivityRecommendationsCard.vue` is upgraded to use declared activities from the context store as its primary input rather than a generic activity catalogue. For each declared activity:
- Status: Good / Marginal / Not recommended (derived from activity sensitivity profile + current forecast)
- Best window: The optimal 2–3 hour window within the next 12 hours for that activity
- Single-line reason: Why the status is what it is ("wind too strong for comfortable cycling" not a weather report)

Activities not declared by the user are not shown. The card is empty-state handled gracefully for users with no declared activities, with a prompt to add activities to their profile.

**Weather Risk Alerts Card — Phase 3 Upgrade**
The existing `WeatherRiskAlertsCard.vue` is upgraded to apply sensitivity-adjusted thresholds from the Urgency Engine. A heat alert at 36°C appears for a heat-sensitive user. The same temperature produces a Useful-level note for a standard user. Alert content includes the specific action the user should take — not just the condition.

**Best Time Card — Phase 3 Upgrade**
The existing `BestTimeCard.vue` is upgraded to derive its "best time" from the activity module rather than a generic comfort calculation. For a declared runner, "best time" means optimal running conditions. For a declared gardener, it means optimal gardening conditions. For a user with no activities declared, it falls back to the general comfort-optimized window.

**Notification Delivery**
Insights marked for proactive delivery (based on user notification preferences) are dispatched through the existing `useWeatherNotifications.js` composable, upgraded to accept typed `Insight` objects rather than raw strings. Notification content is the insight's `content` field. Notification timing is the insight's `timing` field.

### Required Data

- Insight set from `useInsightEngine` (Phase 3.2 dependency)
- User context from `useUserContext` (Phase 3.1 dependency)
- Existing weather store data (unchanged)
- Notification permission state (existing `useWeatherNotifications.js`)

### Technical Requirements

- All upgraded cards must remain backwards-compatible: if context is absent, they fall back to their pre-Phase-3.3 behavior, not to an error state
- Card content must be derived from `Insight` objects — no card may contain its own weather reasoning logic after this phase
- Morning Briefing card must surface its lead insight within 200ms of the insight engine completing its run
- Notification content must pass the same mandatory gate as all insights: non-empty `actionPath` required
- Cards must handle loading states gracefully — if the insight engine has not completed, cards show the existing skeleton loading state, not empty content

### Dependencies

- Phase 3.1 (Context Foundation) — profile data drives all personalization
- Phase 3.2 (Decision Engine) — insight objects are the input for all card upgrades
- Phase 2.6 (Visual Polish) — design token system is required for any new UI elements within cards

### Success Criteria

- A user with a complete profile receives a morning briefing that does not repeat any data already visible on the dashboard
- A user who declares cycling as an activity sees a cycling-specific status on the Activity Recommendations card, not a generic outdoor activity rating
- An alert triggered for a heat-sensitive user at 33°C is not surfaced for a standard user at the same temperature
- The morning briefing for a day with no significant weather concerns reads as a clean confirmation, not as empty content
- A user can configure which briefing components they receive notifications for, and those preferences are respected

### MVP Boundary

**Must ship in Phase 3.3:**
- Morning Briefing card upgrade (lead insight + supporting insight + confirmation)
- Activity Recommendations card upgrade (declared activities with status + best window)
- Risk Alerts card upgrade (sensitivity-adjusted thresholds)
- Best Time card upgrade (activity-aware)
- Notification delivery via typed Insight objects

**Can wait:**
- WeatherCopilot upgrade to use Decision Engine context (can follow in a 3.3.x patch)
- 7-day forward-looking briefing surface (Phase 3.4+)
- Proactive pre-departure alert (Phase 3.4)


---

## 6. Phase 3.4 — Adaptive Intelligence

### Vision

Phases 3.1–3.3 deliver personalized intelligence based on what the user tells Lumi. Phase 3.4 makes Lumi smarter over time based on how the user actually behaves — without ever crossing the line into surveillance or assumption.

The adaptation is narrow and purposeful: Lumi observes which intelligence areas the user engages with, which insight types the user acts on, and when the user opens the app relative to their declared routines. These signals are used to improve insight ranking and timing — not to change what Lumi says, and not to infer facts about the user that they haven't declared.

The governing principle from the Context Model applies throughout: behavioral signals influence silently. They never become declarations.

### User Value

After several weeks of regular use, the user notices:
- The most relevant insight tends to appear first without them having to scroll
- Morning briefings arrive at the right moment — before the decision they're relevant to, not after
- Insight areas the user consistently ignores gradually depersonalize (fall back to general quality) while the areas they engage with become more prominent
- Lumi occasionally surfaces a suggestion to update a routine or preference when behavioral patterns diverge from declared context — but always as a question, never as a unilateral update

### Features

**Behavioral Signal Collector**
A lightweight, privacy-respecting event logger that records:
- App open timestamps (no content, no location — only timing)
- Insight engagement events (which insight type was acted on, not the content)
- Card interaction patterns (which cards the user expands or scrolls past)

All signals are stored locally. The 90-day retention window from the Context Model is enforced automatically. No signal is transmitted off-device.

**Signal Weighting in the Insight Coordinator**
`useInsightEngine` is updated to accept a `signalWeights` input derived from the behavioral signal store. Signal weights adjust the ranking of insights within a given urgency tier — they do not change urgency levels, and they do not change insight content. A cycling insight ranks higher in the morning briefing if the user has consistently engaged with cycling insights, even if they haven't updated their profile.

**Proactive Pre-Departure Alert**
Using the declared departure time and behavioral app-open patterns together, Lumi delivers a single pre-departure notification timed to arrive approximately 30 minutes before the user's declared departure time on weekday mornings. The notification surfaces the lead morning insight — the single most relevant thing for their commute or morning activity window. This is the only proactive timing optimization Lumi makes automatically. Users can adjust or disable it from their notification preferences.

**Routine Refinement Suggestions**
When behavioral signals diverge consistently from declared context (e.g., the user's app-open pattern suggests they leave earlier than their declared departure time), Lumi surfaces a non-intrusive suggestion within the profile section: "Your recent app usage suggests you might be leaving earlier than 8 AM — want to update your departure time?" The user can accept, dismiss, or ignore. No automatic update is made.

**Insight Relevance Fade**
Intelligence areas the user has not engaged with in 60 days of regular use are deprioritized — their insights continue to be generated by the Decision Engine but rank lower in the coordinator output. The user can always re-enable an area at full priority from their preferences. This is not suppression — it is relevance-aware ranking.

### Required Data

- Behavioral signals from the local signal store (app open times, insight engagement, card interactions)
- Declared context from `useUserContext` — behavioral signals are always compared against declared context, never interpreted in isolation
- Insight set from `useInsightEngine` (for ranking input)
- 90-day signal window (enforced by store, not by the ranking function)

### Technical Requirements

- Signal collection must be opt-in — users must have notification preferences enabled for any signal collection to begin. A user who has opted out of all intelligence notifications does not have their behavior tracked
- Signal store must be auditable by the user — they can view what signals have been recorded and delete them independently of the full context reset
- Signal weighting must not alter urgency levels — an Alert-level insight remains Alert regardless of signal weight
- Routine refinement suggestions appear at most once per divergent pattern per 30 days — no repeated nudging
- Pre-departure alert must be suppressible per-day (snooze) and permanently disableable

### Dependencies

- Phase 3.3 (Personal Weather Briefings) must be complete — adaptive intelligence improves existing intelligence; it does not introduce new intelligence surfaces
- Phase 3.1 context store must support a behavioral signals tier (separate from persistent and session memory)

### Success Criteria

- A user who consistently engages with cycling insights sees cycling ranked first in their activity card within 2 weeks of regular use
- A user who never opens the environmental awareness section sees it deprioritized after 60 days without a manual preference change being required
- Pre-departure alerts arrive within a ±5 minute window of the intended timing
- Routine refinement suggestions are surfaced fewer than once per month per pattern, and never for a pattern that has been active for fewer than 14 days
- Signal store contents are viewable and deletable by the user in under 3 taps from the profile screen

### MVP Boundary

**Must ship in Phase 3.4:**
- Behavioral signal collector (app open timing, insight engagement)
- Signal weighting in insight coordinator
- Pre-departure alert with configurable timing
- 90-day retention enforcement

**Can wait:**
- Routine refinement suggestions (can ship as a 3.4.x follow-on after signal quality is validated)
- Insight relevance fade (requires sufficient signal history — ship after 60-day data window is meaningful)
- Wearable integration (Phase 3.5+)


---

## 7. Phase 3.5 — Environmental Intelligence Expansion

### Vision

Phases 3.1–3.4 have built a personal environmental intelligence system grounded in atmospheric weather data. Phase 3.5 expands what "environmental" means — adding intelligence about conditions that affect daily life but are not traditional weather variables: air quality, pollen, UV index as a health signal (not just a number), and the positive dimensions of environmental awareness (optimal conditions for outdoor experiences, not only warnings).

This phase also introduces the first external data integrations beyond the core weather API: air quality index feeds and pollen count data where available. Both are optional enhancements — the intelligence degrades gracefully when the data is unavailable for a given location.

### User Value

A user with declared respiratory sensitivity begins receiving air quality guidance calibrated to their threshold, not a population average. A user who declared pollen sensitivity starts seeing pollen-aware activity windows — Lumi knows that a high-pollen Tuesday morning is not a good time for their outdoor run, even if the temperature and wind are perfect. And for users without specific sensitivities, Phase 3.5 adds the ambient enrichment tier — surfacing positive environmental moments worth knowing about: exceptional visibility, perfect golden hour conditions, a cool clear morning after a hot week.

### Features

**Air Quality Intelligence Module**
A new Decision Engine module that ingests AQI data and applies the sensitivity-adjusted thresholds from the Context Model. For sensitive users: alerts at AQI ≥ 100. For standard users: heads-up at AQI ≥ 150, alert at AQI ≥ 200. Insight format: "[Condition] — [specific recommendation]." Never a raw number without context. "Air quality is poor this morning — outdoor exercise is not recommended" not "AQI is 142."

**Pollen Intelligence Module**
A new Decision Engine module that ingests pollen count data (where available from API) and applies it specifically to activity windows for users with declared pollen sensitivity. The module cross-references pollen levels with the user's declared outdoor activity windows — it does not surface pollen data outside the context of activities the user actually does.

**UV Intelligence Upgrade**
The existing UV surface (already present in some cards) is upgraded from a data display to an action-connected insight. UV index alone is not surfaced — only when it crosses a meaningful threshold relative to the user's declared sensitivity and planned outdoor time. "UV peaks between 11 AM and 2 PM today — apply sunscreen before your lunchtime walk" not "UV index: 7."

**Environmental Awareness Insights — Positive Tier**
The ambient urgency tier from the Philosophy document gets its first dedicated content: positive environmental conditions worth noting. These are low-priority, enrichment-only insights — they appear at the bottom of the insight set and are never delivered as notifications unless explicitly opted in. Examples:
- "Exceptional visibility today — great conditions for photography or a scenic drive."
- "First cool morning in two weeks — a good day to open the windows."
- "Tonight is clear and moonless — ideal for stargazing."

These insights are generated only when conditions are meaningfully above the user's normal environmental baseline — not on ordinary clear days.

**Expanded Weather Copilot Context**
The WeatherCopilot feature gains access to the full environmental data set (air quality, pollen, UV) so that user-initiated queries can include these dimensions. The Copilot does not proactively surface these as conversation starters — it answers questions about them when asked. This is the one deliberate exception to Lumi's non-conversational model, handled as a user-initiated information request, not as Lumi volunteering environmental data.

### Required Data

- Air quality index feed (external API integration — graceful fallback if unavailable)
- Pollen count data (external API integration — graceful fallback; availability is location-dependent)
- UV index data (already available in most weather API responses — upgrade to insight rather than new data source)
- Environmental baseline: historical normal ranges for the user's location (to determine when conditions are "exceptional" vs. ordinary)
- Full user context from `useUserContext`, specifically sensitivity declarations and activity windows

### Technical Requirements

- External data sources (AQI, pollen) must be abstracted behind a data adapter layer — the intelligence modules never call external APIs directly, and swapping a data provider requires no changes to the module logic
- All new modules must follow the same interface contract as Phase 3.2 modules: pure functions, typed `Insight` output, null when no insight is warranted
- Environmental baseline calculation must be stable — it should not trigger positive enrichment insights for conditions that are only marginally above average. The threshold for "exceptional" must be defined per condition type and documented
- Graceful degradation when AQI or pollen data is unavailable: the module returns null (no insight) rather than a degraded or speculative insight
- Positive enrichment insights must never appear at Heads-up or Alert urgency — they are Ambient tier only

### Dependencies

- Phase 3.2 (Decision Engine) — new modules plug into the existing coordinator
- Phase 3.1 (Context Foundation) — sensitivity declarations are required for threshold calibration
- Phase 3.3 (Personal Weather Briefings) — new insight types appear in existing card surfaces
- External API selection and key management (separate infrastructure concern outside the intelligence system)

### Success Criteria

- An AQI insight for a respiratory-sensitive user triggers at AQI 100 and reads as an action-connected recommendation, not a data point
- A pollen insight surfaces only during the user's declared outdoor activity window on high-pollen days, not as a standalone alert throughout the day
- Positive enrichment insights appear no more than twice per week for any single user — the bar for "exceptional" is high enough that they remain meaningful
- When AQI or pollen data is unavailable for a location, the cards render cleanly without error states or placeholder data
- UV insights never surface as standalone data — they always include a specific action recommendation tied to the user's time of day and declared activities

### MVP Boundary

**Must ship in Phase 3.5:**
- Air quality intelligence module with sensitivity-adjusted thresholds
- UV intelligence upgrade (action-connected, not data display)
- External data adapter layer for AQI

**Can wait:**
- Pollen intelligence module (data availability is location-dependent — ship when API coverage is validated)
- Positive enrichment tier (can ship as a 3.5.x follow-on after core environmental modules are stable)
- WeatherCopilot context expansion (can ship in a 3.5.x patch without blocking core 3.5 release)
- Wearable and sensor integration (future — defined in Context Model Section 7.5)
- Calendar integration (future — defined in Context Model Section 7.1)


---

## 8. MVP Boundaries Summary

This section consolidates the MVP decisions across all phases into a single reference. It answers two questions: what must be built first, and what must wait.

### What Must Be Built First

The following capabilities are prerequisites for everything else. Without them, Phase 3 produces generic output that does not justify its complexity.

| Capability | Phase | Why It Cannot Wait |
|---|---|---|
| Context store with persistent memory | 3.1 | Every intelligence function requires context input |
| `useUserContext` composable | 3.1 | Intelligence modules consume this — they cannot exist without it |
| Profile setup: location + departure time + activities | 3.1 | These three inputs produce the highest-impact personalization |
| Sensitivity declarations | 3.1 | Required for urgency threshold calibration in all modules |
| Insight type schema | 3.2 | All modules and cards share this contract |
| Urgency engine with sensitivity adjustment | 3.2 | Threshold calibration is safety-relevant for sensitive users |
| Daily planning + comfort + commute modules | 3.2 | These cover the highest-frequency intelligence needs |
| Morning Briefing card upgrade | 3.3 | The primary daily intelligence surface |
| Activity Recommendations card upgrade | 3.3 | The primary demonstration of personalization value |
| Risk Alerts sensitivity adjustment | 3.3 | The highest-consequence intelligence output |

### What Must Wait

The following capabilities have clear value but introduce scope, complexity, or data dependencies that make them unsuitable for the Phase 3 MVP.

| Capability | Waiting For | Reason |
|---|---|---|
| Behavioral signal collection | Phase 3.4 | Requires validated Phase 3.3 intelligence to be worth adapting |
| Pre-departure adaptive timing | Phase 3.4 | Requires behavioral signal baseline (minimum 2 weeks of data) |
| Routine refinement suggestions | Phase 3.4+ | Requires 14+ days of signal history to avoid false positives |
| Air quality intelligence | Phase 3.5 | Requires external API integration + adapter layer |
| Pollen intelligence | Phase 3.5+ | Data availability is location-dependent; validate coverage first |
| UV as standalone enrichment | Phase 3.5 | Acceptable as a data display until action-connected upgrade is ready |
| Calendar integration | Future | High infrastructure cost; defined in Context Model for future phases |
| Multi-person household profiles | Future | Scope expansion; primary user model must be stable first |
| Wearable/sensor integration | Future | Requires external partnerships and device APIs beyond current scope |
| Cloud sync | Future | Local-first principle holds until multi-device use case is validated |
| Travel mode intelligence | Future | Defined in Context Model; builds on stable primary context model |

### The Minimum Experience

A user who completes the MVP (Phases 3.1–3.3) should experience:

1. A profile setup that takes under 3 minutes and immediately improves the quality of their daily briefing
2. A morning briefing that tells them what the weather means for their day — not what the weather is
3. Activity recommendations that know what they do and tell them whether today is a good day to do it
4. Risk alerts that are calibrated to their body and sensitivities, not to population defaults
5. A notification experience that respects their preferences — never more than useful, never less than important

That is the version of Lumi that earns user trust. Everything in Phases 3.4 and 3.5 builds on that trust to go further.


---

## 9. Lumi Principles Compliance Checklist

Every implementation decision in Phase 3 should be evaluated against the core principles established in the two foundation documents. This checklist is the practical form of that evaluation.

**Weather is the foundation, not the destination.**
- [ ] Does this feature produce output that goes beyond displaying weather data?
- [ ] Would a user need to interpret a weather number to act on this output?
- [ ] If yes to the second question, the feature is not complete.

**Every insight must answer "what should the user do?"**
- [ ] Does the output include a specific, actionable recommendation?
- [ ] Is the recommendation connected to something this specific user actually does?
- [ ] Is the `actionPath` field populated in the `Insight` object?
- [ ] If any answer is no, the insight is not ready to ship.

**Avoid chatbot behavior.**
- [ ] Does this feature ask the user a question? (Only acceptable in WeatherCopilot, user-initiated.)
- [ ] Does this feature engage in back-and-forth dialogue? (Not acceptable anywhere.)
- [ ] Does this feature use generic AI language? ("Based on current conditions..." is acceptable. "Great question!" is not.)
- [ ] If any answer is yes to the first two, redesign the feature.

**Avoid unnecessary data collection.**
- [ ] Is every context field collected in this phase actively used by an existing intelligence function?
- [ ] Would removing this field degrade any current intelligence output?
- [ ] Is the user told why this data makes Lumi better for them?
- [ ] If the answer to the first two is no, the field should not be collected.

**Respect the intelligence hierarchy — do not skip layers.**
- [ ] Does this feature start from raw weather data (Layer 1)?
- [ ] Does it pass through environmental interpretation (Layer 2) before personalization (Layer 3)?
- [ ] Does it produce a recommendation (Layer 4) before framing it for delivery (Layer 5)?
- [ ] If any layer is bypassed, the output quality will be lower than it should be.

---

## 10. Cross-Phase Dependencies Map

```
Phase 2.6 (Complete)
  └── Design system, token architecture, component polish
        ↓
Phase 3.1 — Context Foundation
  ├── Context store (localStorage, reactive, versioned)
  ├── useUserContext composable
  ├── Profile setup UI
  └── Preference + sensitivity declarations
        ↓
Phase 3.2 — Decision Engine
  ├── Insight type schema
  ├── Insight modules (daily planning, comfort, commute, activity, routine)
  ├── Urgency engine
  └── useInsightEngine coordinator
        ↓
Phase 3.3 — Personal Weather Briefings
  ├── MorningBriefingCard upgrade
  ├── ActivityRecommendationsCard upgrade
  ├── WeatherRiskAlertsCard upgrade
  ├── BestTimeCard upgrade
  └── Notification delivery via Insight objects
        ↓
Phase 3.4 — Adaptive Intelligence
  ├── Behavioral signal collector
  ├── Signal weighting in coordinator
  ├── Pre-departure alert
  └── Routine refinement suggestions (3.4.x)
        ↓
Phase 3.5 — Environmental Intelligence Expansion
  ├── External data adapter layer
  ├── Air quality module
  ├── UV intelligence upgrade
  ├── Pollen module (3.5.x)
  └── Positive enrichment tier (3.5.x)
```

No phase can begin implementation until all phases above it in this graph are complete and validated.

---

*LumiCast Intelligence Roadmap v1.0 — Phase 3 Foundation*
*This document governs implementation sequencing for all Phase 3 development.*
*Read in conjunction with `LUMI_INTELLIGENCE_PHILOSOPHY.md` and `LUMI_MEMORY_AND_CONTEXT_MODEL.md`.*
*Changes to phase sequencing require review against the cross-phase dependency map in Section 10.*
*Changes to MVP boundaries require review against the principles compliance checklist in Section 9.*
