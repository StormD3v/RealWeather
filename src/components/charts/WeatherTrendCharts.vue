<script>
// ─────────────────────────────────────────────────────────────────────────────
// Module-level pure helpers — exported so unit/property tests can import them
// directly without mounting the component.
// ─────────────────────────────────────────────────────────────────────────────
import { getChartTheme } from '@/utils/chartTheme'

/**
 * Computes a padded Y-axis range from an array of finite temperature values.
 * @param {number[]} temps
 * @returns {{ yMin: number, yMax: number }}
 */
export function computeYScale(temps) {
  const finite = temps.filter(Number.isFinite)
  if (finite.length === 0) return { yMin: 0, yMax: 1 }

  const min = Math.min(...finite)
  const max = Math.max(...finite)

  if (min === max) return { yMin: min - 1, yMax: max + 1 }

  const padding = 0.1 * (max - min)
  return { yMin: min - padding, yMax: max + padding }
}

/**
 * Returns the index of the latest forecast point whose dt_txt does not exceed `now`.
 * Defaults to 0 if no such point exists.
 * @param {Array} points
 * @param {number} [now]
 * @returns {number}
 */
export function computeCurrentIndex(points, now = Date.now()) {
  let result = 0
  for (let i = 0; i < points.length; i++) {
    const dt = points[i]?.dt_txt
    if (!dt) continue
    const ts = new Date(String(dt).replace(' ', 'T')).getTime()
    if (ts <= now) result = i
  }
  return result
}

/**
 * Returns the index of the point with the maximum temp among points AFTER `now`.
 * Falls back to currentIndex when no future points exist.
 * @param {Array} points
 * @param {number} [now]
 * @returns {number}
 */
export function computePeakIndex(points, now = Date.now()) {
  let peakIdx = -1
  let peakTemp = -Infinity

  for (let i = 0; i < points.length; i++) {
    const dt = points[i]?.dt_txt
    if (!dt) continue
    const ts = new Date(String(dt).replace(' ', 'T')).getTime()
    if (ts <= now) continue

    const temp = Number(points[i]?.main?.temp ?? NaN)
    if (Number.isFinite(temp) && temp > peakTemp) {
      peakTemp = temp
      peakIdx = i
    }
  }

  if (peakIdx === -1) return computeCurrentIndex(points, now)
  return peakIdx
}

/**
 * Builds per-point visual arrays for Chart.js.
 * @param {Array} points
 * @param {number} currentIdx
 * @param {number} peakIdx
 * @returns {{ pointRadii: number[], pointStyles: string[], pointBorderColors: string[] }}
 */
export function computePointArrays(points, currentIdx, peakIdx) {
  const theme = getChartTheme()
  const len = points.length

  const pointRadii = Array(len).fill(0)
  const pointStyles = Array(len).fill('circle')
  const pointBorderColors = Array(len).fill(theme.lineColor)

  if (len > 0) {
    // Current point
    pointRadii[currentIdx] = 5
    pointStyles[currentIdx] = 'circle'
    pointBorderColors[currentIdx] = theme.currentPointColor

    // Peak point (may coincide with current)
    pointRadii[peakIdx] = 6
    pointStyles[peakIdx] = 'rectRot'
    pointBorderColors[peakIdx] = theme.peakPointColor
  }

  return { pointRadii, pointStyles, pointBorderColors }
}

/**
 * Returns a short contextual story string, or null.
 * @param {number} currentIdx
 * @param {number} peakIdx
 * @param {number} currentTemp
 * @param {number} peakTemp
 * @param {string} peakTimeLabel
 * @returns {string|null}
 */
export function computeTemperatureStory(currentIdx, peakIdx, currentTemp, peakTemp, peakTimeLabel) {
  if (currentIdx > peakIdx && (peakTemp - currentTemp) >= 2) {
    return 'Cooling down now'
  }
  if (peakIdx > currentIdx && (peakTemp - currentTemp) >= 4) {
    return `Warming through ${peakTimeLabel}`
  }
  return null
}
</script>

<script setup>
import { computed, watch, ref, onBeforeUnmount } from 'vue'
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
} from 'chart.js'
import { getChartTheme, getConditionColor, formatTempLabel } from '@/utils/chartTheme'
import { useTheme } from '@/composables/useTheme'
import { formatHour } from '@/composables/useWeatherFormatters'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip)

// ─── Props ────────────────────────────────────────────────────────────────────

const props = defineProps({
  points:           { type: Array,  default: () => [] },
  unitSymbol:       { type: String, default: 'C' },
  weatherCondition: { type: String, default: 'Clear' },
})

// ─── Core computed values ─────────────────────────────────────────────────────

const labels = computed(() => props.points.map((p) => formatHour(p.dt_txt)))

const temperatureValues = computed(() =>
  props.points.map((p) => Number(p?.main?.temp ?? NaN))
)

const validTemps = computed(() => temperatureValues.value.filter(Number.isFinite))

const hasValidData = computed(() => validTemps.value.length >= 2)

const currentIndex = computed(() => computeCurrentIndex(props.points))
const peakIndex    = computed(() => computePeakIndex(props.points))

const currentTemp  = computed(() => temperatureValues.value[currentIndex.value])
const peakTemp     = computed(() => temperatureValues.value[peakIndex.value])

const peakTimeLabel = computed(() =>
  formatHour(props.points[peakIndex.value]?.dt_txt ?? '')
)

const yScale = computed(() => computeYScale(validTemps.value))

const pointArrays = computed(() =>
  computePointArrays(props.points, currentIndex.value, peakIndex.value)
)

const temperatureStory = computed(() =>
  computeTemperatureStory(
    currentIndex.value,
    peakIndex.value,
    currentTemp.value,
    peakTemp.value,
    peakTimeLabel.value,
  )
)

// ─── Animation ────────────────────────────────────────────────────────────────

const prefersReducedMotion =
  typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false

const animationDuration = prefersReducedMotion ? 0 : 800

// ─── Chart options ────────────────────────────────────────────────────────────

const chartOptions = computed(() => {
  const theme = getChartTheme()
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: animationDuration,
      easing: 'easeOutQuart',
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: theme.tooltipBg,
        titleColor:       theme.tooltipTitle,
        bodyColor:        theme.tooltipBody,
        borderColor:      theme.tooltipBorder,
        borderWidth: 1,
        cornerRadius: 10,
        padding: 10,
        callbacks: {
          title: (items) => items[0]?.label ?? '',
          label: (item) =>
            item.parsed.y !== undefined
              ? formatTempLabel(item.parsed.y, props.unitSymbol)
              : '',
        },
      },
    },
    scales: {
      x: {
        ticks: {
          color: theme.tickColor,
          font: { size: 11, family: "'Inter', sans-serif" },
          maxTicksLimit: 6,
          maxRotation: 0,
        },
        grid:   { color: theme.gridColor },
        border: { display: false },
      },
      y: {
        min: yScale.value.yMin,
        max: yScale.value.yMax,
        ticks: {
          color: theme.tickColor,
          font: { size: 11, family: "'Inter', sans-serif" },
          maxTicksLimit: 5,
          callback: (val) => `${Math.round(val)}°`,
        },
        grid:   { color: theme.gridColor },
        border: { display: false },
      },
    },
  }
})

// ─── Chart data ───────────────────────────────────────────────────────────────

const chartData = computed(() => {
  const theme = getChartTheme()
  const { pointRadii, pointStyles, pointBorderColors } = pointArrays.value
  return {
    labels: labels.value,
    datasets: [
      {
        label: `Temperature (°${props.unitSymbol})`,
        data: temperatureValues.value,
        borderColor: theme.lineColor,
        backgroundColor: 'transparent', // gradient applied by beforeDraw plugin
        fill: true,
        tension: 0.4,
        borderWidth: 2.5,
        pointRadius: pointRadii,
        pointStyle: pointStyles,
        pointBorderColor: pointBorderColors,
        pointBackgroundColor: theme.lineColor,
        pointBorderWidth: 2,
        pointHoverRadius: 6,
        pointHitRadius: 22,
      },
    ],
  }
})

// ─── Gradient plugin ──────────────────────────────────────────────────────────

// Stored dimensions to avoid infinite update loop
let lastGradientWidth  = 0
let lastGradientHeight = 0

const gradientPlugin = {
  id: 'lumicastGradient',
  beforeDraw(chart) {
    const { ctx, chartArea } = chart
    if (!chartArea) return

    const { left, right, top, bottom } = chartArea
    const width  = right - left
    const height = bottom - top

    // Only recreate gradient when dimensions change
    if (width === lastGradientWidth && height === lastGradientHeight) return
    lastGradientWidth  = width
    lastGradientHeight = height

    const baseColor = getConditionColor(props.weatherCondition)
    const gradient  = ctx.createLinearGradient(0, top, 0, bottom)

    // Resolve baseColor to RGB values via a 1×1 canvas pixel read
    const tempCanvas    = document.createElement('canvas')
    tempCanvas.width    = 1
    tempCanvas.height   = 1
    const tempCtx       = tempCanvas.getContext('2d')
    tempCtx.fillStyle   = baseColor
    tempCtx.fillRect(0, 0, 1, 1)
    const [r, g, b]     = tempCtx.getImageData(0, 0, 1, 1).data

    gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.30)`)
    gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0.00)`)

    chart.data.datasets[0].backgroundColor = gradient
    chart.update('none')
  },
}

// ─── Theme reactivity ─────────────────────────────────────────────────────────

const { resolvedTheme } = useTheme()
const chartRef = ref(null)

watch(resolvedTheme, () => {
  // Reset gradient dimensions so it rebuilds with new theme colours
  lastGradientWidth  = 0
  lastGradientHeight = 0
  // chartData and chartOptions are computed — they re-evaluate automatically.
  // Force a chart update to flush the new colours immediately.
  if (chartRef.value?.chart) {
    chartRef.value.chart.update()
  }
})

onBeforeUnmount(() => {
  if (chartRef.value?.chart) {
    chartRef.value.chart.destroy()
  }
})
</script>

<template>
  <section class="temp-chart-card">
    <!-- Header — always rendered, even with no data -->
    <div class="chart-header">
      <div class="chart-title-group">
        <h3 class="chart-title">Temperature Today</h3>
        <p class="chart-subtitle">Hourly temperature trend</p>
      </div>

      <!-- Contextual summary — only when data is valid -->
      <div v-if="hasValidData" class="chart-summary">
        <div class="summary-stat">
          <span class="summary-label">Current</span>
          <span class="summary-value">{{ formatTempLabel(currentTemp, unitSymbol) }}</span>
        </div>
        <div class="summary-divider" aria-hidden="true"></div>
        <div class="summary-stat">
          <span class="summary-label">Peak</span>
          <span class="summary-value">{{ formatTempLabel(peakTemp, unitSymbol) }}</span>
        </div>
      </div>
    </div>

    <!-- Peak time + temperature story -->
    <div v-if="hasValidData" class="chart-context">
      <span class="peak-time-label">Peak expected around {{ peakTimeLabel }}</span>
      <span v-if="temperatureStory" class="story-phrase">{{ temperatureStory }}</span>
    </div>

    <!-- Chart area -->
    <div
      class="chart-container"
      :aria-label="
        hasValidData
          ? `Temperature chart: current ${formatTempLabel(currentTemp, unitSymbol)}, peak ${formatTempLabel(peakTemp, unitSymbol)}`
          : 'Temperature data unavailable'
      "
    >
      <Line
        v-if="hasValidData"
        ref="chartRef"
        :data="chartData"
        :options="chartOptions"
        :plugins="[gradientPlugin]"
      />
      <div v-else class="chart-placeholder">
        <span>Temperature data unavailable</span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.temp-chart-card {
  display: flex;
  flex-direction: column;
  gap: var(--lc-sp-3);
  padding: var(--lc-sp-4);
  padding-bottom: var(--lc-sp-5);
}

.chart-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--lc-sp-4);
}

.chart-title-group {
  display: flex;
  flex-direction: column;
  gap: var(--lc-sp-1);
}

.chart-title {
  margin: 0;
  font-size: var(--lc-text-h3);
  font-weight: var(--lc-weight-semibold);
  color: var(--lc-text-primary);
  line-height: var(--lc-leading-tight);
}

.chart-subtitle {
  margin: 0;
  font-size: var(--lc-text-caption);
  color: var(--lc-text-muted);
}

.chart-summary {
  display: flex;
  align-items: center;
  gap: var(--lc-sp-3);
  flex-shrink: 0;
}

.summary-stat {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--lc-sp-1);
}

.summary-label {
  font-size: var(--lc-text-label);
  font-weight: var(--lc-weight-medium);
  color: var(--lc-text-muted);
  text-transform: uppercase;
  letter-spacing: var(--lc-tracking-wider);
}

.summary-value {
  font-size: var(--lc-text-h3);
  font-weight: var(--lc-weight-semibold);
  color: var(--lc-text-primary);
  line-height: 1;
}

.summary-divider {
  width: 1px;
  height: var(--lc-sp-6);
  background: var(--lc-border-subtle);
  flex-shrink: 0;
}

.chart-context {
  display: flex;
  align-items: center;
  gap: var(--lc-sp-3);
  flex-wrap: wrap;
}

.peak-time-label {
  font-size: var(--lc-text-caption);
  color: var(--lc-text-muted);
}

.story-phrase {
  font-size: var(--lc-text-caption);
  color: var(--lc-text-faint);
}

.chart-container {
  position: relative;
  height: 180px;
  min-height: 160px;
}

.chart-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--lc-text-faint);
  font-size: var(--lc-text-body-sm);
}

/* Responsive heights */
@media (max-width: 320px) {
  .chart-container {
    height: 160px;
    min-height: 160px;
  }
}

@media (min-width: 601px) {
  .chart-container {
    height: 240px;
  }
}

@media (min-width: 768px) {
  .chart-container {
    height: 260px;
  }
}
</style>
