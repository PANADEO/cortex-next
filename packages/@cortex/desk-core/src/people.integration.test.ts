// Pierwsze wejście nowej osoby — na PRAWDZIWYM Postgresie.
//
// DLACZEGO POWSTAŁ. `identity.ts` szukał adresu w pliku i rzucał wyjątkiem, gdy go tam
// nie było — czyli u klienta na Biurko weszłyby dokładnie dwie osoby. Zmiana tego jest
// tania w kodzie i droga w skutkach: pierwsze wejście ZAKŁADA KONTO, więc od teraz każdy,
// kogo wpuści brama logowania, dostaje biurko. Dwie rzeczy muszą być tu pewne i żadnej
// nie widać na ekranie: że nowa osoba dostaje najmniejszą rolę, i że drugie wejście
// NIE zakłada drugiego konta ani nie cofa awansu, który ktoś dostał w międzyczasie.
//
// Domyślnie POMIJANY — bez DATABASE_URL `pnpm test` zostaje zielony.

import { Pool } from "pg"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

const ADMIN_URL = process.env.DATABASE_URL
const PROBE_DB = "desk_people_probe"

describe.skipIf(!ADMIN_URL)("pierwsze wejście z bramy logowania", () => {
  let admin: Pool
  let db: typeof import("./db")
  let people: typeof import("./people")

  const probeUrl = () => new URL(ADMIN_URL!).href.replace(/\/[^/?]*(\?|$)/, `/${PROBE_DB}$1`)

  beforeAll(async () => {
    admin = new Pool({ connectionString: ADMIN_URL })
    await admin.query(`drop database if exists ${PROBE_DB}`)
    await admin.query(`create database ${PROBE_DB}`)
    process.env.DATABASE_URL = probeUrl()
    process.env.DESK_DOMAIN = "itsg.pl"
    global.__deskPool = undefined
    global.__deskMigration = undefined
    db = await import("./db")
    people = await import("./people")
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

  it("persony pokazu są w tabeli, a nie tylko w pliku", async () => {
    const all = await people.everyone()
    expect(all.map((u) => u.id).sort()).toEqual(["anna", "robert"])
    expect((await people.person("anna"))?.role).toBe("member")
  })

  it("adres persony składa się z domeny wdrożenia", async () => {
    const u = await people.ensurePerson("anna@itsg.pl")
    expect(u.id).toBe("anna")
    expect((await people.everyone()).length).toBe(2)
  })

  it("nieznany adres zakłada konto z najmniejszą rolą i bez działu", async () => {
    const u = await people.ensurePerson("jan.kowalczyk@klient.pl")
    expect(u.role).toBe("member")
    expect(u.department).toBe("")
    expect([u.firstName, u.lastName]).toEqual(["Jan", "Kowalczyk"])
    // rola `member` daje pięć zdolności, z których żadna nie wychodzi poza biurko tej osoby
    expect(u.quickTasks.length).toBeGreaterThan(0)
  })

  it("drugie wejście nie zakłada drugiego konta ani nie cofa awansu", async () => {
    await people.setRole("jan.kowalczyk@klient.pl", "management", "robert")
    const again = await people.ensurePerson("jan.kowalczyk@klient.pl")
    expect(again.role).toBe("management")
    expect((await people.everyone()).length).toBe(3)
  })

  it("założenie konta zostawia ślad w dzienniku", async () => {
    const r = await db.pool.query<{ who: string; details: { email: string } }>(
      `select who, details from desk.audit_log where type='person.created'`,
    )
    expect(r.rows.map((w) => w.details.email)).toContain("jan.kowalczyk@klient.pl")
  })

  it("dział pochodzi z zamkniętej listy — dowolny napis jest odrzucany", async () => {
    // Dział jest właścicielem zgody i musi dać się zestawić z katalogiem zdolności.
    // Wpisany ręcznie napis byłby też nazwą, której nie przetłumaczy żaden słownik.
    await expect(
      people.setDepartment("jan.kowalczyk@klient.pl", "Dział Wymyślony", "robert"),
    ).rejects.toThrow()
    await people.setDepartment("jan.kowalczyk@klient.pl", "finance", "robert")
    expect((await people.person("jan.kowalczyk@klient.pl"))?.department).toBe("finance")
  })
})
