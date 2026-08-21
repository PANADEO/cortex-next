/**
 * Rozstrzyganie nazwy i opisu kafelka po stronie klienta —
 * PROJECT/cortex-frontend/ARTIFACTS/i18n/cortex-frontend-tlumaczenia-nazw-
 * kafelkow-projekt.md.
 *
 * Zastępuje `tile-names.ts`, czyli regułę ASYMETRYCZNĄ („w języku źródłowym
 * wygrywa baza, w pozostałych plik z repo"). Tamta asymetria istniała
 * WYŁĄCZNIE po to, żeby plik `locales/en/tiles.json` nie przykrywał nazwy,
 * którą admin przed chwilą wpisał w panelu. Gdy tłumaczenia stają się daną
 * instancji, powód znika razem z plikiem — i zostaje jedna reguła, którą da
 * się wytłumaczyć w jednym zdaniu.
 */

/**
 * Tłumaczenie kafelka na JEDEN język. Oba pola osobno nullowalne: wolno
 * przetłumaczyć samą nazwę i zostawić opis na wartości bazowej. Kształt wprost
 * z `system_config.application_translations`, przenoszony bez zmian przez
 * `GET /api/hub/tiles` i `GET /api/system-config/applications`.
 */
export interface TileTranslation {
  name: string | null
  description: string | null
}

/** Komplet tłumaczeń JEDNEGO kafelka, kluczowany kodem języka ("en").
 *  Klucz obecny => w bazie stoi wiersz, w którym co najmniej jedno z pól jest
 *  nie-NULL; kafelek bez tłumaczeń dostaje pustą mapę, nigdy `undefined`. */
export type TileTranslations = Record<string, TileTranslation>

/**
 * JEDYNA reguła rozstrzygania:
 *
 *     nazwa(locale) = translations[locale]?.name ?? wartość bazowa
 *
 * Rozstrzyga KLIENT, nie serwer — serwer nie zna języka użytkownika, bo wybór
 * siedzi w `localStorage` (§3 projektu). Trasy zwracają komplet tłumaczeń
 * i wartość bazową, a wybór między nimi jest tutaj.
 *
 * `??`, nie `||`: wartość zapisana w bazie jest albo NULL, albo napisem
 * o niezerowej długości (serwis normalizuje pusty napis i same spacje do NULL,
 * a wiersz bez ani jednej wartości kasuje). Pusty napis NIE jest więc
 * „brakiem tłumaczenia", tylko stanem, którego zapis nie potrafi wyprodukować
 * — i gdyby kiedyś powstał ręczną edycją bazy, ma być widoczny jako defekt,
 * a nie po cichu zamieciony pod wartość bazową.
 *
 * Dla języka wartości bazowych (`pl`) mapa NIGDY nie ma wpisu — trasa PATCH
 * odrzuca ten kod języka (`BASE_VALUE_LOCALE` w @cortex/service), bo wiersz
 * tłumaczenia wygrywałby tu z kolumną `applications.name`, czyli chowałby
 * nazwę wpisaną przez admina pod wartością, której panel nie pokazuje. Spadek
 * na wartość bazową jest więc dla `pl` zachowaniem ZAMIERZONYM, nie
 * przypadkowym efektem braku danych.
 */
export function tileText(
  translations: TileTranslations | undefined,
  locale: string,
  field: keyof TileTranslation,
  base: string,
): string {
  return translations?.[locale]?.[field] ?? base
}
