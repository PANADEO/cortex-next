// Pochodzenie pliku czytane ze zdarzeń — na PRAWDZIWYM Postgresie.
//
// DLACZEGO NA PRAWDZIWYM. Cała rzecz to jedno zapytanie: złączenie zdarzenia ze sprawą,
// `distinct on` po ścieżce i filtr po trzech polach w `jsonb`. Zaślepka bazy sprawdziłaby
// wyłącznie, czy napisałem ten napis tak, jak go napisałem. Pytania, na które ten test ma
// odpowiedzieć — czy `payload->>'ok'` porównuje się z `'true'`, czy `distinct on` bierze
// OSTATNIE odłożenie, czy cudza sprawa nie przecieka — są pytaniami do Postgresa.
//
// SEDNO: zasiew jest pisany jak ZDARZENIE, a nie jak wiersz wygodny dla zapytania.
// Kształt `tool_end` przepisany jest z `runtime.ts` — gdyby narzędzie zaczęło zapisywać
// ścieżkę pod innym polem, ten test musi zgasnąć, a nie milczeć.
//
// Domyślnie POMIJANY — bez DATABASE_URL `pnpm test` zostaje zielony.
//   DATABASE_URL=postgres://cortex:cortex@localhost:5432/cortex pnpm vitest run \
//     packages/@cortex/desk-core/src/file-origin.integration.test.ts

import { Pool } from "pg"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

const ADMIN_URL = process.env.DATABASE_URL
const PROBE_DB = "desk_origin_probe"

describe.skipIf(!ADMIN_URL)("skąd przyszedł plik w Moich plikach", () => {
  let admin: Pool
  let db: typeof import("./db")
  let origins: typeof import("./file-origin").originsInMyFiles

  const probeUrl = () => new URL(ADMIN_URL!).href.replace(/\/[^/?]*(\?|$)/, `/${PROBE_DB}$1`)

  /** Zdarzenie w takim kształcie, w jakim zapisuje je `save_to_my_files` w `runtime.ts`. */
  const stored = (caseId: string, path: string, ok = true) =>
    db.pool.query(`insert into desk.event (case_id, payload) values ($1,$2)`, [
      caseId,
      JSON.stringify({
        type: "tool_end",
        id: `${caseId}-${path}`,
        name: "save_to_my_files",
        ok,
        summary: ok ? path : "nie udało się odłożyć",
        ms: 5,
      }),
    ])

  beforeAll(async () => {
    admin = new Pool({ connectionString: ADMIN_URL })
    await admin.query(`drop database if exists ${PROBE_DB}`)
    await admin.query(`create database ${PROBE_DB}`)
    process.env.DATABASE_URL = probeUrl()
    global.__deskPool = undefined
    global.__deskMigration = undefined
    db = await import("./db")
    origins = (await import("./file-origin")).originsInMyFiles
    await db.migrate()

    await db.pool.query(
      `insert into desk.case_file (id, owner, title) values
         ('s1','anna','Faktury sierpień'),
         ('s2','anna','Poprawka do faktur'),
         ('s3','anna','Sprawa, w której się nie udało'),
         ('s4','robert','Cudza sprawa')`,
    )
    await stored("s1", "Moje pliki/zestawienie.md")
    await stored("s1", "Moje pliki/rozliczenia/podsumowanie.md")
    // to samo miejsce, później i z innej sprawy — prawdziwa jest ta druga
    await stored("s2", "Moje pliki/zestawienie.md")
    await stored("s3", "Moje pliki/nieudane.md", false)
    await stored("s4", "Moje pliki/nie-twoje.md")
  }, 30_000)

  afterAll(async () => {
    process.env.DATABASE_URL = ADMIN_URL
    await db?.pool.end()
    global.__deskPool = undefined
    global.__deskMigration = undefined
    await admin.query(`drop database if exists ${PROBE_DB} with (force)`)
    await admin.end()
  }, 30_000)

  it("plik odłożony przez asystenta zna sprawę, z której przyszedł", async () => {
    const k = await origins("anna")
    expect(k["Moje pliki/rozliczenia/podsumowanie.md"]).toMatchObject({
      caseId: "s1",
      title: "Faktury sierpień",
    })
  })

  it("kluczem jest CAŁA ścieżka, więc podfolder nie miesza się z korzeniem", async () => {
    const k = await origins("anna")
    // ta sama nazwa pliku w dwóch miejscach dałaby jeden wpis, gdyby kluczem była nazwa
    expect(Object.keys(k).filter((p) => p.endsWith("podsumowanie.md"))).toEqual([
      "Moje pliki/rozliczenia/podsumowanie.md",
    ])
  })

  it("odłożenie późniejsze wygrywa z wcześniejszym pod tą samą ścieżką", async () => {
    const k = await origins("anna")
    expect(k["Moje pliki/zestawienie.md"]?.title).toBe("Poprawka do faktur")
  })

  it("nieudane odłożenie nie zostawia pochodzenia — bo plik nie powstał", async () => {
    const k = await origins("anna")
    expect(k["Moje pliki/nieudane.md"]).toBeUndefined()
  })

  it("cudza sprawa nie przecieka do mojej listy", async () => {
    const k = await origins("anna")
    expect(k["Moje pliki/nie-twoje.md"]).toBeUndefined()
    expect((await origins("robert"))["Moje pliki/nie-twoje.md"]?.title).toBe("Cudza sprawa")
  })

  it("indeks częściowy naprawdę stoi na tym zapytaniu", async () => {
    // Bez tego indeksu ekran plików przegląda wszystkie zdarzenia użytkownika, a zdarzeń
    // przybywa z każdą turą rozmowy. Sprawdzamy jego istnienie, nie plan zapytania:
    // przy pięciu wierszach Postgres i tak wybierze przegląd sekwencyjny.
    const r = await db.pool.query<{ indexdef: string }>(
      `select indexdef from pg_indexes where schemaname='desk' and indexname='event_stored_file_idx'`,
    )
    expect(r.rows[0]?.indexdef).toContain("save_to_my_files")
  })
})
