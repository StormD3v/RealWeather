/**
 * useWeatherNotifications.js — Phase 3.3 upgrade
 *
 * PRIMARY PATH (Phase 3.3+):
 *   Accepts an InsightSet from useInsightEngine().
 *   Respects timing.notify flag per insight (Phase 3.4 will set this to true).
 *   Gates each insight on the appropriate notifications preference:
 *     daily-planning | comfort | environmental → prefs.riskAlerts
 *     commute                                  → prefs.commute
 *     activity                                 → prefs.activityAlerts
 *     routine-adapt                            → prefs.riskAlerts
 *     risk-alert                               → prefs.riskAlerts
 *
 * FALLBACK PATH (preserved from Phase 3.1 — runs when insightSet is empty):
 *   Falls back to the original hourlyForecast scan so users never lose
 *   notifications during the Phase 3.3 transition. This fallback will be
 *   removed in Phase 3.4 when timing.notify is activated.
 *
 * Call signature (backwards-compatible):
 *   scheduleWeatherAlerts(insightSet, hourlyForecast)
 *   — insightSet: Insight[] from useInsightEngine().insights.value
 *   — hourlyForecast: raw hourly array (used only by fallback path)
 *
 * Phase 3.1 call sites that pass (hourlyForecast, userProfile) still work:
 *   If the first arg is an array of non-Insight objects (e.g. raw forecast
 *   slots), it is treated as the hourly fallback, matching old behavior.
 */

import { sendNotification } from '@/utils/notifications'
import { useUserContext } from '@/composables/useUserContext'
import { generateDepartureBrief } from '@/utils/departureBrief'

const scheduledAlertKeys = new Set()

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function getNotificationPrefs() {
    try {
        const { userContext } = useUserContext()
        return userContext.value?.preferences?.notifications ?? null
    } catch {
        return null
    }
}

/**
 * Maps an insight type to the notification preference flag that gates it.
 * @param {string} type
 * @returns {keyof NotificationPreferences}
 */
function insightTypeToPrefsKey(type) {
    if (type === 'commute') return 'commute'
    if (type === 'activity') return 'activityAlerts'
    return 'riskAlerts'
}

// ---------------------------------------------------------------------------
// Primary path — Insight-based notifications
// ---------------------------------------------------------------------------

/**
 * Dispatches notifications for insights that have timing.notify === true.
 * Currently a no-op because timing.notify defaults to false (Phase 3.4 activates it).
 * Wired up now so Phase 3.4 can flip the flag without any composable changes.
 *
 * @param {import('@/types/context.js').Insight[]} insightSet
 * @param {object} prefs - notification preferences from useUserContext
 */
function scheduleInsightAlerts(insightSet, prefs) {
    if (!Array.isArray(insightSet) || insightSet.length === 0) return

    for (const insight of insightSet) {
        // Phase 3.4 gate: timing.notify must be true before we dispatch
        if (!insight?.timing?.notify) continue

        const prefsKey = insightTypeToPrefsKey(insight.type)
        if (!prefs[prefsKey]) continue

        const alertKey = `insight-${insight.id}`
        if (scheduledAlertKeys.has(alertKey)) continue
        scheduledAlertKeys.add(alertKey)

        const notifyAt = insight.timing?.notifyAt
        const delay = notifyAt ? Math.max(0, notifyAt - Date.now()) : 0

        setTimeout(() => {
            sendNotification(
                `LumiCast — ${insight.urgency === 'alert' ? '🔴 Alert' : '⚠️ Heads up'}`,
                `${insight.content}\n${insight.actionPath}`,
                '/favicon.ico'
            )
        }, delay)
    }
}

// ---------------------------------------------------------------------------
// Fallback path — original hourly scan (Phase 3.1 behavior, preserved)
// ---------------------------------------------------------------------------

function getHourTimestamp(slot) {
    if (typeof slot?.dt_txt === 'string' && slot.dt_txt) {
        return new Date(slot.dt_txt.replace(' ', 'T')).getTime()
    }
    if (typeof slot?.dt === 'number') {
        return slot.dt > 1e12 ? slot.dt : slot.dt * 1000
    }
    return Date.now()
}

function getPrecipitationProbability(slot) {
    const raw = slot?.precipitation_probability ?? slot?.precipitationProbability ?? slot?.pop
    const value = Number(raw ?? 0)
    if (!Number.isFinite(value)) return 0
    return value <= 1 ? value * 100 : value
}

function formatAlertTime(slot) {
    const dateValue = typeof slot?.dt_txt === 'string' && slot.dt_txt
        ? slot.dt_txt.replace(' ', 'T')
        : slot?.dt
    const date = new Date(dateValue)
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })
        .replace(/\s/g, '').toUpperCase()
}

/**
 * Original Phase 3.1 hourly scan fallback.
 * Runs only when the primary InsightSet is empty (engine not yet computed).
 *
 * @param {object[]} hourlyForecast
 * @param {object} prefs
 */
function scheduleFallbackAlerts(hourlyForecast, prefs) {
    if (!Array.isArray(hourlyForecast) || hourlyForecast.length === 0) return
    if (!prefs?.riskAlerts) return

    const now = Date.now()
    const nextHours = hourlyForecast.slice(0, 12)

    for (const slot of nextHours) {
        const slotTimestamp = getHourTimestamp(slot)
        if (slotTimestamp <= now) continue

        const rainProbability = getPrecipitationProbability(slot)
        const temperature = Number(slot?.main?.temp ?? slot?.temp ?? NaN)
        const alertTime = slotTimestamp - 30 * 60 * 1000
        let delay = alertTime - now
        if (delay < 0) {
            if (slotTimestamp <= now) continue
            delay = 0
        }

        if (rainProbability > 60) {
            const alertKey = `rain-${slotTimestamp}`
            if (!scheduledAlertKeys.has(alertKey)) {
                scheduledAlertKeys.add(alertKey)
                setTimeout(() => {
                    sendNotification(
                        '🌧️ Rain Alert — LumiCast',
                        `Rain expected around ${formatAlertTime(slot)}.\nPlan accordingly.`,
                        '/favicon.ico'
                    )
                }, delay)
            }
        }

        if (Number.isFinite(temperature) && temperature > 35) {
            const alertKey = `heat-${slotTimestamp}`
            if (!scheduledAlertKeys.has(alertKey)) {
                scheduledAlertKeys.add(alertKey)
                setTimeout(() => {
                    sendNotification(
                        '🌡️ Heat Alert — LumiCast',
                        `Feels very hot around ${formatAlertTime(slot)}.\nStay hydrated.`,
                        '/favicon.ico'
                    )
                }, delay)
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Pre-departure alert — Phase 3.4
// ---------------------------------------------------------------------------

/** Tracks which departure date+time slots have already had a pre-departure alert sent. */
const scheduledDepartureDays = new Set()

/**
 * Resets the pre-departure deduplication set.
 * Exported for test isolation only — do not call in production code.
 * @internal
 */
export function _resetPreDepartureKeys() {
    scheduledDepartureDays.clear()
}

/**
 * Parses an "HH:MM" departure time string into today's Unix timestamp.
 * Returns null if invalid or the departure time has already passed
 * (outside the planning window).
 *
 * @param {string|null|undefined} timeStr
 * @param {number} minutesBefore - how many minutes before departure to notify
 * @returns {{ notifyAt: number, departureMs: number }|null}
 */
function parsePreDepartureSchedule(timeStr, minutesBefore) {
    if (!timeStr || typeof timeStr !== 'string') return null
    const m = timeStr.match(/^(\d{1,2}):(\d{2})$/)
    if (!m) return null

    const hours = parseInt(m[1], 10)
    const minutes = parseInt(m[2], 10)
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null

    const now = new Date()
    const today = new Date(now)
    today.setHours(hours, minutes, 0, 0)
    const departureMs = today.getTime()

    const notifyAt = departureMs - minutesBefore * 60 * 1000

    // Only schedule when the notification time is still in the future
    // and the departure itself is within the next 12 hours
    if (notifyAt <= Date.now()) return null
    if (departureMs - Date.now() > 12 * 60 * 60 * 1000) return null

    return { notifyAt, departureMs }
}

/**
 * Schedules a single pre-departure briefing notification.
 *
 * Rules:
 *   - Only fires on weekdays (Mon–Fri) for the declared weekday departure time
 *   - Only fires when preferences.notifications.preDeparture === true
 *   - Deduplicates: at most one pre-departure notification per calendar day
 *   - Notification content comes from generateDepartureBrief(), not leadInsight
 *   - Sends 30 minutes before declared departure time (configurable via minutesBefore)
 *   - No-op when the InsightSet has nothing departure-relevant to say
 *
 * @param {import('@/types/context.js').Insight[]} insightSet
 * @param {string|null} departureTime - "HH:MM" from userContext.routines.weekday.departureTime
 * @param {object} prefs              - preferences.notifications from userContext
 * @param {number} [minutesBefore=30] - how early to send the notification
 */
export function schedulePreDepartureAlert(insightSet, departureTime, prefs, minutesBefore = 30) {
    // Gate 1: master notifications gate
    if (!prefs?.enabled) return

    // Gate 2: pre-departure preference must be opted in
    if (!prefs?.preDeparture) return

    // Gate 3: weekdays only (Mon=1 … Fri=5)
    const dayOfWeek = new Date().getDay()
    if (dayOfWeek === 0 || dayOfWeek === 6) return

    // Gate 4: departure time must be parseable and in the future
    const schedule = parsePreDepartureSchedule(departureTime, minutesBefore)
    if (!schedule) return

    // Gate 5: deduplicate — one alert per calendar day + departure time
    const todayKey = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
    const alertKey = `pre-departure-${todayKey}-${departureTime}`
    if (scheduledDepartureDays.has(alertKey)) return
    scheduledDepartureDays.add(alertKey)

    // Generate departure-specific brief from the InsightSet
    const brief = generateDepartureBrief(insightSet)

    // No departure-relevant conditions — don't send a notification
    if (!brief) {
        scheduledDepartureDays.delete(alertKey) // allow retry if conditions change
        return
    }

    const delay = Math.max(0, schedule.notifyAt - Date.now())

    setTimeout(() => {
        sendNotification(brief.title, brief.body, '/favicon.ico')
    }, delay)
}

// ---------------------------------------------------------------------------
// Exported function — backwards-compatible signature
// ---------------------------------------------------------------------------

/**
 * Schedule weather alerts.
 *
 * New call signature (Phase 3.3+):
 *   scheduleWeatherAlerts(insightSet: Insight[], hourlyForecast: object[])
 *
 * Legacy call signature (Phase 3.1 — still works):
 *   scheduleWeatherAlerts(hourlyForecast: object[], userProfile: string)
 *
 * The function detects which signature is being used by checking whether
 * the first argument contains Insight objects (have an .id and .type field)
 * or raw forecast slots.
 *
 * @param {Insight[]|object[]} firstArg
 * @param {object[]|string}    secondArg
 */
export function scheduleWeatherAlerts(firstArg = [], secondArg = []) {
    const prefs = getNotificationPrefs()

    // Master gate — if notifications not enabled, do nothing
    if (!prefs?.enabled) return

    // Detect call signature:
    // If the first item of firstArg has an `id` and a `type` that matches
    // known insight types, treat it as an InsightSet.
    const INSIGHT_TYPES = new Set([
        'daily-planning', 'comfort', 'commute', 'activity',
        'routine-adapt', 'risk-alert', 'environmental', 'ambient'
    ])

    const firstItem = Array.isArray(firstArg) ? firstArg[0] : null
    // An empty array is treated as an empty InsightSet (not legacy hourly data).
    // Legacy hourly data arrays are never empty when called from App.vue.
    const isInsightSet = firstArg.length === 0
        ? (Array.isArray(secondArg) && secondArg.length > 0)  // empty firstArg + hourly secondArg → new path
        : (firstItem != null &&
            typeof firstItem.id === 'string' &&
            INSIGHT_TYPES.has(firstItem.type))

    if (isInsightSet) {
        // ── New path: InsightSet + optional hourly fallback ──────────────────
        scheduleInsightAlerts(firstArg, prefs)

        // If no insights have timing.notify=true yet (Phase 3.4 not active),
        // fall back to hourly scan so users don't lose notifications.
        const hasNotifiableInsights = firstArg.some(i => i?.timing?.notify === true)
        if (!hasNotifiableInsights && Array.isArray(secondArg) && secondArg.length > 0) {
            scheduleFallbackAlerts(secondArg, prefs)
        }
    } else {
        // ── Legacy path: (hourlyForecast, userProfile) ───────────────────────
        scheduleFallbackAlerts(firstArg, prefs)
    }
}
