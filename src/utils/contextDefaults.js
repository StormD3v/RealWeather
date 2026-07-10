/**
 * @file contextDefaults.js
 * Factory function for a valid default UserContext.
 * Used as the base for first-run state and as the safe fallback
 * when storage is corrupted or migration fails.
 */

/** @typedef {import('@/types/context.js').UserContext} UserContext */

/**
 * Returns a fresh UserContext with all fields at their defined defaults.
 * Every call returns a new independent object — never mutate the return value
 * and assume other callers are unaffected.
 *
 * @returns {UserContext}
 */
export function createDefaultContext() {
    return {
        location: {
            primary: null,
            saved: [],
            current: null
        },
        routines: {
            weekday: {
                departureTime: null,
                returnTime: null,
                outdoorWindows: []
            },
            weekend: {
                outdoorWindows: []
            },
            confidence: 'declared'
        },
        activities: {
            declared: []
        },
        schedule: {
            manualEvents: [],
            calendarConnected: false
        },
        preferences: {
            temperatureUnit: 'C',
            theme: 'dark',
            verbosity: 'concise',
            notifications: {
                enabled: false,
                commute: false,
                morningBriefing: false,
                activityAlerts: false,
                riskAlerts: false,
                preDeparture: false,
                ambient: false
            },
            intelligenceAreas: {
                dailyPlanning: true,
                activityRecommend: false,
                commuteIntelligence: false,
                routineAdaptation: true,
                environmentalAware: false
            },
            intelligence: {
                behavioralLearning: true
            }
        },
        sensitivities: {
            heat: false,
            cold: false,
            pollen: false,
            uv: false,
            airQuality: false,
            precipitation: false
        },
        meta: {
            schemaVersion: '1.0.0',
            createdAt: Date.now(),
            lastModifiedAt: Date.now(),
            completeness: {
                hasLocation: false,
                hasRoutine: false,
                hasActivities: false,
                hasSensitivities: false,
                hasPreferences: false
            },
            contextQuality: 'none'
        }
    }
}
