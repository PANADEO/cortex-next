import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

/**
 * Strażnik parzystości przestrzeni tłumaczeń.
 *
 * Brak klucza w `en` NIE wywala aplikacji — `fallbackLng` pokazuje polski
 * oryginał, i to jest zachowanie zamierzone (klient ma zobaczyć niedokończone
 * tłumaczenie, nie surowy klucz). Cena jest taka, że **luka jest niewidoczna
 * w runtime**: ekran wygląda na działający, tylko zdanie zostaje po polsku.
 * Ten test jest jedynym miejscem, w którym taka luka staje się głośna.
 *
 * Sprawdzane w obie strony: klucz nadmiarowy w `en` to zwykle literówka albo
 * pozostałość po zmianie nazwy po stronie `pl` — czyli martwe tłumaczenie,
 * którego nikt nigdy nie zobaczy.
 */
const localesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../locales")

function flatten(value: unknown, prefix = ""): string[] {
  if (value === null || typeof value !== "object") return [prefix]
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    flatten(child, prefix ? `${prefix}.${key}` : key),
  )
}

function load(locale: string, namespace: string): unknown {
  return JSON.parse(readFileSync(path.join(localesDir, locale, namespace), "utf8"))
}

/**
 * `tiles` NIE MA odpowiednika w języku źródłowym i to jest zamierzone:
 * nazwy kafelków po polsku żyją w bazie i należą do administratora, więc
 * plik w repo by je przykrywał (patrz `hub-tile.ts`). Parzystość liczymy
 * więc po przestrzeniach ŹRÓDŁOWYCH, a nadmiar w `en` dopuszczamy wyłącznie
 * dla tej jednej, wymienionej z nazwy.
 */
const TRANSLATION_ONLY_NAMESPACES = ["tiles.json"]

const namespaces = readdirSync(path.join(localesDir, "pl")).filter((file) => file.endsWith(".json"))

describe("przestrzenie tłumaczeń", () => {
  it("każda przestrzeń z `pl` ma odpowiednik w `en`", () => {
    const en = readdirSync(path.join(localesDir, "en")).filter((file) => file.endsWith(".json"))
    expect(en.filter((file) => !TRANSLATION_ONLY_NAMESPACES.includes(file)).sort()).toEqual(
      namespaces.sort(),
    )
  })

  it("przestrzenie wyłącznie tłumaczeniowe faktycznie istnieją w `en`", () => {
    const en = readdirSync(path.join(localesDir, "en"))
    for (const file of TRANSLATION_ONLY_NAMESPACES) expect(en).toContain(file)
  })

  it.each(namespaces)("%s ma identyczny zestaw kluczy w obu językach", (namespace) => {
    const pl = flatten(load("pl", namespace)).sort()
    const en = flatten(load("en", namespace)).sort()

    expect({ brakujeWEn: pl.filter((k) => !en.includes(k)) }).toEqual({ brakujeWEn: [] })
    expect({ nadmiarWEn: en.filter((k) => !pl.includes(k)) }).toEqual({ nadmiarWEn: [] })
  })

  it.each(namespaces)("%s nie ma pustych wartości", (namespace) => {
    for (const locale of ["pl", "en"]) {
      const raw = JSON.stringify(load(locale, namespace))
      expect(raw, `${locale}/${namespace} zawiera pusty napis`).not.toMatch(/:\s*""/)
    }
  })
})
