import type { HubTile } from "@cortex/api"
import { describe, expect, it } from "vitest"
import { hubApplicationToTile } from "./hub-tile"

/**
 * JEDNA reguła rozstrzygania nazwy kafelka:
 *
 *     nazwa(locale) = translations[locale]?.name ?? applications.name
 *
 * Zastąpiła regułę ASYMETRYCZNĄ („w języku źródłowym wygrywa baza,
 * w pozostałych plik `locales/en/tiles.json"), której cały sens polegał na
 * tym, żeby plik w repo nie przykrywał nazwy wpisanej przez admina w panelu.
 * Defekt, o który wtedy chodziło, jest tu nadal pokryty — tyle że wynika już
 * z jednej reguły, a nie z wyjątku od niej: dla `pl` mapa NIGDY nie ma wpisu
 * (trasa PATCH odrzuca ten kod języka), więc spada na wartość bazową.
 *
 * Drugi, nowy defekt, którego ten plik pilnuje: nazwa angielska ma iść
 * z BAZY, a nie z pliku w repo — bo inaczej kafelka założonego z panelu nie
 * da się nazwać po angielsku.
 */
const ROW: HubTile = {
  code: "content-guru",
  name: "Kreator treści PO ZMIANIE PRZEZ ADMINA",
  description: "Opis ustawiony w panelu",
  translations: {
    en: { name: "Content Creator", description: "Generates marketing and editorial content" },
  },
  kind: "native",
  route: "/content-guru",
  url: null,
  icon: "Sparkles",
  color: "violet",
  categoryFunctional: "content-generation",
  categoryDepartment: [],
} as unknown as HubTile

describe("nazwa kafelka na hubie", () => {
  it("po polsku wygrywa wartość bazowa z bazy", () => {
    const tile = hubApplicationToTile(ROW, "pl")

    expect(tile.label).toBe("Kreator treści PO ZMIANIE PRZEZ ADMINA")
    expect(tile.description).toBe("Opis ustawiony w panelu")
  })

  it("po angielsku wygrywa tłumaczenie z bazy", () => {
    const tile = hubApplicationToTile(ROW, "en")

    expect(tile.label).toBe("Content Creator")
    expect(tile.description).toBe("Generates marketing and editorial content")
  })

  /** Sedno zmiany: nazwa angielska jest DANĄ INSTANCJI. Admin, który zmienia
   *  ją w panelu, ma ją zobaczyć — dawniej przykrywał go plik w repo. */
  it("zmiana tłumaczenia w bazie jest widoczna, nic jej nie przykrywa", () => {
    const renamed = {
      ...ROW,
      translations: { en: { name: "Content Studio", description: null } },
    } as HubTile
    const tile = hubApplicationToTile(renamed, "en")

    expect(tile.label).toBe("Content Studio")
  })

  /** Pola są osobno nullowalne: wolno przetłumaczyć samą nazwę i zostawić
   *  opis na wartości bazowej. */
  it("nieprzetłumaczony opis spada na wartość bazową, mimo przetłumaczonej nazwy", () => {
    const nameOnly = {
      ...ROW,
      translations: { en: { name: "Content Creator", description: null } },
    } as HubTile
    const tile = hubApplicationToTile(nameOnly, "en")

    expect(tile.label).toBe("Content Creator")
    expect(tile.description).toBe("Opis ustawiony w panelu")
  })

  /** Kafelek założony w panelu (link zewnętrzny) nie ma i nie musi mieć
   *  tłumaczeń — ma pokazać nazwę z bazy, nie pustkę i nie surowy kod. */
  it("kafelek bez ani jednego tłumaczenia pokazuje wartość bazową", () => {
    const own = {
      ...ROW,
      code: "czat-zewnetrzny",
      name: "Czat zewnętrzny",
      translations: {},
    } as HubTile
    const tile = hubApplicationToTile(own, "en")

    expect(tile.label).toBe("Czat zewnętrzny")
    expect(tile.label).not.toContain("czat-zewnetrzny")
  })

  /** Język, którego nikt nie przetłumaczył (przyszły trzeci, albo wpis
   *  usunięty z panelu), nie ma prawa wywrócić renderu ani pokazać pustki. */
  it("nieznany język spada na wartość bazową", () => {
    const tile = hubApplicationToTile(ROW, "de")

    expect(tile.label).toBe("Kreator treści PO ZMIANIE PRZEZ ADMINA")
  })

  /** `description` w bazie jest nullowalne, a `Tile.description` nie jest. */
  it("brak opisu w bazie i w tłumaczeniu daje pusty napis, nie `null`", () => {
    const noDescription = {
      ...ROW,
      description: null,
      translations: { en: { name: "Content Creator", description: null } },
    } as HubTile

    expect(hubApplicationToTile(noDescription, "en").description).toBe("")
    expect(hubApplicationToTile(noDescription, "pl").description).toBe("")
  })
})
