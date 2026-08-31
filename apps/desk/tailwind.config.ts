import type { Config } from 'tailwindcss'
export default {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'hsl(var(--desk-bg))', surface: 'hsl(var(--desk-surface))', raised: 'hsl(var(--desk-raised))',
        sunken: 'hsl(var(--desk-sunken))', line: 'hsl(var(--desk-line))', 'line-mocna': 'hsl(var(--desk-line-mocna))',
        ink: 'hsl(var(--desk-ink))', 'ink-2': 'hsl(var(--desk-ink-2))',
        muted: 'hsl(var(--desk-muted))', 'muted-cichy': 'hsl(var(--desk-muted-cichy))',
        accent: 'hsl(var(--desk-accent))', 'accent-hover': 'hsl(var(--desk-accent-hover))',
        'accent-ink': 'hsl(var(--desk-accent-ink))', 'accent-soft': 'hsl(var(--desk-accent-soft))',
        'accent-soft-line': 'hsl(var(--desk-accent-soft-line))', 'accent-soft-ink': 'hsl(var(--desk-accent-soft-ink))',
        focus: 'hsl(var(--desk-focus))',
        ok: 'hsl(var(--desk-ok))', warn: 'hsl(var(--desk-warn))', bad: 'hsl(var(--desk-bad))',
        'ok-soft': 'hsl(var(--desk-ok-soft))', 'warn-soft': 'hsl(var(--desk-warn-soft))', 'bad-soft': 'hsl(var(--desk-bad-soft))',
      },
      borderRadius: {
        xs: 'var(--desk-r-xs)', sm: 'var(--desk-r-sm)', DEFAULT: 'var(--desk-r-md)',
        md: 'var(--desk-r-md)', lg: 'var(--desk-r-lg)', xl: 'var(--desk-r-xl)', pill: 'var(--desk-r-pill)',
      },
      boxShadow: { pop: 'var(--desk-cien-pop)', okno: 'var(--desk-cien-okno)' },
      fontFamily: {
        sans: ['var(--desk-font-tekst)'], naglowek: ['var(--desk-font-naglowek)'], mono: ['var(--desk-font-mono)'],
      },
      maxWidth: { miara: 'var(--desk-miara)', strumien: 'var(--desk-w-strumien)' },
      width: { boczny: 'var(--desk-w-boczny)', wynik: 'var(--desk-w-wynik)' },
      height: { krok: 'var(--desk-h-krok)', wiersz: 'var(--desk-h-wiersz)', pasek: 'var(--desk-h-pasek)' },
      minHeight: { dotyk: 'var(--desk-h-dotyk)' },
      transitionTimingFunction: { wejscie: 'var(--desk-e-wejscie)', stan: 'var(--desk-e-stan)' },
    },
  },
  plugins: [],
} satisfies Config
