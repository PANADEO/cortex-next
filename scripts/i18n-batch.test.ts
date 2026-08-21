import { execFileSync } from "node:child_process"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

/**
 * Narzędzie do wydawania i przyjmowania partii tłumaczeń.
 *
 * Testowane przez URUCHOMIENIE, nie przez import funkcji: skrypt jest
 * interfejsem wiersza poleceń i to jego zachowanie jako procesu jest
 * kontraktem — parsowanie argumentów, kształt wyjścia i zapis na dysk.
 * Test importujący same funkcje przechodziłby także wtedy, gdyby skrypt
 * wywoływał je źle.
 */
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const script = path.join(repoRoot, "scripts/i18n-batch.mjs")

let workdir: string

function run(args: string[]): string {
  return execFileSync("node", [script, ...args], { cwd: workdir, encoding: "utf8" })
}

beforeEach(() => {
  workdir = mkdtempSync(path.join(tmpdir(), "i18n-batch-"))
  const pl = path.join(workdir, "app/idp/locales/pl")
  const en = path.join(workdir, "app/idp/locales/en")
  mkdirSync(pl, { recursive: true })
  mkdirSync(en, { recursive: true })
  writeFileSync(
    path.join(pl, "proba.json"),
    JSON.stringify({
      _ctx: {
        "grupa.zapisz": "przycisk; zatwierdza formularz; maks. 12 zn.",
        "grupa.anuluj": "przycisk; zamyka bez zapisu",
      },
      grupa: { zapisz: "Zapisz", anuluj: "Anuluj" },
    }),
  )
  writeFileSync(path.join(en, "proba.json"), JSON.stringify({ grupa: { zapisz: "Save" } }))
})

afterEach(() => rmSync(workdir, { recursive: true, force: true }))

describe("partia tłumaczeń", () => {
  it("skleja napis z jego kontekstem — po to w ogóle istnieje", () => {
    const batch = JSON.parse(run(["export", "en", "proba"]))
    const entries = batch.namespaces[0].entries
    const zapisz = entries.find((e: { key: string }) => e.key === "grupa.zapisz")

    expect(zapisz).toEqual({
      key: "grupa.zapisz",
      source: "Zapisz",
      context: "przycisk; zatwierdza formularz; maks. 12 zn.",
      target: "Save",
    })
  })

  it("`--missing` wydaje wyłącznie to, czego w języku docelowym nie ma", () => {
    const batch = JSON.parse(run(["export", "en", "proba", "--missing"]))
    const keys = batch.namespaces[0].entries.map((e: { key: string }) => e.key)

    expect(keys).toEqual(["grupa.anuluj"])
  })

  it("import wpisuje tłumaczenie i NIE rusza kolejności kluczy", () => {
    const batch = JSON.parse(run(["export", "en", "proba"]))
    for (const entry of batch.namespaces[0].entries) {
      if (entry.key === "grupa.anuluj") entry.target = "Cancel"
    }
    const file = path.join(workdir, "partia.json")
    writeFileSync(file, JSON.stringify(batch))

    run(["import", file])

    const written = JSON.parse(
      readFileSync(path.join(workdir, "app/idp/locales/en/proba.json"), "utf8"),
    )
    expect(written).toEqual({ grupa: { zapisz: "Save", anuluj: "Cancel" } })
    // Kolejność, nie tylko zawartość: przesortowanie pliku przy zapisie dałoby
    // diff na cały plik i utopiło jedną realną zmianę wśród przestawionych linii.
    expect(Object.keys(written.grupa)).toEqual(["zapisz", "anuluj"])
  })

  it("pozycja bez tłumaczenia nie kasuje tego, co już było", () => {
    const batch = JSON.parse(run(["export", "en", "proba"]))
    for (const entry of batch.namespaces[0].entries) entry.target = null
    const file = path.join(workdir, "partia.json")
    writeFileSync(file, JSON.stringify(batch))

    run(["import", file])

    const written = JSON.parse(
      readFileSync(path.join(workdir, "app/idp/locales/en/proba.json"), "utf8"),
    )
    expect(written).toEqual({ grupa: { zapisz: "Save" } })
  })
})
