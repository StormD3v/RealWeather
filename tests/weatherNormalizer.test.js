import { describe, expect, it } from 'vitest'
import { normalizeWeather } from '@/services/weatherNormalizer'

describe('normalizeWeather', () => {
  it('normalizes current weather and forecast safely', () => {
    const rawCurrent = {
      dt: 100,
      name: 'Test City',
      main: { temp: 28, feels_like: 30, humidity: 82, pressure: 1006 },
      wind: { speed: 5.2 },
      weather: [{ main: 'Rain', description: 'light rain', icon: '10d' }]
    }

    const rawForecast = {
      list: [
        {
          dt: 101,
          dt_txt: '2026-02-26 12:00:00',
          main: { temp: 29, feels_like: 31, temp_min: 27, temp_max: 30, humidity: 80, pressure: 1005 },
          wind: { speed: 6 },
          pop: 0.6,
          rain: { '3h': 1.5 },
          weather: [{ main: 'Rain', description: 'moderate rain', icon: '10d' }]
        }
      ]
    }

    const normalized = normalizeWeather(rawCurrent, rawForecast)

    expect(normalized.current.name).toBe('Test City')
    expect(normalized.current.main.temp).toBe(28)
    expect(normalized.current.rain['1h']).toBeNull()
    expect(normalized.forecast).toHaveLength(1)
    expect(normalized.hourlyNext12).toHaveLength(1)
    expect(normalized.dailySummaries).toHaveLength(1)
    expect(normalized.dailySummaries[0].dominantCondition).toBe('Rain')
    expect(normalized.dailySummaries[0].totalRainfall).toBe(1.5)
  })

  it('handles missing optional fields without crashing', () => {
    const normalized = normalizeWeather({}, { list: [{}] })
    expect(normalized.current.weather[0].main).toBe('Clear')
    expect(normalized.forecast[0].rain['3h']).toBeNull()
    expect(normalized.forecast[0].snow['3h']).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Phase 3.5 — Enrichment field passthrough
// ---------------------------------------------------------------------------

describe('normalizeWeather — Phase 3.5 enrichment passthrough', () => {

  const baseRaw = {
    dt: 100,
    name: 'London',
    main: { temp: 20, feels_like: 19, humidity: 55, pressure: 1013 },
    wind: { speed: 10 },
    weather: [{ main: 'Clear', description: 'clear sky', icon: '01d' }]
  }

  it('preserves rawCurrent.aqi when present', () => {
    const raw = { ...baseRaw, aqi: 127 }
    const normalized = normalizeWeather(raw, { list: [] })
    expect(normalized.current.aqi).toBe(127)
  })

  it('preserves rawCurrent.aqi = 0 (good air quality — valid value)', () => {
    const raw = { ...baseRaw, aqi: 0 }
    const normalized = normalizeWeather(raw, { list: [] })
    expect(normalized.current.aqi).toBe(0)
  })

  it('preserves rawCurrent.uv_index_enriched when present', () => {
    const raw = { ...baseRaw, uv_index_enriched: 7.3 }
    const normalized = normalizeWeather(raw, { list: [] })
    expect(normalized.current.uv_index_enriched).toBe(7.3)
  })

  it('preserves both aqi and uv_index_enriched together', () => {
    const raw = { ...baseRaw, aqi: 200, uv_index_enriched: 9.1 }
    const normalized = normalizeWeather(raw, { list: [] })
    expect(normalized.current.aqi).toBe(200)
    expect(normalized.current.uv_index_enriched).toBe(9.1)
  })

  it('does NOT add aqi property when rawCurrent.aqi is null', () => {
    const raw = { ...baseRaw, aqi: null }
    const normalized = normalizeWeather(raw, { list: [] })
    expect(normalized.current).not.toHaveProperty('aqi')
  })

  it('does NOT add aqi property when rawCurrent.aqi is absent', () => {
    const normalized = normalizeWeather(baseRaw, { list: [] })
    expect(normalized.current).not.toHaveProperty('aqi')
  })

  it('does NOT add uv_index_enriched when absent', () => {
    const normalized = normalizeWeather(baseRaw, { list: [] })
    expect(normalized.current).not.toHaveProperty('uv_index_enriched')
  })

  it('does NOT crash when rawCurrent is empty', () => {
    expect(() => normalizeWeather({}, { list: [] })).not.toThrow()
    const result = normalizeWeather({}, { list: [] })
    expect(result.current).not.toHaveProperty('aqi')
    expect(result.current).not.toHaveProperty('uv_index_enriched')
  })

  it('does NOT crash when rawCurrent is undefined', () => {
    expect(() => normalizeWeather(undefined, { list: [] })).not.toThrow()
  })

  it('existing fields are not affected by enrichment passthrough', () => {
    const raw = { ...baseRaw, aqi: 80, uv_index_enriched: 5 }
    const normalized = normalizeWeather(raw, { list: [] })
    // Verify core fields unchanged
    expect(normalized.current.main.temp).toBe(20)
    expect(normalized.current.wind.speed).toBe(10)
    expect(normalized.current.weather[0].main).toBe('Clear')
    expect(normalized.current.name).toBe('London')
  })
})
