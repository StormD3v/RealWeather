/** @type {import('tailwindcss').Config} */
export default {
    darkMode: 'class',
    content: [
        './index.html',
        './src/**/*.{vue,js,ts,jsx,tsx}'
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif']
            },
            colors: {
                // Map Tailwind utilities to design tokens
                'lc-accent': 'var(--lc-accent)',
                'lc-green': 'var(--lc-green)',
                'lc-success': 'var(--lc-success)',
                'lc-warning': 'var(--lc-warning)',
                'lc-error': 'var(--lc-error)',
                'lc-text': 'var(--lc-text-primary)',
                'lc-muted': 'var(--lc-text-muted)',
                'lc-border': 'var(--lc-border)',
                'lc-surface': 'var(--lc-surface)'
            },
            borderRadius: {
                'lc-sm': 'var(--lc-radius-sm)',
                'lc-md': 'var(--lc-radius-md)',
                'lc-lg': 'var(--lc-radius-lg)',
                'lc-xl': 'var(--lc-radius-xl)',
                'lc-2xl': 'var(--lc-radius-2xl)',
                'lc-pill': 'var(--lc-radius-pill)'
            },
            transitionDuration: {
                'lc-fast': '100ms',
                'lc-normal': '200ms',
                'lc-slow': '350ms'
            }
        }
    },
    plugins: []
}
