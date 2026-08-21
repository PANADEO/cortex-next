import { FUNCTIONAL_CATEGORIES, type TileCategoryFunctional } from "@/lib/tiles"
import { describe, expect, it } from "vitest"
import { type Accent, accentFor } from "./accent"

describe("akcent kafelka z kategorii", () => {
  // §5b: `document-parser` i `visual-guru` to zwykłe kafelki huba na
  // standardowej instancji i nie mają kategorii funkcjonalnej — do tego każdy
  // kafelek założony z panelu startuje bez niej. Wersja Cezarego brała `string`
  // i wołała `.length` wprost, więc przeniesiona bez zmian wywracałaby hub
  // każdemu, kto nie dotknął tych dwóch wierszy w bazie.
  it("kafelek bez kategorii dostaje akcent, a nie wyjątek", () => {
    expect(accentFor(null)).toBe(1)
  })

  // Przypięcie CAŁEJ mapy, wartość po wartości. Nie jest to powtórzenie
  // implementacji: mapa jest rozstrzygnięciem (patrz uzasadnienie w
  // `accent.ts`), więc jej zmiana ma być czerwona i wymagać nowej decyzji,
  // a nie przechodzić dlatego, że wynik dalej mieści się w `1..3`.
  it("mapa kategoria → akcent jest dokładnie taka, jak rozpisana", () => {
    expect({
      "content-generation": accentFor("content-generation"),
      agents: accentFor("agents"),
      "admin-system": accentFor("admin-system"),
      misc: accentFor("misc"),
      research: accentFor("research"),
    }).toEqual({
      "content-generation": 1,
      agents: 2,
      "admin-system": 2,
      misc: 3,
      research: 3,
    })
  })

  // `Record<TileCategoryFunctional, Accent>` w `accent.ts` pilnuje UNII, ale
  // `FUNCTIONAL_CATEGORIES` to osobna lista runtime'owa (karmi panel i zakładki
  // huba) i to ona może się z unią rozjechać. Szósta kategoria dopisana w
  // jednym z tych dwóch miejsc ma tu zapalić czerwone, bo akcent dla niej to
  // decyzja: która para kategorii ma odtąd dzielić kolor.
  it("każda kategoria z listy panelu ma wpis w mapie", () => {
    for (const category of FUNCTIONAL_CATEGORIES) {
      expect(accentFor(category.id)).toBeGreaterThanOrEqual(1)
      expect(accentFor(category.id)).toBeLessThanOrEqual(3)
    }
    expect(FUNCTIONAL_CATEGORIES).toHaveLength(5)
  })

  it("ta sama kategoria zawsze daje ten sam akcent", () => {
    expect(accentFor("agents")).toBe(accentFor("agents"))
    expect(accentFor("research")).toBe(accentFor("research"))
  })

  // Sedno D6: TRZY akcenty. Gdyby mapa spłaszczyła realny zestaw kategorii do
  // jednego albo dwóch kolorów, siatka wyglądałaby jak zepsuta, a każdy test
  // sprawdzający tylko zakres `1..3` przechodziłby bez mrugnięcia.
  it("realne kategorie rozkładają się na wszystkie trzy akcenty", () => {
    const used = new Set(FUNCTIONAL_CATEGORIES.map((category) => accentFor(category.id)))
    expect([...used].sort()).toEqual([1, 2, 3])
  })

  /**
   * REGUŁA, według której mapa została rozpisana: trzy kategorie niosące
   * najwięcej kafelków mają RÓŻNE akcenty, a kolizje spadają na najmniejsze.
   * Kolejność zliczona z manifestów w tym repo (`content-generation` 9,
   * `misc` 6, `admin-system` 3, `agents` 2, `research` 1) i potwierdzona na
   * rejestrze `applications` żywej instancji (10/6/3/2/1).
   *
   * Ten test jest realną bramką, nie parafrazą testu wyżej: hash sprzed
   * 08.08.2026 przechodził „wszystkie trzy akcenty w użyciu" i JEDNOCZEŚNIE
   * malował `content-generation` i `admin-system` tym samym tealem.
   */
  it("trzy największe kategorie mają trzy różne akcenty", () => {
    const largest: TileCategoryFunctional[] = ["content-generation", "misc", "admin-system"]
    expect(new Set(largest.map(accentFor)).size).toBe(3)
  })

  /**
   * Objaw, od którego zaczęła się zmiana, na DANYCH Z BAZY: kafelki włączone
   * (`is_active AND show_on_hub`) na instancji Alexa 08.08.2026, zdjęte
   * `docker exec cortex-next-postgres psql -U cortex -d cortex`. Pod hashem
   * sześć z tych siedmiu kafelków miało akcent 2 — hub czytał się jak
   * jednokolorowy mimo trzech obecnych kategorii.
   */
  it("kafelki włączone na żywej instancji nie zlewają się w jeden kolor", () => {
    const live: Array<TileCategoryFunctional | null> = [
      "content-generation", // document-parser
      "content-generation", // geo-score-calculator
      "content-generation", // ilustromat
      "admin-system", // token-usage
      "research", // okna-czasowe
      "admin-system", // system-config
      "content-generation", // content-guru
    ]

    const perAccent = live.reduce<Record<Accent, number>>(
      (counts, category) => {
        const accent = accentFor(category)
        return { ...counts, [accent]: counts[accent] + 1 }
      },
      { 1: 0, 2: 0, 3: 0 },
    )

    // Trzy kategorie na siedmiu kafelkach → trzy widoczne akcenty, a największy
    // z nich to cztery kafelki `content-generation`, nie sześć z dwóch różnych
    // kategorii sklejonych kolizją.
    expect(perAccent).toEqual({ 1: 4, 2: 2, 3: 1 })
  })

  it("akcent nigdy nie wypada poza `--chart-1..3`", () => {
    for (const category of FUNCTIONAL_CATEGORIES) {
      expect([1, 2, 3]).toContain(accentFor(category.id))
    }
  })
})
