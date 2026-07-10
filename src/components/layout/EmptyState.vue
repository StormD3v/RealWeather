<template>
  <!-- Initial loading (no data yet) -->
  <section v-if="loading && !hasWeather" class="empty-card" role="status" aria-live="polite">
    <div class="loading-indicator">
      <span class="loading-spinner" aria-hidden="true"></span>
      <span>Loading weather data…</span>
    </div>
  </section>

  <!-- Welcome / no search yet -->
  <section
    v-else-if="!hasWeather && !error && !loading"
    class="empty-card empty-welcome"
    aria-label="Welcome screen"
  >
    <div class="empty-welcome-content">
      <h2 class="empty-logo">LumiCast</h2>
      <p class="empty-tagline">Search any city to get started</p>
      <div class="empty-search-cta">
        <div class="search-wrapper">
          <span class="search-icon" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" stroke-width="1.5"/>
              <path d="M10.5 10.5L14 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </span>
          <input
            class="search-input search-pulse"
            type="search"
            autocomplete="off"
            autocorrect="off"
            spellcheck="false"
            placeholder="Try: London, Tokyo, New York…"
            aria-label="Search city"
            :value="cityInput"
            @input="$emit('update:cityInput', $event.target.value)"
            @keyup.enter="$emit('search')"
          />
        </div>
        <button class="search-btn" @click="$emit('search')" aria-label="Search weather">Search</button>
      </div>
      <p v-if="geolocationDenied" class="meta-line">
        📍 Location access denied. Search by city to continue.
      </p>
    </div>
  </section>

  <!-- Error with no existing data -->
  <section v-else-if="error && !hasWeather" class="empty-card empty-error" role="alert">
    <div class="error-icon" aria-hidden="true">⚠️</div>
    <div>
      <h2 class="empty-error-title">Unable to load weather</h2>
      <p class="empty-error-msg">{{ error }}</p>
      <p class="meta-line">Check your network connection and try again.</p>
    </div>
  </section>
</template>

<script setup>
defineProps({
  loading:           { type: Boolean, default: false },
  hasWeather:        { type: Boolean, default: false },
  error:             { type: String,  default: null },
  geolocationDenied: { type: Boolean, default: false },
  cityInput:         { type: String,  default: '' }
})

defineEmits(['search', 'update:cityInput'])
</script>

<style scoped>
/* All class rules are defined globally in App.vue since .search-input / .search-btn
   are shared styles used both here and in the header. */
.empty-card {
  margin-top: var(--lc-sp-4);
}

.empty-error { flex-direction: row; align-items: flex-start; gap: var(--lc-sp-4); }
.error-icon  { font-size: 1.5rem; flex-shrink: 0; margin-top: 2px; }

.empty-error-title {
  margin: 0 0 var(--lc-sp-2);
  font-size: var(--lc-text-h3);
  font-weight: var(--lc-weight-bold);
  color: var(--lc-text-primary);
}

.empty-error-msg {
  margin: 0 0 var(--lc-sp-2);
  color: var(--lc-error);
  font-size: var(--lc-text-body-sm);
  font-weight: var(--lc-weight-medium);
}

.search-wrapper {
  position: relative;
  width: min(340px, 100%);
}

.search-icon {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--lc-text-muted);
  pointer-events: none;
  display: flex;
  align-items: center;
}
</style>
