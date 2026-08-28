import type { Config } from 'tailwindcss'
export default {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'hsl(var(--bg))', surface: 'hsl(var(--surface))', raised: 'hsl(var(--raised))',
        sunken: 'hsl(var(--sunken))', line: 'hsl(var(--line))', 'line-mocna': 'hsl(var(--line-mocna))',
        ink: 'hsl(var(--ink))', 'ink-2': 'hsl(var(--ink-2))',
        muted: 'hsl(var(--muted))', 'muted-cichy': 'hsl(var(--muted-cichy))',
        accent: 'hsl(var(--accent))', 'accent-hover': 'hsl(var(--accent-hover))',
        'accent-ink': 'hsl(var(--accent-ink))', 'accent-soft': 'hsl(var(--accent-soft))',
        'accent-soft-line': 'hsl(var(--accent-soft-line))', 'accent-soft-ink': 'hsl(var(--accent-soft-ink))',
        focus: 'hsl(var(--focus))',
        ok: 'hsl(var(--ok))', warn: 'hsl(var(--warn))', bad: 'hsl(var(--bad))',
        'ok-soft': 'hsl(var(--ok-soft))', 'warn-soft': 'hsl(var(--warn-soft))', 'bad-soft': 'hsl(var(--bad-soft))',
      },
      borderRadius: {
        xs: 'var(--r-xs)', sm: 'var(--r-sm)', DEFAULT: 'var(--r-md)',
        md: 'var(--r-md)', lg: 'var(--r-lg)', xl: 'var(--r-xl)', pill: 'var(--r-pill)',
      },
      boxShadow: { pop: 'var(--cien-pop)', okno: 'var(--cien-okno)' },
      fontFamily: {
        sans: ['var(--font-tekst)'], naglowek: ['var(--font-naglowek)'], mono: ['var(--font-mono)'],
      },
      maxWidth: { miara: 'var(--miara)', strumien: 'var(--w-strumien)' },
      width: { boczny: 'var(--w-boczny)', wynik: 'var(--w-wynik)' },
      height: { krok: 'var(--h-krok)', wiersz: 'var(--h-wiersz)', pasek: 'var(--h-pasek)' },
      minHeight: { dotyk: 'var(--h-dotyk)' },
      transitionTimingFunction: { wejscie: 'var(--e-wejscie)', stan: 'var(--e-stan)' },
    },
  },
  plugins: [],
} satisfies Config
