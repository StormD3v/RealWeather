<template>
  <div
    class="skeleton"
    :class="[shapeClass, { 'skeleton--text': text }]"
    :style="inlineStyle"
    aria-hidden="true"
  ></div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  width:  { type: String, default: '100%' },
  height: { type: String, default: '16px' },
  shape:  { type: String, default: 'rect', validator: (v) => ['rect', 'circle', 'pill'].includes(v) },
  text:   { type: Boolean, default: false }
})

const shapeClass = computed(() => `skeleton--${props.shape}`)
const inlineStyle = computed(() => ({ width: props.width, height: props.height }))
</script>

<style scoped>
.skeleton {
  display: block;
  background: linear-gradient(
    90deg,
    var(--lc-surface-overlay) 0%,
    var(--lc-border-glass)    50%,
    var(--lc-surface-overlay) 100%
  );
  background-size: 200% 100%;
  animation: skeletonShimmer 1.6s ease infinite;
}

html.light .skeleton {
  background: linear-gradient(
    90deg,
    rgba(30, 60, 110, 0.06)  0%,
    rgba(30, 60, 110, 0.13)  50%,
    rgba(30, 60, 110, 0.06)  100%
  );
  background-size: 200% 100%;
}

.skeleton--rect   { border-radius: var(--lc-radius-sm); }
.skeleton--pill   { border-radius: var(--lc-radius-pill); }
.skeleton--circle { border-radius: var(--lc-radius-full); }
.skeleton--text   { border-radius: var(--lc-radius-pill); height: 14px; }

@keyframes skeletonShimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
</style>
