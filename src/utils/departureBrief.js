/**
 * @file departureBrief.js
 * Phase 3.4 — Pre-departure intelligence generator.
 *
 * PURPOSE
 * -------
 * Synthesizes the current InsightSet into a departure-targeted notification
 * payload. This is distinct from the general leadInsight — the brief is
 * specifically composed for someone who is about to leave the house.
 *
 * SELECTION LOGIC (priority order, first match wins)
 * --------------------------------------------------
 * 1. Commute insight (any urgency) — it is inherently departure-specific
 * 2. Alert-tier daily-planning or routine-adapt insight
 * 3. Heads-up tier daily-planning insight
 * 4. Any other heads-up or alert insight
 * 5. If nothing above matches → return null (conditions are benign; no
 *    pre-departure notification is warranted)
 *
 * The brief is intentionally narrow:
 *   - At most ONE primary insight drives the notification headline
 *   - One optional secondary line is added when a separate commute insight
 *     and a separate severe alert both exist
 *   - Ambient and useful insights are NEVER included in a departure brief
 *
 * OUTPUT FORMAT
 * -------------
 * {
 *   title:   string  — notification title (short, action-oriented)
 *   body:    string  — notification body (content + actionPath, ≤ 2 lines)
 *   urgency: string  — 'alert' | 'heads-up'
 * }
 * Returns null when conditions do not warrant a pre-departure notification.
 *
 * PURE FUNCTION — no side effects, no store access, no Vue reactivity.
 * Testable in complete isolation.
 *
 * @module departureBrief
 */

/** @typedef {import('@/types/context.js').Insight} Insight */

/** @typedef {{ title: string, body: string, urgency: string }} DepartureBrief */

// ---------------------------------------------------------------------------
// Selection helpers
// ---------------------------------------------------------------------------

const NOTIFIABLE_URGENCIES = new Set(['alert', 'heads-up'])

/**
 * Returns true if the insight urgency warrants inclusion in a departure brief.
 * Ambient and useful insights are excluded — they don't justify interrupting
 * the user before they leave.
 *
 * @param {Insight} insight
 * @returns {boolean}
 */
function isNotifiable(insight) {
    return NOTIFIABLE_URGENCIES.has(insight?.urgency)
}

/**
 * Returns the notification title prefix for a given urgency level.
 * @param {string} urgency
 * @returns {string}
 */
function titlePrefix(urgency) {
    return urgency === 'alert' ? '🔴 Before you go' : '⚠️ Before you go'
}

/**
 * Formats the notification body from a primary insight and an optional
 * secondary line (e.g. a separate commute note alongside a weather alert).
 *
 * @param {Insight} primary
 * @param {Insight|null} secondary
 * @returns {string}
 */
function formatBody(primary, secondary) {
    const primaryText = `${primary.content} ${primary.actionPath}`.trim()
    if (!secondary) return primaryText
    return `${primaryText}\n${secondary.content}`
}

// ---------------------------------------------------------------------------
// Main generator
// ---------------------------------------------------------------------------

/**
 * Generates a departure brief from the current InsightSet.
 *
 * @param {Insight[]} insights - ordered InsightSet from useInsightEngine
 * @returns {DepartureBrief|null}
 */
export function generateDepartureBrief(insights) {
    if (!Array.isArray(insights) || insights.length === 0) return null

    const notifiable = insights.filter(isNotifiable)
    if (notifiable.length === 0) return null

    // Step 1: Find the most departure-relevant primary insight
    // Priority order: commute > alert daily-planning/routine > heads-up daily-planning > any alert/heads-up

    const commuteInsight = notifiable.find(i => i.type === 'commute') ?? null

    const alertDailyOrRoutine = notifiable.find(i =>
        i.urgency === 'alert' &&
        (i.type === 'daily-planning' || i.type === 'routine-adapt')
    ) ?? null

    const headsUpDaily = notifiable.find(i =>
        i.urgency === 'heads-up' && i.type === 'daily-planning'
    ) ?? null

    const anyNotifiable = notifiable[0] ?? null

    // Resolve primary
    const primary = commuteInsight ?? alertDailyOrRoutine ?? headsUpDaily ?? anyNotifiable

    if (!primary) return null

    // Step 2: Add a secondary line only when a distinct secondary insight adds
    // meaningful context that the primary doesn't already cover.
    // Rule: secondary is included only when primary is NOT a commute insight
    // AND a commute insight exists separately, OR when primary IS commute and
    // there is an alert-tier weather insight alongside it.
    let secondary = null

    if (primary.type === 'commute') {
        // Primary is commute — add a severe weather alert as secondary context if present
        secondary = notifiable.find(i =>
            i !== primary &&
            i.urgency === 'alert' &&
            i.type !== 'commute'
        ) ?? null
    } else if (commuteInsight && commuteInsight !== primary) {
        // Primary is weather-based — add commute note as secondary if it exists
        secondary = commuteInsight
    }

    return {
        title: titlePrefix(primary.urgency),
        body: formatBody(primary, secondary),
        urgency: primary.urgency
    }
}
