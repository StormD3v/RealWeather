<template>
  <button
    class="base-btn"
    :class="[`base-btn--${variant}`, `base-btn--${size}`, { 'base-btn--icon-only': iconOnly }]"
    :disabled="disabled"
    :type="type"
    v-bind="$attrs"
  >
    <slot />
  </button>
</template>

<script setup>
defineProps({
  variant:  { type: String, default: 'primary', validator: (v) => ['primary','secondary','ghost','danger'].includes(v) },
  size:     { type: String, default: 'md',      validator: (v) => ['sm','md','lg'].includes(v) },
  type:     { type: String, default: 'button' },
  disabled: { type: Boolean, default: false },
  iconOnly: { type: Boolean, default: false }
})
</script>

<style scoped>
.base-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--lc-sp-2);
  border: none;
  border-radius: var(--lc-radius-pill);
  font-family: var(--lc-font-family);
  font-weight: var(--lc-weight-bold);
  cursor: pointer;
  white-space: nowrap;
  transition:
    background var(--lc-transition-hover),
    color var(--lc-transition-hover),
    border-color var(--lc-transition-hover),
    box-shadow var(--lc-transition-hover),
    transform var(--lc-transition-hover);
  letter-spacing: 0.01em;
}

.base-btn:disabled { opacity: 0.45; cursor: not-allowed; pointer-events: none; }

.base-btn:not(:disabled):hover  { transform: translateY(-1px); }
.base-btn:not(:disabled):active { transform: translateY(0); }

/* Sizes */
.base-btn--sm { height: 36px; min-height: 36px; padding: 0 var(--lc-sp-4); font-size: var(--lc-text-label); }
.base-btn--md { height: 48px; min-height: 48px; padding: 0 var(--lc-sp-5); font-size: var(--lc-text-body-sm); }
.base-btn--lg { height: 56px; min-height: 56px; padding: 0 var(--lc-sp-8); font-size: var(--lc-text-body); }

.base-btn--icon-only { padding: 0; width: var(--lc-sp-10); }
.base-btn--icon-only.base-btn--sm { width: 36px; }
.base-btn--icon-only.base-btn--lg { width: 56px; }

/* Variants */
.base-btn--primary {
  background: var(--lc-accent);
  color: var(--lc-text-on-accent);
}
.base-btn--primary:not(:disabled):hover {
  background: var(--lc-accent-hover);
  box-shadow: 0 4px 14px rgba(37,99,235,0.35);
}
html.dark .base-btn--primary:not(:disabled):hover {
  box-shadow: 0 4px 14px rgba(39,192,99,0.35);
}

.base-btn--secondary {
  background: var(--lc-surface-overlay);
  color: var(--lc-text-primary);
  border: 1.5px solid var(--lc-border-glass);
}
.base-btn--secondary:not(:disabled):hover {
  background: var(--lc-surface-hover);
  border-color: var(--lc-accent);
}

.base-btn--ghost {
  background: transparent;
  color: var(--lc-text-muted);
  border: 1px solid transparent;
}
.base-btn--ghost:not(:disabled):hover {
  background: var(--lc-surface-overlay);
  color: var(--lc-text-primary);
  border-color: var(--lc-border-glass);
}

.base-btn--danger {
  background: var(--lc-error-subtle);
  color: var(--lc-error);
  border: 1px solid rgba(239,68,68,0.25);
}
.base-btn--danger:not(:disabled):hover {
  background: var(--lc-error);
  color: var(--lc-text-inverted);
  border-color: var(--lc-error);
}
</style>
