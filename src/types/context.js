/**
 * @file context.js
 * LumiCast context system type definitions.
 * JSDoc typedefs only — zero runtime code, zero exports.
 * Import in other files via:  /** @type {UserContext} *\/
 */

/**
 * @typedef {'full'|'partial'|'minimal'|'none'} ContextQuality
 */

/**
 * @typedef {'ambient'|'useful'|'heads-up'|'alert'} UrgencyLevel
 */

/**
 * @typedef {'running'|'cycling'|'hiking'|'gardening'|'photography'|'golf'|'outdoor-dining'|'dog-walking'|'swimming'|'sailing'} ActivityKey
 */

/**
 * @typedef {'temperature'|'feelsLike'|'humidity'|'windSpeed'|'gustSpeed'|'precipitation'|'uvIndex'|'visibility'|'airQuality'|'pollen'} WeatherVariable
 */

/**
 * @typedef {'declared'|'inferred'} ContextConfidence
 */

/**
 * @typedef {'daily'|'several-weekly'|'occasional'|'seasonal'} ActivityFrequency
 */

/**
 * @typedef {'urban'|'suburban'|'rural'} LocationType
 */

/**
 * @typedef {'granted'|'denied'|'not-requested'} GpsPermissionState
 */

/**
 * @typedef {'high'|'medium'|'low'} InsightConfidence
 */

/**
 * @typedef {'daily-planning'|'comfort'|'commute'|'activity'|'routine-adapt'|'risk-alert'|'environmental'|'ambient'} InsightType
 */

/**
 * Threshold set: a map of WeatherVariable to min/max range.
 * @typedef {Object.<WeatherVariable, {min?: number, max?: number}>} ThresholdSet
 */

/**
 * @typedef {Object} ActivitySensitivityProfile
 * @property {WeatherVariable[]} primaryVariables - Weather variables this activity is most sensitive to
 * @property {{good: ThresholdSet, marginal: ThresholdSet, notRecommended: ThresholdSet}} thresholds
 */

/**
 * @typedef {Object} SeasonRange
 * @property {number|null} startMonth - 1–12 or null (year-round)
 * @property {number|null} endMonth   - 1–12 or null (year-round)
 */

/**
 * @typedef {Object} DeclaredActivity
 * @property {string}                   id          - Stable identifier
 * @property {ActivityKey}              activityKey - Canonical key from system catalogue
 * @property {string}                   label       - Human display name
 * @property {ActivityFrequency}        frequency
 * @property {SeasonRange|null}         seasonRange - null means year-round
 * @property {ActivitySensitivityProfile} profile   - System-defined, not user-configured
 */

/**
 * @typedef {Object} ActivityContext
 * @property {DeclaredActivity[]} declared
 */

/**
 * @typedef {Object} TimeWindow
 * @property {string}   startTime  - "HH:MM" 24h format
 * @property {string}   endTime    - "HH:MM" 24h format
 * @property {string}   label      - Human label e.g. "Morning run"
 * @property {number[]} daysOfWeek - 0=Sunday … 6=Saturday; empty = all days
 */

/**
 * @typedef {Object} WeekdayRoutine
 * @property {string|null}   departureTime  - "HH:MM" or null
 * @property {string|null}   returnTime     - "HH:MM" or null
 * @property {TimeWindow[]}  outdoorWindows
 */

/**
 * @typedef {Object} WeekendRoutine
 * @property {TimeWindow[]} outdoorWindows
 */

/**
 * @typedef {Object} RoutineContext
 * @property {WeekdayRoutine}    weekday
 * @property {WeekendRoutine}    weekend
 * @property {ContextConfidence} confidence - always 'declared' in Phase 3.1
 */

/**
 * @typedef {Object} SavedLocation
 * @property {string}       id
 * @property {string}       name
 * @property {number|null}  lat
 * @property {number|null}  lon
 * @property {string|null}  timezone   - IANA timezone string
 * @property {LocationType} locationType
 */

/**
 * @typedef {Object} PrimaryLocation
 * @property {string}            name
 * @property {number}            lat
 * @property {number}            lon
 * @property {string}            timezone   - IANA timezone string
 * @property {LocationType}      locationType
 * @property {ContextConfidence} confidence
 */

/**
 * @typedef {Object} CurrentLocation
 * @property {number|null}         lat
 * @property {number}              lon
 * @property {boolean}             isAtPrimary - true if within ~2km of primary
 * @property {GpsPermissionState}  permissionState
 */

/**
 * @typedef {Object} LocationContext
 * @property {PrimaryLocation|null}   primary
 * @property {SavedLocation[]}        saved
 * @property {CurrentLocation|null}   current  - session-only, never persisted
 */

/**
 * @typedef {Object} ManualEvent
 * @property {string}      id
 * @property {string}      label       - e.g. "Outdoor wedding"
 * @property {string}      date        - ISO 8601 date "YYYY-MM-DD"
 * @property {string|null} timeStart   - "HH:MM" or null if all-day
 * @property {string|null} timeEnd
 * @property {boolean}     isOutdoor
 * @property {string|null} locationId  - references SavedLocation.id or null for primary
 */

/**
 * @typedef {Object} ScheduleContext
 * @property {ManualEvent[]} manualEvents
 * @property {boolean}       calendarConnected - always false in Phase 3.1
 */

/**
 * @typedef {Object} NotificationPreferences
 * @property {boolean} enabled
 * @property {boolean} commute
 * @property {boolean} morningBriefing
 * @property {boolean} activityAlerts
 * @property {boolean} riskAlerts
 * @property {boolean} preDeparture    - Phase 3.4; default false
 * @property {boolean} ambient         - Phase 3.5; default false
 */

/**
 * @typedef {Object} IntelligenceAreaPreferences
 * @property {boolean} dailyPlanning
 * @property {boolean} activityRecommend
 * @property {boolean} commuteIntelligence
 * @property {boolean} routineAdaptation
 * @property {boolean} environmentalAware  - Phase 3.5; default false
 */

/**
 * @typedef {Object} IntelligencePreferences
 * @property {boolean} behavioralLearning - Phase 3.4; enables local signal collection
 *                                          and insight ranking adaptation. Default true.
 *                                          Separate from notification.enabled — learning
 *                                          works silently without notifications.
 */

/**
 * @typedef {Object} PreferenceContext
 * @property {'C'|'F'}                    temperatureUnit
 * @property {'dark'|'light'}             theme
 * @property {'concise'|'extended'}       verbosity
 * @property {NotificationPreferences}    notifications
 * @property {IntelligenceAreaPreferences} intelligenceAreas
 * @property {IntelligencePreferences}    intelligence
 */

/**
 * @typedef {Object} SensitivityContext
 * @property {boolean} heat
 * @property {boolean} cold
 * @property {boolean} pollen
 * @property {boolean} uv
 * @property {boolean} airQuality
 * @property {boolean} precipitation
 */

/**
 * @typedef {Object} ContextCompleteness
 * @property {boolean} hasLocation
 * @property {boolean} hasRoutine
 * @property {boolean} hasActivities
 * @property {boolean} hasSensitivities
 * @property {boolean} hasPreferences
 */

/**
 * @typedef {Object} ContextMeta
 * @property {string}              schemaVersion
 * @property {number}              createdAt       - Unix timestamp ms
 * @property {number}              lastModifiedAt  - Unix timestamp ms
 * @property {ContextCompleteness} completeness
 * @property {ContextQuality}      contextQuality
 */

/**
 * Root context object. Returned by useUserContext().
 * @typedef {Object} UserContext
 * @property {LocationContext}    location
 * @property {RoutineContext}     routines
 * @property {ActivityContext}    activities
 * @property {ScheduleContext}    schedule
 * @property {PreferenceContext}  preferences
 * @property {SensitivityContext} sensitivities
 * @property {ContextMeta}        meta
 */

/**
 * @typedef {Object} BehavioralSignal
 * @property {'app-open'|'insight-engage'|'card-scroll'|'card-expand'} type
 * @property {number} timestamp - Unix timestamp ms
 * @property {Object} metadata
 * @property {string} [metadata.insightType] - for 'insight-engage'
 * @property {string} [metadata.cardId]      - for card interaction events
 */

/**
 * @typedef {Object} SignalStore
 * @property {string}             schemaVersion
 * @property {BehavioralSignal[]} signals
 */

/**
 * Normalized current weather conditions for intelligence modules.
 * @typedef {Object} CurrentWeatherData
 * @property {number}      temp        - Celsius
 * @property {number}      feelsLike   - Celsius
 * @property {number}      humidity    - 0–100
 * @property {number}      windSpeed   - km/h
 * @property {number}      gustSpeed   - km/h
 * @property {number}      uvIndex     - 0–11+
 * @property {string}      condition   - normalized key from resolveWeatherIconKey()
 * @property {number}      visibility  - km
 * @property {number}      precipProb  - 0–1
 * @property {number|null} airQuality  - AQI 0–300 (normalized from EU scale), null when unavailable
 * @property {string|null} pollenLevel - 'low'|'moderate'|'high'|'very-high'|null when unavailable
 */

/**
 * A single hourly forecast point (from weatherNormalizer).
 * @typedef {Object} HourlyPoint
 * @property {number} dt
 * @property {string} dt_txt
 * @property {{temp: number, feels_like: number, humidity: number}} main
 * @property {{speed: number, deg: number}} wind
 * @property {number} visibility
 * @property {number} pop
 * @property {{main: string, description: string, icon: string}[]} weather
 */

/**
 * A single daily forecast summary (from weatherNormalizer).
 * @typedef {Object} DailyPoint
 * @property {string} date
 * @property {number} dt
 * @property {number} minTemp
 * @property {number} maxTemp
 * @property {string} dominantCondition
 * @property {number} totalRainfall
 * @property {{main: string, description: string, icon: string}[]} weather
 */

/**
 * Normalized weather data object consumed by intelligence modules (Phase 3.2+).
 * @typedef {Object} WeatherData
 * @property {CurrentWeatherData} current
 * @property {HourlyPoint[]}      hourly
 * @property {DailyPoint[]}       daily
 * @property {number}             fetchedAt  - Unix timestamp ms
 * @property {{lat: number, lon: number}} location
 */

/**
 * Insight timing metadata.
 * @typedef {Object} InsightTiming
 * @property {number|null} windowStart - Unix timestamp ms; null = now
 * @property {number|null} windowEnd   - Unix timestamp ms; null = open-ended
 * @property {boolean}     notify      - whether to push a notification
 * @property {number|null} notifyAt    - Unix timestamp for scheduled notification
 */

/**
 * Source context flags — which context categories influenced this insight.
 * @typedef {Object} InsightSourceContext
 * @property {boolean} usedLocation
 * @property {boolean} usedRoutine
 * @property {boolean} usedActivity
 * @property {boolean} usedSensitivity
 */

/**
 * Structured insight object — output of all intelligence modules (Phase 3.2+).
 * actionPath MUST be non-empty — this is the mandatory gate.
 * @typedef {Object} Insight
 * @property {string}              id
 * @property {InsightType}         type
 * @property {string|undefined}    subtype     - optional; used by environmental modules
 *                                               e.g. 'uv', 'air-quality', 'pollen'
 * @property {UrgencyLevel}        urgency
 * @property {InsightTiming}       timing
 * @property {string}              content     - rendered insight text
 * @property {string}              actionPath  - REQUIRED non-empty: what user should do
 * @property {InsightConfidence}   confidence
 * @property {InsightSourceContext} sourceContext
 */
