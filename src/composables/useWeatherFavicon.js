/**
 * Updates the browser favicon to match the current weather condition.
 * Extracted from App.vue.
 */

const CONDITION_EMOJI = {
    Clear: '☀️',
    Clouds: '☁️',
    Rain: '🌧️',
    Drizzle: '🌧️',
    Thunderstorm: '⛈️',
    Snow: '❄️'
}

export function setFaviconFromWeather(condition) {
    if (typeof document === 'undefined') return

    const emoji = CONDITION_EMOJI[condition] || '☀️'
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">${emoji}</text></svg>`
    const href = `data:image/svg+xml,${encodeURIComponent(svg)}`

    let favicon = document.querySelector("link[rel='icon']")
    if (!favicon) {
        favicon = document.createElement('link')
        favicon.setAttribute('rel', 'icon')
        document.head.appendChild(favicon)
    }
    favicon.setAttribute('href', href)
}
