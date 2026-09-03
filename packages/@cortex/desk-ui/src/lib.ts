import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { DeskLocale } from "./i18n/locale"

export function cn(...i: ClassValue[]) {
  return twMerge(clsx(i))
}

/**
 * Kwota w złotówkach. Język jest OBOWIĄZKOWY, a nie domyślnie polski — inaczej
 * każde nowe wywołanie po cichu wracałoby do polskiego formatu, a to jest dokładnie
 * ten rodzaj wstecznego biegu, którego przy dwóch językach nie widać na przeglądzie.
 *
 * `Intl.NumberFormat` zamiast ręcznego `toFixed().replace(".", ",")`: przecinek jest
 * separatorem po polsku i kropką po angielsku, a miejsce symbolu waluty też się różni.
 */
export function zl(usd: number, locale: DeskLocale) {
  const rate = Number(process.env.NEXT_PUBLIC_USD_PLN ?? 4)
  return new Intl.NumberFormat(locale, { style: "currency", currency: "PLN" }).format(usd * rate)
}

export function size(b: number) {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} kB`
  return `${(b / 1024 / 1024).toFixed(1)} MB`
}

/**
 * „5 min temu". `Intl.RelativeTimeFormat` odmienia to za nas w każdym języku —
 * ręczne sklejanie działało dopóki język był jeden.
 */
export function when(iso: string, locale: DeskLocale) {
  const d = new Date(iso)
  const minutes = Math.round((Date.now() - d.getTime()) / 60000)
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: "auto" })
  if (minutes < 1) return relative.format(0, "minute")
  if (minutes < 60) return relative.format(-minutes, "minute")
  if (minutes < 60 * 24) return relative.format(-Math.round(minutes / 60), "hour")
  return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit" }).format(d)
}

/**
 * Polska odmiana liczebnika: 1 plik · 2 pliki · 5 plików · 22 pliki · 25 plików.
 * Zostaje dla miejsc, które składają zdanie z danych, a nie z klucza słownika —
 * w słowniku tę robotę wykonuje `Intl.PluralRules` w `makeDeskT`.
 */
export function count(n: number, one: string, several: string, many: string) {
  const d = n % 10
  const s = n % 100
  if (n === 1) return `${n} ${one}`
  if (d >= 2 && d <= 4 && (s < 12 || s > 14)) return `${n} ${several}`
  return `${n} ${many}`
}

/**
 * POWÓD ZATRZYMANIA SPRAWY po ludzku, w języku patrzącego.
 *
 * Kolumna `case_file.reason` trzyma dwa różne rodzaje wartości i to rozróżnienie jest
 * tu całą treścią:
 *   · KODY — „stopped-by-you", „server-restart" — czyli przyczyny, które Biurko zna
 *     i potrafi nazwać w każdym języku;
 *   · ZDANIA — wynik `readableFailure()` przy awarii, złożony z tego, co realnie padło.
 *
 * Do 03.09.2026 kodów nie było wcale: zatrzymanie zapisywało do bazy polskie zdanie
 * „przerwane przez Ciebie", a ekran renderował je dosłownie. Zdarzeń i wierszy się nie
 * przepisuje, więc angielski użytkownik miał tam polszczyznę NA ZAWSZE — także po
 * naprawieniu wszystkiego dookoła.
 *
 * Nieznana wartość wraca bez zmian i to jest zamierzone: stare sprawy dalej mówią to,
 * co powiedziały, a zdania awarii nie udają, że są kodami. Sprowadzenie ICH do słownika
 * to osobna praca — `readableFailure` składa zdanie z treści błędu, więc nie ma
 * skończonej listy, którą dałoby się przetłumaczyć.
 */
export function reasonText(translate: (key: string) => string, reason: string): string {
  const known = new Set(["stopped-by-you", "server-restart"])
  return known.has(reason) ? translate(`case.reason.${reason}`) : reason
}
