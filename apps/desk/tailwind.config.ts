import type { Config } from 'tailwindcss'
export default {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'hsl(var(--bg))', surface: 'hsl(var(--surface))', raised: 'hsl(var(--raised))',
        line: 'hsl(var(--line))', ink: 'hsl(var(--ink))', muted: 'hsl(var(--muted))',
        accent: 'hsl(var(--accent))', 'accent-ink': 'hsl(var(--accent-ink))',
        ok: 'hsl(var(--ok))', warn: 'hsl(var(--warn))', bad: 'hsl(var(--bad))',
      },
      borderRadius: { xl: 'var(--radius-xl)', lg: 'var(--radius-lg)', md: 'var(--radius-md)' },
      fontFamily: { sans: ['var(--font-sans)', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
} satisfies Config
