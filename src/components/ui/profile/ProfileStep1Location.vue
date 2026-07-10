<script setup>
/**
 * ProfileStep1Location.vue
 * Step 1: Declare primary location via city search.
 * Reuses the weather store's fetch to resolve coords from city name.
 * Emits: complete (location written), skip (nothing written)
 */
import { ref, computed, onMounted } from 'vue'
import { useWeatherStore } from '@/stores/weather'
import { useUserContext } from '@/composables/useUserContext'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import { uiIcon } from '@/utils/uiIcons'

const emit = defineEmits(['complete', 'skip'])

const weatherStore = useWeatherStore()
const { userContext, setContext } = useUserContext()

const cityInput = ref('')
const searching = ref(false)
const searchError = ref('')
const resolvedCity = ref(null) // { name, lat, lon }

const existingPrimary = computed(() => userContext.value.location?.primary)

onMounted(() => {
  if (existingPrimary.value) {
    cityInput.value = existingPrimary.value.name
    resolvedCity.value = {
      name: existingPrimary.value.name,
      lat: existingPrimary.value.lat,
      lon: existingPrimary.value.lon
    }
  }
})

function normalize(city) {
  return String(city || '').trim().replace(/[^a-zA-Z\s\-',().]/g, '').slice(0, 60)
}

async function searchCity() {
  const normalized = normalize(cityInput.value)
  if (!normalized) {
    searchError.value = 'Please enter a city name.'
    return
  }
  searchError.value = ''
  searching.value = true
  resolvedCity.value = null

  try {
    await weatherStore.fetchWeather(normalized)
    const w = weatherStore.currentWeather
    if (w && w.coord) {
      resolvedCity.value = {
        name: w.name || normalized,
        lat: w.coord.lat,
        lon: w.coord.lon
      }
    } else {
      searchError.value = 'City not found. Try a different name.'
    }
  } catch {
    searchError.value = 'Search failed. Please try again.'
  } finally {
    searching.value = false
  }
}

function confirm() {
  if (!resolvedCity.value) return
  setContext({
    location: {
      primary: {
        name: resolvedCity.value.name,
        lat: resolvedCity.value.lat,
        lon: resolvedCity.value.lon,
        timezone: 'UTC',
        locationType: 'urban',
        confidence: 'declared'
      }
    }
  })
  emit('complete')
}

function skip() {
  emit('skip')
}
</script>

<template>
  <div class="step-location">
    <div class="step-header">
      <span class="step-icon" aria-hidden="true" v-html="uiIcon('location')"></span>
      <div>
        <h2 class="step-title">Your home location</h2>
        <p class="step-desc">LumiCast uses this to load weather automatically when you open the app.</p>
      </div>
    </div>

    <div class="search-group">
      <label for="location-input" class="field-label">City name</label>
      <div class="search-row">
        <input
          id="location-input"
          class="text-input"
          :class="{ 'text-input--error': searchError }"
          type="text"
          autocomplete="off"
          autocorrect="off"
          spellcheck="false"
          placeholder="e.g. London, New York, Tokyo…"
          aria-label="Enter your city"
          v-model="cityInput"
          @keyup.enter="searchCity"
        />
        <BaseButton
          variant="secondary"
          size="md"
          :disabled="searching || !cityInput.trim()"
          @click="searchCity"
          aria-label="Search for city"
        >
          {{ searching ? 'Searching…' : 'Search' }}
        </BaseButton>
      </div>
      <p v-if="searchError" class="field-error" role="alert">{{ searchError }}</p>
    </div>

    <div v-if="resolvedCity" class="resolved-location" role="status" aria-live="polite">
      <span class="resolved-icon" aria-hidden="true" v-html="uiIcon('check')"></span>
      <span class="resolved-name">{{ resolvedCity.name }}</span>
      <span class="resolved-coords">({{ resolvedCity.lat.toFixed(2) }}, {{ resolvedCity.lon.toFixed(2) }})</span>
    </div>

    <div class="step-actions">
      <BaseButton
        variant="primary"
        size="md"
        :disabled="!resolvedCity"
        @click="confirm"
        aria-label="Confirm this location"
      >
        Confirm location
      </BaseButton>
      <BaseButton variant="ghost" size="md" @click="skip" aria-label="Skip this step">
        Skip for now
      </BaseButton>
    </div>
  </div>
</template>

<style scoped>
.step-location { display: flex; flex-direction: column; gap: var(--lc-sp-5); }

.step-header {
  display: flex;
  align-items: flex-start;
  gap: var(--lc-sp-3);
}

.step-icon { line-height: 1; flex-shrink: 0; margin-top: 2px; display: inline-flex; width: 28px; height: 28px; }
.step-icon :deep(svg) { width: 28px; height: 28px; }

.step-title {
  margin: 0 0 var(--lc-sp-1);
  font-size: var(--lc-text-h3);
  font-weight: var(--lc-weight-bold);
  color: var(--lc-text-primary);
}

.step-desc {
  margin: 0;
  font-size: var(--lc-text-body-sm);
  color: var(--lc-text-muted);
  line-height: var(--lc-leading-relaxed);
}

.search-group { display: flex; flex-direction: column; gap: var(--lc-sp-2); }

.field-label {
  font-size: var(--lc-text-label);
  font-weight: var(--lc-weight-semibold);
  color: var(--lc-text-secondary);
  text-transform: uppercase;
  letter-spacing: var(--lc-tracking-wider);
}

.search-row { display: flex; gap: var(--lc-sp-2); align-items: center; }

.text-input {
  flex: 1;
  min-width: 0;
  padding: 12px var(--lc-sp-4);
  border-radius: var(--lc-radius-pill);
  border: 1.5px solid var(--lc-border-glass);
  background: var(--lc-surface-overlay);
  color: var(--lc-text-primary);
  font-size: var(--lc-text-body-sm);
  font-family: var(--lc-font-family);
  outline: none;
  transition: border-color var(--lc-transition-hover), box-shadow var(--lc-transition-hover);
  min-height: 48px;
}

.text-input::placeholder { color: var(--lc-text-muted); }
.text-input:hover { border-color: var(--lc-border-strong); background: var(--lc-surface-hover); }
.text-input:focus { border-color: var(--lc-accent); box-shadow: 0 0 0 3px var(--lc-accent-subtle); }
.text-input--error { border-color: var(--lc-error); }

.field-error {
  margin: 0;
  font-size: var(--lc-text-caption);
  color: var(--lc-error);
  font-weight: var(--lc-weight-medium);
}

.resolved-location {
  display: inline-flex;
  align-items: center;
  gap: var(--lc-sp-2);
  padding: var(--lc-sp-3) var(--lc-sp-4);
  border-radius: var(--lc-radius-pill);
  background: var(--lc-green-subtle);
  border: 1px solid rgba(39, 192, 99, 0.3);
  font-size: var(--lc-text-body-sm);
}

.resolved-icon { color: var(--lc-green); font-style: normal; font-weight: var(--lc-weight-bold); display: inline-flex; width: 16px; height: 16px; }
.resolved-icon :deep(svg) { width: 16px; height: 16px; }
.resolved-name { font-weight: var(--lc-weight-semibold); color: var(--lc-text-primary); }
.resolved-coords { color: var(--lc-text-muted); font-size: var(--lc-text-caption); }

.step-actions {
  display: flex;
  gap: var(--lc-sp-3);
  align-items: center;
  flex-wrap: wrap;
}
</style>
