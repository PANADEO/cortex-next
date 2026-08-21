// Klucze komunikatów oddawane przez /api/content-guru/** REALNIE ISTNIEJĄ w
// obu plikach tłumaczeń.
//
// To własność odwrotna do guard-coverage.test.ts: tam chodzi o to, KTO może
// wejść, tu o to, co użytkownik zobaczy, gdy wejdzie i trafi na ścieżkę błędu.
// Literówka w `messageKey` nie wywala niczego — klient (lib/i18n/api-error.ts)
// spada wtedy na ogólny zapas wołającego („Nie udało się uruchomić
// generowania") i ginie dokładnie ta informacja, dla której klucz w ogóle
// wyjechał z serwera: KTÓREGO zasobu brakuje.
//
// Dwie rzeczy robią ten test mocniejszym niż lista przypadków przepisana ręcznie:
//
//  1. Klucze są WYŁUSKIWANE ZE ŹRÓDEŁ, nie wpisane tutaj. Nowy endpoint z
//     `messageKey` wchodzi do zestawu sam, bez pamiętania o dopisaniu go.
//  2. Skan idzie PLIK PO PLIKU. Te same trzy klucze oddają DWIE trasy
//     (`generate/route.ts` i `jobs/route.ts`) — zestaw scalony w jeden worek
//     przepuściłby literówkę w jednej z nich, bo poprawny bliźniak z drugiej
//     i tak by w nim był.
//
// Sprawdzane są OBA języki: klucz obecny tylko w `pl` nie wywala aplikacji,
// bo `en` spada na zapas — i angielski użytkownik dostaje polskie zdanie.

import enContentGuru from "@/locales/en/content-guru.json"
import plContentGuru from "@/locales/pl/content-guru.json"
import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const moduleDir = path.dirname(fileURLToPath(import.meta.url))

const BUNDLES: Record<string, unknown> = { pl: plContentGuru, en: enContentGuru }
const LOCALES = Object.keys(BUNDLES)

function sentence(locale: string, key: string): unknown {
  return key
    .split(".")
    .reduce<unknown>(
      (node, part) => (node as Record<string, unknown> | undefined)?.[part],
      BUNDLES[locale],
    )
}

/** Wszystkie route handlery modułu — bez listy do utrzymania, wzorem
 *  guard-coverage.test.ts. */
function routeFiles(): string[] {
  return readdirSync(moduleDir, { recursive: true, encoding: "utf8" })
    .map((entry) => entry.split(path.sep).join("/"))
    .filter((file) => file.endsWith("/route.ts") || file === "route.ts")
}

interface Usage {
  file: string
  key: string
}

const USAGES: Usage[] = routeFiles().flatMap((file) => {
  const source = readFileSync(path.join(moduleDir, file), "utf8")
  return [...source.matchAll(/messageKey:\s*"([^"]+)"/g)].map((match) => ({
    file,
    key: match[1] ?? "",
  }))
})

describe("klucze komunikatów /api/content-guru/**", () => {
  // Bez tego pusty wynik skanu (zmieniona składnia, przeniesione pliki)
  // dałby zestaw bez ani jednego przypadku — czyli zielono i bez wartości.
  it("skan realnie znajduje klucze w obu trasach, które je oddają", () => {
    expect(USAGES.length).toBeGreaterThanOrEqual(6)
    expect(USAGES.filter(({ file }) => file === "generate/route.ts").length).toBeGreaterThanOrEqual(
      3,
    )
    expect(USAGES.filter(({ file }) => file === "jobs/route.ts").length).toBeGreaterThanOrEqual(3)
  })

  it.each(USAGES.flatMap((usage) => LOCALES.map((locale) => ({ ...usage, locale }))))(
    "$file: $key istnieje w $locale",
    ({ locale, key }) => {
      expect(typeof sentence(locale, key)).toBe("string")
    },
  )

  // Żaden z tych komunikatów nie dostaje parametrów — ciało odpowiedzi niesie
  // sam `messageKey`, bez `messageParams`. Wąs w takim zdaniu wyszedłby na
  // ekran surowy.
  it.each(USAGES.flatMap((usage) => LOCALES.map((locale) => ({ ...usage, locale }))))(
    "$file: $key nie ma w $locale wąsa bez parametru",
    ({ locale, key }) => {
      const text = sentence(locale, key) as string
      expect({ wasy: [...text.matchAll(/{{[^{}]+}}/g)].map((match) => match[0]) }).toEqual({
        wasy: [],
      })
    },
  )
})
