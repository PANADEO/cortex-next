// Strażnik parzystości: plik migracji `.sql` <-> wpis w `meta/_journal.json`.
//
// Powód powstania: migrator drizzle-orm NIE skanuje katalogu — czyta wyłącznie
// `_journal.json` i po każdym wpisie sięga po odpowiadający plik. Migracja
// dopisana ręcznie (bo drizzle-kit nie generuje UPDATE-ów ani DELETE-ów —
// 0004_romantic_sprite.sql i 0005_bitter_shadowcat.sql) bez wpisu w journalu
// po prostu NIGDY SIĘ NIE WYKONA. Nic nie pada: `migrate` kończy się
// sukcesem, deploy przechodzi, a naprawa danych, dla której migracja powstała,
// nie dzieje się na żadnej instancji. Objaw pokazuje się dopiero w produkcie
// (dla 0005: aktywowany kafelek, który nie pojawia się na hubie) i nie wskazuje
// na migrację.
//
// Odwrotny rozjazd też jest realny: wpis w journalu bez pliku wywraca krok
// `migrate` w połowie łańcucha, czyli zatrzymuje deploy — głośno, ale
// najlepiej złapać to przed wypchnięciem obrazu.
//
// Dlaczego test, a nie lint: `pnpm lint` obejmuje wyłącznie
// `{app,packages}/**/*.{ts,tsx}`, `tsc` nie patrzy na `.sql` ani na JSON
// danych, a żaden test nie uruchamia migracji. Ta sama luka i ten sam wzorzec
// co scripts-parse.test.ts i seed-chain-parity.test.ts obok.

import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

/** Lista modułów wyciągnięta z migrate.mjs, a nie wpisana drugi raz tutaj:
 *  moduł dodany do łańcucha bez folderu migracji ma paść na tym teście, a nie
 *  dopiero na deployu. */
const MODULE_FOLDERS = [
  ...readFileSync(path.join(packageRoot, "scripts/migrate.mjs"), "utf8").matchAll(
    /folder:\s*"(drizzle\/[a-z-]+)"/g,
  ),
].map((match) => match[1] as string)

interface JournalEntry {
  idx: number
  when: number
  tag: string
}

function journalOf(folder: string): JournalEntry[] {
  const raw = readFileSync(path.join(packageRoot, folder, "meta/_journal.json"), "utf8")
  return (JSON.parse(raw) as { entries: JournalEntry[] }).entries
}

function sqlFilesOf(folder: string): string[] {
  return readdirSync(path.join(packageRoot, folder))
    .filter((name) => name.endsWith(".sql"))
    .map((name) => name.replace(/\.sql$/, ""))
    .sort()
}

describe("migracje drizzle — journal i pliki .sql opisują ten sam zbiór", () => {
  it("migrate.mjs wymienia wszystkie sześć modułów (kontrola regexa wyżej)", () => {
    expect(MODULE_FOLDERS).toContain("drizzle/system-config")
    expect(MODULE_FOLDERS.length).toBe(6)
  })

  it.each(MODULE_FOLDERS)("%s: każdy plik .sql ma wpis w journalu i odwrotnie", (folder) => {
    expect(
      journalOf(folder)
        .map((entry) => entry.tag)
        .sort(),
    ).toEqual(sqlFilesOf(folder))
  })

  // Migrator stosuje migracje w kolejności `when` i zapisuje tę wartość jako
  // `created_at` w tabeli stanu; nowsza migracja z NIŻSZYM `when` niż już
  // odnotowana zostaje pominięta po cichu na każdej istniejącej instancji, a
  // na świeżej wykona się poprawnie. To jest dokładnie ta klasa błędu, która
  // różnicuje bazy między klientami — a przy ręcznie dopisywanym wpisie jest
  // na wyciągnięcie ręki (skopiowany timestamp sąsiada).
  it.each(MODULE_FOLDERS)("%s: idx i when rosną ściśle monotonicznie", (folder) => {
    const entries = journalOf(folder)
    expect(entries.map((entry) => entry.idx)).toEqual(entries.map((_entry, index) => index))
    for (let i = 1; i < entries.length; i += 1) {
      expect(entries[i]!.when).toBeGreaterThan(entries[i - 1]!.when)
    }
  })
})
