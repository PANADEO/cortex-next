import type { Config } from "tailwindcss"
import animate from "tailwindcss-animate"
import { fontFamily } from "tailwindcss/defaultTheme"

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx,mdx}",
    // `*/src/**`, nie `**`: szeroki wzorzec wchodził w
    // `packages/@cortex/*/node_modules` (dowiązania workspace'u pnpm) i
    // generował narzędzia zależne od stanu instalacji, a nie od kodu — stąd
    // ostrzeżenie Tailwinda w logu builda. Poza `src/` nie ma w tych pakietach
    // ani jednego pliku z `className`/`cva` (configi drizzle i testy skryptów).
    "./packages/@cortex/*/src/**/*.{ts,tsx,mdx}",
    "./.ladle/**/*.{ts,tsx}",
  ],
  // Skin classes applied via classList at runtime — keep them in the bundle.
  // DOPISZ TU KAŻDY NOWY `.skin-*`. Pominięcie nie objawia się brakiem skinu,
  // tylko skinem DZIAŁAJĄCYM WYŁĄCZNIE W CIEMNYM: purge warstwy `base` wycina
  // `.skin-x`, ale zostawia `.skin-x.dark`, bo token `dark` występuje w
  // źródłach. Objaw nie wskazuje na safelistę i diagnozuje się go od zera.
  //
  // Kuszący `{ pattern: /^skin-/ }` NIE DZIAŁA i jest gorszy niż brak wpisu:
  // wzorce rozwijają się po WYGENEROWANYCH narzędziach, a `.skin-*` to surowy
  // CSS z `globals.css`, więc Tailwind ostrzega „doesn't match any Tailwind CSS
  // classes" i wycina oba skiny naraz — sprawdzone. Odrzucone też wciągnięcie
  // `globals.css` do `content`: skiny przeżywają, ale skaner tokenizuje treść i
  // komentarze tego pliku, produkując narzędzia-widma (`.antialiased`,
  // `.[text-transform:var(--label-transform)]`) — czyli ten sam problem, który
  // zawężenie globu wyżej właśnie usuwa.
  safelist: ["skin-customs", "skin-domino"],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        // Pary `-foreground` tylko dla trzech pierwszych: to one są
        // WYPEŁNIENIAMI pod treścią w wariancie `chiclet` (D6), czwarty i piąty
        // służą wykresom, gdzie nic na nich nie leży.
        chart: {
          1: "hsl(var(--chart-1))",
          "1-foreground": "hsl(var(--chart-1-foreground))",
          2: "hsl(var(--chart-2))",
          "2-foreground": "hsl(var(--chart-2-foreground))",
          3: "hsl(var(--chart-3))",
          "3-foreground": "hsl(var(--chart-3-foreground))",
          4: "hsl(var(--chart-4))",
          5: "hsl(var(--chart-5))",
        },
        cortex: {
          DEFAULT: "#4A90E2",
          dark: "#2563eb",
          light: "#dbeafe",
          foreground: "#ffffff",
        },
      },
      borderRadius: {
        xs: "var(--radius-xs)",
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
        "2xl": "var(--radius-2xl)",
      },
      // Tokenem jest wyłącznie PIERWSZA pozycja stosu, fallbacki zostają
      // literałami — inaczej skin, który podmienia krój, kasowałby też stos
      // zapasowy. Stąd `slice(1)` przy mono: domyślny stos zaczyna się od
      // `ui-monospace`, więc token dublowałby tę pozycję. Wariant z projektu
      // (`--font-mono: ui-monospace, monospace` przed pełnym stosem) jest gorszy
      // niż kosmetyczny duplikat: `monospace` to rodzina GENERYCZNA, zawsze
      // rozwiązywalna, więc ucina łańcuch i zabija SFMono-Regular, Menlo,
      // Consolas i Liberation Mono, które nigdy nie dostają szansy.
      fontFamily: {
        sans: ["var(--font-sans)", ...fontFamily.sans],
        mono: ["var(--font-mono)", ...fontFamily.mono.slice(1)],
      },
      fontSize: {
        sm: ["0.813rem", { lineHeight: "1.143" }],
      },
      // DEFAULT tokenizuje samo `border`, więc każdy istniejący komponent staje
      // się skin-aware bez dotykania go; `token` jest jawnym wariantem dla
      // miejsc, które mają deklarować tę zależność wprost (app-shell, tile-menu).
      borderWidth: {
        DEFAULT: "var(--border-width)",
        token: "var(--border-width)",
      },
      boxShadow: {
        card: "var(--shadow-card)",
      },
      letterSpacing: {
        tighter: "-0.05em",
        tight: "-0.025em",
        normal: "0",
        wide: "0.025em",
        label: "var(--label-tracking)",
      },
      minHeight: {
        tile: "var(--tile-min-height)",
      },
      transitionTimingFunction: {
        "in-out": "cubic-bezier(0.4, 0, 0.2, 1)",
        out: "cubic-bezier(0, 0, 0.2, 1)",
      },
      keyframes: {
        // Gradient sweep for "working" status text (agent activity).
        shimmer: {
          "0%": { backgroundPosition: "150% 0" },
          "100%": { backgroundPosition: "-150% 0" },
        },
        // Stroke draw/undraw loop for the geometric working glyph.
        "glyph-draw": {
          "0%": { strokeDashoffset: "34.6" },
          "55%": { strokeDashoffset: "0" },
          "100%": { strokeDashoffset: "-34.6" },
        },
        "soft-pulse": {
          "0%, 100%": { opacity: "0.35" },
          "50%": { opacity: "1" },
        },
        // Wejście kafelka w wariancie `chiclet` (u Cezarego `ch-tile-in`).
        // Klatki są w configu, a nie w `globals.css`, bo to jedyna forma, w
        // której `@keyframes` NIE trafia do arkusza, dopóki `animate-tile-in`
        // nie pojawi się w źródłach — reguła dopisana ręcznie wisiałaby w
        // bundlu każdego presetu, także tych, które kaskady nie mają.
        // Kaskadę robi `animation-delay` wstawiany stylem inline (indeks
        // kafelka), a `motion-reduce:animate-none` ją kasuje: bez nazwy
        // animacji opóźnienie nie ma czego opóźniać, więc styl inline nie musi
        // być nadpisywany.
        "tile-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        shimmer: "shimmer 2.4s linear infinite",
        "glyph-draw": "glyph-draw 2.6s cubic-bezier(0.4, 0, 0.2, 1) infinite",
        "soft-pulse": "soft-pulse 1.6s ease-in-out infinite",
        // `backwards`, nie `both` jak w oryginale Cezarego — i to jest POPRAWKA
        // DEFEKTU, nie różnica smaku. `both` trzyma klatkę końcową w nieskończoność
        // po zakończeniu animacji, a właściwości animowane biją w kaskadzie
        // deklaracje autora, więc `transform: translateY(0)` z klatki `to` na
        // zawsze wygrywał z `:hover`: kafelek nie dawał się podnieść, mimo że
        // cień offsetowy się pojawiał. Zmierzone (`matrix(1,0,0,1,0,0)` przy
        // najechaniu). `backwards` wypełnia wyłącznie okres OPÓŹNIENIA — czyli
        // dokładnie to, czego potrzebuje kaskada — i oddaje `transform` z
        // powrotem, kiedy animacja się skończy.
        "tile-in": "tile-in 0.32s ease-out backwards",
      },
      transitionDuration: {
        DEFAULT: "150ms",
      },
      width: {
        sidebar: "var(--sidebar-width)",
        "sidebar-icon": "var(--sidebar-width-icon)",
      },
      height: {
        header: "var(--header-height)",
      },
    },
  },
  plugins: [animate],
}

export default config
