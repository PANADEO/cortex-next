// Strażnik parzystości listy języków — TA SAMA lista w trzech pakietach.
//
//   app/idp/lib/i18n/config.ts      LOCALES          (źródło prawdy dla UI)
//   packages/@cortex/service        SUPPORTED_LOCALES (walidacja zapisu)
//   packages/@cortex/tile-sdk       TILE_LOCALES      (klucze w manifeście)
//
// Kopie, nie importy, i to jest wymuszone kierunkiem zależności: tile-sdk jest
// liściem, service importuje z niego, a aplikacja z obu — żaden import w drugą
// stronę nie jest możliwy, a `config.ts` dodatkowo wciąga do bundla wszystkie
// pliki tłumaczeń. Ten sam układ co APPLICATION_KINDS w @cortex/db wobec
// TileKind i TileColor w @cortex/tile-sdk wobec palety aplikacji.
//
// PO CO TEST, A NIE KOMENTARZ: rozjazd tych list jest CICHY w obie strony.
//  - Język dołożony w `config.ts` bez dopisania w serwisie: przełącznik języka
//    go pokazuje, ale KAŻDA próba zapisania tłumaczenia wraca jako 400
//    "nieprawidłowe żądanie", bez wskazówki gdzie szukać przyczyny.
//  - Język usunięty z `config.ts`, zostawiony w serwisie: w bazie zbierają się
//    wiersze, po które nikt już nigdy nie sięgnie.
//  - Rozjazd tile-sdk: `defineTile()` odrzuca manifest z poprawnym językiem
//    (błąd przy starcie builda) albo przepuszcza literówkę, po której seed
//    wstawia martwy wiersz, a kafelek dalej pokazuje polską nazwę w
//    angielskim interfejsie — czyli dokładnie ten defekt, którego naprawie
//    całe to pole służy.
//
// Dlaczego test, a nie lint/tsc: ani jedno, ani drugie nie widzi, że trzy
// tablice w trzech pakietach mają znaczyć to samo. Ten sam wzorzec i ten sam
// powód co system-config.sort-order-parity.test.ts obok.
//
// Strona aplikacji czytana REGEXEM po źródle, nie importem: `config.ts`
// importuje ~40 plików JSON z tłumaczeniami, a @cortex/service nie ma prawa
// zależeć od app/idp w żadną stronę — nawet w teście.

import { MANIFEST_BASE_LOCALE, TILE_LOCALES } from "@cortex/tile-sdk"
import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { BASE_VALUE_LOCALE, SUPPORTED_LOCALES, isSupportedLocale } from "./system-config"

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..")
const I18N_CONFIG = "app/idp/lib/i18n/config.ts"

/** Lista języków zadeklarowana po stronie aplikacji. Zniknięcie/przemianowanie
 *  stałej ma PAŚĆ, a nie po cichu zwolnić strażnika z pilnowania czegokolwiek. */
function appLocales(): string[] {
  const source = readFileSync(path.join(repoRoot, I18N_CONFIG), "utf8")
  const match = source.match(/^export const LOCALES = \[([^\]]*)\] as const$/m)
  if (!match) {
    throw new Error(
      `Nie znalazłem deklaracji "export const LOCALES = [...] as const" w ${I18N_CONFIG}. ` +
        "Jeśli lista języków przeniosła się gdzie indziej, tego strażnika trzeba przepisać — nie zostawiać ślepego.",
    )
  }
  return [...match[1]!.matchAll(/"([a-z-]+)"/g)].map((entry) => entry[1] as string)
}

describe("parzystość listy języków — aplikacja, serwis, manifest kafelka", () => {
  it("regex w ogóle coś złapał (inaczej porównania niżej byłyby puste)", () => {
    expect(appLocales().length).toBeGreaterThan(0)
    expect(SUPPORTED_LOCALES.length).toBeGreaterThan(0)
  })

  it("SUPPORTED_LOCALES (@cortex/service) = LOCALES (app/idp/lib/i18n/config.ts)", () => {
    // Porównanie po ZBIORZE, nie po kolejności: kolejność w `config.ts` niesie
    // znaczenie dla UI (język źródłowy jest pierwszy), w walidacji zapisu nie
    // niesie żadnego. Wymuszanie jej tutaj wywracałoby test za przestawienie
    // przełącznika języka, które niczego nie psuje.
    expect([...SUPPORTED_LOCALES].sort()).toEqual([...appLocales()].sort())
  })

  /**
   * Czwarta lista, której rozjazd byłby najgroźniejszy, bo cichy: gdyby
   * `BASE_VALUE_LOCALE` odjechał od `SOURCE_LOCALE` aplikacji, tłumaczenie
   * na język wartości bazowych przestałoby być odrzucane i zaczęłoby
   * przykrywać nazwę wpisaną przez admina — bez żadnego objawu poza tym,
   * że panel pokazuje co innego niż hub.
   */
  it("BASE_VALUE_LOCALE (@cortex/service) = SOURCE_LOCALE (app/idp/lib/i18n/config.ts)", () => {
    const source = readFileSync(path.join(repoRoot, I18N_CONFIG), "utf8").match(
      /export const SOURCE_LOCALE: Locale = "([a-z-]+)"/,
    )?.[1]

    expect(source).toBeDefined()
    expect(BASE_VALUE_LOCALE).toBe(source)
  })

  it("MANIFEST_BASE_LOCALE (@cortex/tile-sdk) = BASE_VALUE_LOCALE (@cortex/service)", () => {
    expect(MANIFEST_BASE_LOCALE).toBe(BASE_VALUE_LOCALE)
  })

  it("TILE_LOCALES (@cortex/tile-sdk) = SUPPORTED_LOCALES (@cortex/service)", () => {
    expect([...TILE_LOCALES].sort()).toEqual([...SUPPORTED_LOCALES].sort())
  })

  // Kontrola pozytywna i negatywna predykatu, przez który idzie CAŁA walidacja
  // kodu języka w zapisie — bez niej powyższe przechodziłoby także wtedy, gdy
  // isSupportedLocale() zwraca stałą.
  it("isSupportedLocale() przepuszcza dokładnie języki z listy", () => {
    for (const locale of appLocales()) expect(isSupportedLocale(locale)).toBe(true)
    for (const bogus of ["eng", "EN", "en-GB", "de", "", " en"]) {
      expect(isSupportedLocale(bogus)).toBe(false)
    }
  })
})
