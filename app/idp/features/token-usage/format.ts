import type { Locale } from "@/lib/i18n/config"
import { formatNumber as formatLocalizedNumber } from "@/lib/i18n/formats"

/** Formatowanie liczb w jednym miejscu — inaczej separator tysięcy rozjeżdża
 *  się między kartami metryk, słupkami i tabelami.
 *
 *  `locale` idzie PARAMETREM, tak samo jak `t` w fabrykach kolumn: to nie jest
 *  komponent, więc nie ma prawa sięgnąć po hook. Wybór języka podaje wywołujący,
 *  a bierze go z `useLocaleStore` — z tego samego miejsca, co napisy. */
export function formatNumber(value: number, locale: Locale): string {
  return formatLocalizedNumber(Math.round(value), locale)
}

export function formatShare(share: number): string {
  return `${share.toFixed(1)}%`
}
