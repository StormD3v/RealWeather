<script setup>
import { computed } from 'vue'

const props = defineProps({
    currentWeather: {
        type: Object,
        default: () => ({})
    },
    hourlyForecast: {
        type: Array,
        default: () => []
    },
    impactScore: {
        type: Object,
        default: () => ({})
    },
    userProfile: {
        type: String,
        default: 'general'
    }
})

function toNumber(value, fallback = 0) {
    const n = Number(value)
    return Number.isFinite(n) ? n : fallback
}

function toHour24(slot) {
    if (slot?.dt_txt) {
        const parsed = new Date(String(slot.dt_txt).replace(' ', 'T'))
        if (!Number.isNaN(parsed.getTime())) return parsed.getHours()
    }
    if (slot?.dt) {
        const parsed = new Date(Number(slot.dt) * 1000)
        if (!Number.isNaN(parsed.getTime())) return parsed.getHours()
    }
    return -1
}

function formatTime(slot) {
    if (slot?.dt_txt) {
        const parsed = new Date(String(slot.dt_txt).replace(' ', 'T'))
        return parsed.toLocaleTimeString([], { hour: 'numeric', hour12: true })
    }
    if (slot?.dt) {
        const parsed = new Date(Number(slot.dt) * 1000)
        return parsed.toLocaleTimeString([], { hour: 'numeric', hour12: true })
    }
    return ''
}

function scoreTemp(temp) {
    if (temp >= 22 && temp <= 28) return 100
    if (temp >= 20 && temp <= 30) return 80
    if (temp >= 18 && temp <= 32) return 60
    return 30
}

function findBestOutdoorWindow() {
    if (!Array.isArray(props.hourlyForecast) || props.hourlyForecast.length < 2) {
        return null
    }

    let bestWindow = null
    let bestScore = -Infinity

    for (let i = 0; i < props.hourlyForecast.length - 1; i++) {
        const slot1 = props.hourlyForecast[i]
        const slot2 = props.hourlyForecast[i + 1]

        const rainChance1 = toNumber(slot1?.pop, 0) * 100
        const rainChance2 = toNumber(slot2?.pop, 0) * 100
        const avgRain = (rainChance1 + rainChance2) / 2

        const temp1 = toNumber(slot1?.main?.temp, 25)
        const temp2 = toNumber(slot2?.main?.temp, 25)
        const avgTemp = (temp1 + temp2) / 2

        const rainScore = Math.max(0, 100 - avgRain)
        const tempScore = scoreTemp(avgTemp)
        const totalScore = rainScore * 0.6 + tempScore * 0.4

        if (totalScore > bestScore) {
            bestScore = totalScore
            bestWindow = {
                start: slot1,
                end: slot2,
                score: totalScore
            }
        }
    }

    return bestWindow
}

function findRainWarning() {
    if (!Array.isArray(props.hourlyForecast)) return null

    for (const slot of props.hourlyForecast) {
        const rainChance = toNumber(slot?.pop, 0) * 100
        if (rainChance > 60) {
            return {
                time: formatTime(slot),
                chance: Math.round(rainChance)
            }
        }
    }

    return null
}

const profileTips = {
    student: 'Check your lecture schedule against the forecast.',
    office_worker: 'Plan your commute around the rain window.',
    business_owner: 'Rain after noon may affect foot traffic.',
    delivery_rider: 'Front-load your deliveries before noon.',
    driver: 'Wet roads expected later. Drive carefully.',
    athlete: 'Get your workout in during the morning window.',
    traveler: 'Check conditions at your destination too.',
    general: 'Have a productive day!'
}

const currentHour = computed(() => new Date().getHours())
const isShowTime = computed(() => currentHour.value >= 5 && currentHour.value < 11)
const cityName = computed(() => props.currentWeather?.name || 'Your location')
const bestWindow = computed(() => findBestOutdoorWindow())
const rainWarning = computed(() => findRainWarning())
const profileTip = computed(() => profileTips[props.userProfile] || profileTips.general)

const impactScoreValue = computed(() => {
    const score = toNumber(props.impactScore?.score, 0)
    return score
})

const impactLabel = computed(() => props.impactScore?.label || 'Unknown')

const impactColor = computed(() => {
    const score = impactScoreValue.value
    if (score >= 70) return 'impact-red'
    if (score >= 40) return 'impact-yellow'
    return 'impact-green'
})

function getImpactBgColor() {
    if (impactColor.value === 'impact-red') return 'rgba(239, 68, 68, 0.2)'
    if (impactColor.value === 'impact-yellow') return 'rgba(234, 179, 8, 0.2)'
    return 'rgba(39, 192, 99, 0.2)'
}

function getImpactTextColor() {
    if (impactColor.value === 'impact-red') return '#ef4444'
    if (impactColor.value === 'impact-yellow') return '#eab308'
    return '#27c063'
}
</script>

<template>
    <div v-if="isShowTime" class="morning-briefing-card">
        <h3 class="morning-briefing-title">☀️ Morning Briefing</h3>

        <div class="briefing-content">
            <div class="briefing-greeting">
                <div class="greeting-text">Good morning</div>
                <div class="city-text">{{ cityName }}</div>
            </div>

            <div class="impact-section">
                <div class="impact-label">Today's Impact</div>
                <div class="impact-badge" :class="impactColor"
                    :style="{ background: getImpactBgColor(), color: getImpactTextColor() }">
                    <span class="impact-score">{{ impactScoreValue }}</span>
                    <span class="impact-text">{{ impactLabel }}</span>
                </div>
            </div>

            <div v-if="bestWindow" class="best-window-section">
                <div class="best-window-label">Best outdoor window</div>
                <div class="best-window-time">
                    {{ formatTime(bestWindow.start) }} - {{ formatTime(bestWindow.end) }}
                </div>
            </div>

            <div v-if="rainWarning" class="rain-warning-section">
                <div class="rain-warning-icon">⚠️</div>
                <div class="rain-warning-text">
                    Rain expected around {{ rainWarning.time }}. Carry an umbrella if leaving later.
                </div>
            </div>

            <div class="profile-tip-section">
                {{ profileTip }}
            </div>
        </div>
    </div>
</template>

<style scoped>
.morning-briefing-card {
    width: 100%;
    border-radius: 14px;
    border-left: 3px solid #27c063;
    background: linear-gradient(135deg, rgba(39, 192, 99, 0.12), rgba(255, 255, 255, 0.06));
    backdrop-filter: blur(14px);
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    border-right: 1px solid rgba(255, 255, 255, 0.1);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    padding: 20px;
    box-shadow: 0 4px 12px rgba(4, 13, 28, 0.06);
}

.morning-briefing-title {
    margin: 0 0 16px 0;
    font-size: 1.2rem;
    font-weight: 700;
    color: #27c063;
}

.briefing-content {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.briefing-greeting {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.greeting-text {
    font-size: 1rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
}

.city-text {
    font-size: 0.95rem;
    color: rgba(255, 255, 255, 0.7);
}

.impact-section {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
}

.impact-label {
    font-size: 0.85rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.7);
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.impact-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    border-radius: 999px;
    font-size: 0.9rem;
    font-weight: 700;
}

.impact-score {
    min-width: 28px;
    text-align: center;
}

.best-window-section {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.best-window-label {
    font-size: 0.85rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.7);
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.best-window-time {
    font-size: 0.95rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
}

.rain-warning-section {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    padding: 12px;
    border-radius: 8px;
    background: rgba(234, 179, 8, 0.15);
    border: 1px solid rgba(234, 179, 8, 0.4);
}

.rain-warning-icon {
    font-size: 1rem;
    flex-shrink: 0;
    margin-top: 2px;
}

.rain-warning-text {
    font-size: 0.9rem;
    color: rgba(234, 179, 8, 0.95);
    line-height: 1.4;
}

.profile-tip-section {
    font-size: 0.9rem;
    color: rgba(255, 255, 255, 0.65);
    padding-top: 8px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    line-height: 1.4;
}

.impact-red {
    /* styles applied dynamically */
}

.impact-yellow {
    /* styles applied dynamically */
}

.impact-green {
    /* styles applied dynamically */
}

@media (max-width: 640px) {
    .morning-briefing-card {
        padding: 16px;
    }

    .morning-briefing-title {
        font-size: 1.1rem;
        margin-bottom: 12px;
    }

    .briefing-content {
        gap: 12px;
    }

    .impact-section {
        flex-direction: column;
        align-items: flex-start;
    }
}
</style>
