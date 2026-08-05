// Strażnik składni skryptów seedowych. Powód powstania: 05.08.2026 komentarz
// SQL wpisany wewnątrz tagged template `tx`...`` użył BACKTICKÓW wokół nazwy
// kolumny (-- Kolumna `category` ...), co zamyka template literal i wywala
// CAŁY plik na etapie parsowania — jeszcze zanim dotknie bazy.
//
// Dlaczego to jest groźniejsze, niż wygląda: `docker-compose*.yml` łączy seedy
// w łańcuch przez `&&`, więc padnięcie seed-system-config.mjs zatrzymuje
// migrację i wszystkie kolejne seedy. Na świeżej instancji zostaje baza bez
// administratora i bez rejestru aplikacji, a panel Konfiguracji Systemu jest
// za własnym grantem — czyli nie ma ścieżki naprawy z UI.
//
// Dlaczego akurat test, a nie lint: `pnpm lint` obejmuje wyłącznie
// `{app,packages}/**/*.{ts,tsx}`, `tsc` w ogóle nie patrzy na `.mjs`, a żaden
// test nie wykonuje seedów. Ta klasa błędu nie była łapana przez nic.

import { execFileSync } from "node:child_process"
import { readdirSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const scriptsDir = path.dirname(fileURLToPath(import.meta.url))
const scripts = readdirSync(scriptsDir).filter((name) => name.endsWith(".mjs"))

describe("skrypty seedowe/migracyjne parsują się", () => {
  it("w katalogu w ogóle są jakieś skrypty (inaczej test jest pusty i nic nie dowodzi)", () => {
    expect(scripts.length).toBeGreaterThan(0)
  })

  it.each(scripts)("%s", (name) => {
    expect(() =>
      execFileSync(process.execPath, ["--check", path.join(scriptsDir, name)], { stdio: "pipe" }),
    ).not.toThrow()
  })
})
