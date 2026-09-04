// KOSZT LICZY SIĘ ZE ZDARZEŃ. KOLUMNY `case_file.cost_usd` NIKT NIE CZYTA.
//
// DLACZEGO POWSTAŁ — to jest historia prawdziwa i kosztowała cudzą pracę.
//
// Kolumna `cost_usd` była kiedyś jedynym źródłem: dzienny limit, raport przełożonego
// i okienko sprawy sumowały ją. Po kolei każde z tych trzech miejsc przeniesiono na
// ZDARZENIE `cost`, bo suma trzymana obok zdarzeń kłamie na dwa sposoby (patrz komentarze
// przy `spentToday` i `costByStatus`). Przeniesiono jednak SAME ODCZYTY — trasa testowa
// `POST /api/test-reset` dalej robiła `update desk.case_file set cost_usd=0 where
// created_at >= current_date`, w przekonaniu, że odblokowuje dzienny limit przed kolejnym
// przebiegiem zestawu. Od chwili przejścia limitu na zdarzenia nie odblokowywała już nic.
// Zostało samo kasowanie — i kasowało sprawy CZŁOWIEKA, bo warunek brzmiał „z dzisiaj",
// a nie „z testu": ktoś klikał w Biurku, w tle szedł `pnpm test:e2e`, a koszt jego własnej,
// przed chwilą zrobionej sprawy pokazywał się jako 0,00 zł.
//
// Zmierzone przed poprawką na bazie deweloperskiej: 1866 zerowań, 4,74 USD skasowanej
// historii, 438 spraw ze zdarzeniem kosztu wobec 38 z niezerowym `cost_usd`.
//
// Cały ten szereg pomyłek ma jedną przyczynę: DWA ŹRÓDŁA TEJ SAMEJ LICZBY. Dopóki
// kolumna daje się odczytać, ktoś ją kiedyś odczyta — bo jedno `sum(cost_usd)` jest
// krótsze od podzapytania po zdarzeniach i wygląda niewinnie w code review.
//
// Ten test pilnuje więc granicy, a nie objawu: kolumna wolno ZAPISYWAĆ (runtime dokłada
// do niej po turze), nie wolno jej CZYTAĆ ani ZEROWAĆ. Kto ją zacznie czytać, dowie się
// tutaj, i dowie się razem z powodem.

import { readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const ROOT = path.resolve(__dirname, "../../../..")
/**
 * Skan obejmuje BIURKO, a nie całe repozytorium. `total_cost_usd` w typach IDP jest polem
 * cudzego backendu o zbieżnej nazwie — wciągnięcie go tutaj kazałoby wpisywać obcy produkt
 * na listę wyjątków własnej granicy, a to uczy dopisywania się do listy bezmyślnie.
 */
const LOOK_IN = [
  "packages/@cortex/desk-core",
  "packages/@cortex/desk-app",
  "packages/@cortex/desk-ui",
  "apps/desk",
]

/**
 * Miejsca, w których kolumna wolno się pojawić, z powodem przy każdym. Lista jest
 * WYCZERPUJĄCA — dopisanie do niej ma być decyzją, a nie odruchem gaszenia czerwieni.
 */
const ALLOWED = new Map<string, string>([
  ["packages/@cortex/desk-core/src/db.ts", "definicja kolumny i historyczne przemianowania"],
  ["packages/@cortex/desk-core/src/runtime.ts", "jedyny zapis: dokłada koszt tury"],
  [
    "packages/@cortex/desk-core/src/spent-today.integration.test.ts",
    "wstawia koszt do kolumny jako PUŁAPKĘ — dowodzi, że limit jej nie czyta",
  ],
])

/** Pliki, w których sam napis `cost_usd` stoi w komentarzu ostrzegawczym, nie w SQL-u. */
const PROSE_ONLY = new Set([
  "packages/@cortex/desk-core/src/capability-gate.ts",
  "packages/@cortex/desk-core/src/outcomes.ts",
  "packages/@cortex/desk-core/src/audit-log-text.ts",
  "packages/@cortex/desk-app/src/api/test-reset.ts",
  "packages/@cortex/desk-app/src/api/case-events.ts",
])

function sources(dir: string, into: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name === "dist") continue
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) sources(full, into)
    else if (/\.tsx?$/.test(name)) into.push(full)
  }
  return into
}

/** Wiersz kodu, czyli taki, który nie jest komentarzem `//` ani wnętrzem bloku `/* … *\/`. */
function codeLines(text: string): string[] {
  const out: string[] = []
  let inBlock = false
  for (const raw of text.split("\n")) {
    const line = raw.trim()
    if (inBlock) {
      if (line.includes("*/")) inBlock = false
      continue
    }
    if (line.startsWith("/*")) {
      if (!line.includes("*/")) inBlock = true
      continue
    }
    if (line.startsWith("//") || line.startsWith("*")) continue
    out.push(raw)
  }
  return out
}

const touching = LOOK_IN.flatMap((d) => sources(path.join(ROOT, d)))
  .map((full) => ({ rel: path.relative(ROOT, full), text: readFileSync(full, "utf8") }))
  // Sam strażnik odpada: wymienia zakazane zapisy, żeby ich szukać, więc każdym swoim
  // wzorcem trafiłby we własny tekst.
  .filter(({ rel }) => rel !== path.relative(ROOT, __filename))
  .filter(({ text }) => text.includes("cost_usd"))
  // `code` to ten sam plik bez komentarzy. Komentarz CYTUJĄCY zakazane zapytanie jest
  // najlepszą rzeczą, jaka może stać w kodzie po takiej pomyłce — strażnik, który by go
  // karał, kazałby usunąć wyjaśnienie, po które ktoś tu kiedyś przyjdzie.
  .map((z) => ({ ...z, code: codeLines(z.text).join("\n") }))

describe("granica kolumny `cost_usd`", () => {
  it("nikt nowy jej nie dotyka bez wpisania się na listę z powodem", () => {
    const strangers = touching
      .filter(({ rel }) => !ALLOWED.has(rel) && !PROSE_ONLY.has(rel))
      .map(({ rel }) => rel)
    expect(strangers).toEqual([])
  })

  it("w plikach spoza listy napis stoi w KOMENTARZU, a nie w zapytaniu", () => {
    // Bez tej asercji dopisanie się do `PROSE_ONLY` przepuszczałoby dowolny SQL.
    const inCode = touching
      .filter(({ rel }) => PROSE_ONLY.has(rel))
      .filter(({ code }) => code.includes("cost_usd"))
      .map(({ rel }) => rel)
    expect(inCode).toEqual([])
  })

  it("NIKT NIE ZERUJE kolumny — to był ten błąd, który zjadał koszty człowieka", () => {
    const zeroing = touching
      .filter(({ code }) => /set\s+cost_usd\s*=\s*0/i.test(code))
      .map(({ rel }) => rel)
    expect(zeroing).toEqual([])
  })

  it("ani jedno zapytanie jej nie SUMUJE — od tego są zdarzenia `cost`", () => {
    // `sum(cost_usd)` to dokładnie ten zapis, który wracał trzy razy: krótszy od
    // podzapytania po zdarzeniach i nie do odróżnienia w przeglądzie kodu.
    const summing = touching
      .filter(({ code }) => /sum\s*\(\s*cost_usd/i.test(code))
      .map(({ rel }) => rel)
    expect(summing).toEqual([])
  })

  it("na obu listach nie ma wpisu MARTWEGO", () => {
    // Zwolnienie, którego nikt już nie potrzebuje, jest gotowym miejscem na wpuszczenie
    // następnej pomyłki: przy najbliższej czerwieni ktoś zobaczy pasującą nazwę pliku
    // na liście i uzna, że wolno. Lista ma opisywać stan faktyczny albo zniknąć.
    const real = new Set(touching.map((z) => z.rel))
    const dead = [...ALLOWED.keys(), ...PROSE_ONLY].filter((rel) => !real.has(rel))
    expect(dead).toEqual([])
  })

  it("KONTROLA POZYTYWNA: skan naprawdę czyta pliki i naprawdę widzi kolumnę", () => {
    // Bez tego cztery asercje wyżej przechodziłyby również wtedy, gdyby `sources`
    // nie znalazło ani jednego pliku — a taki strażnik jest gorszy niż żaden.
    expect(touching.length).toBeGreaterThan(3)
    expect(touching.map((z) => z.rel)).toContain("packages/@cortex/desk-core/src/runtime.ts")
  })
})
