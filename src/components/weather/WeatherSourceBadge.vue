<script setup>
import { computed } from 'vue'

const props = defineProps({
  source: { type: String, default: null },
  timestamp: { type: Number, default: null }
})

const label = computed(() => {
  if (props.source === 'cache') return '⟳ Cached'
  if (props.source === 'stale-cache') return '⚠ Offline Cache'
  if (props.source === 'network') return '● Live'
  return null
})

const badgeClass = computed(() => {
  if (props.source === 'stale-cache') return 'badge-warning'
  if (props.source === 'cache') return 'badge-muted'
  if (props.source === 'network') return 'badge-live'
  return ''
})

const details = computed(() => {
  if (!props.timestamp) return ''
  const d = new Date(props.timestamp)
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  if (props.source === 'cache' || props.source === 'stale-cache') {
    return `Cached at ${time}`
  }
  return `Updated ${time}`
})
</script>

<template>
  <div v-if="label" class="source-badge" :class="badgeClass" :title="details" role="status" aria-live="polite">
    <span class="badge-label">{{ label }}</span>
    <span v-if="details" class="badge-time">{{ details }}</span>
  </div>
</template>

<style scoped>
.source-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--lc-sp-2);
  padding: 5px var(--lc-sp-3);
  border-radius: var(--lc-radius-pill);
  font-size: var(--lc-text-label-sm);
  font-weight: var(--lc-weight-semibold);
  letter-spacing: var(--lc-tracking-wide);
  border: 1px solid var(--lc-border-glass);
  background: var(--lc-surface-overlay);
  min-height: 28px;
  white-space: nowrap;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}

.badge-live    { color: var(--lc-success); border-color: rgba(34,197,94,0.25); background: var(--lc-success-subtle); }
.badge-muted   { color: var(--lc-text-muted); }
.badge-warning { color: var(--lc-warning); border-color: rgba(245,158,11,0.25); background: var(--lc-warning-subtle); }

.badge-label { font-weight: var(--lc-weight-bold); }
.badge-time  { color: inherit; opacity: 0.75; }

@media (max-width: 600px) {
  .badge-time { display: none; }
}
</style>
