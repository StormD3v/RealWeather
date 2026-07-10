/**
 * Theme management composable.
 * Supports: system preference detection, manual toggle, persistence.
 *
 * Phase 3.1 addition: two-way sync with user context preferences.
 * - On initTheme(): if userContext.preferences.theme is set and differs
 *   from the stored lumicast-theme, the context value takes precedence.
 * - On setTheme(): also writes preferences.theme to context store.
 * - The existing lumicast-theme localStorage key continues to work —
 *   this is deprecation preparation only. No existing behavior changes.
 *
 * useUserContext is imported lazily (dynamic import) to avoid init-time
 * circular dependency: useUserContext → contextMigration → contextStore,
 * and useTheme itself is used by App.vue before context is fully loaded.
 */

import { ref } from 'vue'

const STORAGE_KEY = 'lumicast-theme'

/** 'dark' | 'light' | 'system' */
const theme = ref('system')
const resolvedTheme = ref('dark')

function getSystemPreference() {
    if (typeof window === 'undefined') return 'dark'
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(resolved) {
    if (typeof document === 'undefined') return
    const root = document.documentElement
    if (resolved === 'dark') {
        root.classList.add('dark')
        root.classList.remove('light')
    } else {
        root.classList.add('light')
        root.classList.remove('dark')
    }
    resolvedTheme.value = resolved
}

function resolve(preference) {
    if (preference === 'system') return getSystemPreference()
    return preference
}

// ---------------------------------------------------------------------------
// Context sync helper — lazy so we don't import at module init time
// ---------------------------------------------------------------------------

let _setContextTheme = null

async function _loadContextSetter() {
    if (_setContextTheme) return _setContextTheme
    try {
        const mod = await import('@/composables/useUserContext.js')
        _setContextTheme = (themeValue) => {
            try {
                mod.useUserContext().setContext({ preferences: { theme: themeValue } })
            } catch {
                // Context may not be ready — non-fatal
            }
        }
    } catch {
        _setContextTheme = null
    }
    return _setContextTheme
}

// ---------------------------------------------------------------------------
// Exported composable
// ---------------------------------------------------------------------------

export function useTheme() {
    function setTheme(preference) {
        theme.value = preference
        localStorage.setItem(STORAGE_KEY, preference)
        applyTheme(resolve(preference))

        // Phase 3.1: sync to context preferences (fire-and-forget)
        const resolvedPref = resolve(preference) // 'dark' or 'light'
        _loadContextSetter().then((setter) => {
            if (setter) setter(resolvedPref)
        }).catch(() => { })
    }

    function toggleTheme() {
        const next = resolvedTheme.value === 'dark' ? 'light' : 'dark'
        setTheme(next)
    }

    function initTheme() {
        const stored = localStorage.getItem(STORAGE_KEY) || 'system'
        theme.value = stored
        applyTheme(resolve(stored))

        // Phase 3.1: if context declares a theme preference, apply it.
        // This runs async after context is loaded — does not block init.
        _loadContextSetter().then(() => {
            try {
                // Read context directly to avoid circular dep
                const raw = localStorage.getItem('lumi.context.v1')
                if (raw) {
                    const ctx = JSON.parse(raw)
                    const ctxTheme = ctx?.preferences?.theme
                    if ((ctxTheme === 'dark' || ctxTheme === 'light') &&
                        ctxTheme !== resolvedTheme.value) {
                        applyTheme(ctxTheme)
                        theme.value = ctxTheme
                        localStorage.setItem(STORAGE_KEY, ctxTheme)
                    }
                }
            } catch {
                // Context read failure — keep existing theme
            }
        }).catch(() => { })

        // Listen for system preference changes when mode is 'system'
        if (typeof window !== 'undefined') {
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
                if (theme.value === 'system') {
                    applyTheme(e.matches ? 'dark' : 'light')
                }
            })
        }
    }

    return { theme, resolvedTheme, setTheme, toggleTheme, initTheme }
}
