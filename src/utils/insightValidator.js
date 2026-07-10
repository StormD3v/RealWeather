/**
 * @file insightValidator.js
 * Enforces the mandatory insight gate defined in the Intelligence Philosophy:
 *   "Every insight must have a non-empty actionPath field, or it is rejected."
 *
 * Also provides the factory for building well-formed Insight objects, so
 * intelligence modules don't need to construct the full shape manually.
 *
 * @see LUMI_INTELLIGENCE_PHILOSOPHY.md §4 — Rules for Insights
 * @see LUMI_CONTEXT_FOUNDATION_TASKS.md Task 4.4 — Insight type
 */

/** @typedef {import('@/types/context.js').Insight} Insight */
/** @typedef {import('@/types/context.js').InsightType} InsightType */
/** @typedef {import('@/types/context.js').UrgencyLevel} UrgencyLevel */

import { URGENCY } from '@/utils/urgencyEngine.js'

// ---------------------------------------------------------------------------
// Insight factory
// ---------------------------------------------------------------------------

let _insightCounter = 0

/**
 * Creates a well-formed Insight object.
 * Throws if `actionPath` is empty — this is the mandatory gate.
 *
 * @param {{
 *   type:        InsightType,
 *   subtype?:    string,          — optional; used by environmental modules (e.g. 'uv', 'air-quality', 'pollen')
 *   urgency:     UrgencyLevel,
 *   content:     string,
 *   actionPath:  string,         — REQUIRED non-empty
 *   confidence?: 'high'|'medium'|'low',
 *   windowStart?: number|null,
 *   windowEnd?:   number|null,
 *   notify?:      boolean,
 *   notifyAt?:    number|null,
 *   usedLocation?:    boolean,
 *   usedRoutine?:     boolean,
 *   usedActivity?:    boolean,
 *   usedSensitivity?: boolean
 * }} params
 * @returns {Insight}
 */
export function createInsight(params) {
    const {
        type,
        subtype,
        urgency = URGENCY.USEFUL,
        content,
        actionPath,
        confidence = 'medium',
        windowStart = null,
        windowEnd = null,
        notify = false,
        notifyAt = null,
        usedLocation = false,
        usedRoutine = false,
        usedActivity = false,
        usedSensitivity = false
    } = params

    // Mandatory gate — enforced unconditionally
    if (!actionPath || typeof actionPath !== 'string' || !actionPath.trim()) {
        throw new Error(
            `[insightValidator] Insight of type "${type}" rejected: actionPath is empty or missing. ` +
            `Every insight must answer "what should the user do?"`
        )
    }

    if (!content || typeof content !== 'string' || !content.trim()) {
        throw new Error(
            `[insightValidator] Insight of type "${type}" rejected: content is empty or missing.`
        )
    }

    const insight = {
        id: `insight-${type}-${++_insightCounter}-${Date.now()}`,
        type,
        urgency,
        timing: {
            windowStart,
            windowEnd,
            notify,
            notifyAt
        },
        content: content.trim(),
        actionPath: actionPath.trim(),
        confidence,
        sourceContext: {
            usedLocation,
            usedRoutine,
            usedActivity,
            usedSensitivity
        }
    }

    // Include subtype only when explicitly provided — not validated, free-form string
    if (subtype !== undefined && subtype !== null) {
        insight.subtype = String(subtype)
    }

    return insight
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validates a candidate Insight object without throwing.
 * Returns { valid: boolean, reason?: string }.
 *
 * @param {unknown} candidate
 * @returns {{ valid: boolean, reason?: string }}
 */
export function validateInsight(candidate) {
    if (!candidate || typeof candidate !== 'object') {
        return { valid: false, reason: 'Not an object' }
    }

    const insight = /** @type {any} */ (candidate)

    if (!insight.actionPath?.trim()) {
        return { valid: false, reason: 'actionPath is empty — mandatory gate failed' }
    }

    if (!insight.content?.trim()) {
        return { valid: false, reason: 'content is empty' }
    }

    const validTypes = ['daily-planning', 'comfort', 'commute', 'activity', 'routine-adapt', 'risk-alert', 'environmental', 'ambient']
    if (!validTypes.includes(insight.type)) {
        return { valid: false, reason: `Unknown insight type: ${insight.type}` }
    }

    const validUrgency = ['ambient', 'useful', 'heads-up', 'alert']
    if (!validUrgency.includes(insight.urgency)) {
        return { valid: false, reason: `Unknown urgency level: ${insight.urgency}` }
    }

    return { valid: true }
}

/**
 * Filters an array of candidate insights, keeping only valid ones.
 * Logs a warning for each rejected insight.
 *
 * @param {Array<Insight|null|undefined>} candidates
 * @returns {Insight[]}
 */
export function filterValidInsights(candidates) {
    return candidates
        .filter(Boolean)
        .filter((c) => {
            const { valid, reason } = validateInsight(c)
            if (!valid) {
                console.warn(`[insightValidator] Insight rejected: ${reason}`, c)
            }
            return valid
        })
}
