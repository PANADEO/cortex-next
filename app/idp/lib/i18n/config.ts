import plCommon from "@/locales/pl/common.json"
import enCommon from "@/locales/en/common.json"
import enTiles from "@/locales/en/tiles.json"

/**
 * Języki interfejsu. `pl` jest źródłowy — to w nim pisze się nowe napisy,
 * a `en` jest tłumaczeniem, nigdy odwrotnie.
 */
export const LOCALES = ["pl", "en"] as const
export type Locale = (typeof LOCALES)[number]

/** Język, w którym pisze się nowe napisy i w którym baza jest źródłem prawdy
 *  dla nazw kafelków. Tłumaczenia powstają Z niego, nigdy do niego. */
export const SOURCE_LOCALE: Locale = "pl"

/** Język pokazywany przy pierwszej wizycie. Zostaje polski, bo instancja jest
 *  dziś polska; wybór użytkownika i tak go nadpisuje. */
export const DEFAULT_LOCALE: Locale = "pl"

/**
 * Język, na który spada BRAK KLUCZA. Angielski, nie polski — decyzja Alexa
 * (21.08.2026: „będzie bardziej międzynarodowe").
 *
 * Rozstrzyga asymetria skutków, nie preferencja: luka pokazana Polakowi po
 * angielsku jest niewygodna, luka pokazana klientowi ze Szwajcarii po polsku
 * wygląda na produkt niegotowy. Cezary sam to zresztą przesądził — „Polakom
 * można pokazywać trudne kafelki po angielsku".
 *
 * Przy `pl` i `en` o identycznych zestawach kluczy (pilnuje test parzystości)
 * ten zapas prawie nigdy się nie odpala. Ma znaczenie dopiero dla przestrzeni
 * dokładanych później i dla przyszłego trzeciego języka.
 */
export const FALLBACK_LOCALE: Locale = "en"

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value)
}

/**
 * Przestrzenie nazw = pliki JSON. Jedna na powłokę (`common`), jedna na
 * katalog kafelków (`tiles`), dalej po jednej na kafelek — dzięki temu nowy
 * kafelek dokłada dwa pliki i nie dotyka cudzych tłumaczeń (D3).
 *
 * Zasoby są WBUDOWANE w bundel, nie dociągane po sieci. Powód jest ten sam,
 * dla którego preset instancji czyta się na serwerze: przełączenie języka nie
 * ma prawa pokazać na moment surowych kluczy ani pustego ekranu. Cena to
 * kilkadziesiąt kilobajtów w bundlu — przy dwóch językach akceptowalna.
 */
export const resources = {
  pl: { common: plCommon },
  en: { common: enCommon, tiles: enTiles },
} as const

export const DEFAULT_NS = "common"
