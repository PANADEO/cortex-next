import resolveConfig from "tailwindcss/resolveConfig"
import { describe, expect, it } from "vitest"
import rootConfig from "../../../tailwind.config"

/**
 * Strażnik motywu — jedyna asercja w tym repo na WARTOŚCI, a nie na nazwy klas.
 *
 * Powstał, gdy do konfiguracji korzenia wszedł motyw Biurka (kafelek `desk`).
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
const motyw = resolveConfig(rootConfig).theme

/** Role, na których stoi wygląd powłoki. Wartość, nie nazwa. */
const POWLOKA_KOLORY: Record<string, string> = {
  border: "hsl(var(--border))",
  input: "hsl(var(--input))",
  ring: "hsl(var(--ring))",
  background: "hsl(var(--background))",
  foreground: "hsl(var(--foreground))",
}

const POWLOKA_PARY = ["primary", "secondary", "muted", "accent", "destructive", "card", "popover"]

const POWLOKA_PROMIENIE: Record<string, string> = {
  xs: "var(--radius-xs)",
  sm: "var(--radius-sm)",
  md: "var(--radius-md)",
  lg: "var(--radius-lg)",
  xl: "var(--radius-xl)",
  "2xl": "var(--radius-2xl)",
}

describe("motyw powłoki jest nietknięty", () => {
  it("kolory-role wskazują swoje tokeny", () => {
    const kolory = motyw?.colors as unknown as Record<string, unknown>
    for (const [nazwa, wartosc] of Object.entries(POWLOKA_KOLORY)) {
      expect({ [nazwa]: kolory[nazwa] }).toEqual({ [nazwa]: wartosc })
    }
  })

  it("pary `DEFAULT`/`foreground` shadcn zostają parami", () => {
    const kolory = motyw?.colors as unknown as Record<string, Record<string, string>>
    for (const nazwa of POWLOKA_PARY) {
      expect({ [nazwa]: kolory[nazwa] }).toEqual({
        [nazwa]: {
          DEFAULT: `hsl(var(--${nazwa}))`,
          foreground: `hsl(var(--${nazwa}-foreground))`,
        },
      })
    }
  })

  it("skala promieni idzie z tokenów presetu", () => {
    const promienie = motyw?.borderRadius as Record<string, string>
    for (const [nazwa, wartosc] of Object.entries(POWLOKA_PROMIENIE)) {
      expect({ [nazwa]: promienie[nazwa] }).toEqual({ [nazwa]: wartosc })
    }
    // Brak `DEFAULT` jest DECYZJĄ: gołe `rounded` (92 użycia w powłoce) ma zostać
    // przy Tailwindowym 0.25rem. Dopisanie tu tokenu przesunęłoby je wszystkie naraz.
    expect(promienie.DEFAULT).toBe("0.25rem")
  })

  it("kroje pisma biorą token jako PIERWSZĄ pozycję stosu, nie jedyną", () => {
    const kroje = motyw?.fontFamily as Record<string, string[]>
    expect(kroje.sans?.[0]).toBe("var(--font-sans)")
    expect(kroje.mono?.[0]).toBe("var(--font-mono)")
    expect(kroje.sans?.length).toBeGreaterThan(1)
    expect(kroje.mono?.length).toBeGreaterThan(1)
  })

  it("nazwy Biurka nie nadpisały żadnej nazwy powłoki", () => {
    const kolory = motyw?.colors as unknown as Record<string, unknown>
    // Dwie role, które w obu słownikach nazywały się tak samo, a znaczyły co innego.
    // Gdyby wróciły płaskie, `bg-muted` powłoki (830 użyć) dostałoby KOLOR TEKSTU.
    expect(typeof kolory.muted).toBe("object")
    expect(typeof kolory.accent).toBe("object")
    expect(kolory.cichy).toBe("hsl(var(--desk-cichy))")
    expect(kolory.akcent).toBe("hsl(var(--desk-akcent))")
  })
})
