/**
 * uiIcons.js
 * UI icon system — inline SVG strings, same pattern as useWeatherIcons.js.
 *
 * All SVGs:
 *   - Use currentColor or var(--lc-*) for colors (never hardcoded hex)
 *   - viewBox="0 0 24 24" for UI icons (consistent with standard icon grids)
 *   - stroke-based where possible (clean, scalable)
 *   - aria-hidden="true" on every SVG (decorative; accessible labels on parents)
 *
 * Usage:
 *   import { uiIcon } from '@/utils/uiIcons'
 *   v-html="uiIcon('location')"
 */

const _cache = new Map()

// ---------------------------------------------------------------------------
// Status icons
// ---------------------------------------------------------------------------

const ALERT_SVG = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <circle cx="12" cy="12" r="10" stroke="var(--lc-error)" stroke-width="2"/>
  <line x1="12" y1="8" x2="12" y2="13" stroke="var(--lc-error)" stroke-width="2" stroke-linecap="round"/>
  <circle cx="12" cy="16.5" r="1" fill="var(--lc-error)"/>
</svg>`

const WARNING_SVG = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke="var(--lc-warning)" stroke-width="2" stroke-linejoin="round"/>
  <line x1="12" y1="9" x2="12" y2="13" stroke="var(--lc-warning)" stroke-width="2" stroke-linecap="round"/>
  <circle cx="12" cy="16.5" r="1" fill="var(--lc-warning)"/>
</svg>`

const INFO_SVG = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <circle cx="12" cy="12" r="10" stroke="var(--lc-accent)" stroke-width="2"/>
  <line x1="12" y1="16" x2="12" y2="12" stroke="var(--lc-accent)" stroke-width="2" stroke-linecap="round"/>
  <circle cx="12" cy="8.5" r="1" fill="var(--lc-accent)"/>
</svg>`

const CHECK_SVG = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <polyline points="20 6 9 17 4 12" stroke="var(--lc-success)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`

const CHECK_CIRCLE_SVG = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <circle cx="12" cy="12" r="10" stroke="var(--lc-success)" stroke-width="2"/>
  <polyline points="8 12 11 15 16 9" stroke="var(--lc-success)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`

const CLOSE_SVG = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
</svg>`

// ---------------------------------------------------------------------------
// Profile / navigation icons
// ---------------------------------------------------------------------------

const USER_SVG = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="2"/>
  <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
</svg>`

const LOCATION_SVG = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
  <circle cx="12" cy="9" r="2.5" stroke="currentColor" stroke-width="2"/>
</svg>`

const CLOCK_SVG = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
  <polyline points="12 6 12 12 16 14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`

const LEAF_SVG = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <path d="M17 8C8 10 5.9 16.17 3.82 19.98A.5.5 0 0 0 4.22 20.7C6 20 7.5 19.5 9 19c0 0 4-2 4-8 0 0 1 4-1 7.5M12 11c1-4 5-7 8-8-1 4-3 7-8 8z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`

const SHIELD_SVG = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <path d="M12 2L3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7L12 2z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
</svg>`

const SETTINGS_SVG = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/>
  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" stroke="currentColor" stroke-width="2"/>
</svg>`

const CALENDAR_SVG = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" stroke="currentColor" stroke-width="2"/>
  <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  <line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" stroke-width="2"/>
</svg>`

// ---------------------------------------------------------------------------
// Weather metric icons
// ---------------------------------------------------------------------------

const HUMIDITY_SVG = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
</svg>`

const WIND_SVG = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <path d="M9.59 4.59A2 2 0 1 1 11 8H2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  <path d="M12.59 19.41A2 2 0 1 0 14 16H2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  <path d="M6.59 11.41A2 2 0 1 0 8 8H2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
</svg>`

const TEMPERATURE_SVG = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
</svg>`

const RAIN_METRIC_SVG = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <line x1="8" y1="19" x2="8" y2="21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  <line x1="8" y1="13" x2="8" y2="15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  <line x1="12" y1="15" x2="12" y2="17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  <line x1="12" y1="21" x2="12" y2="23" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  <line x1="16" y1="13" x2="16" y2="15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  <line x1="16" y1="19" x2="16" y2="21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
</svg>`

const PRESSURE_SVG = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
  <path d="M12 6v2M12 16v2M6 12H4M20 12h-2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/>
</svg>`

// ---------------------------------------------------------------------------
// Sensitivity icons
// ---------------------------------------------------------------------------

const HEAT_SVG = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <circle cx="12" cy="12" r="5" stroke="currentColor" stroke-width="2"/>
  <line x1="12" y1="1" x2="12" y2="3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  <line x1="12" y1="21" x2="12" y2="23" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  <line x1="1" y1="12" x2="3" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  <line x1="21" y1="12" x2="23" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
</svg>`

const COLD_SVG = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <line x1="12" y1="2" x2="12" y2="22" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  <path d="M17 7l-5-5-5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M17 17l-5 5-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <line x1="2" y1="12" x2="22" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  <path d="M7 7l-5 5 5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M17 7l5 5-5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`

const POLLEN_SVG = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="2"/>
  <path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  <circle cx="12" cy="5" r="1.5" fill="currentColor"/>
  <circle cx="12" cy="19" r="1.5" fill="currentColor"/>
  <circle cx="5" cy="12" r="1.5" fill="currentColor"/>
  <circle cx="19" cy="12" r="1.5" fill="currentColor"/>
</svg>`

const UV_SVG = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <circle cx="12" cy="12" r="5" stroke="currentColor" stroke-width="2"/>
  <line x1="12" y1="2" x2="12" y2="4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  <line x1="12" y1="20" x2="12" y2="22" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  <line x1="2" y1="12" x2="4" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  <line x1="20" y1="12" x2="22" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  <path d="M9 9l1.5 4.5L12 10l1.5 3.5L15 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`

const AIR_QUALITY_SVG = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <path d="M8 12h8M6 8h10M10 16h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  <circle cx="5" cy="8" r="1.5" fill="currentColor"/>
  <circle cx="4" cy="12" r="1.5" fill="currentColor"/>
  <circle cx="8" cy="16" r="1.5" fill="currentColor"/>
</svg>`

const PRECIPITATION_SVG = RAIN_METRIC_SVG

// ---------------------------------------------------------------------------
// Activity icons
// ---------------------------------------------------------------------------

const RUNNING_SVG = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <circle cx="13" cy="4" r="1.5" stroke="currentColor" stroke-width="2"/>
  <path d="M7.5 17.5L10 13l2 2 2.5-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M10 13l-2.5 1L6 17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M14.5 9l2 1.5L18 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M12 7l1.5 2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
</svg>`

const CYCLING_SVG = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <circle cx="6" cy="16" r="3.5" stroke="currentColor" stroke-width="2"/>
  <circle cx="18" cy="16" r="3.5" stroke="currentColor" stroke-width="2"/>
  <path d="M6 16l5-8h3.5L18 16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="15" cy="6" r="1.5" stroke="currentColor" stroke-width="2"/>
  <path d="M14.5 8L12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
</svg>`

const HIKING_SVG = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <circle cx="12" cy="4" r="1.5" stroke="currentColor" stroke-width="2"/>
  <path d="M9 20l2-6 2 3 2-8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M7 10l5-4 3 3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M6 20h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  <path d="M5 12l1.5-2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
</svg>`

const GARDENING_SVG = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <path d="M12 22V12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  <path d="M12 12C12 12 8 9 8 5a4 4 0 0 1 8 0c0 4-4 7-4 7z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
  <path d="M12 16c0 0-3-2-5-1a3 3 0 0 0 5 3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M12 19c0 0 3-2 5-1a3 3 0 0 1-5 3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`

const PHOTOGRAPHY_SVG = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
  <circle cx="12" cy="13" r="4" stroke="currentColor" stroke-width="2"/>
</svg>`

const GOLF_SVG = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <line x1="12" y1="2" x2="12" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  <path d="M12 2l6 4-6 4V2z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
  <ellipse cx="12" cy="20" rx="5" ry="2" stroke="currentColor" stroke-width="2"/>
</svg>`

const DINING_SVG = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <path d="M18 8h1a4 4 0 0 1 0 8h-1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
  <line x1="6" y1="1" x2="6" y2="4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  <line x1="10" y1="1" x2="10" y2="4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  <line x1="14" y1="1" x2="14" y2="4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
</svg>`

const DOG_WALKING_SVG = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <circle cx="7" cy="4" r="1.5" stroke="currentColor" stroke-width="2"/>
  <path d="M6 7l-1 5h4l1-3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M5 12l-1 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  <path d="M9 12l1 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  <path d="M13 9l2-2 3 1 1 3-2 1" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M15 13l1 3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  <path d="M18 13l1 3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  <path d="M8 7l3 2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
</svg>`

const SWIMMING_SVG = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <path d="M2 12c2-2 4-2 6 0s4 2 6 0 4-2 6 0" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  <path d="M2 17c2-2 4-2 6 0s4 2 6 0 4-2 6 0" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  <circle cx="13" cy="5" r="1.5" stroke="currentColor" stroke-width="2"/>
  <path d="M10 8l3-3 3 2-2 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`

const SAILING_SVG = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <path d="M12 2v12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  <path d="M12 2L4 14h8V2z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
  <path d="M2 17h20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  <path d="M4 17l-1 4h18l-1-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`

const UNKNOWN_SVG = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  <circle cx="12" cy="17" r="1" fill="currentColor"/>
</svg>`

// ---------------------------------------------------------------------------
// Theme / branding icons
// ---------------------------------------------------------------------------

const SUN_SVG = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <circle cx="12" cy="12" r="5" stroke="currentColor" stroke-width="2"/>
  <line x1="12" y1="1" x2="12" y2="3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  <line x1="12" y1="21" x2="12" y2="23" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  <line x1="1" y1="12" x2="3" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  <line x1="21" y1="12" x2="23" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
</svg>`

const MOON_SVG = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`

// ---------------------------------------------------------------------------
// Saved-location slot icons
// ---------------------------------------------------------------------------

const HOME_SVG = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
  <polyline points="9 22 9 12 15 12 15 22" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
</svg>`

const GRADUATION_CAP_SVG = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <polygon points="12 2 22 8.5 12 15 2 8.5 12 2" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
  <polyline points="6 11.5 6 17.5 12 21 18 17.5 18 11.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`

const BRIEFCASE_SVG = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <rect x="2" y="7" width="20" height="14" rx="2" ry="2" stroke="currentColor" stroke-width="2"/>
  <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
  <line x1="12" y1="12" x2="12" y2="12" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
</svg>`

// ---------------------------------------------------------------------------
// Decorative icons
// ---------------------------------------------------------------------------

const SPARKLES_SVG = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
  <path d="M19 3l.75 2.25L22 6l-2.25.75L19 9l-.75-2.25L16 6l2.25-.75L19 3z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
  <path d="M5 15l.5 1.5L7 17l-1.5.5L5 19l-.5-1.5L3 17l1.5-.5L5 15z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
</svg>`

// ---------------------------------------------------------------------------
// Icon map
// ---------------------------------------------------------------------------

const ICON_MAP = {
  // status
  alert: ALERT_SVG,
  warning: WARNING_SVG,
  info: INFO_SVG,
  check: CHECK_SVG,
  'check-circle': CHECK_CIRCLE_SVG,
  close: CLOSE_SVG,
  // theme
  sun: SUN_SVG,
  moon: MOON_SVG,
  // profile / nav
  user: USER_SVG,
  location: LOCATION_SVG,
  clock: CLOCK_SVG,
  leaf: LEAF_SVG,
  shield: SHIELD_SVG,
  settings: SETTINGS_SVG,
  calendar: CALENDAR_SVG,
  // saved-location slots
  home: HOME_SVG,
  school: GRADUATION_CAP_SVG,
  work: BRIEFCASE_SVG,
  // decorative
  sparkles: SPARKLES_SVG,
  // weather metrics
  humidity: HUMIDITY_SVG,
  wind: WIND_SVG,
  temperature: TEMPERATURE_SVG,
  rain: RAIN_METRIC_SVG,
  pressure: PRESSURE_SVG,
  // sensitivities
  heat: HEAT_SVG,
  cold: COLD_SVG,
  pollen: POLLEN_SVG,
  uv: UV_SVG,
  'air-quality': AIR_QUALITY_SVG,
  precipitation: PRECIPITATION_SVG,
  // activities
  running: RUNNING_SVG,
  cycling: CYCLING_SVG,
  hiking: HIKING_SVG,
  gardening: GARDENING_SVG,
  photography: PHOTOGRAPHY_SVG,
  golf: GOLF_SVG,
  'outdoor-dining': DINING_SVG,
  'dog-walking': DOG_WALKING_SVG,
  swimming: SWIMMING_SVG,
  sailing: SAILING_SVG,
  // fallback
  unknown: UNKNOWN_SVG
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns an inline SVG string for the given icon name.
 * Falls back to the unknown/question icon for unrecognised names.
 *
 * @param {string} name — key from ICON_MAP
 * @returns {string} SVG markup string
 */
export function uiIcon(name) {
  if (_cache.has(name)) return _cache.get(name)
  const svg = ICON_MAP[name] ?? UNKNOWN_SVG
  _cache.set(name, svg)
  return svg
}

/**
 * Convenience re-export of the full icon name list (useful for debugging).
 */
export const ICON_NAMES = Object.keys(ICON_MAP)
