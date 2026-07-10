<template>
  <div class="weather-impact-card">
    <h3>Weather Impact Score</h3>

    <div class="impact-content">
      <!-- Top: Impact Score Circle -->
      <div class="score-ring">
        <svg class="ring-svg" viewBox="0 0 200 200" role="img" :aria-label="`Impact score: ${impactScore?.score ?? 0}`">
          <circle cx="100" cy="100" r="70" fill="none" stroke="var(--lc-border)" stroke-width="8" />
          <circle cx="100" cy="100" r="70" fill="none" :stroke="ringColor" stroke-width="8" stroke-linecap="round"
            transform="rotate(-90 100 100)" :stroke-dasharray="circumference" :stroke-dashoffset="dashOffset"
            class="ring-progress" />
          <text x="100" y="110" text-anchor="middle" class="ring-score">
            {{ impactScore?.score ?? 0 }}
          </text>
        </svg>
      </div>

      <!-- Middle: Score Number and Description -->
      <div class="score-label">
        <div class="score-number">{{ impactScore?.score ?? 0 }}</div>
        <div class="score-text">{{ impactScore?.label || 'Unknown' }}</div>
        <div class="score-conditions">{{ impactScore?.explanation || 'Weather conditions are being assessed.' }}</div>
        <div class="impact-trend">
          <div class="trend-title">Impact Score Trend</div>
          <svg class="trend-sparkline" viewBox="0 0 120 36" preserveAspectRatio="none" aria-hidden="true">
            <polyline class="trend-line" :points="trendLinePoints" />
            <circle v-for="(score, idx) in trendScores" :key="`trend-dot-${idx}`" class="trend-dot" :cx="idx * 40"
              :cy="35 - ((score / 100) * 30)" r="2.5" />
          </svg>
          <div class="trend-values">[ {{ trendText }} ]</div>
        </div>
      </div>
    </div>

    <!-- Bottom: Impact Factor Grid -->
    <div class="impact-factors">
      <div class="factors-title">Impact Factors</div>
      <div class="factors-grid">
        <div class="factor-chip">
          <span class="factor-label">🌧️ RAIN</span>
          <span class="factor-value">{{ currentWeather?.rain?.['3h'] || currentWeather?.rain?.['1h'] || '0.0' }}
            mm</span>
        </div>
        <div class="factor-chip">
          <span class="factor-label">💨 WIND</span>
          <span class="factor-value">{{ currentWeather?.wind?.speed || 0 }} km/h</span>
        </div>
        <div class="factor-chip">
          <span class="factor-label">🌡️ TEMP</span>
          <span class="factor-value">{{ Math.round(currentWeather?.main?.temp || 0) }}&deg;{{ unitSymbol }}</span>
        </div>
        <div class="factor-chip">
          <span class="factor-label">🌡️ PRESSURE</span>
          <span class="factor-value">{{ currentWeather?.main?.pressure && currentWeather?.main?.pressure > 0 ?
            currentWeather?.main?.pressure : 'N/A' }} hPa</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  impactScore: {
    type: Object,
    default: () => ({ score: 0, label: 'Unknown' })
  },
  currentWeather: {
    type: Object,
    default: null
  },
  hourlyForecast: {
    type: Array,
    default: () => []
  },
  trendIndicators: {
    type: Object,
    default: () => ({})
  },
  unitSymbol: {
    type: String,
    default: 'C'
  }
})

const circumference = 2 * Math.PI * 70
const dashOffset = computed(() => {
  const score = props.impactScore?.score ?? 0
  return circumference - (score / 100) * circumference
})

const ringColor = computed(() => {
  const score = props.impactScore?.score ?? 0
  if (score >= 80) return '#10b981' // green (80-100)
  if (score >= 60) return '#f59e0b' // yellow (60-79)
  if (score >= 30) return '#f97316' // orange (30-59)
  return '#ef4444' // red
})

const recommendationText = computed(() => {
  return props.impactScore?.explanation || 'Weather conditions are being assessed.'
})

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function estimateImpactFromSlot(slot) {
  const temp = Number(slot?.main?.temp ?? 0)
  const windSpeed = Number(slot?.wind?.speed ?? 0)
  const humidity = Number(slot?.main?.humidity ?? 0)
  const visibility = Number(slot?.visibility ?? 10000) / 1000
  const rainChance = Number(slot?.pop ?? 0)
  const condition = String(slot?.weather?.[0]?.main || '').toLowerCase()

  let score = 100
  score -= (rainChance / 100) * 0.4
  score -= Math.abs(temp - 22) * 1.5
  if (windSpeed > 20) score -= 10
  if (visibility < 5) score -= 15
  if (condition.includes('storm') || condition.includes('thunder') || condition.includes('snow')) score -= 25
  if (humidity > 85) score -= 6

  return Math.round(clamp(score, 0, 100))
}

const trendScores = computed(() => {
  const currentScore = Number(props.impactScore?.score ?? 0)
  const projected = (props.hourlyForecast || [])
    .slice(0, 3)
    .map((slot) => estimateImpactFromSlot(slot))
  const points = [currentScore, ...projected]
  while (points.length < 4) points.push(points[points.length - 1] ?? currentScore)
  return points.slice(0, 4)
})

const trendText = computed(() => trendScores.value.join(' → '))

const trendLinePoints = computed(() =>
  trendScores.value
    .map((score, idx) => `${idx * 40},${35 - ((score / 100) * 30)}`)
    .join(' ')
)
</script>

<style scoped>
.weather-impact-card { display: flex; flex-direction: column; height: 100%; }

.impact-content { display: flex; flex-direction: column; gap: var(--lc-sp-5); flex: 1; }

.score-ring { display: flex; justify-content: center; align-items: center; margin-bottom: var(--lc-sp-4); }
.ring-svg { width: 140px; height: 140px; }
.ring-progress { transition: stroke-dashoffset var(--lc-duration-slow) var(--lc-ease-out); }
.ring-score { font-size: 28px; font-weight: var(--lc-weight-bold); fill: var(--lc-text-primary); }

.score-label { display: flex; flex-direction: column; align-items: center; text-align: center; margin-bottom: var(--lc-sp-5); }
.score-number { font-size: 2.5rem; font-weight: var(--lc-weight-extrabold); color: var(--lc-text-primary); line-height: 1; margin-bottom: var(--lc-sp-1); }
.score-text { font-size: var(--lc-text-subtitle); font-weight: var(--lc-weight-medium); color: var(--lc-text-secondary); margin-bottom: var(--lc-sp-2); }
.score-conditions { font-size: var(--lc-text-caption); color: var(--lc-text-muted); text-align: center; max-width: 280px; line-height: var(--lc-leading-normal); }

.impact-trend { margin-top: var(--lc-sp-3); display: flex; flex-direction: column; align-items: center; gap: var(--lc-sp-2); }
.trend-title { font-size: var(--lc-text-label); text-transform: uppercase; letter-spacing: var(--lc-tracking-wider); color: var(--lc-text-muted); font-weight: var(--lc-weight-semibold); }
.trend-sparkline { width: 140px; height: 36px; }
.trend-line { fill: none; stroke: var(--lc-text-secondary); stroke-width: 2; }
.trend-dot { fill: var(--lc-text-primary); opacity: 0.9; }
.trend-values { font-size: var(--lc-text-caption); font-weight: var(--lc-weight-semibold); color: var(--lc-text-muted); }

.impact-factors { display: flex; flex-direction: column; }
.factors-title { font-size: var(--lc-text-title); font-weight: var(--lc-weight-semibold); color: var(--lc-text-secondary); margin-bottom: var(--lc-sp-3); }

.factors-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--lc-sp-3); }

.factor-chip {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--lc-sp-4);
  background: var(--lc-surface-overlay);
  border: 1px solid var(--lc-border-glass);
  border-radius: var(--lc-radius-md);
  transition: background var(--lc-transition-hover), transform var(--lc-transition-hover);
  min-height: 90px;
}

.factor-chip:hover { background: var(--lc-surface-hover); transform: translateY(-1px); }

.factor-label {
  font-size: var(--lc-text-label-sm);
  color: var(--lc-text-muted);
  margin-bottom: var(--lc-sp-2);
  text-transform: uppercase;
  letter-spacing: var(--lc-tracking-wider);
  font-weight: var(--lc-weight-semibold);
}

.factor-value { font-size: var(--lc-text-body-sm); font-weight: var(--lc-weight-semibold); color: var(--lc-text-primary); line-height: 1; }

@media (max-width: 600px) {
  .ring-svg { width: 120px; height: 120px; }
  .factors-grid { grid-template-columns: 1fr; }
  .factor-chip { min-height: 52px; height: auto; padding: var(--lc-sp-3); }
}
</style>
