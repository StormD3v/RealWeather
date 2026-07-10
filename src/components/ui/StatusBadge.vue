<template>
  <span class="status-badge" :class="`status-badge--${variant}`">
    <slot />
  </span>
</template>

<script setup>
defineProps({
  variant: {
    type: String,
    default: 'default',
    validator: (v) => ['default', 'success', 'warning', 'error', 'info', 'muted'].includes(v)
  }
})
</script>

<style scoped>
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--lc-sp-1);
  padding: 4px var(--lc-sp-3);
  border-radius: var(--lc-radius-pill);
  font-size: var(--lc-text-label-sm);
  font-weight: var(--lc-weight-bold);
  letter-spacing: var(--lc-tracking-wide);
  text-transform: uppercase;
  line-height: 1;
  white-space: nowrap;
  border: 1px solid transparent;
}

.status-badge--default { background: var(--lc-surface-overlay); color: var(--lc-text-secondary); border-color: var(--lc-border-glass); }
.status-badge--success { background: var(--lc-success-subtle);   color: var(--lc-success);   border-color: rgba(34,197,94,0.25); }
.status-badge--warning { background: var(--lc-warning-subtle);   color: var(--lc-warning);   border-color: rgba(245,158,11,0.25); }
.status-badge--error   { background: var(--lc-error-subtle);     color: var(--lc-error);     border-color: rgba(239,68,68,0.25); }
.status-badge--info    { background: var(--lc-info-subtle);      color: var(--lc-info);      border-color: rgba(59,130,246,0.25); }
.status-badge--muted   { background: transparent; color: var(--lc-text-muted); border-color: var(--lc-border-subtle); }
</style>
