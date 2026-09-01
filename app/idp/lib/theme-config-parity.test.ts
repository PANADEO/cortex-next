import resolveConfig from "tailwindcss/resolveConfig"
import { describe, expect, it } from "vitest"
import rootConfig from "../../../tailwind.config"

/**
 * Strażnik motywu — jedyna asercja w tym repo na WARTOŚCI, a nie na nazwy klas.
 *
 * Powstał, gdy do konfiguracji korzenia wszedł theme Biurka (kafelek `desk`).
 * Wtedy okazało się, jak cienka jest tu siatka: `e2e/` ma 38 plików i zero
 * `toHaveScreenshot`/`toHaveCSS`, a jedyny dotychczasowy strażnik wyglądu
 * (`components/shell/shell-variants.test.tsx`) porównuje KOMPLETY NAZW KLAS.
 * Złapie więc podmianę `rounded-md` na `rounded-lg` w komponencie, ale nie
 * złapie zmiany tego, CO `rounded-md` znaczy — a to jest właśnie ta klasa
 * regresji, którą wnosi dopisanie cudzego motywu do wspólnego pliku.
 *
 * Test jest jednostronny i taki ma być: pilnuje kluczy, których używa POWŁOKA.
 * Nowe nazwy (Biurka albo następnego modułu) przechodzą, bo są nowymi wpisami —
 * dopisanie klucza jest addytywne z definicji. Czerwony zapala się dopiero,
 * gdy ktoś zmieni albo usunie wartość, na której stoi 27 istniejących kafelków.
 *
 * Gdy zmiana jest zamierzona: popraw migawkę w tym samym commicie, co config.
 * Ręczne przepisanie jednej linijki to cała cena — i jest nią świadoma decyzja
 * zamiast cichego przesunięcia całej platformy.
 */
const theme = resolveConfig(rootConfig).theme

/** Role, na których stoi wygląd powłoki. Wartość, nie key. */
const SHELL_COLORS: Record<string, string> = {
  border: "hsl(var(--border))",
  input: "hsl(var(--input))",
  ring: "hsl(var(--ring))",
  background: "hsl(var(--background))",
  foreground: "hsl(var(--foreground))",
}

const SHELL_COLOR_PAIRS = [
  "primary",
  "secondary",
  "muted",
  "accent",
  "destructive",
  "card",
  "popover",
]

const SHELL_RADII: Record<string, string> = {
  xs: "var(--radius-xs)",
  sm: "var(--radius-sm)",
  md: "var(--radius-md)",
  lg: "var(--radius-lg)",
  xl: "var(--radius-xl)",
  "2xl": "var(--radius-2xl)",
}

describe("theme powłoki jest nietknięty", () => {
  it("colors-role wskazują swoje tokeny", () => {
    const colors = theme?.colors as unknown as Record<string, unknown>
    for (const [key, value] of Object.entries(SHELL_COLORS)) {
      expect({ [key]: colors[key] }).toEqual({ [key]: value })
    }
  })

  it("pary `DEFAULT`/`foreground` shadcn zostają parami", () => {
    const colors = theme?.colors as unknown as Record<string, Record<string, string>>
    for (const key of SHELL_COLOR_PAIRS) {
      expect({ [key]: colors[key] }).toEqual({
        [key]: {
          DEFAULT: `hsl(var(--${key}))`,
          foreground: `hsl(var(--${key}-foreground))`,
        },
      })
    }
  })

  it("skala promieni idzie z tokenów presetu", () => {
    const radii = theme?.borderRadius as Record<string, string>
    for (const [key, value] of Object.entries(SHELL_RADII)) {
      expect({ [key]: radii[key] }).toEqual({ [key]: value })
    }
    // Brak `DEFAULT` jest DECYZJĄ: gołe `rounded` (92 użycia w powłoce) ma zostać
    // przy Tailwindowym 0.25rem. Dopisanie tu tokenu przesunęłoby je wszystkie naraz.
    expect(radii.DEFAULT).toBe("0.25rem")
  })

  it("fonts pisma biorą token jako PIERWSZĄ pozycję stosu, nie jedyną", () => {
    const fonts = theme?.fontFamily as Record<string, string[]>
    expect(fonts.sans?.[0]).toBe("var(--font-sans)")
    expect(fonts.mono?.[0]).toBe("var(--font-mono)")
    expect(fonts.sans?.length).toBeGreaterThan(1)
    expect(fonts.mono?.length).toBeGreaterThan(1)
  })

  /**
   * Po przejściu Biurka na prefiks `desk-` zdanie „nazwy Biurka nie nadpisały nazw
   * powłoki" stało się prawdziwe z definicji, więc przestało być asercją. W to
   * miejsce wchodzi KOMPLETNOŚĆ: Tailwind na nieznaną klasę nie zgłasza błędu,
   * tylko nie generuje reguły — a wtedy `bg-desk-surface` jest przezroczyste i
   * nikt się o tym nie dowiaduje ani z builda, ani z `tsc`, ani z testu.
   */
  const DESK_COLORS = [
    "desk-bg",
    "desk-surface",
    "desk-raised",
    "desk-sunken",
    "desk-line",
    "desk-line-strong",
    "desk-ink",
    "desk-ink-2",
    "desk-muted",
    "desk-muted-2",
    "desk-accent",
    "desk-accent-hover",
    "desk-accent-ink",
    "desk-accent-soft",
    "desk-accent-soft-line",
    "desk-accent-soft-ink",
    "desk-focus",
    "desk-ok",
    "desk-warn",
    "desk-bad",
    "desk-ok-soft",
    "desk-warn-soft",
    "desk-bad-soft",
  ]

  /** Pozostałe role Biurka — sekcja motywu, w której każda z nich musi stać. */
  const DESK_SCALES: Record<string, string[]> = {
    spacing: ["desk-step", "desk-row", "desk-bar", "desk-touch", "desk-side", "desk-result"],
    maxWidth: ["desk-measure", "desk-stream"],
    boxShadow: ["desk-pop", "desk-window"],
    borderRadius: ["desk-pill"],
    fontFamily: ["desk-heading"],
    transitionTimingFunction: ["desk-enter", "desk-state"],
  }

  it("komplet ról Biurka stoi w motywie i każda wskazuje własny token", () => {
    const colors = theme?.colors as unknown as Record<string, unknown>
    // Role powłoki, które w obu słownikach nazywały się tak samo, a znaczyły co
    // innego — zostają zagnieżdżone. Gdyby wróciły płaskie, `bg-muted` powłoki
    // (830 użyć) dostałoby KOLOR TEKSTU.
    expect(typeof colors.muted).toBe("object")
    expect(typeof colors.accent).toBe("object")

    // Trzy zarzuty w JEDNEJ asercji, nie w trzech po kolei: przy trzech pierwszy
    // czerwony ukrywa dwa pozostałe, a wtedy naprawa idzie w trzech nawrotach
    // zamiast w jednym — sprawdzone wstrzyknięciem regresji do wszystkich trzech naraz.
    const found = {
      brakujace: DESK_COLORS.filter((key) => typeof colors[key] !== "string"),
      // Wartość każdej roli Biurka musi pochodzić z `--desk-*`, a nie z tokenu powłoki:
      // to jest ta granica, którą prefiks w nazwie tylko zapowiada.
      obce: DESK_COLORS.filter(
        (key) => typeof colors[key] === "string" && !String(colors[key]).includes("--desk-"),
      ),
      skale: Object.entries(DESK_SCALES).flatMap(([section, keys]) => {
        const bucket = (theme as unknown as Record<string, Record<string, unknown>>)[section] ?? {}
        return keys.filter((key) => bucket[key] === undefined).map((key) => `${section}.${key}`)
      }),
    }
    expect(found).toEqual({ brakujace: [], obce: [], skale: [] })
  })
})
