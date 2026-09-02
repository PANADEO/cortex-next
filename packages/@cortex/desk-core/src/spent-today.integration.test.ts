// Dzienny limit na PRAWDZIWYM Postgresie — bo cała pomyłka siedziała w jednym `where`.
//
// DLACZEGO POWSTAŁ. `spentToday` sumowało `cost_usd` spraw z `updated_at` z dzisiaj,
// czyli koszt SPRAW DOTKNIĘTYCH DZIŚ, a nie dzisiejszy wydatek. Skutek był podwójny
// i oba razy cichy: sprawa sprzed tygodnia, w której ktoś dopisał zdanie, wnosiła cały
// swój historyczny koszt i potrafiła zamknąć człowiekowi dzień komunikatem „wyczerpany
// dzienny limit" za pieniądze wydane w zeszłym miesiącu — a w drugą stronę wczorajszy
// koszt znikał z rachunku, gdy sprawy dziś nie ruszono, więc limit dawał się obejść
// przez samo odczekanie do północy.
//
// Testu jednostkowego na to nie ma sensu pisać: pomyłka jest w zapytaniu, więc sprawdzać
// trzeba na bazie, która to zapytanie wykona. Domyślnie POMIJANY — bez DATABASE_URL
// `pnpm test` zostaje zielony.

import { Pool } from "pg"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

const ADMIN_URL = process.env.DATABASE_URL
const PROBE_DB = "desk_spent_probe"

describe.skipIf(!ADMIN_URL)("dzisiejszy wydatek a limit dzienny", () => {
  let admin: Pool
  let db: typeof import("./db")
  let gate: typeof import("./capability-gate")

  const probeUrl = () => new URL(ADMIN_URL!).href.replace(/\/[^/?]*(\?|$)/, `/${PROBE_DB}$1`)

  /** Sprawa z kosztem historycznym, DOTKNIĘTA DZIŚ — to jest pułapka starego zapytania. */
  async function caseWith(id: string, owner: string, costUsd: number) {
    await db.pool.query(
      `insert into desk.case_file (id, owner, title, status, cost_usd, created_at, updated_at)
       values ($1,$2,$3,'done',$4, now() - interval '7 days', now())`,
      [id, owner, `sprawa ${id}`, costUsd],
    )
  }

  /** Zdarzenie kosztu z konkretnego dnia — `daysAgo: 0` znaczy dzisiaj. */
  async function costEvent(caseId: string, usd: number, daysAgo: number) {
    await db.pool.query(
      `insert into desk.event (case_id, at, payload)
       values ($1, now() - ($2 || ' days')::interval, $3::jsonb)`,
      [caseId, String(daysAgo), JSON.stringify({ type: "cost", usd, basis: "provider" })],
    )
  }

  beforeAll(async () => {
    admin = new Pool({ connectionString: ADMIN_URL })
    await admin.query(`drop database if exists ${PROBE_DB}`)
    await admin.query(`create database ${PROBE_DB}`)
    process.env.DATABASE_URL = probeUrl()
    global.__deskPool = undefined
    global.__deskMigration = undefined
    db = await import("./db")
    gate = await import("./capability-gate")
    await db.migrate()
  }, 30_000)

  afterAll(async () => {
    process.env.DATABASE_URL = ADMIN_URL
    await db?.pool.end()
    await admin.query(`drop database if exists ${PROBE_DB}`)
    await admin.end()
  })

  it("stara droga sprawa otwarta dziś NIE wlicza się do dzisiejszego limitu", async () => {
    // To jest dokładnie ta sytuacja, w której produkt oskarżał człowieka o wydatek,
    // którego dziś nie było: koszt sprzed tygodnia, `updated_at` z dzisiaj.
    await caseWith("stara", "anna", 4.5)
    await costEvent("stara", 4.5, 7)
    expect(await gate.spentToday("anna")).toBe(0)
  })

  it("dzisiejszy wydatek liczy się co do grosza", async () => {
    await caseWith("dzisiejsza", "anna", 0.75)
    await costEvent("dzisiejsza", 0.5, 0)
    await costEvent("dzisiejsza", 0.25, 0)
    expect(await gate.spentToday("anna")).toBeCloseTo(0.75, 6)
  })

  it("wczorajszy wydatek zostaje we wczoraj", async () => {
    await caseWith("wczorajsza", "anna", 9)
    await costEvent("wczorajsza", 9, 1)
    expect(await gate.spentToday("anna")).toBeCloseTo(0.75, 6)
  })

  it("cudzy wydatek nie obciąża mojego limitu", async () => {
    // Kontrola ujemna: gdyby zapytanie zgubiło złączenie z właścicielem, ten wiersz
    // wszedłby do sumy Anny i test przestałby cokolwiek dowodzić.
    await caseWith("roberta", "robert", 3)
    await costEvent("roberta", 3, 0)
    expect(await gate.spentToday("anna")).toBeCloseTo(0.75, 6)
    expect(await gate.spentToday("robert")).toBeCloseTo(3, 6)
  })

  it("osoba bez żadnej sprawy ma zero, a nie awarię", async () => {
    expect(await gate.spentToday("nikt")).toBe(0)
  })
})
