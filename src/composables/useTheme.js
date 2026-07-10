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
 */

import { ref } from 'vue'
import { useUserContext } from '@/composables/useUserContext'

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
// Exported composable
// ---------------------------------------------------------------------------

export function useTheme() {
    function setTheme(preference) {
        theme.value = preference
        localStorage.setItem(STORAGE_KEY, preference)
        applyTheme(resolve(preference))

        // Phase 3.1: sync resolved theme to context preferences (fire-and-forget)
        const resolvedPref = resolve(preference) // 'dark' or 'light'
        try {
            useUserContext().setContext({ preferences: { theme: resolvedPref } })
        } catch {
            // Context may not be ready — non-fatal
        }
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
        // Context is already initialized synchronously at module load by
        // useUserContext's _initialize(), so this read is always safe.
        try {
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
