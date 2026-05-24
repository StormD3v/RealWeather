import { computed, defineComponent, h } from 'vue'

type HourlyPoint = {
  dt_txt?: string
  dt?: number
  pop?: number
  uvi?: number
  main?: {
    temp?: number
    humidity?: number
  }
  wind?: {
    speed?: number
  }
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

export default defineComponent({
  name: 'HourlyDecisionTimeline',
  props: {
    weatherData: {
      type: Object,
      default: () => ({})
    },
    hourlyForecast: {
      type: Array as () => HourlyPoint[],
      default: () => []
    },
    currentWeather: {
      type: Object,
      default: null
    },
    iconSvg: {
      type: Function,
      required: true
    },
    toDisplayTemp: {
      type: Function,
      required: true
    },
    unitSymbol: {
      type: String,
      default: 'C'
    }
  },
  setup(props) {
    const timeline = computed(() => {
      const data = (props.weatherData as any) || {}
      const current = data.currentWeather || props.currentWeather
      const hourly = Array.isArray(data.hourlyForecast) ? data.hourlyForecast : props.hourlyForecast
      const currentUv = toNumber((current as any)?.uvi ?? (current as any)?.uvIndex, 0)

      return (hourly || []).slice(0, 8).map((slot) => {
        const temp = toNumber(slot?.main?.temp, 0)
        const humidity = toNumber(slot?.main?.humidity, toNumber((current as any)?.main?.humidity, 50))
        const wind = toNumber(slot?.wind?.speed, toNumber((current as any)?.wind?.speed, 0))
        const rawPop = toNumber(slot?.pop, 0)
        const rainProbability = rawPop > 1 ? Math.round(rawPop) : Math.round(rawPop * 100)
        const precipitationAmount = toNumber(slot?.rain?.['1h'] ?? slot?.rain?.['3h'] ?? 0)
        const uv = toNumber(slot?.uvi, currentUv)
        const condition = String(slot?.weather?.[0]?.main || '')
        const comfortScore = computeComfortScore(temp, humidity, wind)

        // Avoid recommending "Great time" when there's measurable precipitation
        const hasPrecipitation = precipitationAmount > 0 || rainProbability >= 30

        let recommendation = 'Not the best outside. Keep trips short.'
        if (rainProbability > 50) {
          recommendation = 'Stay indoors if possible.'
        } else if (!hasPrecipitation) {
          // Only consider positive recommendations when no precipitation and low rain chance
          recommendation = 'Great time to go outside!'
          if (uv > 7) {
            recommendation = 'The sun is strong. Stay in shade.'
          } else if (wind > 30) {
            recommendation = "It's windy out. Stay sheltered if you can."
          } else if (temp < 18 || temp > 25 || comfortScore < 65) {
            recommendation = 'Not the best outside. Keep trips short.'
          }
        }

        return {
          hour: formatHour(slot?.dt_txt, slot?.dt),
          tempDisplay: `${(props.toDisplayTemp as any)(temp)}°${props.unitSymbol}`,
          icon: (props.iconSvg as any)(condition || 'Clear'),
          recommendation
        }
      })
    })

    return () =>
      h(
        'section',
        {
          class:
            'hourly-decision-timeline rounded-2xl bg-white/10 backdrop-blur p-6 shadow-lg border border-white/10'
        },
        [
          h('h3', { class: 'm-0 text-[22px] font-semibold text-white' }, 'Hourly Decision Timeline'),
          h(
            'p',
            { class: 'mt-1 mb-0 text-xs text-white/75' },
            'Decision guidance for each hour based on comfort and disruption risk'
          ),
          h(
            'div',
            {
              class:
                'mt-4 flex gap-3 overflow-x-auto pb-2 scroll-smooth'
            },
            timeline.value.map((item, index) =>
              h(
                'article',
                {
                  key: `timeline-${index}`,
                  class:
                    'min-w-[180px] rounded-xl bg-white/10 border border-white/15 p-3 transition duration-200 hover:bg-white/15 hover:shadow-[0_8px_24px_rgba(0,0,0,0.2)]'
                },
                [
                  h('p', { class: 'm-0 text-xs font-semibold tracking-wide text-white/80' }, item.hour),
                  h('div', {
                    class: 'mt-2 h-8 w-8 [&_svg]:h-8 [&_svg]:w-8',
                    innerHTML: item.icon
                  }),
                  h('p', { class: 'mt-2 mb-0 text-sm font-semibold text-white' }, item.tempDisplay),
                  h('p', { class: 'mt-2 mb-0 text-xs leading-relaxed text-white/85' }, item.recommendation)
                ]
              )
            )
          )
        ]
      )
  }
})
