export function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Geolocation not supported'))
      return
    }

    let finished = false
    let attempts = 0

    const overallTimer = setTimeout(() => {
      if (!finished) {
        finished = true
        reject(new Error('Geolocation timed out'))
      }
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
            setTimeout(tryOnce, 1000)
          } else {
            finished = true
            clearTimeout(overallTimer)
            reject(error)
          }
        },
        {
          enableHighAccuracy: false,
          timeout: 7000,
          maximumAge: 300000
        }
      )
    }

    tryOnce()
  })
}
