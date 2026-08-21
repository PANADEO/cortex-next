import plCommon from "@/locales/pl/common.json"
import plTiles from "@/locales/pl/tiles.json"
import enCommon from "@/locales/en/common.json"
import enTiles from "@/locales/en/tiles.json"

/**
 * Języki interfejsu. `pl` jest źródłowy — to w nim pisze się nowe napisy,
 * a `en` jest tłumaczeniem, nigdy odwrotnie.
 */
export const LOCALES = ["pl", "en"] as const
export type Locale = (typeof LOCALES)[number]
export const DEFAULT_LOCALE: Locale = "pl"

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
  pl: { common: plCommon, tiles: plTiles },
  en: { common: enCommon, tiles: enTiles },
} as const

export const DEFAULT_NS = "common"
