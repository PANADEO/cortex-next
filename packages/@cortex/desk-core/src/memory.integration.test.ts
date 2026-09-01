// Pamięć asystenta — na PRAWDZIWYM Postgresie.
//
// DLACZEGO POWSTAŁ. Pamięć jest pierwszą rzeczą w tym narzędziu, która mogłaby złamać
// jego tezę: to wiedza o człowieku, wpływająca na KAŻDĄ kolejną sprawę. Trzy warunki
// muszą być spełnione razem i żadnego z nich nie widać na ekranie:
//
//   * propozycja NIE działa, dopóki człowiek jej nie przyjmie,
//   * limit jest egzekwowany, bo całość idzie do promptu każdej tury,
//   * dziennik NIE zawiera treści — przełożony widzi, że coś się zmieniło, nie co.
//
// Trzeci jest najważniejszy i jednocześnie najłatwiejszy do zepsucia jedną linijką,
// której nikt nie zauważy, bo dziennik czyta się rzadko.
//
// Domyślnie POMIJANY — bez DATABASE_URL `pnpm test` zostaje zielony.

import { Pool } from "pg"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

const ADMIN_URL = process.env.DATABASE_URL
const PROBE_DB = "desk_memory_probe"

describe.skipIf(!ADMIN_URL)("pamięć asystenta", () => {
  let admin: Pool
  let db: typeof import("./db")
  let memory: typeof import("./memory")

  const probeUrl = () => new URL(ADMIN_URL!).href.replace(/\/[^/?]*(\?|$)/, `/${PROBE_DB}$1`)

  beforeAll(async () => {
    admin = new Pool({ connectionString: ADMIN_URL })
    await admin.query(`drop database if exists ${PROBE_DB}`)
    await admin.query(`create database ${PROBE_DB}`)
    process.env.DATABASE_URL = probeUrl()
    global.__deskPool = undefined
    global.__deskMigration = undefined
    db = await import("./db")
    memory = await import("./memory")
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

  it("propozycja asystenta NIE trafia do promptu, dopóki człowiek jej nie przyjmie", async () => {
    const p = await memory.propose("anna", "Faktury przychodzą jako CSV.", "sprawa-1")
    expect(p.status).toBe("proposed")
    expect(await memory.kept("anna")).toEqual([])
    expect(memory.recallBlock(await memory.kept("anna"))).toBe("")

    await memory.accept("anna", p.id)
    const remembered = await memory.kept("anna")
    expect(remembered.map((m) => m.text)).toEqual(["Faktury przychodzą jako CSV."])
  })

  it("blok promptu niesie zdania DOSŁOWNIE, a nie streszczone", async () => {
    // Człowiek widzi na ekranie dokładnie te zdania. Każda różnica byłaby cichym
    // kłamstwem tego ekranu — a ekran jest jedynym powodem, dla którego ta pamięć
    // w ogóle może istnieć.
    const block = memory.recallBlock(await memory.kept("anna"))
    expect(block).toContain("Faktury przychodzą jako CSV.")
  })

  it("odrzucona propozycja znika, a nie czeka w ukryciu", async () => {
    const p = await memory.propose("anna", "Coś, czego nie chcę.", "sprawa-2")
    await memory.forget("anna", p.id)
    expect((await memory.all("anna")).map((m) => m.text)).not.toContain("Coś, czego nie chcę.")
  })

  it("cudzego wspomnienia nie da się ani zobaczyć, ani skasować", async () => {
    const mine = await memory.add("robert", "To jest Roberta.")
    await memory.forget("anna", mine.id)
    expect((await memory.all("robert")).map((m) => m.text)).toContain("To jest Roberta.")
    expect((await memory.all("anna")).map((m) => m.text)).not.toContain("To jest Roberta.")
  })

  it("limit jest egzekwowany, a nie urywany po cichu", async () => {
    // Urwanie po cichu znaczyłoby, że asystent przestał pamiętać coś, co człowiek
    // dalej widzi na liście — czyli ekran przestałby mówić prawdę.
    while ((await memory.kept("anna")).length < memory.MEMORY_LIMIT) {
      await memory.add("anna", `wypełniacz ${(await memory.kept("anna")).length}`)
    }
    await expect(memory.add("anna", "jedno za dużo")).rejects.toThrow(memory.MemoryFull)
    expect((await memory.kept("anna")).length).toBe(memory.MEMORY_LIMIT)
  })

  it("dziennik wie, ŻE się zmieniło, i nie wie, CO", async () => {
    const r = await db.pool.query<{ type: string; details: Record<string, unknown> }>(
      `select type, details from desk.audit_log where type like 'memory.%'`,
    )
    expect(r.rows.length).toBeGreaterThan(0)
    // Ani jedno pole żadnego wpisu nie może zawierać treści wspomnienia.
    const values = r.rows.flatMap((w) => Object.values(w.details ?? {})).map(String)
    expect(values.filter((v) => v.includes("Faktury"))).toEqual([])
    expect(values.filter((v) => v.includes("wypełniacz"))).toEqual([])
    // ...a same typy zdarzeń są zapisane, więc audytor widzi, że coś się działo
    expect([...new Set(r.rows.map((w) => w.type))].sort()).toEqual([
      "memory.accepted",
      "memory.added",
      "memory.forgotten",
    ])
  })
})
