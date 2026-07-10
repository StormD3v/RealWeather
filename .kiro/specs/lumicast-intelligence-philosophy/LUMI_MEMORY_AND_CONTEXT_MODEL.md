# LumiCast Memory and Context Model
## How Lumi Understands the Person Behind the Weather
### Phase 3 Foundation Document · v1.0

*Companion document to `LUMI_INTELLIGENCE_PHILOSOPHY.md`.*
*This document defines Layer 3 (Personal Context) of Lumi's Intelligence Hierarchy in full detail.*

---

## 1. What User Context Means in LumiCast

In the Intelligence Hierarchy, Layer 3 is where environmental interpretation becomes personal. Without this layer, Lumi can tell any user that the afternoon will feel hot and sticky — but it cannot tell *this* user that today is a bad day for their usual lunchtime run, that they should leave earlier to beat the storm before their commute, or that the weekend forecast is actually good for the garden work they've been deferring.

Context is the information that makes the difference between a useful answer and the right answer.

In LumiCast, **user context** is defined as:

> The complete, structured body of knowledge about a specific person — their location, patterns, preferences, sensitivities, and plans — that Lumi uses to transform general environmental intelligence into personal guidance.

Context is not profile data. Profile data is a file. Context is a live, layered understanding that combines what the user has declared, what Lumi has inferred from patterns, and what the current moment implies. A user's "commute time" declared in their profile is profile data. The fact that it is currently 7:45 AM on a Tuesday, that rain starts in 40 minutes, and that the user's commute mode is cycling — that combination is context in action.

The fundamental rule governing everything in this document:

> **Context is a tool for serving the user better, not a data asset to be collected, retained, or leveraged beyond that purpose.**

---

## 2. Context Categories

Lumi understands six categories of personal context. Each category has a different nature (declared vs. inferred), a different update frequency (static vs. real-time), and a different role in the reasoning pipeline. They are described below in order from most concrete to most nuanced.

---

### 2.1 Location Context

Location is the most fundamental context in a weather application — it determines which atmospheric data is relevant in the first place.

**What it includes:**

- **Primary location**: The user's home or base location. Used as the default for all morning and planning intelligence.
- **Saved locations**: Named places the user has explicitly saved (work, a family member's city, a vacation destination). Each can be used as a target for location-aware insights.
- **Current location**: The device's live GPS position, when permission is granted and the user is away from their primary location.
- **Location type metadata**: Whether each saved location is urban, suburban, or rural — relevant because microclimates, commute patterns, and outdoor exposure patterns differ meaningfully.

**How it affects intelligence:**

Location is always the first input to any weather query. It determines data freshness requirements (urban users in rapidly-changing climates need more frequent updates than stable-climate locations), timezone (for time-aware framing of insights), and which location-specific patterns are relevant for a given intelligence request.

When the user is at a non-primary location, Lumi adjusts its context frame entirely — routine-based insights that depend on the user being at home do not apply.

---

### 2.2 Routine Context

Routines are the recurring temporal patterns in a user's life that connect to environmental conditions. They represent the highest-value context for daily planning intelligence — because routines are exactly where weather either cooperates or disrupts.

**What it includes:**

- **Morning departure time**: When the user typically leaves home. Central to commute and preparation intelligence.
- **Typical outdoor windows**: Times of day when the user is regularly outside (lunch walks, after-work runs, school pickup, dog walks). Each window has a day-of-week pattern and a typical duration.
- **Evening return time**: Relevant for forecasting conditions the user will encounter at the end of their day.
- **Weekend vs. weekday profile**: Many users have meaningfully different outdoor exposure on weekends. Lumi distinguishes between them.

**How it affects intelligence:**

Routine context allows Lumi to speak with temporal precision. "You'll likely be outside around 6 PM — that's when the wind picks up tonight" is only possible because Lumi knows the user's evening routine. Without routine context, the insight degrades to "wind increases in the evening" — useful to nobody in particular.

Routines have **confidence weights**: a routine the user declared explicitly has full confidence. A routine Lumi has inferred from behavioral patterns has a lower confidence weight and should not be stated as fact in insights — it should influence ranking and weighting silently, not be surfaced as a declared truth.

---

### 2.3 Activity Context

Activity context defines *what kinds of things the user does outdoors* — distinct from *when* they do them (which is routine context). Activities determine which environmental factors matter and how much.

**What it includes:**

- **Declared activities**: Things the user has explicitly said they do. Examples: running, cycling, hiking, gardening, photography, golf, outdoor dining, dog walking.
- **Activity sensitivity profiles**: Each declared activity has an associated set of environmental thresholds. A runner cares about heat index, humidity, and surface conditions. A cyclist cares about wind speed, gusts, and rain. A gardener cares about frost dates, soil moisture, and sun hours. These profiles are pre-defined by the system, not configured by the user.
- **Activity frequency signal**: Whether an activity is daily, several times a week, occasional, or seasonal. Frequency affects how prominently the activity factors into routine insights.

**How it affects intelligence:**

Activity context is the primary driver of recommendation specificity. The same conditions generate entirely different recommendations for different activity profiles. 25°C with 80% humidity is ideal for a swimming session and miserable for a long run. High wind is a cycling hazard and a sailing opportunity.

Lumi should never assume an activity applies unless the user has declared it or a strong behavioral signal exists. The Activity Recommendation card exists precisely because activities have been declared — it is not a generic suggestion engine.

---

### 2.4 Schedule Context

Schedule context captures the temporal structure of the user's day and week — especially events and commitments that have an outdoor or weather-sensitive dimension.

**What it includes:**

- **Calendar integration** *(future capability)*: External calendar events with location or outdoor context. A "Park run" entry at 9 AM Saturday is high-value schedule context. A "Team meeting" in an office is not.
- **Manually declared events**: The user can flag specific upcoming plans ("I have an outdoor event on Saturday afternoon") that Lumi should factor into its forward-looking intelligence.
- **Time-of-day signal**: Even without explicit schedule data, the current time of day and day of week is implicit schedule context. 6 AM on a weekday implies a different decision context than 6 AM on a Sunday.
- **Seasonal schedule shifts**: Some users have predictable seasonal changes to their patterns (a runner who only runs outdoors between April and October, for example). These should be capturable as schedule context even without calendar integration.

**How it affects intelligence:**

Schedule context is what enables Lumi to give *forward-looking* recommendations — not just "here's what's happening now" but "here's what you should think about for the next 24–48 hours in light of what you have planned." It is the bridge between current conditions and future decisions.

Without schedule context, Lumi can only react to conditions as they approach. With schedule context, Lumi can proactively surface a heads-up 12 hours before a weather event that will affect a known plan — which is where the most valuable environmental intelligence lives.

---

### 2.5 Preference Context

Preference context covers the user's declared and inferred choices about how they want Lumi to communicate with them — the meta-layer of the interaction, distinct from what they do and where they are.

**What it includes:**

- **Temperature unit**: Celsius or Fahrenheit. Applies universally across all surfaces.
- **Notification preferences**: Which types of intelligence the user wants pushed vs. pulled. Some users want proactive commute alerts; others prefer to consult Lumi rather than receive it. Some want morning briefings; others want silence until they ask.
- **Insight verbosity preference**: Whether the user prefers concise one-line guidance or slightly more contextual explanations. Default is concise. Extended explanations are opt-in.
- **Theme preference**: Dark or light mode. Not an intelligence preference, but a declared user preference that Lumi respects as part of the overall experience.
- **Intelligence areas of interest**: Which of Lumi's intelligence domains the user finds valuable. A user who never gardens does not benefit from gardening insights and should not receive them.

**How it affects intelligence:**

Preference context governs the *delivery* of intelligence, not the reasoning behind it. Lumi may generate an identical insight for two users — but deliver it as a notification to one and surface it only in the dashboard for another, based on their preference.

Preferences are always explicitly declared. They are never inferred. Inferring that a user "doesn't like notifications" because they haven't opened recent ones is a guess that could be wrong in consequential ways. Preferences must be set by the user.

---

### 2.6 Environmental Sensitivity Context

Sensitivity context captures the user's individual relationship with specific environmental conditions — the factors where the standard human response does not apply to them, for health, physiological, or personal reasons.

**What it includes:**

- **Heat sensitivity**: Users who are more affected by high temperatures than average (relevant for elderly users, users with cardiovascular conditions, users on certain medications).
- **Cold sensitivity**: Users who need to dress more warmly than average, or who are at risk from mild cold that others tolerate easily.
- **Allergy and pollen sensitivity**: Users who are affected by high pollen counts — relevant for activity recommendations and outdoor timing.
- **UV sensitivity**: Users who burn easily or have medical reasons to avoid sun exposure — raises the threshold for UV-related caution.
- **Air quality sensitivity**: Users with asthma or respiratory conditions for whom poor air quality is a genuine health concern, not just a mild nuisance.
- **Precipitation sensitivity**: Users for whom even light rain is a meaningful deterrent vs. users who are unbothered by rain (affects how Lumi weights rain in activity recommendations).

**How it affects intelligence:**

Sensitivity context directly changes the thresholds at which Lumi escalates from "useful" to "heads-up" to "alert." A heat alert at 36°C is an Alert-level event for a heat-sensitive user and a Useful-level note for a user without heat sensitivity. Surfacing an Alert to someone who doesn't need it erodes trust. Failing to surface an Alert to someone who does is a product failure.

Sensitivities are always declared. They are never inferred from behavioral patterns — the stakes of getting a sensitivity inference wrong are too high. A user who has never triggered a pollen alert has not demonstrated they have no pollen sensitivity; they may simply have never encountered high-pollen conditions.

---

## 3. What Lumi Should Remember

Memory in LumiCast means retaining context across sessions and over time, so that Lumi's intelligence improves with use rather than resetting to a generic baseline every time the user opens the app.

Not all context should be remembered equally. The following framework distinguishes what Lumi retains and how.

### 3.1 Persistent Memory (Explicitly Declared, Retained Indefinitely)

These are things the user has told Lumi directly. They represent **ground truth** — the foundation upon which all personalized intelligence is built.

- Primary location and saved locations
- Declared activities and their frequency
- Declared routines (departure time, outdoor windows)
- Explicitly stated preferences (units, notifications, verbosity)
- Declared environmental sensitivities
- Manually flagged upcoming events

Persistent memory never expires on its own. It is only changed by the user. Lumi does not "drift" its understanding of persistent memory based on inferred signals — if a user declared they run at 6 AM, that remains true until they change it, even if Lumi has no app-open events at 6 AM for several weeks.

### 3.2 Session Memory (Active During a Session, Not Retained)

Session memory is the short-term context Lumi uses during a single app session — relevant state that helps the current interaction but does not need to persist.

- The current screen or card the user is viewing
- Weather queries made during this session
- The forecast data already loaded (avoids re-fetching identical data)
- Interaction state for the WeatherCopilot (conversation history within a session)

Session memory is discarded when the session ends. It is never written to persistent storage.

### 3.3 Behavioral Signals (Inferred, Low-Confidence, Used to Adjust — Not to Conclude)

Behavioral signals are patterns Lumi observes from user interactions over time — not things users have said, but things that can be weakly inferred from what they do.

- App open frequency and timing (signals when the user is most likely planning their day)
- Which cards or insights the user consistently engages with vs. ignores (signals which intelligence areas are valuable to them)
- Whether the user acts on commute-related insights on specific day patterns
- Whether the user regularly opens the app before typical outdoor activity windows

Behavioral signals are always **low-confidence**. They influence how Lumi ranks and prioritizes insights — not what Lumi says. A behavioral signal can cause Lumi to surface an activity-related insight higher in the morning briefing. It cannot cause Lumi to state "you usually run at 6 AM" as a fact, because behavioral signals are not declarations.

Behavioral signals are the one category of memory that has an explicit **data retention window** — they are not retained indefinitely. Signals older than 90 days are not factored into pattern inference, because life patterns change and stale inferences become misleading.

---

## 4. What Lumi Should Never Assume

These are the failure modes on the memory and context side — the inferences Lumi must never make, no matter how much behavioral or contextual data is available. Each one represents a case where being wrong has meaningful negative consequences for the user's trust or wellbeing.

**Never assume a health or sensitivity profile that has not been declared.**
If a user has not stated they have asthma, Lumi does not infer it from the fact that they avoid opening the app on high-pollution days. Health inferences from behavioral patterns are never safe. The cost of a false positive (treating a healthy user as medically sensitive) is an annoying miscalibration. The cost of a false negative (failing to alert a sensitive user) can be genuinely harmful.

**Never assume a schedule from a behavioral pattern alone.**
If a user opens the app at 7:45 AM every weekday, Lumi should not conclude their commute departure is 8 AM and start delivering pre-commute alerts. The pattern is real, but the conclusion is a guess. Schedule intelligence is only activated for explicitly declared or calendar-integrated events.

**Never assume a routine has ended because usage was absent.**
A user who takes a two-week vacation and doesn't open the app has not stopped being a morning runner. Absence of usage is not evidence of a changed routine. Persistent memory does not degrade or expire based on app engagement.

**Never assume a location is permanent.**
When the user's GPS position is different from their primary location, Lumi should not reclassify the primary location. Travel is the most common explanation for a location mismatch. A user in a different city for three days has not moved.

**Never assume the user wants more personalization.**
Some users want a weather app that knows their name. Others want useful, well-designed weather intelligence without a sense that the app is building a model of them. Lumi's context features should not be foregrounded in the UI — the user should experience better intelligence, not the sensation of being profiled. Lumi earns trust by being useful, not by demonstrating how much it remembers.

**Never assume a preference from behavior.**
A user who dismisses five consecutive morning briefing notifications has not indicated they dislike the briefing feature. They may be busy. They may be checking their phone later. They may have simply forgotten they enabled it. Preference changes are always user-initiated.

---

## 5. How Context Affects Recommendations

Context does not add extra information to a recommendation. It *transforms* the recommendation from generic to personal. This section maps each context category to its effect on the intelligence output.

### 5.1 Location → Data Selection and Framing

Location context determines which forecast data is loaded and how insights are time-framed. A user at a coastal location receives wind and humidity insights that would be irrelevant for an inland user in the same country. A user in a tropical climate has no use for frost warnings. Location is the filter applied before any other reasoning happens.

When the user is traveling, all routine-based intelligence is suspended. Lumi operates in "location-aware general mode" — providing the best environmental intelligence it can for the current location without mapping it to the user's home-based patterns.

### 5.2 Routine + Schedule → Timing Precision

The combination of routine and schedule context is what enables Lumi to speak in specific time windows rather than general forecasts. Without them, Lumi says "rain in the afternoon." With them, Lumi says "rain starts around 3 PM — that's after your usual departure time, so no impact on your commute, but bring an umbrella if you're heading out again after 5 PM."

Routine and schedule context also determine the *order* in which daily insights are prioritized. Commute-affecting conditions come before general afternoon conditions. Activity-window conditions come before ambient observations.

### 5.3 Activity → Threshold Calibration

Activity context changes the thresholds at which conditions become noteworthy. "Wind at 30 km/h" means nothing without knowing what the user does. For a cyclist, it is a heads-up. For a runner, it is a minor note. For a sailor, it might be the best condition of the week.

Activity context also changes which weather variables matter. A gardener tracks soil moisture and frost probability. A photographer tracks golden hour timing and cloud coverage for diffused light. A runner tracks dew point and heat index more than raw temperature. Lumi applies activity-specific variable weighting before generating recommendations.

### 5.4 Preference → Delivery Calibration

Preference context does not change what Lumi knows or concludes — it changes how and when that conclusion reaches the user. The same insight about tomorrow's rain event is delivered as a proactive notification to a user who has enabled commute alerts, and as a prominent section in the morning briefing to a user who prefers to pull their intelligence. A user who has indicated low interest in activity recommendations will not see them surfaced prominently, even if the conditions are favorable.

Preference context is the final layer applied before output is rendered — the "last mile" of personalization.

### 5.5 Environmental Sensitivity → Urgency Recalibration

Sensitivity context shifts the urgency escalation thresholds described in the Intelligence Philosophy (Section 7.3). Specifically:

| Condition | Default threshold | Sensitivity-adjusted threshold |
|---|---|---|
| Heat (feels-like) | Alert ≥ 40°C | Alert ≥ 33°C for heat-sensitive users |
| UV index | Alert ≥ 8 | Alert ≥ 6 for UV-sensitive users |
| Air quality (AQI) | Alert ≥ 150 | Alert ≥ 100 for respiratory-sensitive users |
| Pollen (high) | Heads-up at high | Heads-up at moderate for allergy-sensitive users |
| Cold (wind chill) | Alert ≤ -15°C | Alert ≤ -5°C for cold-sensitive users |

These thresholds are **not user-configurable** — they are calibrated by the system to appropriate safety margins for each sensitivity type. A user declaring heat sensitivity does not set their own alert threshold. Lumi applies a medically-informed calibration on their behalf.

### 5.6 The Absence of Context

When context is sparse — a new user who has not configured a profile, or a user using Lumi with only location data — Lumi falls back to the best general environmental intelligence it can produce. It does not fabricate personal context, and it does not degrade into raw data display.

The fallback mode produces insights at Layer 2 (Environmental Context) quality: human-meaningful, action-connected, and well-timed — just not personalized. "It'll feel hot this afternoon — good to plan outdoor activity before noon" is a useful insight that requires no personal context at all. As the user adds context, insights become progressively more targeted without the user needing to understand why.

---

## 6. Privacy Principles

Privacy in LumiCast is not a compliance checklist — it is a design principle that shapes every context-related decision from the beginning.

The guiding statement:

> **Lumi earns the right to know more about a user by demonstrating the value of what it already knows. It never demands context. It always explains why context matters.**

### 6.1 Minimum Viable Context

Lumi requests only the context it genuinely uses. A field in the user profile that does not affect any current intelligence feature should not exist — because it sends the signal that the product is collecting data speculatively.

Every context category described in Section 2 has a documented, user-visible reason for existing: "We use your departure time to give you commute-aware forecasts." If that reason disappears, the field disappears.

### 6.2 Local-First Storage

All user context is stored locally on the device by default. It is not sent to external servers unless the user explicitly opts into a feature that requires it (such as cloud sync for multi-device use).

No context data is used for analytics, advertising, or any purpose beyond improving Lumi's intelligence for the individual user.

### 6.3 Transparent Inference

When Lumi uses an inferred pattern (behavioral signal) to influence an insight, it does not pretend that pattern is a fact. It never says "since you usually run at 6 AM..." based on an inference. Inferences are used silently to improve relevance — they are not narrated to the user.

If a user asks Lumi why it surfaced a specific insight, the explanation should reference only declared context ("because you told us you run in the morning") or explicit conditions ("because the forecast shows rain during your declared morning outdoor window").

### 6.4 Graceful Reduction

When a user removes context (deletes a location, disables a routine, removes a sensitivity), Lumi's intelligence degrades gracefully to what is still supported by remaining context. Lumi never "remember" context that has been removed. The reduction takes effect immediately.

### 6.5 No Behavioral Profiling Beyond the App

LumiCast does not cross-reference weather behavior with external data sources. It does not use the user's location history for anything other than determining which forecast data to load. It does not attempt to infer demographic characteristics, health conditions, or socioeconomic status from behavioral patterns.

The context Lumi holds is narrow, purposeful, and entirely in service of making environmental intelligence better for that specific person.

### 6.6 User Ownership

The user owns their context. At any time, they can review what Lumi knows about them, edit it, or delete it entirely. Deletion resets Lumi to the new-user state — no context persists after a full clear. This should be a discoverable, clearly documented capability, not buried in settings.

---

## 7. Future Expansion Possibilities

The context model described in this document is designed to be extended as Lumi's intelligence evolves. These are the directions where expansion is anticipated, along with the principles that should govern each.

### 7.1 Calendar Integration

Connecting to the user's calendar is the single highest-impact expansion for schedule context. It would allow Lumi to detect weather-sensitive events automatically (outdoor events, travel days, early starts) and provide proactive guidance days in advance rather than hours.

**Governing principle:** Lumi reads the calendar to identify weather-sensitive events. It does not read calendar content for any other purpose, and it does not store calendar data — it processes it in-session and stores only the derived event flags it needs.

### 7.2 Learned Routine Refinement

Over time, consistent behavioral signals could be surfaced to the user as suggested routine updates: "We've noticed you usually leave around 7:30 AM on weekdays — want to update your departure time?" This moves inference from silent background influence into a transparent, user-confirmed update to persistent memory.

**Governing principle:** Lumi proposes, the user confirms. No inferred pattern ever becomes persistent memory without explicit user acceptance.

### 7.3 Multi-Person Household Context

A household with children, elderly parents, or multiple people with different sensitivities creates a more complex context model. A parent packing children for school has different needs than an individual commuter. A household with an elderly member has different heat alert thresholds.

**Governing principle:** Multi-person context is always explicitly configured, not inferred. Each person in the profile is a named, opt-in entry with their own sensitivity and routine settings. The "default" user context remains individual.

### 7.4 Seasonal Context Adaptation

User routines and activities shift with seasons in ways that don't require behavioral inference — they can be directly declared. A runner who only runs outdoors from spring through autumn, a gardener whose season runs April to October, a skier whose relevant location changes in winter. Seasonal context profiles would allow Lumi to automatically activate and deactivate relevant intelligence areas based on the calendar.

**Governing principle:** Seasonal context is declared as date ranges, not inferred from engagement. The user says "my running season is March to November." Lumi respects that boundary precisely.

### 7.5 Wearable and Sensor Integration

Future integration with fitness wearables or smart home sensors could provide real-time physiological and environmental data that significantly enriches context: actual body temperature during exercise, indoor air quality, real-time exertion level. This would make comfort and safety intelligence dramatically more precise.

**Governing principle:** Sensor integration is opt-in per device, per data type. Lumi never requests access to data it does not currently use. Sensor data is processed in real-time for intelligence and discarded — it is not stored as part of the context model unless the user explicitly enables logging.

### 7.6 Travel Mode Intelligence

When the user travels to a non-primary location, Lumi currently suspends routine-based intelligence and operates in general mode. A future "Travel Mode" would allow Lumi to apply a lightweight, temporary context profile to a travel destination: "I'll be in London for three days — I'll be walking a lot and have two outdoor events."

**Governing principle:** Travel context is declared per trip, has an explicit start and end date, and does not affect the user's primary context model. It is ephemeral by design.

---

## 8. The Relationship Between Memory and Trust

Context depth is not a goal in itself. It is a means to an end: better, more personally relevant intelligence. The moment a user feels that Lumi knows more about them than feels comfortable — or that Lumi is using what it knows in ways they didn't intend — the intelligence value is overwhelmed by unease.

Lumi evolves from weather intelligence into a personal environmental assistant by being consistently, demonstrably useful with the context it has — not by accumulating more context than it needs.

The progression should feel natural to the user:

1. Lumi gives good general weather intelligence. (No personal context needed.)
2. Lumi gives better insights when the user adds their location and a departure time. (Visible, immediate payoff.)
3. Lumi becomes noticeably more useful when the user declares their activities and sensitivities. (The value of context is experienced, not explained.)
4. Over time, Lumi feels like it genuinely understands the user's day — not because it has a large profile, but because every piece of context it holds is actively used.

At each step, the user should understand why the context makes Lumi better. The product should never ask for information it can't immediately demonstrate the value of.

That is how a weather intelligence system earns the right to be called personal.

---

*LumiCast Memory and Context Model v1.0 — Phase 3 Foundation*
*This document governs all context-aware feature development from Phase 3 forward.*
*Read in conjunction with `LUMI_INTELLIGENCE_PHILOSOPHY.md`.*
*Changes to the context categories in Section 2 require review against the Privacy Principles in Section 6.*
