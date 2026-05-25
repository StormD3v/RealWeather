<template>
  <div class="weather-impact-card">
    <h3>Weather Impact Score</h3>

    <div class="impact-content">
      <!-- Top: Impact Score Circle -->
      <div class="score-ring">
        <svg class="ring-svg" viewBox="0 0 200 200">
          <circle cx="100" cy="100" r="70" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="8" />
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
.weather-impact-card {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.weather-impact-card h3 {
  margin: 0 0 20px 0;
  font-size: 22px;
  font-weight: 600;
  color: white;
}

.impact-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
  flex: 1;
}

/* Top: Impact Score Circle */
.score-ring {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: 16px;
}

.ring-svg {
  width: 140px;
  height: 140px;
}

.ring-progress {
  transition: stroke-dashoffset 0.5s ease;
}

.ring-score {
  font-size: 28px;
  font-weight: 700;
  fill: white;
}

/* Middle: Score Number and Description */
.score-label {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  margin-bottom: 20px;
}

.score-number {
  font-size: 42px;
  font-weight: 700;
  color: white;
  line-height: 1;
  margin-bottom: 4px;
}

.score-text {
  font-size: 18px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
  margin-bottom: 8px;
}

.score-conditions {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.8);
  text-align: center;
  max-width: 280px;
  line-height: 1.4;
}

.impact-trend {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.trend-title {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: rgba(255, 255, 255, 0.75);
}

.trend-sparkline {
  width: 140px;
  height: 38px;
}

.trend-line {
  fill: none;
  stroke: rgba(255, 255, 255, 0.85);
  stroke-width: 2;
}

.trend-dot {
  fill: #ffffff;
  opacity: 0.95;
}

.trend-values {
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
}

/* Bottom: Impact Factor Grid */
.impact-factors {
  display: flex;
  flex-direction: column;
}

.factors-title {
  font-size: 16px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  margin-bottom: 12px;
}

.factors-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.factor-chip {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  transition: all 0.2s ease;
  height: 100px;
}

.factor-chip:hover {
  background: rgba(255, 255, 255, 0.12);
  transform: translateY(-1px);
}

.factor-label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 6px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 500;
}

.factor-value {
  font-size: 16px;
  font-weight: 600;
  color: white;
  line-height: 1;
}

@media (max-width: 600px) {
  .impact-content {
    flex-direction: column;
    gap: 16px;
  }

  .score-display {
    justify-content: center;
  }

  .indicators {
    align-items: center;
  }

  .ring-svg {
    width: 120px;
    height: 120px;
  }

  .factors-grid {
    grid-template-columns: 1fr;
  }

  .factor-chip {
    min-height: 44px;
    height: auto;
    padding: 12px;
  }
}
</style>
