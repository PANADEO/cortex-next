import { describe, expect, it } from "vitest"
import { FUNCTIONAL_CATEGORIES } from "@/lib/tiles"
import { accentFor } from "./accent"

describe("akcent kafelka z kategorii", () => {
  // §5b: `document-parser` i `visual-guru` to zwykłe kafelki huba na
  // standardowej instancji i nie mają kategorii funkcjonalnej — do tego każdy
  // kafelek założony z panelu startuje bez niej. Wersja Cezarego brała `string`
  // i wołała `.length` wprost, więc przeniesiona bez zmian wywracałaby hub
  // każdemu, kto nie dotknął tych dwóch wierszy w bazie.
  it("kafelek bez kategorii dostaje akcent, a nie wyjątek", () => {
    expect(accentFor(null)).toBe(1)
  })

  it("ta sama kategoria zawsze daje ten sam akcent", () => {
    expect(accentFor("agents")).toBe(accentFor("agents"))
    expect(accentFor("research")).toBe(accentFor("research"))
  })

  // Sedno D6: TRZY akcenty. Gdyby hash spłaszczył realny zestaw kategorii do
  // jednego albo dwóch kolorów, siatka wyglądałaby jak zepsuta, a każdy test
  // sprawdzający tylko zakres `1..3` przechodziłby bez mrugnięcia.
  it("realne kategorie rozkładają się na wszystkie trzy akcenty", () => {
    const used = new Set(FUNCTIONAL_CATEGORIES.map((category) => accentFor(category.id)))
    expect([...used].sort()).toEqual([1, 2, 3])
  })

  it("akcent nigdy nie wypada poza `--chart-1..3`", () => {
    for (const category of FUNCTIONAL_CATEGORIES) {
      expect([1, 2, 3]).toContain(accentFor(category.id))
    }
  })
})
