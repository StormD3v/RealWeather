/**
 * @file stores/context.js
 * Session context Pinia store — in-memory only, never persisted.
 *
 * Holds the transient, session-scoped portion of user context:
 * - Live GPS position (cleared on session end)
 * - Current timestamp and day-of-week (refreshed periodically)
 * - WeatherCopilot conversation history (discarded on close)
 *
 * This store does NOT use any persistence plugin.
 * clearSession() resets all state to initial values.
 */

import { defineStore } from 'pinia'
import { readContext } from '@/utils/contextStore.js'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/**
 * Haversine distance in kilometres between two lat/lon points.
 * @param {number} lat1
 * @param {number} lon1
 * @param {number} lat2
 * @param {number} lon2
 * @returns {number}
 */
function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371
    const dLat = ((lat2 - lat1) * Math.PI) / 180
    const dLon = ((lon2 - lon1) * Math.PI) / 180
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export const useContextStore = defineStore('lumi-session-context', {
    state: () => ({
        /** @type {{ lat: number, lon: number, permissionState: string } | null} */
        gpsPosition: null,

        /** Unix timestamp ms — current wall-clock time */
        currentTimestamp: Date.now(),

        /** 0=Sunday … 6=Saturday */
        currentDayOfWeek: new Date().getDay(),

        /** Session-only copilot history — always empty on start */
        copilotHistory: [],

        /** true if within ~2km of primary location; null when GPS unavailable */
        isAtPrimary: null
    }),

    getters: {
        /** @returns {boolean} */
        isWeekday: (state) => state.currentDayOfWeek >= 1 && state.currentDayOfWeek <= 5,

        /** @returns {string} */
        formattedDayOfWeek: (state) => DAYS[state.currentDayOfWeek] ?? 'Unknown'
    },

    actions: {
        /**
         * Updates GPS position and recomputes isAtPrimary.
         * @param {number} lat
         * @param {number} lon
         * @param {string} [permissionState]
         */
        updateGpsPosition(lat, lon, permissionState = 'granted') {
            this.gpsPosition = { lat, lon, permissionState }

            // One-time read of persistent context to get primary coordinates
            // (not a reactive subscription — avoids circular dependency)
            try {
                const persistent = readContext()
                const primary = persistent?.location?.primary
                if (primary?.lat != null && primary?.lon != null) {
                    const dist = haversineKm(lat, lon, primary.lat, primary.lon)
                    this.isAtPrimary = dist <= 2
                } else {
                    this.isAtPrimary = null
                }
            } catch {
                this.isAtPrimary = null
            }
        },

        /** Refreshes timestamp and day-of-week. Called on app focus and on interval. */
        refreshTimestamp() {
            const now = new Date()
            this.currentTimestamp = now.getTime()
            this.currentDayOfWeek = now.getDay()
        },

        /** Resets all session state to initial values. */
        clearSession() {
            this.gpsPosition = null
            this.currentTimestamp = Date.now()
            this.currentDayOfWeek = new Date().getDay()
            this.copilotHistory = []
            this.isAtPrimary = null
        }
    }
})
