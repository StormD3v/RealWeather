import { sendNotification } from '@/utils/notifications'

const scheduledAlertKeys = new Set()

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
    const dateValue = typeof slot?.dt_txt === 'string' && slot.dt_txt ? slot.dt_txt.replace(' ', 'T') : slot?.dt
    const date = new Date(dateValue)
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }).replace(/\s/g, '').toUpperCase()
}

export function scheduleWeatherAlerts(hourlyForecast = [], userProfile) {
    if (!Array.isArray(hourlyForecast) || hourlyForecast.length === 0) return

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
            if (slotTimestamp <= now) {
                continue
            }
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

        if (temperature > 35) {
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
