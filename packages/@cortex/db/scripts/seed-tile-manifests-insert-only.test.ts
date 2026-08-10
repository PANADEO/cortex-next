// Strażnik reguły, na której stoi cała konsolidacja rejestrów kafelka (K1,
// PROJECT/cortex-frontend/ARTIFACTS/licencjonowanie/
// cortex-frontend-konsolidacja-rejestrow-kafelka-projekt.md D2): pola
// prezentacyjne z manifestu są wartością POCZĄTKOWĄ wiersza, więc wolno je
// wstawiać WYŁĄCZNIE w INSERCIE i nigdy w `on conflict do update set`.
//
// Powód powstania testu, a nie samego komentarza: dopisanie jednej linijki do
// `do update set` odtworzyłoby defekt, dla którego naprawy ten projekt w ogóle
// powstał — seed-system-config.mjs ma dziś color/category_functional/
// category_department w UPDATE bezwarunkowo, więc kategoria ustawiona przez
// admina w UI wraca do wartości z kodu przy KAŻDYM deployu. Objaw jest cichy:
// nic nie pada, admin po prostu zastaje swoją zmianę cofniętą.
//
// Dlaczego akurat test, a nie lint: `pnpm lint` obejmuje wyłącznie
// `{app,packages}/**/*.{ts,tsx}`, `tsc` nie patrzy na `.mjs`, a żaden test nie
// wykonuje seedów — dokładnie ta sama luka, dla której powstały
// scripts-parse.test.ts i seed-chain-parity.test.ts obok.

import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const scriptsDir = path.dirname(fileURLToPath(import.meta.url))
const source = readFileSync(path.join(scriptsDir, "seed-tile-manifests.mjs"), "utf8")

/** Kolumny, których właścicielem w runtime jest admin (edytuje je w UI
 *  Aplikacje), a manifest podaje tylko ich wartość początkową. */
const ADMIN_OWNED_COLUMNS = [
  "name",
  "description",
  "icon",
  "color",
  "category_functional",
  "category_department",
  "is_active",
  "show_on_hub",
  "sort_order",
]

/** Samo zapytanie, BEZ komentarzy SQL — komentarze wewnątrz wymieniają te same
 *  nazwy kolumn (właśnie po to, żeby wyjaśnić, czemu ich tam nie ma), więc bez
 *  ich odcięcia test padałby na własnej dokumentacji. Zakotwiczone na `insert
 *  into`, bo fraza "do update set" pada też w nagłówku pliku. */
const statement = (source.match(/insert into system_config\.applications[\s\S]*?returning/i)?.[0] ?? "")
  .split("\n")
  .filter((line) => !line.trim().startsWith("--"))
  .join("\n")

/** Lista kolumn INSERT-a. */
const insertColumns = statement.match(/applications\s*\(([^)]*)\)/i)?.[1] ?? ""

/** Wszystko przed `on conflict`, czyli lista kolumn RAZEM z wartościami. Dla
 *  sześciu pól prezentacyjnych wystarczała sama nazwa kolumny w INSERCIE, bo
 *  kolumna była tam WYŁĄCZNIE po to, żeby wziąć wartość z manifestu. Siódme
 *  pole (`entitlementOnly`, K1b) nie ma własnej kolumny — steruje `show_on_hub`,
 *  które w INSERCIE stało już wcześniej z zaszytym `false`. Nazwa kolumny nie
 *  odróżnia więc stanu przed od stanu po; odróżnia to dopiero wartość. */
const valuesClause = statement.split(/on conflict/i)[0] ?? ""

/** Ciało `do update set`. */
const updateClause = statement.match(/do update set([\s\S]*)$/i)?.[1] ?? ""

describe("seed-tile-manifests.mjs — pola prezentacyjne wyłącznie na INSERCIE", () => {
  // Bez tych dwóch asercji cała reszta przechodziłaby triumfalnie także wtedy,
  // gdyby regexy przestały pasować (przepisany INSERT, inne formatowanie) albo
  // gdyby ktoś usunął te kolumny z INSERT-a zamiast z UPDATE-u.
  it("regexy w ogóle coś złapały", () => {
    expect(insertColumns).toContain("code")
    expect(valuesClause).toContain("manifest.entitlementCode")
    expect(updateClause).toContain("kind = excluded.kind")
  })

  it.each([
    "description",
    "icon",
    "color",
    "category_functional",
    "category_department",
    "sort_order",
  ])("INSERT wstawia %s z manifestu", (column) => {
    expect(insertColumns).toContain(column)
  })

  // Siódme pole (K1b). Osobna asercja, bo `show_on_hub` stało w INSERCIE już
  // przed K1b — z zaszytym `false` dla KAŻDEGO kafelka. Sprawdzenie nazwy
  // kolumny przeszłoby więc także na wersji sprzed zmiany; dowodem jest
  // dopiero to, że wartość bierze się z manifestu.
  it("INSERT bierze show_on_hub z manifestowego entitlementOnly, nie z zaszytej stałej", () => {
    expect(insertColumns).toContain("show_on_hub")
    expect(valuesClause).toContain("manifest.entitlementOnly")
  })

  it.each(ADMIN_OWNED_COLUMNS)("%s NIE JEST w do update set — edycja admina przeżywa deploy", (column) => {
    expect(updateClause).not.toMatch(new RegExp(`\\b${column}\\s*=`))
  })

  // Świadoma nadmiarowość, nie luka: wstrzyknięcie
  // `show_on_hub = ${manifest.entitlementOnly !== true}` do `do update set`
  // łapią już DWIE asercje wyżej (show_on_hub w ADMIN_OWNED_COLUMNS i
  // dokładna lista przypisań) — sprawdzone uruchomieniem. Ta jedna nazywa
  // wprost, czego dotyczy naruszenie, żeby raport z pnpm test wskazywał
  // siódme pole, a nie tylko kolumnę, przez którą ono działa.
  it("entitlementOnly nie przecieka do do update set", () => {
    expect(updateClause).not.toContain("entitlementOnly")
  })

  it("do update set obejmuje wyłącznie kolumny strukturalne + updated_at", () => {
    const assigned = [...updateClause.matchAll(/(\w+)\s*=/g)].map((match) => match[1])
    expect(assigned.sort()).toEqual(["kind", "route", "target", "updated_at", "url"])
  })
})
