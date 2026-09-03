// PROCEDURY NA PRAWDZIWYM POSTGRESIE — bo cały ciężar tej warstwy leży w bazie.
//
// Trzy rzeczy trzeba sprawdzić razem i żadnej z nich nie widać na ekranie:
//
//   · WYDANIA NARASTAJĄ, a stare zostają — sprawa sprzed miesiąca powołuje się na wydanie,
//     które wtedy obowiązywało, więc nadpisanie treści zabierałoby dowód wstecz;
//   · ZASIEW DOTYKA BAZY RAZ — wdrożenie, w którym przełożony wydał własny tekst, nie może
//     go stracić przy restarcie kontenera (to jest błąd, którym LibreChat płaci do dziś);
//   · WYCOFANIE NIE KASUJE — procedura znika z tury, ale zostaje w bazie.
//
// Domyślnie POMIJANY — bez DATABASE_URL `pnpm test` zostaje zielony.

import { Pool } from "pg"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { parseSkill } from "./frontmatter"

const ADMIN_URL = process.env.DATABASE_URL
const PROBE_DB = "desk_procedures_probe"

const skill = (over: Partial<Record<string, string>> = {}) =>
  parseSkill(`---
name: ${over["name"] ?? "proba-wydania"}
title: ${over["title"] ?? "Próba wydania"}
description: ${over["description"] ?? "Jak składamy zestawienie."}
${over["extra"] ?? ""}---

${over["body"] ?? "Sumujemy po stawkach."}`)

describe.skipIf(!ADMIN_URL)("procedury w bazie", () => {
  let admin: Pool
  let db: typeof import("../db")
  let store: typeof import("./store")

  const probeUrl = () => new URL(ADMIN_URL!).href.replace(/\/[^/?]*(\?|$)/, `/${PROBE_DB}$1`)

  beforeAll(async () => {
    admin = new Pool({ connectionString: ADMIN_URL })
    await admin.query(`drop database if exists ${PROBE_DB}`)
    await admin.query(`create database ${PROBE_DB}`)
    process.env.DATABASE_URL = probeUrl()
    global.__deskPool = undefined
    global.__deskMigration = undefined
    db = await import("../db")
    store = await import("./store")
    await db.migrate()
  }, 30_000)

  afterAll(async () => {
    process.env.DATABASE_URL = ADMIN_URL
    await db?.pool.end()
    global.__deskPool = undefined
    global.__deskMigration = undefined
    await admin.query(`drop database if exists ${PROBE_DB} with (force)`)
    await admin.end()
  }, 30_000)

  it("zasiew wchodzi do PUSTEJ tabeli i daje trzy tryby", async () => {
    const all = await store.allProcedures()
    expect(all.length).toBeGreaterThanOrEqual(3)
    // Wszystkie trzy tryby muszą być reprezentowane — inaczej dwa z nich nie mają
    // ani jednego użycia w całym produkcie i pierwsze będzie dopiero u klienta.
    expect(new Set(all.map((p) => p.loading))).toEqual(new Set(["always", "index", "paths"]))
    expect(all.every((p) => p.origin === "seed")).toBe(true)
    expect(all.every((p) => p.current.author === "seed")).toBe(true)
  })

  it("ZASIEW NIE WRACA po tym, jak człowiek coś wydał", async () => {
    // Sedno tej warstwy — to jest ten błąd, którym LibreChat płaci do dziś: operator
    // zmienia coś w panelu, restartuje kontener, zmiana znika.
    await store.publish("robert", skill({ name: "wlasna", title: "Własna" }))
    // Kasujemy jedno wydanie z zasiewu, żeby powrót zasiewu BYŁO WIDAĆ. Bez tego
    // test przechodziłby także wtedy, gdyby zasiew wstawiał to samo `on conflict do nothing`.
    await db.pool.query(`delete from desk.procedure where name='zestawienie-vat'`)
    const before = (await store.allProcedures()).map((p) => p.name).sort()

    // Zasiew liczy się RAZ NA PROCES, więc powtórne wywołanie tej samej funkcji nie
    // dotknęłoby bazy i nie sprawdziłoby niczego. Świeża instancja modułu ma czystą
    // pamięć, a pulę bierze z `globalThis` — czyli przechodzi przez PRAWDZIWĄ bramkę.
    vi.resetModules()
    const fresh = await import("./store")
    await fresh.seedProcedures()

    expect((await store.allProcedures()).map((p) => p.name).sort()).toEqual(before)
  })

  it("drugie wydanie NARASTA, a pierwsze zostaje", async () => {
    await store.publish("robert", skill({ body: "Wersja pierwsza." }))
    const e2 = await store.publish("anna", skill({ body: "Wersja druga." }))
    expect(e2).toBe(2)

    const now = await store.procedureByName("proba-wydania")
    expect(now?.current.edition).toBe(2)
    expect(now?.current.body).toBe("Wersja druga.")
    expect(now?.current.author).toBe("anna")

    const history = await store.editionsOf("proba-wydania")
    expect(history.map((e) => e.edition)).toEqual([2, 1])
    expect(history[1]?.body).toBe("Wersja pierwsza.")
    expect(history[1]?.author).toBe("robert")
  })

  it("odcisk zmienia się, gdy zmienia się TYTUŁ przy tej samej treści", async () => {
    // Zmiana tytułu jest zmianą dla czytającego, więc musi być zmianą dla odcisku —
    // to ta sama reguła, przez którą opis narzędzia MCP wchodzi do jego odcisku.
    const a = store.fingerprintOf({
      title: "A",
      description: "d",
      loading: "index",
      paths: [],
      scope: [],
      body: "t",
    })
    const b = store.fingerprintOf({
      title: "B",
      description: "d",
      loading: "index",
      paths: [],
      scope: [],
      body: "t",
    })
    expect(a).not.toBe(b)
  })

  it("odcisk NIE zmienia się od kolejności działów w zasięgu", async () => {
    // Kontrola ujemna: bez sortowania przestawienie dwóch nazw w formularzu wyglądałoby
    // jak nowa treść i kazało wydawać procedurę jeszcze raz.
    const a = store.fingerprintOf({
      title: "A",
      description: "d",
      loading: "index",
      paths: [],
      scope: ["finance", "accounting"],
      body: "t",
    })
    const b = store.fingerprintOf({
      title: "A",
      description: "d",
      loading: "index",
      paths: [],
      scope: ["accounting", "finance"],
      body: "t",
    })
    expect(a).toBe(b)
  })

  it("wycofanie zabiera z tury, ale NIE z bazy", async () => {
    await store.withdraw("robert", "proba-wydania")
    expect((await store.activeProcedures()).map((p) => p.name)).not.toContain("proba-wydania")
    // Wiersz zostaje z całą historią — sprawy sprzed wycofania powołują się na nią.
    const p = await store.procedureByName("proba-wydania")
    expect(p?.status).toBe("withdrawn")
    expect((await store.editionsOf("proba-wydania")).length).toBe(2)

    await store.restore("robert", "proba-wydania")
    expect((await store.activeProcedures()).map((p) => p.name)).toContain("proba-wydania")
  })

  it("dziennik notuje wydanie i wycofanie, ale NIE treść", async () => {
    // Ta sama reguła, co przy pamięci: przełożony widzi, ŻE coś się zmieniło, a treść
    // czyta na ekranie procedury. Dziennik z treścią byłby drugą kopią dokumentów firmy.
    const r = await db.pool.query(
      `select type, details from desk.audit_log where type like 'procedure.%' order by id`,
    )
    const types = r.rows.map((x) => x.type)
    expect(types).toContain("procedure.published")
    expect(types).toContain("procedure.withdrawn")
    for (const row of r.rows) {
      expect(JSON.stringify(row.details)).not.toContain("Wersja druga")
      expect(JSON.stringify(row.details)).not.toContain("Sumujemy")
    }
  })

  it("zapisuje zasięg i wzorce tak, jak je podano", async () => {
    await store.publish(
      "robert",
      skill({
        name: "faktury",
        title: "Faktury",
        extra: 'loading: paths\npaths: ["Moje pliki/Faktury"]\nscope: [accounting]\n',
      }),
    )
    const p = await store.procedureByName("faktury")
    expect(p?.loading).toBe("paths")
    expect(p?.paths).toEqual(["Moje pliki/Faktury"])
    expect(p?.scope).toEqual(["accounting"])
  })
})
