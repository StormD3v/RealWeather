export function getCurrentPosition(options = {}) {
  const FALLBACK = { lat: 6.5244, lon: 3.3792, name: 'Lagos' }

  const geolocationAvailable = typeof navigator !== 'undefined' && navigator.geolocation

  if (!geolocationAvailable) {
    return Promise.resolve({
      coords: { latitude: FALLBACK.lat, longitude: FALLBACK.lon },
      fallback: true,
      name: FALLBACK.name
    })
  }

  const GEO_OPTIONS = {
    enableHighAccuracy: false,
    timeout: 8000,
    maximumAge: 300000
  }

  return new Promise((resolve) => {
    let finished = false
    let attempts = 0

    const resolveWithFallback = () => {
      if (finished) return
      finished = true
      resolve({
        coords: { latitude: FALLBACK.lat, longitude: FALLBACK.lon },
        fallback: true,
        name: FALLBACK.name
      })
    }

    const overallTimer = setTimeout(() => {
      resolveWithFallback()
    }, 10000)

    const tryOnce = () => {
      attempts += 1
      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (finished) return
          finished = true
          clearTimeout(overallTimer)
          resolve(position)
        },
        (error) => {
          if (finished) return
          if (attempts < 2) {
            setTimeout(tryOnce, 2000)
          } else {
            clearTimeout(overallTimer)
            resolveWithFallback()
          }
        },
        GEO_OPTIONS
      )
    }

    tryOnce()
  })
}
