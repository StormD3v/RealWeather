<template>
  <section class="footer-section dashboard-section" aria-label="Site footer">
    <footer class="app-footer">
      <span class="footer-brand">LumiCast</span>
      <span class="footer-tagline">Live weather intelligence for everyday planning.</span>
      <span class="footer-attribution">
        Powered by <a href="https://open-meteo.com/" target="_blank" rel="noopener" class="footer-link">Open-Meteo</a>
      </span>
    </footer>
  </section>
</template>

<script setup>
// Stateless presentational footer.
</script>

<style scoped>
.app-footer {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--lc-sp-1);
  color: var(--lc-text-muted);
  font-size: var(--lc-text-caption);
  text-align: center;
  padding: var(--lc-sp-3) 0;
}

.footer-brand {
  color: var(--lc-text-secondary);
  font-weight: var(--lc-weight-extrabold);
  letter-spacing: var(--lc-tracking-wide);
  font-size: var(--lc-text-body-sm);
}

.footer-tagline { color: var(--lc-text-muted); }

.footer-attribution { color: var(--lc-text-faint); font-size: var(--lc-text-label); }

.footer-link {
  color: var(--lc-accent);
  text-decoration: none;
  font-weight: var(--lc-weight-semibold);
  min-height: auto;
  transition: color var(--lc-transition-hover);
}
.footer-link:hover { color: var(--lc-text-primary); }
</style>
