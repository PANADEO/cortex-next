// @vitest-environment jsdom
import i18n from "@/lib/i18n"
import type { TFunction } from "i18next"
import { afterAll, beforeEach, describe, expect, it } from "vitest"
import { formatIdpBasicDisplayText } from "./status"

/**
 * Backend `idp-basic` przysyła ostrzeżenia i braki gotową POLSKĄ prozą i przed
 * wtorkowym demo tego nie zmienimy. Ten test pilnuje JEDYNEJ własności, na
 * której to stoi: polski napis z drutu jest KLUCZEM DOPASOWANIA, a wynikiem
 * jest tłumaczenie — więc dołożenie trzeciego języka nie wymaga dotknięcia
 * `status.tsx`. Poprzednia wersja zwracała zaszyty angielski i to właśnie ta
 * regresja jest tu nie do przepuszczenia.
 */
const t = ((key: string, options?: Record<string, unknown>) =>
  i18n.t(key, { ns: "idp-basic", ...options })) as TFunction<"idp-basic">

/**
 * WSZYSTKIE dziesięć napisów z drutu, nie próbka.
 *
 * Pod polskim wynik ma być IDENTYCZNY z wejściem — a to jest asercja o treści
 * pliku `pl`, nie o samym mechanizmie: zjedzona spacja po dwukropku
 * („Niska pewność klasyfikacji:{{detail}}") nie wywala niczego, nie rusza
 * angielskiego i widać ją dopiero na ekranie. Wersja sprawdzająca dwa z
 * dziesięciu kluczy zostawiała osiem takich okazji.
 *
 * `wire` to dokładny napis, który przychodzi z backendu; `en` to jego
 * tłumaczenie — przepisane tutaj celowo, bo test czytający ten sam plik JSON,
 * z którego czyta kod, nie dowodziłby niczego.
 */
const BACKEND_TEXTS: ReadonlyArray<{ wire: string; en: string }> = [
  { wire: "Brak CMR", en: "Missing CMR" },
  { wire: "Brak POD", en: "Missing POD" },
  { wire: "Brak faktury kosztowej", en: "Missing cost invoice" },
  { wire: "Brak zlecenia transportowego", en: "Missing transport order" },
  { wire: "Nie znaleziono numeru referencyjnego", en: "Reference number not found" },
  {
    wire: "Dokument nierozpoznany: skan_0007.pdf",
    en: "Unrecognized document: skan_0007.pdf",
  },
  {
    wire: "Niska pewność klasyfikacji: faktura.pdf (0.42)",
    en: "Low classification confidence: faktura.pdf (0.42)",
  },
  {
    wire: "CMR zawiera uwagę lub zastrzeżenie: uszkodzona paleta",
    en: "CMR contains a remark or reservation: uszkodzona paleta",
  },
  {
    wire: "Niepełna analiza po maksymalnym zakresie: 12 z 40 stron",
    en: "Incomplete analysis after full coverage: 12 z 40 stron",
  },
  {
    wire: "Pominięto nieobsługiwany plik: cennik.txt",
    en: "Skipped unsupported file: cennik.txt",
  },
]

describe("formatIdpBasicDisplayText", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("pl")
  })

  afterAll(async () => {
    await i18n.changeLanguage("pl")
  })

  it("tabela testowa pokrywa komplet napisów z drutu", () => {
    expect(BACKEND_TEXTS).toHaveLength(10)
  })

  it.each(BACKEND_TEXTS)("pod polskim „$wire” wraca bez zmian", ({ wire }) => {
    expect(formatIdpBasicDisplayText(t, wire)).toBe(wire)
  })

  it.each(BACKEND_TEXTS)("pod angielskim „$wire” tłumaczy się na „$en”", async ({ wire, en }) => {
    await i18n.changeLanguage("en")

    expect(formatIdpBasicDisplayText(t, wire)).toBe(en)
  })

  it("napis spoza tabelki przechodzi nietknięty", async () => {
    await i18n.changeLanguage("en")

    expect(formatIdpBasicDisplayText(t, "Zupełnie inny napis z backendu")).toBe(
      "Zupełnie inny napis z backendu",
    )
  })
})
