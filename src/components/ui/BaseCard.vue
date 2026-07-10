<template>
  <div class="base-card" :class="[`base-card--${variant}`, { 'base-card--hoverable': hoverable }]" v-bind="$attrs">
    <slot />
  </div>
</template>

<script setup>
const props = defineProps({
  variant: {
    type: String,
    default: 'default',
    validator: (v) => ['default', 'accent', 'success', 'warning', 'error', 'ai'].includes(v)
  },
  hoverable: { type: Boolean, default: false }
})

const variantClass = `base-card--${props.variant}`
</script>

<style scoped>
.base-card {
  border-radius: var(--lc-radius-lg);
  backdrop-filter: var(--lc-blur-md);
  -webkit-backdrop-filter: var(--lc-blur-md);
  background: var(--lc-surface-card);
  border: 1px solid var(--lc-border-glass);
  padding: var(--lc-sp-5);
  overflow: hidden;
  box-shadow: var(--lc-shadow-glass);
  transition: box-shadow var(--lc-duration-normal) var(--lc-ease),
              transform  var(--lc-duration-normal) var(--lc-ease);
}

.base-card--hoverable:hover {
  box-shadow: var(--lc-shadow-hover);
  transform: translateY(-2px);
}

.base-card--accent {
  background: linear-gradient(145deg, var(--lc-accent-subtle), var(--lc-surface-card));
  border-color: rgba(37,99,235,0.2);
}

.base-card--success {
  background: linear-gradient(135deg, var(--lc-success-subtle), var(--lc-surface-card));
  border-color: var(--lc-border-glass);
  border-left: 3px solid var(--lc-green);
}

.base-card--warning {
  background: var(--lc-warning-subtle);
  border-color: rgba(245,158,11,0.25);
}

.base-card--error {
  background: var(--lc-error-subtle);
  border-color: rgba(239,68,68,0.25);
}

.base-card--ai {
  background: linear-gradient(145deg, var(--lc-surface-overlay), var(--lc-info-subtle));
  border-color: var(--lc-border-glass);
}
</style>
