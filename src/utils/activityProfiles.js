/**
 * @file activityProfiles.js
 * System-defined environmental thresholds for all declared activity types.
 *
 * These profiles are the authoritative source of activity knowledge.
 * No intelligence reasoning happens here — these are static data profiles
 * consumed by Phase 3.2 intelligence modules.
 *
 * Profiles are system-defined and not user-configurable.
 * When a user declares an activity, they receive the system profile — they
 * do not configure what "good" conditions mean for their activity.
 *
 * NOTE: Threshold values are calibrated to human-experience standards.
 * They require domain review before Phase 3.2 consumes them for recommendations.
 * All temperatures in °C, wind in km/h, precipitation in mm/hr.
 */

/** @typedef {import('@/types/context.js').ActivityKey} ActivityKey */
/** @typedef {import('@/types/context.js').ActivitySensitivityProfile} ActivitySensitivityProfile */

// ---------------------------------------------------------------------------
// ALL_ACTIVITY_KEYS
// ---------------------------------------------------------------------------

/**
 * All valid ActivityKey values. This is the canonical list.
 * @type {ActivityKey[]}
 */
export const ALL_ACTIVITY_KEYS = [
    'running',
    'cycling',
    'hiking',
    'gardening',
    'photography',
    'golf',
    'outdoor-dining',
    'dog-walking',
    'swimming',
    'sailing'
]

// ---------------------------------------------------------------------------
// Profile definitions
// ---------------------------------------------------------------------------

/** @type {Object.<ActivityKey, ActivitySensitivityProfile>} */
export const ACTIVITY_PROFILES = {

    running: {
        primaryVariables: ['feelsLike', 'humidity', 'precipitation', 'windSpeed'],
        thresholds: {
            good: {
                feelsLike: { min: 8, max: 22 },
                humidity: { max: 65 },
                precipitation: { max: 0.0 },
                windSpeed: { max: 25 }
            },
            marginal: {
                feelsLike: { min: 2, max: 30 },
                humidity: { max: 80 },
                precipitation: { max: 1.5 },
                windSpeed: { max: 40 }
            },
            notRecommended: {
                feelsLike: { min: 34 },
                precipitation: { min: 3 },
                windSpeed: { min: 50 }
            }
        }
    },

    cycling: {
        primaryVariables: ['windSpeed', 'gustSpeed', 'precipitation', 'feelsLike'],
        thresholds: {
            good: {
                windSpeed: { max: 20 },
                gustSpeed: { max: 30 },
                precipitation: { max: 0.0 },
                feelsLike: { min: 8, max: 28 }
            },
            marginal: {
                windSpeed: { max: 40 },
                gustSpeed: { max: 55 },
                precipitation: { max: 2 },
                feelsLike: { min: 2, max: 35 }
            },
            notRecommended: {
                windSpeed: { min: 50 },
                gustSpeed: { min: 65 },
                precipitation: { min: 4 }
            }
        }
    },

    hiking: {
        primaryVariables: ['feelsLike', 'precipitation', 'windSpeed', 'visibility'],
        thresholds: {
            good: {
                feelsLike: { min: 5, max: 25 },
                precipitation: { max: 0.0 },
                windSpeed: { max: 30 },
                visibility: { min: 5 }
            },
            marginal: {
                feelsLike: { min: -2, max: 32 },
                precipitation: { max: 2 },
                windSpeed: { max: 50 },
                visibility: { min: 2 }
            },
            notRecommended: {
                precipitation: { min: 5 },
                windSpeed: { min: 60 },
                visibility: { max: 1 }
            }
        }
    },

    gardening: {
        primaryVariables: ['precipitation', 'feelsLike', 'uvIndex'],
        thresholds: {
            good: {
                precipitation: { max: 0.5 },
                feelsLike: { min: 10, max: 28 },
                uvIndex: { max: 7 }
            },
            marginal: {
                precipitation: { max: 3 },
                feelsLike: { min: 5, max: 35 },
                uvIndex: { max: 10 }
            },
            notRecommended: {
                precipitation: { min: 5 },
                feelsLike: { min: 38 },
                uvIndex: { min: 11 }
            }
        }
    },

    photography: {
        primaryVariables: ['visibility', 'precipitation', 'uvIndex'],
        thresholds: {
            good: {
                visibility: { min: 10 },
                precipitation: { max: 0.0 },
                uvIndex: { min: 2, max: 8 }
            },
            marginal: {
                visibility: { min: 3 },
                precipitation: { max: 1 },
                uvIndex: { min: 1 }
            },
            notRecommended: {
                visibility: { max: 1 },
                precipitation: { min: 3 }
            }
        }
    },

    golf: {
        primaryVariables: ['windSpeed', 'precipitation', 'feelsLike'],
        thresholds: {
            good: {
                windSpeed: { max: 20 },
                precipitation: { max: 0.0 },
                feelsLike: { min: 12, max: 30 }
            },
            marginal: {
                windSpeed: { max: 35 },
                precipitation: { max: 1 },
                feelsLike: { min: 8, max: 36 }
            },
            notRecommended: {
                windSpeed: { min: 45 },
                precipitation: { min: 3 },
                feelsLike: { min: 38 }
            }
        }
    },

    'outdoor-dining': {
        primaryVariables: ['feelsLike', 'windSpeed', 'precipitation'],
        thresholds: {
            good: {
                feelsLike: { min: 16, max: 28 },
                windSpeed: { max: 20 },
                precipitation: { max: 0.0 }
            },
            marginal: {
                feelsLike: { min: 10, max: 33 },
                windSpeed: { max: 35 },
                precipitation: { max: 0.5 }
            },
            notRecommended: {
                feelsLike: { max: 6 },
                windSpeed: { min: 45 },
                precipitation: { min: 2 }
            }
        }
    },

    'dog-walking': {
        primaryVariables: ['feelsLike', 'precipitation', 'windSpeed'],
        thresholds: {
            good: {
                feelsLike: { min: 8, max: 26 },
                precipitation: { max: 0.5 },
                windSpeed: { max: 30 }
            },
            marginal: {
                feelsLike: { min: 0, max: 34 },
                precipitation: { max: 3 },
                windSpeed: { max: 50 }
            },
            notRecommended: {
                feelsLike: { min: 38 },
                precipitation: { min: 5 },
                windSpeed: { min: 60 }
            }
        }
    },

    swimming: {
        primaryVariables: ['feelsLike', 'uvIndex', 'windSpeed'],
        thresholds: {
            good: {
                feelsLike: { min: 22, max: 38 },
                uvIndex: { min: 3, max: 8 },
                windSpeed: { max: 25 }
            },
            marginal: {
                feelsLike: { min: 16, max: 40 },
                uvIndex: { max: 10 },
                windSpeed: { max: 40 }
            },
            notRecommended: {
                feelsLike: { max: 12 },
                windSpeed: { min: 50 }
            }
        }
    },

    sailing: {
        primaryVariables: ['windSpeed', 'gustSpeed', 'visibility', 'precipitation'],
        thresholds: {
            good: {
                windSpeed: { min: 10, max: 35 },
                gustSpeed: { max: 45 },
                visibility: { min: 5 },
                precipitation: { max: 0.5 }
            },
            marginal: {
                windSpeed: { min: 5, max: 50 },
                gustSpeed: { max: 65 },
                visibility: { min: 2 },
                precipitation: { max: 3 }
            },
            notRecommended: {
                windSpeed: { min: 60 },
                gustSpeed: { min: 75 },
                visibility: { max: 1 },
                precipitation: { min: 5 }
            }
        }
    }
}

// ---------------------------------------------------------------------------
// getActivityProfile
// ---------------------------------------------------------------------------

/**
 * Returns the ActivitySensitivityProfile for the given key.
 * Returns undefined for unknown keys — never throws.
 *
 * @param {string} activityKey
 * @returns {ActivitySensitivityProfile|undefined}
 */
export function getActivityProfile(activityKey) {
    return ACTIVITY_PROFILES[activityKey]
}
