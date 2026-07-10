<template>
  <div
    v-if="detectingLocation || loading || error || successMessage"
    class="search-feedback"
  >
    <div v-if="detectingLocation" class="detecting-location">
      <span class="loading-spinner"></span>
      <span>Detecting location...</span>
    </div>
    <div v-else-if="loading" class="loading-indicator">
      <span class="loading-spinner"></span>
      <span>Searching weather...</span>
    </div>
    <div v-else-if="error" class="error-banner">{{ error }}</div>
    <div v-else-if="successMessage" class="success-banner">{{ successMessage }}</div>
  </div>
</template>

<script setup>
defineProps({
  detectingLocation: { type: Boolean, default: false },
  loading:           { type: Boolean, default: false },
  error:             { type: String,  default: null },
  successMessage:    { type: String,  default: '' }
})
</script>
