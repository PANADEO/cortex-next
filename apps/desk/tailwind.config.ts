import type { Config } from 'tailwindcss'
export default {
  darkMode: 'class',
  // Komponenty Biurka mieszkają w pakiecie workspace, a skaner Tailwinda czyta pliki, nie importy —
  // bez drugiego wzorca klasy z pakietu wypadają z arkusza i ekran przychodzi bez stylów.
  content: ['./src/**/*.{ts,tsx}', '../../packages/@cortex/desk-ui/src/**/*.{ts,tsx}'],
  // Skiny powłoki to zwykłe klasy w `@layer base`, więc skaner Tailwinda wycina je
  // razem z całym blokiem, gdy nie znajdzie ich w treści. Forma NAPISOWA, nigdy wzorzec:
  // wzorce rozwijają się wobec nazw narzędzi i `.skin-*` i tak wypada.
  // Źródło prawdy: `safelist` w korzeniu repozytorium.
  safelist: ['skin-customs', 'skin-domino'],
  theme: {
    extend: {
      colors: {
        // Trzy nazwy powłoki, bo jej `globals.css` robi `@apply border-border`
        // i `@apply bg-background text-foreground` na `body`. Bez nich import
        // wywala się z „The `border-border` class does not exist" — utility
        // musi istnieć w TYM motywie, nie w tamtym.
        background: 'hsl(var(--background))', foreground: 'hsl(var(--foreground))',
        border: 'hsl(var(--border))',

        bg: 'hsl(var(--desk-bg))', surface: 'hsl(var(--desk-surface))', raised: 'hsl(var(--desk-raised))',
        sunken: 'hsl(var(--desk-sunken))', line: 'hsl(var(--desk-line))', 'line-mocna': 'hsl(var(--desk-line-mocna))',
        ink: 'hsl(var(--desk-ink))', 'ink-2': 'color-mix(in oklab, hsl(var(--desk-ink)) 78%, hsl(var(--desk-bg)))',
        muted: 'hsl(var(--desk-muted))', 'muted-cichy': 'color-mix(in oklab, hsl(var(--desk-muted)) 68%, hsl(var(--desk-bg)))',
        accent: 'hsl(var(--desk-accent))', 'accent-hover': 'color-mix(in oklab, hsl(var(--desk-accent)) 85%, hsl(var(--desk-ink)))',
        'accent-ink': 'hsl(var(--desk-accent-ink))', 'accent-soft': 'color-mix(in oklab, hsl(var(--desk-accent)) 12%, hsl(var(--desk-surface)))',
        'accent-soft-line': 'color-mix(in oklab, hsl(var(--desk-accent)) 30%, hsl(var(--desk-line)))', 'accent-soft-ink': 'color-mix(in oklab, hsl(var(--desk-accent)) 80%, hsl(var(--desk-ink)))',
        focus: 'hsl(var(--desk-focus))',
        ok: 'hsl(var(--desk-ok))', warn: 'hsl(var(--desk-warn))', bad: 'hsl(var(--desk-bad))',
        'ok-soft': 'color-mix(in oklab, hsl(var(--desk-ok)) 14%, hsl(var(--desk-surface)))', 'warn-soft': 'color-mix(in oklab, hsl(var(--desk-warn)) 16%, hsl(var(--desk-surface)))', 'bad-soft': 'color-mix(in oklab, hsl(var(--desk-bad)) 12%, hsl(var(--desk-surface)))',
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
