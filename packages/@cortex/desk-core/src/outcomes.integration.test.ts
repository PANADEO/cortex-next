// Zestawienie porażek na PRAWDZIWYM Postgresie — bo całe to zestawienie JEST zapytaniem.
//
// DLACZEGO NIE JEDNOSTKOWO. Pomyłka, której się tu boimy, nie mieszka w JavaScripcie:
// `payload->>'ok' = 'false'` kontra `payload->'ok' = 'false'`, `count(*)` kontra
// `count(distinct case_id)`, złączenie z właścicielem zgubione w `blocked`. Atrapa
// sterownika przepuściłaby każdą z nich, bo odpowiadałaby to, co jej kazano — czyli
// test dowodziłby wyłącznie tego, że umiem napisać atrapę. To ta sama decyzja, co
// w `spent-today.integration.test.ts`, i z tego samego powodu.
//
// Domyślnie POMIJANY — bez DATABASE_URL `pnpm test` zostaje zielony.

import { Pool } from "pg"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import type { DeskEvent } from "./types"

const ADMIN_URL = process.env.DATABASE_URL
const PROBE_DB = "desk_outcomes_probe"

describe.skipIf(!ADMIN_URL)("zestawienie porażek dla przełożonego", () => {
  let admin: Pool
  let db: typeof import("./db")
  let outcomes: typeof import("./outcomes")

  const probeUrl = () => new URL(ADMIN_URL!).href.replace(/\/[^/?]*(\?|$)/, `/${PROBE_DB}$1`)

  /** Sprawa w zadanym stanie, domknięta `daysAgo` dni temu. `daysAgo: 0` znaczy dzisiaj. */
  async function caseFile(
    id: string,
    owner: string,
    status: string,
    daysAgo = 0,
    reason: string | null = null,
  ) {
    await db.pool.query(
      `insert into desk.case_file (id, owner, title, status, reason, created_at, updated_at)
       values ($1,$2,$3,$4,$5, now() - ($6 || ' days')::interval, now() - ($6 || ' days')::interval)`,
      // Tytuł jest tu bez znaczenia i to jest część dowodu: zestawienie nie ma prawa
      // go tknąć, więc niech we wszystkich sprawach brzmi tak samo.
      [id, owner, "sprawa", status, reason, String(daysAgo)],
    )
  }

  async function event(caseId: string, payload: DeskEvent, daysAgo = 0) {
    await db.pool.query(
      `insert into desk.event (case_id, at, payload)
       values ($1, now() - ($2 || ' days')::interval, $3::jsonb)`,
      [caseId, String(daysAgo), JSON.stringify(payload)],
    )
  }

  const step = (name: string, ok: boolean, reason?: string): DeskEvent =>
    ({ type: "tool_end", name, ok, summary: "", ms: 1, ...(reason ? { reason } : {}) }) as DeskEvent

  const blocked = (capabilityId?: string): DeskEvent =>
    ({
      type: "blocked",
      // Opis JEST treścią zlecenia — stoi tu po to, żeby dało się sprawdzić, że
      // zestawienie nigdy go nie oddaje.
      description: "zestawić faktury spółki Kowalski i Wspólnicy za sierpień",
      ...(capabilityId ? { capabilityId } : {}),
    }) as DeskEvent

  beforeAll(async () => {
    admin = new Pool({ connectionString: ADMIN_URL })
    await admin.query(`drop database if exists ${PROBE_DB}`)
    await admin.query(`create database ${PROBE_DB}`)
    process.env.DATABASE_URL = probeUrl()
    global.__deskPool = undefined
    global.__deskMigration = undefined
    db = await import("./db")
    outcomes = await import("./outcomes")
    await db.migrate()

    // ── STAN, NA KTÓRYM LICZYMY ─────────────────────────────────────────────
    await caseFile("done-1", "anna", "done")
    await caseFile("done-2", "anna", "done")
    await caseFile("done-3", "robert", "done")
    await caseFile("failed-1", "anna", "failed", 0, "Nie udało się połączyć z usługą modelu.")
    await caseFile("stopped-1", "anna", "stopped", 0, "stopped-by-you")
    await caseFile("stopped-2", "robert", "stopped", 0, "server-restart")
    await caseFile("stopped-3", "anna", "stopped", 0, "stopped-by-you")
    await caseFile("working-1", "anna", "working")
    // Sprawa spoza okna — jedyna, której NIE wolno policzyć.
    await caseFile("done-old", "anna", "done", 90)

    // Kroki: dwa razy ten sam powód w JEDNEJ sprawie, raz w drugiej.
    await event("failed-1", step("read_file", false, "no-such-file"))
    await event("failed-1", step("read_file", false, "no-such-file"))
    await event("done-1", step("read_file", false, "no-such-file"))
    await event("done-1", step("run_computation", false, "computation-error"))
    // Krok UDANY — kontrola ujemna dla warunku `ok = false`.
    await event("done-1", step("write_sheet", true))
    // Krok bez powodu i krok z powodem spoza listy: oba są tą samą niewiedzą.
    await event("done-2", step("mcp_something", false))
    await event("done-2", step("mcp_something", false, "cos-czego-nie-znamy"))
    // Poza oknem.
    await event("done-old", step("read_file", false, "cannot-open"), 90)

    // Kłódki: ta sama zdolność u dwóch osób, druga u jednej, jedna spoza katalogu.
    await event("done-1", blocked("sheet.write"))
    await event("done-1", blocked("sheet.write"))
    await event("done-3", blocked("sheet.write"))
    await event("failed-1", blocked("counterparty.verify"))
    await event("done-2", blocked())
    await event("done-old", blocked("sheet.write"), 90)

    // Pieniądze: po jednym zdarzeniu na każde zakończenie.
    await event("done-1", { type: "cost", usd: 1.5, basis: "provider" })
    await event("failed-1", { type: "cost", usd: 0.75, basis: "provider" })
    await event("stopped-1", { type: "cost", usd: 0.25, basis: "provider" })
    await event("working-1", { type: "cost", usd: 0.4, basis: "provider" })
    await event("done-old", { type: "cost", usd: 99, basis: "provider" }, 90)
  }, 40_000)

  afterAll(async () => {
    process.env.DATABASE_URL = ADMIN_URL
    await db?.pool.end()
    await admin.query(`drop database if exists ${PROBE_DB}`)
    await admin.end()
  })

  it("liczy sprawy po zakończeniu i nie sięga poza okno", async () => {
    const tally = Object.fromEntries(
      (await outcomes.caseTally()).map((row) => [row.status, row.cases]),
    )
    expect(tally).toEqual({ done: 3, failed: 1, stopped: 3, working: 1 })
    // Kontrola dodatnia dla samego okna: przy oknie stuletnim stara sprawa wchodzi.
    const wide = Object.fromEntries(
      (await outcomes.caseTally(365)).map((row) => [row.status, row.cases]),
    )
    expect(wide.done).toBe(4)
  })

  it("plakietka liczy WYŁĄCZNIE awarie, nie przerwania", async () => {
    // Przerwanie na życzenie człowieka nie jest porażką narzędzia. Plakietka, która
    // by je liczyła, alarmowałaby za każdym razem, gdy ktoś rozmyślił się w połowie.
    expect(await outcomes.failedCaseCount()).toBe(1)
  })

  it("grupuje powody przerwania i nie miesza do nich zdań z awarii", async () => {
    expect(await outcomes.stopReasons()).toEqual([
      { reason: "stopped-by-you", cases: 2 },
      { reason: "server-restart", cases: 1 },
    ])
    // Zdanie ułożone przez `readableFailure` przy awarii NIE JEST powodem ze skończonej
    // listy — gdyby weszło do tej listy, przełożony dostałby na ekranie polszczyznę
    // utrwaloną w bazie, także patrząc po angielsku.
    const said = (await outcomes.stopReasons()).map((row) => row.reason)
    expect(said.some((one) => one.includes(" "))).toBe(false)
  })

  it("liczy nieudane kroki po powodzie, osobno razy i osobno sprawy", async () => {
    const steps = await outcomes.failedSteps()
    // Trzy wywrotki `no-such-file`, ale w DWÓCH sprawach — czterdzieści awarii w dwóch
    // sprawach to inna choroba niż czterdzieści w czterdziestu.
    expect(steps).toContainEqual({ reason: "no-such-file", times: 3, cases: 2 })
    expect(steps).toContainEqual({ reason: "computation-error", times: 1, cases: 1 })
    // Krok udany nie jest porażką — kontrola ujemna dla warunku `ok = false`.
    expect(steps.reduce((sum, row) => sum + row.times, 0)).toBe(6)
    // Najczęstszy powód stoi pierwszy: ekran ma zaczynać od tego, co boli najbardziej.
    expect(steps[0]?.reason).toBe("no-such-file")
  })

  it("powód spoza skończonej listy zwija się w „nie wiadomo”, razem z brakiem powodu", async () => {
    const steps = await outcomes.failedSteps()
    // Dwa kroki: jeden bez powodu, jeden z wartością, której lista nie zna. To jest ta
    // sama niewiedza, więc jeden wiersz — i JEDNA sprawa, a nie dwie. Zwinięcie po
    // stronie JavaScriptu policzyłoby tę sprawę dwa razy.
    expect(steps).toContainEqual({ reason: "unknown", times: 2, cases: 1 })
  })

  it("zestawia kłódki po zdolnościach, z liczbą ludzi i bez ich imion", async () => {
    const missing = await outcomes.missingCapabilities()
    // Trzy kłódki na arkuszach, u dwóch RÓŻNYCH osób — to jest wiersz, po którym
    // przełożony wie, komu warto tę zdolność włączyć.
    expect(missing[0]).toEqual({ capabilityId: "sheet.write", times: 3, people: 2 })
    expect(missing).toContainEqual({ capabilityId: "counterparty.verify", times: 1, people: 1 })
    // Czynność, której katalog nie zna, ma własny wiersz — to sygnał o dziurze
    // w katalogu, a nie o czyimś braku uprawnień.
    expect(missing).toContainEqual({ capabilityId: null, times: 1, people: 1 })
  })

  it("zestawienie nie niesie ANI JEDNEGO znaku treści cudzej sprawy", async () => {
    // Reguła produktu, nie estetyka: przełożony nie ma wglądu w treść cudzych spraw
    // z urzędu. Opis kłódki układa model z tego, co miał zrobić, więc jest treścią —
    // sprawdzamy CAŁĄ odpowiedź, a nie pole po polu, bo dopisanie pola jest tanie.
    const all = JSON.stringify(await outcomes.outcomes())
    expect(all).not.toContain("Kowalski")
    expect(all).not.toContain("sprawa")
    expect(all).not.toContain("anna")
  })

  it("dzieli pieniądze na te z wynikiem i te bez, po zdarzeniach kosztu", async () => {
    const { cost, resultShare } = await outcomes.outcomes()
    expect(cost.withResult).toBeCloseTo(1.5, 6)
    // 0,75 z awarii + 0,25 z przerwania — pieniądze, które nic nie przyniosły.
    expect(cost.withoutResult).toBeCloseTo(1, 6)
    expect(cost.unfinished).toBeCloseTo(0.4, 6)
    // Stara sprawa wniosłaby 99 USD, gdyby okno liczyło się po `case_file`, a nie
    // po znaczniku czasu zdarzenia kosztu — to jest pomyłka naprawiona w `spentToday`.
    expect(cost.withResult).toBeLessThan(90)
    // 3 z 7 zakończonych spraw skończyły się wynikiem.
    expect(resultShare).toBe(43)
  })

  // OSTATNI W PLIKU I TO NIE JEST PORZĄDEK ALFABETYCZNY: ten scenariusz DOSYPUJE zdarzeń
  // do bazy próbnej, więc postawiony wyżej przesuwałby liczby, na których stoją tamte.
  it("czynność spoza katalogu stoi NA KOŃCU, choćby była najliczniejsza", async () => {
    // Blok obiecuje, że każdy wiersz to zdolność, którą da się komuś włączyć. Tej
    // akurat włączyć się nie da, bo jej nie ma — więc nie ma prawa stać nad tymi,
    // na które przełożony naprawdę może dziś coś zrobić. Zmierzone na żywych danych:
    // stała pierwsza, z 39 trafieniami, nad dwiema zdolnościami do włączenia.
    for (let i = 0; i < 20; i++) await event("done-2", blocked())
    const missing = await outcomes.missingCapabilities()
    expect(missing.at(-1)?.capabilityId).toBeNull()
    expect(missing.at(-1)?.times).toBeGreaterThan(missing[0]!.times)
  })
})
