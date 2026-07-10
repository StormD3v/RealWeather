/**
 * Router — currently a single-page application with no named routes.
 * This file is ready for future multi-view expansion (Phase 2+).
 */
import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: []
})

export default router
