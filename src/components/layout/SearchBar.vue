<template>
  <div class="controls">
    <input
      class="search"
      :class="{ 'search-pulse': showPulse }"
      type="text"
      placeholder="Enter city name (search worldwide)..."
      v-model="modelValue"
      @keyup.enter="$emit('search')"
    />
    <button class="search-btn" @click="$emit('search')">Search</button>
    <div class="unit-toggle" aria-label="Temperature unit toggle">
      <button type="button" class="unit-btn" @click="$emit('toggle-unit')">
        {{ unitLabel }}
      </button>
    </div>
  </div>
</template>

<script setup>
defineProps({
  modelValue: { type: String, default: '' },
  unitLabel: { type: String, default: '°C' },
  showPulse: { type: Boolean, default: false }
})

defineEmits(['update:modelValue', 'search', 'toggle-unit'])
</script>
