import en from "./en.json"
import pl from "./pl.json"

/**
 * TŁUMACZENIA BIURKA — własna, maleńka warstwa, a nie `i18next` powłoki. Trzy powody:
 *
 *  1. Ekrany Biurka są komponentami SERWERA (sięgają do bazy przy renderze), a `i18next`
 *     powłoki żyje wyłącznie w przeglądarce. Napis musiałby więc jechać przez klienta —
 *     czyli albo mignięcie po polsku, albo przepisanie ekranów na klienckie.
 *  2. Biurko stoi w DWÓCH miejscach: jako kafelek powłoki i jako `apps/desk`. Druga
 *     aplikacja nie ma `app/idp/lib/i18n` i mieć nie będzie, bo to inny pakiet.
 *  3. Cała warstwa to odczyt klucza, liczba mnoga przez `Intl.PluralRules` i podstawienie
 *     zmiennych. Biblioteka niosłaby tu głównie rzeczy, których nie używamy.
 *
 * Wybór języka jedzie w CIASTECZKU, bo to jedyny nośnik, który widzi zarówno serwer
 * (przy renderze), jak i przeglądarka (przy przełączaniu). `localStorage` powłoki
 * serwerowi nic nie mówi.
 */
export const DESK_LOCALES = ["pl", "en"] as const
export type DeskLocale = (typeof DESK_LOCALES)[number]

/** Polski jest źródłowy — w nim pisze się nowe napisy, angielski jest tłumaczeniem. */
export const DEFAULT_DESK_LOCALE: DeskLocale = "pl"

export const DESK_LOCALE_COOKIE = "desk_locale"

export const isDeskLocale = (value: unknown): value is DeskLocale =>
  typeof value === "string" && (DESK_LOCALES as readonly string[]).includes(value)

export const DESK_LOCALE_NAMES: Record<DeskLocale, string> = { pl: "Polski", en: "English" }

const DICTIONARIES: Record<DeskLocale, unknown> = { pl, en }

/** Formy liczby mnogiej pod jednym kluczem — wybiera je `Intl.PluralRules`. */
type Plural = Partial<Record<Intl.LDMLPluralRule, string>>

function resolve(dictionary: unknown, key: string): string | Plural | undefined {
  let node: unknown = dictionary
  for (const part of key.split(".")) {
    if (typeof node !== "object" || node === null) return undefined
    node = (node as Record<string, unknown>)[part]
  }
  if (typeof node === "string") return node
  if (typeof node === "object" && node !== null) return node as Plural
  return undefined
}

const fill = (text: string, vars: Record<string, unknown>) =>
  text.replace(/\{\{(\w+)\}\}/g, (whole, name: string) =>
    name in vars ? String(vars[name]) : whole,
  )

export type DeskT = (key: string, vars?: Record<string, unknown>) => string

/**
 * Brak klucza zwraca SAM KLUCZ, a nie pustkę. Pusty napis znika z ekranu bez śladu
 * i wygląda jak układ bez treści; klucz widać i widać, gdzie go szukać.
 *
 * Zapasu na drugi język NIE MA celowo — parzystość obu słowników pilnuje test, więc
 * cichy zapas maskowałby dokładnie to, co ten test ma pokazywać.
 */
export function makeDeskT(locale: DeskLocale): DeskT {
  const dictionary = DICTIONARIES[locale]
  const plural = new Intl.PluralRules(locale)
  return (key, vars = {}) => {
    const entry = resolve(dictionary, key)
    if (entry === undefined) return key
    if (typeof entry === "string") return fill(entry, vars)
    const n = Number(vars.count ?? 0)
    const form = entry[plural.select(n)] ?? entry.other ?? entry.many ?? entry.one
    return form === undefined ? key : fill(form, vars)
  }
}
