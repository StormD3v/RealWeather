/**
 * Weather SVG icon generation with caching.
 * Extracted from App.vue to eliminate prop-drilled iconSvg function.
 */

const iconCache = new Map()

// ---------------------------------------------------------------------------
// SVG definitions
// All colours reference CSS custom properties from tokens.css so they adapt
// automatically when the theme changes (dark ↔ light or any future theme).
// ---------------------------------------------------------------------------
function buildSunSvg() {
  const rays = Array.from({ length: 8 })
    .map((_, i) => {
      const angle = (i * Math.PI) / 4
      const x1 = 32 + Math.cos(angle) * 18
      const y1 = 32 + Math.sin(angle) * 18
      const x2 = 32 + Math.cos(angle) * 26
      const y2 = 32 + Math.sin(angle) * 26
      return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="var(--lc-sun-color)" stroke-width="3" stroke-linecap="round" />`
    })
    .join('')

  return `<svg viewBox="0 0 64 64" aria-hidden="true">
    <defs>
      <radialGradient id="sun-grad" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="var(--lc-sun-color-light)" />
        <stop offset="100%" stop-color="var(--lc-sun-color-deep)" />
      </radialGradient>
    </defs>
    <circle cx="32" cy="32" r="12" fill="url(#sun-grad)" />
    ${rays}
  </svg>`
}

const CLOUD_SVG = `<svg viewBox="0 0 64 64" aria-hidden="true">
  <path d="M20 44h26a10 10 0 0 0 0-20 14 14 0 0 0-27-3A11 11 0 0 0 20 44Z" fill="var(--lc-cloud-fill)" />
</svg>`

const RAIN_SVG = `<svg viewBox="0 0 64 64" aria-hidden="true">
  <path d="M20 38h26a10 10 0 0 0 0-20 14 14 0 0 0-27-3A11 11 0 0 0 20 38Z" fill="var(--lc-cloud-fill)" />
  <path d="M22 46l-4 8" stroke="var(--lc-rain-color)" stroke-width="3" stroke-linecap="round" />
  <path d="M34 46l-4 8" stroke="var(--lc-rain-color)" stroke-width="3" stroke-linecap="round" />
  <path d="M46 46l-4 8" stroke="var(--lc-rain-color)" stroke-width="3" stroke-linecap="round" />
</svg>`

const SNOW_SVG = `<svg viewBox="0 0 64 64" aria-hidden="true">
  <path d="M20 38h26a10 10 0 0 0 0-20 14 14 0 0 0-27-3A11 11 0 0 0 20 38Z" fill="var(--lc-cloud-fill)" />
  <circle cx="24" cy="50" r="2" fill="var(--lc-snow-color)" />
  <circle cx="34" cy="50" r="2" fill="var(--lc-snow-color)" />
  <circle cx="44" cy="50" r="2" fill="var(--lc-snow-color)" />
</svg>`

const STORM_SVG = `<svg viewBox="0 0 64 64" aria-hidden="true">
  <path d="M20 36h26a10 10 0 0 0 0-20 14 14 0 0 0-27-3A11 11 0 0 0 20 36Z" fill="var(--lc-cloud-fill)" />
  <path d="M34 38l-6 10h6l-6 10" stroke="var(--lc-sun-color)" stroke-width="3" fill="none" />
</svg>`

const FOG_SVG = `<svg viewBox="0 0 64 64" aria-hidden="true">
  <path d="M20 38h26a10 10 0 0 0 0-20 14 14 0 0 0-27-3A11 11 0 0 0 20 38Z" fill="var(--lc-cloud-fill)" />
  <path d="M18 46h30" stroke="var(--lc-fog-line)" stroke-width="3" stroke-linecap="round" />
  <path d="M22 52h26" stroke="var(--lc-fog-line)" stroke-width="3" stroke-linecap="round" />
</svg>`

// ---------------------------------------------------------------------------
// Lookup map
// ---------------------------------------------------------------------------
const ICON_MAP = {
  Clear: null, // built lazily
  Clouds: CLOUD_SVG,
  Rain: RAIN_SVG,
  Drizzle: RAIN_SVG,
  Thunderstorm: STORM_SVG,
  Snow: SNOW_SVG,
  Mist: FOG_SVG,
  Smoke: FOG_SVG,
  Haze: FOG_SVG,
  Fog: FOG_SVG
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export function iconSvg(condition) {
  const key = condition || 'Clear'
  if (iconCache.has(key)) return iconCache.get(key)

  let svg = ICON_MAP[key]
  if (svg === undefined) svg = buildSunSvg() // unknown → sun
  if (svg === null) svg = buildSunSvg() // Clear

  iconCache.set(key, svg)
  return svg
}

/** Returns the normalised condition key used for icon lookups. */
export function resolveWeatherIconKey(condition) {
  const map = {
    Clear: 'Clear',
    Clouds: 'Clouds',
    Rain: 'Rain',
    Thunderstorm: 'Thunderstorm',
    Snow: 'Snow',
    Drizzle: 'Rain',
    Mist: 'Fog',
    Fog: 'Fog',
    Haze: 'Fog'
  }
  return map[condition] || 'Clear'
}

/** Returns the CSS animation class for the main weather icon. */
export function resolveWeatherAnimationClass(condition) {
  const animationMap = {
    Clear: 'is-clear',
    Clouds: 'is-clouds',
    Rain: 'is-rain',
    Thunderstorm: 'is-thunderstorm',
    Snow: 'is-snow',
    Drizzle: 'is-drizzle',
    Mist: 'is-fog',
    Fog: 'is-fog',
    Haze: 'is-fog'
  }
  return animationMap[condition] || 'is-clear'
}
