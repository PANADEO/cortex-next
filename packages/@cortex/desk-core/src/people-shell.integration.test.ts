// Zszycie Biurka z katalogiem użytkowników POWŁOKI — na prawdziwym Postgresie.
//
// OSOBNY PLIK, nie kolejny `describe` obok pierwszego, i to nie jest kwestia porządku:
// oba zestawy podmieniają `DATABASE_URL` i zamykają pulę w `afterAll`, a Vitest trzyma
// rejestr modułów per PLIK. W jednym pliku drugi zestaw dostałby pulę zamkniętą przez
// pierwszy i przewróciłby się na „Cannot use a pool after calling end".
//
// Domyślnie POMIJANY — bez DATABASE_URL `pnpm test` zostaje zielony.

import { Pool } from "pg"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

const ADMIN_URL = process.env.DATABASE_URL

/**
 * ZSZYCIE Z KATALOGIEM POWŁOKI. Powłoka trzyma użytkowników w `system_config.users`,
 * w tej samej bazie, i to ona wie, KTO to jest oraz czy w ogóle należy do firmy.
 * Biurko wie, co ta osoba może u siebie. Żadna strona nie nadpisuje drugiej.
 *
 * Sedno: „aktywny" znaczy aktywny PO OBU STRONACH — przecięcie, nigdy suma.
 */
describe.skipIf(!ADMIN_URL)("Biurko obok katalogu powłoki", () => {
  let admin: Pool
  let db: typeof import("./db")
  let people: typeof import("./people")
  const PROBE = "desk_shell_probe"
  const probeUrl = () => new URL(ADMIN_URL!).href.replace(/\/[^/?]*(\?|$)/, `/${PROBE}$1`)

  beforeAll(async () => {
    admin = new Pool({ connectionString: ADMIN_URL })
    await admin.query(`drop database if exists ${PROBE}`)
    await admin.query(`create database ${PROBE}`)
    process.env.DATABASE_URL = probeUrl()
    global.__deskPool = undefined
    global.__deskMigration = undefined
    db = await import("./db")
    people = await import("./people")
    await db.migrate()
    // Katalog powłoki — tylko te kolumny, których Biurko naprawdę używa.
    await db.pool.query(`
      create schema if not exists system_config;
      create table system_config.users (
        email text primary key,
        full_name text,
        is_active boolean not null default true
      );
      insert into system_config.users (email, full_name, is_active) values
        ('nowa.osoba@klient.pl', 'Katarzyna Zielińska', true),
        ('bylalna@klient.pl', 'Była Pracownica', false);
    `)
  }, 30_000)

  afterAll(async () => {
    process.env.DATABASE_URL = ADMIN_URL
    await db?.pool.end()
    global.__deskPool = undefined
    global.__deskMigration = undefined
    await admin.query(`drop database if exists ${PROBE} with (force)`)
    await admin.end()
  }, 30_000)

  it("imię i nazwisko bierze z katalogu powłoki, nie zgaduje z adresu", async () => {
    const u = await people.ensurePerson("nowa.osoba@klient.pl")
    expect([u.firstName, u.lastName]).toEqual(["Katarzyna", "Zielińska"])
  })

  it("wyłączenie W POWŁOCE wyłącza konto w Biurku", async () => {
    const u = await people.ensurePerson("bylalna@klient.pl")
    expect(u.active).toBe(false)
  })

  it("wyłączenie W BIURKU działa też wtedy, gdy powłoka o tej osobie nie wie", async () => {
    const u = await people.ensurePerson("ktos.spoza@klient.pl")
    expect(u.active).toBe(true)
    await people.setActive(u.id, false, "robert")
    expect((await people.person(u.id))?.active).toBe(false)
  })

  it("osoba spoza katalogu powłoki dostaje imię zgadnięte z adresu", async () => {
    const u = await people.ensurePerson("jan.nowak@klient.pl")
    expect([u.firstName, u.lastName]).toEqual(["Jan", "Nowak"])
  })
})
