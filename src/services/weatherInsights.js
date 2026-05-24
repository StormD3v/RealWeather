function round(value) {
  return Math.round(Number(value) || 0)
}

function insight(message, level = 'normal') {
  return { message, level }
}

export function generateWeatherInsights(normalizedWeather) {
  const insights = []

  const current = normalizedWeather?.current
  const hourly = normalizedWeather?.hourlyNext24 || []
  const daily = normalizedWeather?.dailySummaries || []

  if (!current) return [insight('Weather insights are unavailable until data loads.')]

  const temp = Number(current.main?.temp ?? 0)
  const feelsLike = Number(current.main?.feels_like ?? temp)
  const humidity = Number(current.main?.humidity ?? 0)
  const windSpeed = Number(current.wind?.speed ?? 0)
  const currentRain = Number(current.rain?.['1h'] ?? 0)
  const precipitation = Number(current.rain?.chance ?? 0)
  const condition = String(current.weather?.[0]?.main || '')

  // Rain-based insights
  if (precipitation > 2) {
    insights.push({
      type: "weather-alert",
      message: "Rain expected. Outdoor activity and customer flow may decrease."
    })
  }

  const next3h = hourly[0]
  const next24h = hourly.slice(0, 8)

  const hasImminentRain =
    currentRain > 0 ||
    Number(next3h?.pop ?? 0) >= 0.45 ||
    Number(next3h?.rain?.['3h'] ?? 0) > 0

  if (hasImminentRain) {
    insights.push(insight('Rain expected within 3 hours.', 'warning'))
  } else if (next24h.some((slot) => Number(slot?.pop ?? 0) >= 0.4)) {
    insights.push(insight('Light precipitation risk later today.', 'normal'))
  }

  if (humidity >= 75 && feelsLike >= 30) {
    insights.push(insight('High humidity and heat may feel uncomfortable.', 'warning'))
  } else if (humidity <= 30 && temp >= 28) {
    insights.push(insight('Dry and warm conditions expected; stay hydrated.', 'normal'))
  }

  if (windSpeed > 12) {
    insights.push(insight('Very strong winds detected — avoid outdoor activities.', 'severe'))
  } else if (windSpeed >= 10) {
    insights.push(insight('Strong winds — outdoor activities not recommended.', 'warning'))
  } else if (windSpeed >= 7) {
    insights.push(insight('Breezy conditions expected across the day.', 'normal'))
  }

  const rainIn24h = next24h.reduce(
    (acc, slot) => acc + Number(slot?.rain?.['3h'] ?? 0) + Number(slot?.snow?.['3h'] ?? 0),
    0
  )
  if (rainIn24h >= 10) {
    insights.push(
      insight(`Heavy precipitation likely today (${round(rainIn24h)} mm total expected).`, 'severe')
    )
  } else if (rainIn24h >= 6) {
    insights.push(
      insight(`Heavy precipitation likely today (${round(rainIn24h)} mm total expected).`, 'warning')
    )
  }

  if (condition === 'Thunderstorm') {
    insights.push(insight('Thunderstorm conditions detected. Minimize outdoor exposure.', 'severe'))
  }

  if (temp > 35 || feelsLike > 35) {
    insights.push(insight('Extreme heat risk — hydrate and limit prolonged sun exposure.', 'severe'))
  }

  if (temp < 0 || feelsLike < 0) {
    insights.push(insight('Extreme cold conditions — dress in layers and limit outdoor time.', 'severe'))
  }

  if (daily.length >= 2) {
    const todayAvg = (Number(daily[0].minTemp) + Number(daily[0].maxTemp)) / 2
    const tomorrowAvg = (Number(daily[1].minTemp) + Number(daily[1].maxTemp)) / 2
    const delta = tomorrowAvg - todayAvg

    if (delta <= -5) {
      insights.push(insight('Temperature dropping significantly tomorrow.', 'warning'))
    } else if (delta >= 5) {
      insights.push(insight('Noticeable warm-up expected tomorrow.', 'normal'))
    }
  }

  if (insights.length === 0) {
    insights.push(insight('Conditions look stable with low short-term weather disruption.'))
  }

  return insights.slice(0, 5)
}
