<template>
  <div v-if="history.length" class="recent-searches">
    <button
      v-for="city in history"
      :key="'recent-' + city"
      type="button"
      class="recent-chip"
      @click="$emit('select', city)"
    >
      {{ city }}
    </button>
  </div>
</template>

<script setup>
defineProps({
  history: { type: Array, default: () => [] }
})

defineEmits(['select'])
</script>
