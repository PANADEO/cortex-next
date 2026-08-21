import { describe, expect, it } from "vitest"
import type { HubTile } from "@cortex/api"
import { hubApplicationToTile } from "./hub-tile"

/**
 * Kto wygrywa o nazwę kafelka: baza czy plik tłumaczeń.
 *
 * Pierwsza wersja nakładała tłumaczenie także na język źródłowy, przez co
 * ZMIANA NAZWY PRZEZ ADMINISTRATORA BYŁA NIEWIDOCZNA — plik w repo przykrywał
 * to, co admin przed chwilą wpisał w panelu. Zgłoszone przez Alexa, bo to
 * wprost łamie zasadę fazy K: manifest podaje wartość początkową, właścicielem
 * w runtime jest admin.
 */
const ROW: HubTile = {
  code: "content-guru",
  name: "Kreator treści PO ZMIANIE PRZEZ ADMINA",
  description: "Opis ustawiony w panelu",
  kind: "native",
  route: "/content-guru",
  url: null,
  icon: "Sparkles",
  color: "violet",
  categoryFunctional: "content-generation",
  categoryDepartment: [],
} as unknown as HubTile

/** Atrapa `t` z przestrzeni `tiles` — zwraca tłumaczenie tylko dla znanych kluczy. */
const dictionary: Record<string, string> = {
  "content-guru.label": "Content Creator",
  "content-guru.description": "Generates marketing and editorial content",
}
const t = ((key: string, options?: { defaultValue?: string }) =>
  dictionary[key] ?? options?.defaultValue ?? key) as never

describe("nazwa kafelka na hubie", () => {
  it("po polsku wygrywa BAZA, nie plik tłumaczeń", () => {
    const tile = hubApplicationToTile(ROW, t, "pl")

    expect(tile.label).toBe("Kreator treści PO ZMIANIE PRZEZ ADMINA")
    expect(tile.description).toBe("Opis ustawiony w panelu")
  })

  it("po angielsku wygrywa tłumaczenie", () => {
    const tile = hubApplicationToTile(ROW, t, "en")

    expect(tile.label).toBe("Content Creator")
    expect(tile.description).toBe("Generates marketing and editorial content")
  })

  /** Kafelek założony w panelu (link zewnętrzny) nie ma i nie będzie miał
   *  klucza w repo — ma pokazać swoją nazwę z bazy, nie surowy klucz. */
  it("kafelek bez tłumaczenia pokazuje wartość z bazy, nie klucz", () => {
    const own = { ...ROW, code: "czat-zewnetrzny", name: "Czat zewnętrzny" }
    const tile = hubApplicationToTile(own as HubTile, t, "en")

    expect(tile.label).toBe("Czat zewnętrzny")
    expect(tile.label).not.toContain("czat-zewnetrzny.label")
  })
})
