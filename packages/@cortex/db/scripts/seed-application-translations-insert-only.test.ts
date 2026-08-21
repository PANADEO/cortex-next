// Strażnik reguły, na której stoi cała migracja tłumaczeń nazw kafelków
// (PROJECT/cortex-frontend/ARTIFACTS/i18n/cortex-frontend-tlumaczenia-nazw-
// kafelkow-projekt.md, Krok 3): wartość początkowa tłumaczenia pochodzi z
// kodu, ale WŁAŚCICIELEM w runtime jest admin edytujący ją w oknie
// "Tłumaczenia". Oba seedy wolno więc wstawiać WYŁĄCZNIE przez
// `on conflict ... do nothing` — ani jednej kolumny w UPDATE.
//
// Powód powstania testu, a nie samego komentarza: dopisanie `do update set
// name = excluded.name` odtworzyłoby dokładnie ten defekt, dla którego naprawy
// powstał projekt konsolidacji rejestrów — zmiana zrobiona w UI wraca do
// wartości z kodu przy KAŻDYM deployu. Objaw jest cichy: nic nie pada, admin
// po prostu zastaje swoją zmianę cofniętą. Bliźniak
// seed-tile-manifests-insert-only.test.ts obok.
//
// Dlaczego akurat test, a nie lint: `pnpm lint` obejmuje wyłącznie
// `{app,packages}/**/*.{ts,tsx}`, `tsc` nie patrzy na `.mjs`, a żaden test nie
// wykonuje seedów.

import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const scriptsDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptsDir, "../../../..")

function read(name: string): string {
  return readFileSync(path.join(scriptsDir, name), "utf8")
}

/** Sam kod, bez komentarzy JS i SQL — komentarze w tych plikach wymieniają
 *  wprost frazy, których zakazują asercje niżej (po to, żeby wyjaśnić, czemu
 *  ich w kodzie nie ma), więc bez odcięcia testy padałyby na własnej
 *  dokumentacji. */
function codeOf(source: string): string {
  return source
    .split("\n")
    .filter((line) => !/^(\/\/|--|\/\*|\*)/.test(line.trim()))
    .join("\n")
}

/** Instrukcja INSERT-a do tabeli tłumaczeń, BEZ komentarzy SQL — komentarze
 *  wewnątrz wymieniają te same frazy (właśnie po to, żeby wyjaśnić, czemu ich
 *  tam nie ma), więc bez ich odcięcia test padałby na własnej dokumentacji. */
function translationStatement(source: string): string {
  const match = source.match(
    /insert into system_config\.application_translations[\s\S]*?on conflict[^\n]*\n/i,
  )
  return (match?.[0] ?? "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
}

describe("seed-application-translations.mjs — INSERT-only", () => {
  const source = read("seed-application-translations.mjs")
  const statement = translationStatement(source)

  it("regex w ogóle coś złapał", () => {
    expect(statement).toContain("application_id")
    expect(statement).toContain("locale")
  })

  it("wstawia przez on conflict do nothing, nie do update", () => {
    expect(statement).toMatch(/on conflict \(application_id, locale\) do nothing/i)
    expect(statement).not.toMatch(/do update/i)
  })

  it("w CAŁYM pliku nie ma ani jednego UPDATE-u tabeli tłumaczeń", () => {
    // Szersza asercja niż powyższa: łapie także UPDATE dopisany jako osobna
    // instrukcja obok INSERT-a, którego regex wyżej by nie objął.
    expect(codeOf(source)).not.toMatch(/do update/i)
    expect(codeOf(source)).not.toMatch(/update\s+system_config\./i)
  })

  it("dopasowuje kafelek po applications.code, a nie po zgadywanym id", () => {
    // Kod jest jedynym stabilnym kluczem między repo a instancją — id jest
    // losowe i różne w każdej bazie.
    expect(statement).toMatch(/from system_config\.applications a/i)
    expect(statement).toMatch(/where a\.code =/i)
  })

  it("pomija shortLabel — krótka nazwa nie jest daną instancji (rozstrzygnięcie 2)", () => {
    // Poza komentarzami: nagłówek pliku wymienia to pole właśnie po to, żeby
    // wyjaśnić, czemu go tam nie ma.
    expect(codeOf(source)).not.toContain("shortLabel")
  })

  it("nie czyta app/idp/locales w runtime — ten katalog nie istnieje w obrazie runner", () => {
    // Krok 6 projektu KASUJE en/tiles.json; odczyt w runtime uczyniłby ten seed
    // zależnym od pliku, którego usunięcie jest częścią tej samej roboty.
    expect(codeOf(source)).not.toContain("tiles.json")
    expect(codeOf(source)).not.toContain("readFile")
  })
})

describe("seed-application-translations.mjs — komplet dzisiejszych tłumaczeń", () => {
  const source = read("seed-application-translations.mjs")

  // Zrzut ma odpowiadać plikowi, z którego powstał, DOPÓKI ten plik istnieje.
  // Po Kroku 6 (kasacja en/tiles.json) ten test zniknie razem z nim — wtedy
  // jedynym źródłem prawdy jest baza, a nowe kafelki niosą tłumaczenia w
  // manifeście.
  const tilesJson = path.join(repoRoot, "app/idp/locales/en/tiles.json")

  it("każdy wpis z en/tiles.json ma odpowiednik w zrzucie (label -> name)", () => {
    const tiles = JSON.parse(readFileSync(tilesJson, "utf8")) as Record<
      string,
      { label: string; description?: string }
    >

    for (const [code, entry] of Object.entries(tiles)) {
      expect(source, `brak kodu ${code}`).toContain(JSON.stringify(code))
      expect(source, `brak etykiety kafelka ${code}`).toContain(JSON.stringify(entry.label))
      if (entry.description) {
        expect(source, `brak opisu kafelka ${code}`).toContain(JSON.stringify(entry.description))
      }
    }
  })
})

describe("seed-tile-manifests.mjs — tłumaczenia z manifestu tą samą regułą", () => {
  const source = read("seed-tile-manifests.mjs")
  const statement = translationStatement(source)

  it("w ogóle wstawia manifest.translations", () => {
    expect(source).toContain("manifest.translations")
    expect(statement).toContain("application_id")
  })

  it("wstawia przez on conflict do nothing, nie do update", () => {
    expect(statement).toMatch(/on conflict \(application_id, locale\) do nothing/i)
    expect(statement).not.toMatch(/do update/i)
  })

  it("nie zakłada wiersza bez ani jednej wartości", () => {
    // Ta sama reguła co po stronie zapisu z panelu: wpis, w którym oba pola są
    // puste, nie jest tłumaczeniem i nie ma powodu, żeby zajmował wiersz.
    expect(source).toMatch(/if \(name === null && description === null\) continue/)
  })
})
