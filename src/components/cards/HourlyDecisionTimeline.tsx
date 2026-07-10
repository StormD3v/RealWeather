import { computed, defineComponent, h } from 'vue'

type HourlyPoint = {
  dt_txt?: string
  dt?: number
  pop?: number
  uvi?: number
  main?: { temp?: number; humidity?: number }
  wind?: { speed?: number }
  weather?: Array<{ main?: string }>
}

function toNumber(value: unknown, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function formatHour(value?: string, dt?: number): string {
  const date = value
    ? new Date(String(value).replace(' ', 'T'))
    : new Date((dt || 0) * 1000)
  if (Number.isNaN(date.getTime())) return 'Now'
  return date
    .toLocaleTimeString([], { hour: 'numeric', hour12: true })
    .replace(/\s/g, ' ')
    .toUpperCase()
}

function computeComfortScore(temp: number, humidity: number, wind: number): number {
  let score = 100
  score -= Math.abs(temp - 22) * 3
  if (humidity > 70) score -= (humidity - 70) * 0.6
  if (humidity < 30) score -= (30 - humidity) * 0.4
  if (wind > 30) score -= (wind - 30) * 1.4
  return Math.round(clamp(score, 0, 100))
}

/** Map rain probability (0-100) to a CSS token-based colour class */
function rainBadgeClass(rainProbability: number): string {
  if (rainProbability > 50) return 'hdt-badge hdt-badge--rain'
  if (rainProbability >= 30) return 'hdt-badge hdt-badge--caution'
  return 'hdt-badge hdt-badge--clear'
}

export default defineComponent({
  name: 'HourlyDecisionTimeline',
  props: {
    weatherData: { type: Object, default: () => ({}) },
    hourlyForecast: { type: Array as () => HourlyPoint[], default: () => [] },
    currentWeather: { type: Object, default: null },
    iconSvg: { type: Function, required: true },
    toDisplayTemp: { type: Function, required: true },
    unitSymbol: { type: String, default: 'C' }
  },

  setup(props) {
    const timeline = computed(() => {
      const data = (props.weatherData as any) || {}
      const current = data.currentWeather || props.currentWeather
      const hourly = Array.isArray(data.hourlyForecast)
        ? data.hourlyForecast
        : props.hourlyForecast

      const currentUv = toNumber(
        (current as any)?.uvi ?? (current as any)?.uvIndex,
        0
      )

      return (hourly || []).slice(0, 8).map((slot) => {
        const temp = toNumber(slot?.main?.temp, 0)
        const humidity = toNumber(slot?.main?.humidity, toNumber((current as any)?.main?.humidity, 50))
        const wind = toNumber(slot?.wind?.speed, toNumber((current as any)?.wind?.speed, 0))
        const rawPop = toNumber(slot?.pop, 0)
        const rainPct = rawPop > 1 ? Math.round(rawPop) : Math.round(rawPop * 100)
        const precip = toNumber((slot as any)?.rain?.['1h'] ?? (slot as any)?.rain?.['3h'] ?? 0)
        const uv = toNumber((slot as any)?.uvi, currentUv)
        const condition = String(slot?.weather?.[0]?.main || '')
        const comfort = computeComfortScore(temp, humidity, wind)
        const hasPrecip = precip > 0 || rainPct >= 30

        let rec = 'Conditions are mixed. Keep trips short.'
        if (rainPct > 50) {
          rec = 'Rain likely. Stay indoors if possible.'
        } else if (!hasPrecip) {
          rec = 'Great time to head outside!'
          if (uv > 7) rec = 'Strong sun. Shade recommended.'
          else if (wind > 30) rec = 'Very windy. Seek shelter outdoors.'
          else if (temp < 18 || temp > 25 || comfort < 65) rec = 'Conditions are mixed. Keep trips short.'
        }

        return {
          hour: formatHour(slot?.dt_txt, slot?.dt),
          tempDisplay: `${(props.toDisplayTemp as any)(temp)}°${props.unitSymbol}`,
          icon: (props.iconSvg as any)(condition || 'Clear'),
          rainPct,
          rec,
          badgeClass: rainBadgeClass(rainPct),
          comfortScore: comfort
        }
      })
    })

    return () =>
      h('section', { class: 'hdt-root' }, [
        /* ── Header ── */
        h('div', { class: 'hdt-header' }, [
          h('h3', { class: 'hdt-title' }, 'Hourly Decision Guide'),
          h('p', { class: 'hdt-subtitle' }, 'Hour-by-hour comfort and disruption risk')
        ]),

        /* ── Scroll container ── */
        h('div', { class: 'hdt-scroll', role: 'list' },
          timeline.value.map((item, index) =>
            h('article', {
              key: `hdt-${index}`,
              class: 'hdt-card',
              role: 'listitem',
              'aria-label': `${item.hour}: ${item.tempDisplay}, ${item.rec}`
            }, [
              /* Time */
              h('p', { class: 'hdt-time' }, item.hour),

              /* Icon */
              h('div', {
                class: 'hdt-icon',
                innerHTML: item.icon,
                'aria-hidden': 'true'
              }),

              /* Temperature */
              h('p', { class: 'hdt-temp' }, item.tempDisplay),

              /* Rain badge */
              item.rainPct > 0
                ? h('span', { class: item.badgeClass }, `${item.rainPct}%`)
                : h('span', { class: 'hdt-badge hdt-badge--clear' }, 'Dry'),

              /* Recommendation */
              h('p', { class: 'hdt-rec' }, item.rec)
            ])
          )
        )
      ])
  }
})
