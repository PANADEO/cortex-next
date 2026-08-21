import type { Locale } from "./config"

/**
 * JEDYNE MIEJSCE, W KTÓRYM JĘZYK INTERFEJSU ZAMIENIA SIĘ W REGUŁĘ FORMATOWANIA.
 *
 * Biblioteka tłumaczeń wymienia NAPISY i na tym kończy się jej zakres. Data,
 * godzina i separator tysięcy nie są napisami — są wynikiem `Intl`, który bierze
 * własny tag BCP-47. Dopóki ten tag stał wpisany w kodzie („pl-PL" w sześciu
 * miejscach), przełączenie języka zmieniało etykiety, a zostawiało `21.08, 10:38`
 * i `1 234 567` — czyli ekran w dwóch językach naraz.
 *
 * `Locale` (język interfejsu) i tag `Intl` to CELOWO dwie różne rzeczy, spięte tą
 * mapą. Język ma dwie litery i wybiera plik JSON; formatowanie potrzebuje kraju,
 * bo to kraj rozstrzyga kolejność dzień/miesiąc i zegar 12- kontra 24-godzinny.
 *
 * `en` → `en-GB`, NIE `en-US`. Angielski jest tu językiem prezentacji dla klienta
 * EUROPEJSKIEGO (Szwajcaria), nie amerykańskiego. `en-US` dałoby `08/21, 10:38 AM`
 * — miesiąc przed dniem i zegar 12-godzinny — czyli zapis, który Europejczyk
 * czyta błędnie przez pierwsze dwanaście dni każdego miesiąca. `en-GB` daje
 * `21/08, 10:38`: ta sama kolejność co po polsku, inny separator, zegar 24-godzinny.
 * Zmiana tej jednej linii jest całą zmianą konwencji dla aplikacji.
 *
 * `pl` → `pl-PL` bez zmian. Polski jest językiem ŹRÓDŁOWYM, więc wynik pod `pl`
 * musi zostać identyczny co do znaku z tym sprzed tej zmiany — pilnuje tego
 * `formats.test.ts`, bo na tych literałach stoją asercje testów i e2e.
 */
const FORMATTING_LOCALES: Record<Locale, string> = {
  pl: "pl-PL",
  en: "en-GB",
}

/**
 * CZEGO TU ŚWIADOMIE NIE MA — żeby następny nie uznał tego za przeoczenie.
 *
 *  1. EKSPORTY (`lib/token-usage/csv.ts`). CSV i JSON idą do Excela i do cudzych
 *     parserów, nie na ekran. Formatują `String(x)` i `toFixed(1)`, czyli kropką
 *     dziesiętną i bez separatora tysięcy — CELOWO, bo liczba ma się
 *     re-importować jako liczba. Podpięcie ich pod język użytkownika zepsułoby
 *     plik, nie naprawiło.
 *  2. KWOTY (`lib/invoice-supervisor/types.ts` → `pl-PL`,
 *     `features/store-pit/helpers.ts` → `en-US`). To osobna klasa: `formatMoney`
 *     z `@cortex/utils` już przyjmuje `locale` parametrem, więc mechanika jest
 *     gotowa, ale wybór jest tam ZWIĄZANY Z WALUTĄ I DOMENĄ kafelka (faktury
 *     w PLN; rozliczenie GLS DE w EUR, z całym interfejsem po angielsku).
 *     Przepięcie ich pod język interfejsu to decyzja produktowa dla tych dwóch
 *     kafelków, a nie ta sama poprawka — i jedyne, czego brakuje, to podanie
 *     tutaj wyliczonego tagu zamiast literału.
 *  3. DATY ZE STAŁYM WZORCEM (`formatAbsolute` z `@cortex/utils`, np.
 *     `"dd.MM.yyyy"`). Te nie przechodzą przez `Intl` w ogóle — wzorzec podaje
 *     wywołujący i wynik jest z założenia identyczny w każdym języku.
 */

/**
 * Tag BCP-47 do przekazania wprost do `Intl.*` / `toLocale*`. Wołaj TO, a nie
 * literał — literał jest dokładnie tym błędem, który ten moduł usuwa.
 */
export function formattingLocale(locale: Locale): string {
  return FORMATTING_LOCALES[locale]
}

function toDate(value: Date | string | number): Date {
  return value instanceof Date ? value : new Date(value)
}

/**
 * Liczba z separatorem tysięcy wybranego języka.
 *
 * UWAGA na `pl-PL`: ICU ma tam `minimumGroupingDigits=2`, więc liczby
 * czterocyfrowe NIE są grupowane („6000"), a pięciocyfrowe już tak („60 000",
 * twardą spacją). `en-GB` grupuje od tysiąca („6,000"). To nie jest usterka
 * i nie wolno tego „naprawiać" ręcznym wstawianiem spacji.
 */
export function formatNumber(value: number, locale: Locale): string {
  return value.toLocaleString(formattingLocale(locale))
}

/** Pełna data z godziną: `21.08.2026, 10:38:00` / `21/08/2026, 10:38:00`. */
export function formatDateTime(value: Date | string | number, locale: Locale): string {
  return toDate(value).toLocaleString(formattingLocale(locale))
}

/**
 * Skrót „dzień, miesiąc, godzina" bez roku: `21.08, 10:38` / `21/08, 10:38`.
 *
 * Zapis CYFROWY nie jest neutralny językowo, wbrew intuicji — różni się i
 * separatorem daty, i (przy `en-US`) kolejnością członów oraz obecnością AM/PM.
 * Dlatego przechodzi przez tę samą mapę co reszta, a nie przez własny literał.
 */
export function formatDayMonthTime(value: Date | string | number, locale: Locale): string {
  return toDate(value).toLocaleString(formattingLocale(locale), {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

/** Sama godzina, bez sekund: `10:38`. Pod `en-US` byłoby `10:38 AM` — patrz wyżej. */
export function formatClockTime(value: Date | string | number, locale: Locale): string {
  return toDate(value).toLocaleTimeString(formattingLocale(locale), {
    hour: "2-digit",
    minute: "2-digit",
  })
}
