import type { TFunction } from "i18next"
import { SOURCE_LOCALE } from "./config"

export type TileNameField = "label" | "shortLabel" | "description"

/**
 * Nazwa kafelka w wybranym języku.
 *
 * W JĘZYKU ŹRÓDŁOWYM WYGRYWA WARTOŚĆ LOKALNA — ta z bazy dla katalogu huba,
 * ta z rejestru dla kafelków wpisanych w kodzie. Bez tej reguły plik
 * tłumaczeń przykrywa nazwę, którą administrator przed chwilą wpisał
 * w panelu, i zmiana nazwy jest niewidoczna.
 *
 * W pozostałych językach wygrywa tłumaczenie, a brak klucza spada na wartość
 * lokalną — kafelek założony w panelu pokaże swoją polską nazwę zamiast
 * surowego klucza.
 *
 * Wspólne dla trzech ścieżek, które inaczej powielałyby tę regułę osobno:
 * katalog huba (`hub-tile.ts`), okruszki (`breadcrumbs.ts`) i nawigacja
 * narzędzi AI (`nav.ts`).
 */
export function tileName(
  t: TFunction<"tiles">,
  locale: string,
  code: string,
  field: TileNameField,
  fromSource: string,
): string {
  if (locale === SOURCE_LOCALE) return fromSource
  const value = t(`${code}.${field}`, { defaultValue: "" })
  return value || fromSource
}
