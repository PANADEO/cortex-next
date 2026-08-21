import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

/**
 * Strażnik plików tłumaczeń: parzystość kluczy i KOMPLETNOŚĆ KONTEKSTU.
 *
 * Brak klucza w `en` NIE wywala aplikacji — zapas pokazuje inny język, i to
 * jest zamierzone. Cena jest taka, że **luka jest w runtime niewidoczna**:
 * ekran wygląda na działający, tylko zdanie zostaje w złym języku. Ten test
 * jest jedynym miejscem, w którym taka luka staje się głośna.
 *
 * `_ctx` to sekcja WYŁĄCZNIE dla człowieka i dla agenta tłumaczącego —
 * i18next nigdy jej nie odpytuje. Trzyma po jednym zdaniu na klucz w formacie
 * `typ; co robi[; ograniczenie]`, np. „przycisk; operacja NIEODWRACALNA;
 * maks. 12 zn.". Bez tego agent tłumaczący widzi goły napis „Usuń" i nie wie,
 * czy to przycisk w wierszu tabeli (gdzie liczy się długość), czy nagłówek
 * potwierdzenia. Kontekst żyje tylko przy języku ŹRÓDŁOWYM, bo wszystkie
 * tłumaczenia powstają z niego.
 */
const localesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../locales")
const SOURCE = "pl"
const CONTEXT_KEY = "_ctx"

/** Przestrzenie bez odpowiednika w języku źródłowym — patrz `hub-tile.ts`:
 *  polskie nazwy kafelków żyją w bazie i należą do administratora. */
const TRANSLATION_ONLY_NAMESPACES = ["tiles.json"]

function flatten(value: unknown, prefix = ""): string[] {
  if (value === null || typeof value !== "object") return [prefix]
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    flatten(child, prefix ? `${prefix}.${key}` : key),
  )
}

function load(locale: string, namespace: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path.join(localesDir, locale, namespace), "utf8"))
}

/** Klucze tłumaczeń, czyli wszystko POZA sekcją kontekstu. */
function translationKeys(bundle: Record<string, unknown>): string[] {
  const { [CONTEXT_KEY]: _ignored, ...rest } = bundle
  return flatten(rest).sort()
}

const namespaces = readdirSync(path.join(localesDir, SOURCE)).filter((file) =>
  file.endsWith(".json"),
)

describe("pliki tłumaczeń", () => {
  it("każda przestrzeń źródłowa ma odpowiednik w `en`", () => {
    const en = readdirSync(path.join(localesDir, "en")).filter((file) => file.endsWith(".json"))
    expect(en.filter((file) => !TRANSLATION_ONLY_NAMESPACES.includes(file)).sort()).toEqual(
      namespaces.sort(),
    )
  })

  it("przestrzenie wyłącznie tłumaczeniowe istnieją w `en`", () => {
    const en = readdirSync(path.join(localesDir, "en"))
    for (const file of TRANSLATION_ONLY_NAMESPACES) expect(en).toContain(file)
  })

  it.each(namespaces)("%s ma identyczny zestaw kluczy w obu językach", (namespace) => {
    const pl = translationKeys(load(SOURCE, namespace))
    const en = translationKeys(load("en", namespace))

    expect({ brakujeWEn: pl.filter((k) => !en.includes(k)) }).toEqual({ brakujeWEn: [] })
    expect({ nadmiarWEn: en.filter((k) => !pl.includes(k)) }).toEqual({ nadmiarWEn: [] })
  })

  it.each(namespaces)("%s: KAŻDY klucz ma kontekst dla tłumacza", (namespace) => {
    const bundle = load(SOURCE, namespace)
    const context = (bundle[CONTEXT_KEY] ?? {}) as Record<string, string>
    const keys = translationKeys(bundle)

    expect({ bezKontekstu: keys.filter((k) => !context[k]) }).toEqual({ bezKontekstu: [] })
    expect({
      kontekstBezKlucza: Object.keys(context).filter((k) => !keys.includes(k)),
    }).toEqual({ kontekstBezKlucza: [] })
  })

  it.each(namespaces)("%s: kontekst mówi CZYM jest napis, nie tylko gdzie stoi", (namespace) => {
    const context = (load(SOURCE, namespace)[CONTEXT_KEY] ?? {}) as Record<string, string>

    // Format `typ; co robi[; ograniczenie]` — bez średnika zostaje sama nazwa
    // miejsca, a to za mało, żeby wybrać słowo w obcym języku.
    const bezTypu = Object.entries(context)
      .filter(([, value]) => !value.includes(";"))
      .map(([key]) => key)

    expect({ bezTypu }).toEqual({ bezTypu: [] })
  })

  it.each(namespaces)("%s nie ma pustych wartości", (namespace) => {
    for (const locale of [SOURCE, "en"]) {
      const raw = JSON.stringify(load(locale, namespace))
      expect(raw, `${locale}/${namespace} zawiera pusty napis`).not.toMatch(/:\s*""/)
    }
  })
})
