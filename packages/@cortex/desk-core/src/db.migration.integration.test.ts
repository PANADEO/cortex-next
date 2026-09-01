// Migracja na PRAWDZIWYM Postgresie: baza sprzed przemianowania wchodzi, baza po
// przemianowaniu wychodzi — i ani jedno stare słowo nie zostaje w środku.
//
// DLACZEGO POWSTAŁ. Przemianowanie schematu przeszło zbiorczą podmianą tekstu, po której
// literał `'biala-lista'` w pięciu zapytaniach SQL zamienił się w `'biala-list'`. Migracja
// nie trafiała wtedy w ani jeden wiersz — i nie miała jak o tym powiedzieć, bo `update`,
// który zaktualizował zero wierszy, jest poprawnym `update`em. Zasiew zakładał `vat-registry`
// OBOK nietkniętej `biala-listy`, klient MCP szedł do starego serwera po `sprawdz_nip`,
// a pracownik dostawał komunikat o dryfie zamiast wyniku. Ta sama cisza ukryła wcześniej
// brakujące `default` kolumn i klucze `surowy` oraz `gdyKolizja`.
//
// SEDNO TESTU. Zasiew NIE jest pisany z migracji, tylko ze STANU SPRZED niej: DDL jest
// przepisany dosłownie z wydania sprzed przemianowania, a wiersze budowane są z listy
// starych nazw. Dzięki temu test pyta „czy coś ze starego słownika przeżyło", a nie „czy
// migracja robi to, co napisano w migracji" — bo na to drugie odpowiedź jest zawsze tak.
//
// Domyślnie POMIJANY — bez DATABASE_URL `pnpm test` zostaje zielony.
//   DATABASE_URL=postgres://cortex:cortex@localhost:5432/cortex pnpm vitest run \
//     packages/@cortex/desk-core/src/db.migration.integration.test.ts

import { Pool } from "pg"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

const ADMIN_URL = process.env.DATABASE_URL
const PROBE_DB = "desk_migration_probe"

/** Schemat sprzed przemianowania — przepisany z `db.ts` w wydaniu 0be71aa~1, bez zmian. */
const OLD_SCHEMA = `
  create schema if not exists desk;

  create table desk.sprawa (
    id text primary key,
    wlasciciel text not null,
    tytul text not null,
    stan text not null default 'nowa',
    powod text,
    koszt_usd numeric not null default 0,
    utworzona timestamptz not null default now(),
    zmieniona timestamptz not null default now()
  );
  create index sprawa_wlasciciel_idx on desk.sprawa (wlasciciel, zmieniona desc);

  create table desk.zdarzenie (
    seq bigserial primary key,
    sprawa_id text not null references desk.sprawa(id) on delete cascade,
    at timestamptz not null default now(),
    payload jsonb not null
  );
  create index zdarzenie_sprawa_idx on desk.zdarzenie (sprawa_id, seq);

  create table desk.dziennik (
    id bigserial primary key,
    at timestamptz not null default now(),
    kto text not null,
    typ text not null,
    szczegoly jsonb not null default '{}'::jsonb
  );
  create index dziennik_at_idx on desk.dziennik (at desc);

  create table desk.prosba (
    id bigserial primary key,
    at timestamptz not null default now(),
    kto text not null,
    zdolnosc text not null,
    stan text not null default 'oczekuje',
    rozpatrzona timestamptz,
    rozpatrzyl text,
    uzasadnienie text
  );

  create table desk.serwer_mcp (
    nazwa text primary key,
    etykieta text not null,
    url text not null,
    dodal text not null,
    at timestamptz not null default now()
  );

  create table desk.narzedzie_mcp (
    serwer text not null references desk.serwer_mcp(nazwa) on delete cascade,
    nazwa_zdalna text not null,
    opis text not null,
    krotko text not null,
    zdolnosc text not null,
    odcisk text not null,
    stan text not null default 'zatwierdzone',
    powod text,
    zatwierdzil text not null,
    at timestamptz not null default now(),
    primary key (serwer, nazwa_zdalna)
  );

  create table desk.grant (
    kto text not null,
    zdolnosc text not null,
    nadal text not null,
    at timestamptz not null default now(),
    primary key (kto, zdolnosc)
  );
`

/**
 * Stare słownictwo. Po migracji ŻADEN z tych napisów nie ma prawa stać ani w kolumnie
 * tekstowej, ani jako klucz w `jsonb`. Lista jest zarazem materiałem na zasiew: każdy
 * wpis gdzieś trafia, więc test nie może przejść dlatego, że czegoś nie posiał.
 *
 * Nie ma tu `start`, `lifecycle` ani `assistant` — te trzy były po angielsku od początku.
 */
const OLD = {
  caseStatus: ["nowa", "pracuje", "gotowe", "przerwane", "blad"],
  requestStatus: ["oczekuje", "przyznana", "odrzucona"],
  toolStatus: ["zatwierdzone", "wstrzymane"],
  capability: [
    "pliki.lista",
    "pliki.czytaj",
    "dokument.zapisz",
    "dokument.sprawdz",
    "pliki.zapisz",
    "arkusz.zapisz",
    "kod.uruchom",
    "obraz.generuj",
    "kontrahent.sprawdz",
    "inne",
  ],
  auditType: [
    "sprawa.utworzona",
    "tura.start",
    "tura.koniec",
    "tura.stop",
    "tura.blad",
    "prosba.o.dostep",
    "prosba.przyznana",
    "prosba.odrzucona",
    "prosba.inne",
    "zdolnosc.cofnieta",
    "zdolnosc.brak",
    "dostep.odrzucony",
    "pliki.wgranie",
    "pliki.kosz",
    "pliki.przywroc",
    "pliki.przenies",
    "pliki.kopiuj",
    "pliki.katalog",
    "mcp.serwer.dodany",
    "mcp.serwer.przejrzany",
    "mcp.narzedzie.zatwierdzone",
    "mcp.narzedzie.wycofane",
    "mcp.narzedzie.wstrzymane",
    "koszt.wyzerowany",
  ],
  auditKey: [
    "sprawaId",
    "odcisk",
    "zdolnosc",
    "zdolnosci",
    "kosztUsd",
    "skadKoszt",
    "powod",
    "komu",
    "opis",
    "nazwa",
    "serwer",
    "narzedzie",
    "narzedzi",
    "rozmiar",
    "gdzie",
    "co",
    "spraw",
    "sciezka",
    "akcja",
    "z",
    "do",
    "kiedy",
    "surowy",
    "gdyKolizja",
  ],
  auditAction: ["katalog", "kosz", "przywroc", "przenies", "kopiuj"],
  costBasis: ["dostawca", "oszacowanie"],
  onCollision: ["blad", "obie"],
  eventKey: [
    "typ",
    "tekst",
    "nazwy",
    "etykieta",
    "argumenty",
    "podsumowanie",
    "zrodlo",
    "opis",
    "zdolnoscId",
    "dzial",
    "skad",
    "powod",
    "nazwa",
    "stan",
    "zalaczniki",
  ],
  eventType: ["mysl", "zalacznik", "narzedzie_start", "narzedzie_koniec", "zablokowane", "koszt"],
  lifecycleStatus: ["koniec", "przerwane", "blad"],
  argKey: ["katalog", "sciezka", "nazwa", "cel", "opis"],
  toolName: [
    "lista_plikow",
    "czytaj_plik",
    "zapisz_dokument",
    "sprawdz_dokument",
    "zapisz_do_moich_plikow",
    "zapisz_arkusz",
    "uruchom_obliczenia",
    "generuj_obraz",
    "zglos_brak",
    "mcp_biala_lista_sprawdz_nip",
    "mcp_biala_lista_sprawdz_rachunek",
  ],
  connector: "biala-lista",
  connectorTool: ["sprawdz_nip", "sprawdz_rachunek"],
}

const FORBIDDEN = new Set(Object.values(OLD).flat())

/** Wszystkie napisy i wszystkie klucze `jsonb` z wiersza — rekurencyjnie, bez wyjątków. */
function atoms(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value)
  else if (Array.isArray(value)) for (const v of value) atoms(v, out)
  else if (value && typeof value === "object")
    for (const [k, v] of Object.entries(value)) {
      out.push(k)
      atoms(v, out)
    }
  return out
}

const skip = !ADMIN_URL

describe.skipIf(skip)("migracja schematu Biurka na angielski", () => {
  let admin: Pool
  let db: typeof import("./db")

  const probeUrl = () => new URL(ADMIN_URL!).href.replace(/\/[^/?]*(\?|$)/, `/${PROBE_DB}$1`)

  /** Napisy ze starego słownika, które przeżyły migrację. Pusto = migracja kompletna. */
  async function survivors(): Promise<string[]> {
    const tables = await db.pool.query<{ table_name: string }>(
      `select table_name from information_schema.tables where table_schema='desk'`,
    )
    const found = new Set<string>()
    for (const t of tables.rows) {
      const rows = await db.pool.query(`select * from desk."${t.table_name}"`)
      for (const row of rows.rows) for (const a of atoms(row)) if (FORBIDDEN.has(a)) found.add(a)
    }
    return [...found].sort()
  }

  async function again() {
    global.__deskMigration = undefined
    await db.migrate()
  }

  beforeAll(async () => {
    admin = new Pool({ connectionString: ADMIN_URL })
    await admin.query(`drop database if exists ${PROBE_DB}`)
    await admin.query(`create database ${PROBE_DB}`)
    // Pula w `db.ts` czyta `DATABASE_URL` przy imporcie i zapamiętuje się na `globalThis`.
    process.env.DATABASE_URL = probeUrl()
    global.__deskPool = undefined
    global.__deskMigration = undefined
    db = await import("./db")
  }, 30_000)

  afterAll(async () => {
    process.env.DATABASE_URL = ADMIN_URL
    await db?.pool.end()
    global.__deskPool = undefined
    global.__deskMigration = undefined
    await admin.query(`drop database if exists ${PROBE_DB} with (force)`)
    await admin.end()
  }, 30_000)

  describe("baza sprzed przemianowania", () => {
    beforeAll(async () => {
      await db.pool.query(`drop schema if exists desk cascade`)
      await db.pool.query(OLD_SCHEMA)

      // Po jednej sprawie na każdy stary stan, plus zdarzenia pokrywające cały wariantowy
      // słownik zdarzeń — bo to `payload` odtwarza przebieg, a przebieg jest dowodem.
      for (const [i, stan] of OLD.caseStatus.entries()) {
        await db.pool.query(
          `insert into desk.sprawa (id, wlasciciel, tytul, stan, powod) values ($1,'anna',$2,$3,null)`,
          [`s${i}`, `Sprawa ${i}`, stan],
        )
      }
      const events: Record<string, unknown>[] = [
        { typ: "lifecycle", stan: "start" },
        ...OLD.lifecycleStatus.map((stan) => ({ typ: "lifecycle", stan, powod: "z restartu" })),
        { typ: "mysl", tekst: "Sprawdź fakturę", zalaczniki: ["Moje pliki/f.pdf"] },
        { typ: "zalacznik", nazwy: ["f.pdf"] },
        { typ: "assistant", tekst: "Gotowe." },
        ...OLD.toolName.map((nazwa) => ({
          typ: "narzedzie_start",
          nazwa,
          etykieta: "Czytam",
          zrodlo: "builtin",
          argumenty: Object.fromEntries(OLD.argKey.map((k) => [k, "x"])),
        })),
        ...OLD.toolName.map((nazwa) => ({
          typ: "narzedzie_koniec",
          nazwa,
          ok: true,
          podsumowanie: "ok",
          ms: 12,
        })),
        ...OLD.capability.map((zdolnoscId) => ({
          typ: "zablokowane",
          opis: "brak zgody",
          zdolnoscId,
          nazwa: "Wgląd",
          dzial: "Księgowość",
        })),
        ...OLD.costBasis.map((skad) => ({ typ: "koszt", usd: 0.01, skad })),
      ]
      for (const payload of events) {
        await db.pool.query(`insert into desk.zdarzenie (sprawa_id, payload) values ('s0',$1)`, [
          JSON.stringify(payload),
        ])
      }

      // Dziennik: każdy stary typ wpisu i każdy stary klucz szczegółów.
      for (const typ of OLD.auditType) {
        await db.pool.query(
          `insert into desk.dziennik (kto, typ, szczegoly) values ('anna',$1,$2)`,
          [typ, JSON.stringify(Object.fromEntries(OLD.auditKey.map((k) => [k, "x"])))],
        )
      }
      for (const akcja of OLD.auditAction) {
        await db.pool.query(
          `insert into desk.dziennik (kto, typ, szczegoly) values ('anna','pliki.kopiuj',$1)`,
          [JSON.stringify({ akcja, sciezka: "Moje pliki/a", gdyKolizja: "obie" })],
        )
      }
      for (const skadKoszt of OLD.costBasis) {
        await db.pool.query(
          `insert into desk.dziennik (kto, typ, szczegoly) values ('anna','tura.koniec',$1)`,
          [JSON.stringify({ kosztUsd: 0.02, skadKoszt })],
        )
      }
      for (const gdyKolizja of OLD.onCollision) {
        await db.pool.query(
          `insert into desk.dziennik (kto, typ, szczegoly) values ('anna','pliki.przenies',$1)`,
          [JSON.stringify({ akcja: "przenies", gdyKolizja })],
        )
      }
      await db.pool.query(
        `insert into desk.dziennik (kto, typ, szczegoly) values ('anna','mcp.narzedzie.zatwierdzone',$1)`,
        [JSON.stringify({ serwer: OLD.connector, narzedzie: OLD.connectorTool[0] })],
      )
      await db.pool.query(
        `insert into desk.dziennik (kto, typ, szczegoly) values ('robert','mcp.serwer.dodany',$1)`,
        [JSON.stringify({ nazwa: OLD.connector, url: "http://localhost:8310/mcp" })],
      )

      for (const [i, stan] of OLD.requestStatus.entries()) {
        await db.pool.query(`insert into desk.prosba (kto, zdolnosc, stan) values ('anna',$1,$2)`, [
          OLD.capability[i]!,
          stan,
        ])
      }
      for (const [i, zdolnosc] of OLD.capability.entries()) {
        await db.pool.query(
          `insert into desk.grant (kto, zdolnosc, nadal) values ($1,$2,'robert')`,
          [`u${i}`, zdolnosc],
        )
      }

      await db.pool.query(
        `insert into desk.serwer_mcp (nazwa, etykieta, url, dodal)
         values ($1,'wykaz podatników VAT','http://localhost:8310/mcp','seed')`,
        [OLD.connector],
      )
      for (const [i, n] of OLD.connectorTool.entries()) {
        await db.pool.query(
          `insert into desk.narzedzie_mcp
             (serwer, nazwa_zdalna, opis, krotko, zdolnosc, odcisk, stan, zatwierdzil)
           values ($1,$2,'sprawdza kontrahenta','sprawdzenie','kontrahent.sprawdz',$3,$4,'robert')`,
          [OLD.connector, n, `odcisk-${i}`, OLD.toolStatus[i]!],
        )
      }

      await db.migrate()
    }, 60_000)

    it("nie zostawia ani jednego napisu ze starego słownika", async () => {
      expect(await survivors()).toEqual([])
    })

    it("przenosi WSZYSTKIE dane, a nie tworzy pustego drugiego kompletu tabel", async () => {
      const counts = async () => ({
        sprawy: (await db.pool.query(`select count(*)::int n from desk.case_file`)).rows[0].n,
        zdarzenia: (await db.pool.query(`select count(*)::int n from desk.event`)).rows[0].n,
        dziennik: (await db.pool.query(`select count(*)::int n from desk.audit_log`)).rows[0].n,
        prosby: (await db.pool.query(`select count(*)::int n from desk.access_request`)).rows[0].n,
        granty: (await db.pool.query(`select count(*)::int n from desk.grant`)).rows[0].n,
      })
      expect(await counts()).toEqual({
        sprawy: OLD.caseStatus.length,
        zdarzenia:
          1 +
          OLD.lifecycleStatus.length +
          3 +
          2 * OLD.toolName.length +
          OLD.capability.length +
          OLD.costBasis.length,
        dziennik:
          OLD.auditType.length +
          OLD.auditAction.length +
          OLD.costBasis.length +
          OLD.onCollision.length +
          2,
        prosby: OLD.requestStatus.length,
        granty: OLD.capability.length,
      })
      const stare = await db.pool.query(
        `select table_name from information_schema.tables
         where table_schema='desk' and table_name in
           ('sprawa','zdarzenie','dziennik','prosba','serwer_mcp','narzedzie_mcp')`,
      )
      expect(stare.rows).toEqual([])
    })

    it("przestawia WARTOŚCI DOMYŚLNE kolumn, nie tylko istniejące wiersze", async () => {
      // `create table if not exists` nie dotyka tabeli, która już istnieje, a `rename column`
      // nie niesie `default` — więc bez osobnego kroku każdy NOWY wiersz wpadałby po polsku.
      const r = await db.pool.query<{ table_name: string; column_default: string }>(
        `select table_name, column_default from information_schema.columns
         where table_schema='desk' and column_name='status' order by table_name`,
      )
      expect(r.rows.map((x) => [x.table_name, x.column_default])).toEqual([
        ["access_request", "'pending'::text"],
        ["case_file", "'new'::text"],
        ["mcp_tool", "'approved'::text"],
      ])
    })

    it("nie zostawia polskiej nazwy w żadnym ograniczeniu ani indeksie", async () => {
      const r = await db.pool.query<{ name: string }>(
        `select conname as name from pg_constraint c
           join pg_namespace n on n.oid=c.connamespace where n.nspname='desk'
         union all
         select indexname as name from pg_indexes where schemaname='desk'`,
      )
      const polskie = r.rows
        .map((x) => x.name)
        .filter((n) => /sprawa|zdarzenie|dziennik|prosba|serwer|narzedzie|wlasciciel/.test(n))
      expect(polskie).toEqual([])
    })

    it("scala konektor w jeden serwer i zachowuje podpis zatwierdzającego", async () => {
      const s = await db.pool.query(`select name, added_by from desk.mcp_server order by name`)
      expect(s.rows).toEqual([{ name: "vat-registry", added_by: "seed" }])
      const n = await db.pool.query(
        `select remote_name, fingerprint, status, approved_by from desk.mcp_tool order by remote_name`,
      )
      expect(n.rows).toEqual([
        {
          remote_name: "bank_account_check",
          fingerprint: "19c8a3199bbd49bac72fdf5db8b254ce1e7e537288971e9f036c893cbcccf693",
          // wstrzymanie jest decyzją człowieka i musi przeżyć przemianowanie
          status: "suspended",
          approved_by: "robert",
        },
        {
          remote_name: "vat_status",
          fingerprint: "5c8b05965afd3c3d2994872d4fb9fc70fa20486b30d5edaebb87d882b0ed51e3",
          status: "approved",
          approved_by: "robert",
        },
      ])
    })

    it("powtórzona migracja niczego nie psuje", async () => {
      await again()
      expect(await survivors()).toEqual([])
      const n = await db.pool.query(`select count(*)::int n from desk.mcp_tool`)
      expect(n.rows[0].n).toBe(2)
    }, 30_000)

    it("zasiew słownika naprawdę pokrywa cały stary słownik", () => {
      // Bez tej asercji test przechodziłby także wtedy, gdyby zasiew czegoś nie posiał —
      // a wtedy „zero pozostałości" nie znaczyłoby nic.
      expect(FORBIDDEN.size).toBeGreaterThan(90)
    })
  })

  describe("baza po nietrafionej migracji — dwa serwery naraz", () => {
    beforeAll(async () => {
      await db.pool.query(`drop schema if exists desk cascade`)
      await again() // świeży schemat po angielsku

      // Dokładnie to, co zostawiło wydanie szukające slugu `biala-list`: stary serwer
      // nietknięty, a obok niego zasiew nowego.
      await db.pool.query(
        `insert into desk.mcp_server (name, label, url, added_by) values
           ($1,'wykaz podatników VAT','http://localhost:8310/mcp','seed'),
           ('vat-registry','wykaz podatników VAT','http://localhost:8310/mcp','seed')`,
        [OLD.connector],
      )
      await db.pool.query(
        `insert into desk.mcp_tool
           (server, remote_name, description, short_label, capability, fingerprint, approved_by) values
           ($1,'sprawdz_nip','sprawdza NIP','NIP','counterparty.verify','stary','robert'),
           ($1,'sprawdz_rachunek','sprawdza rachunek','rachunek','counterparty.verify','stary','robert'),
           ('vat-registry','vat_status','sprawdza NIP','NIP','counterparty.verify','5c8b','seed'),
           ('vat-registry','bank_account_check','sprawdza rachunek','rachunek','counterparty.verify','19c8','seed')`,
        [OLD.connector],
      )
      await again()
    }, 30_000)

    it("zostawia jeden serwer, dwa narzędzia i podpis człowieka zamiast zasiewu", async () => {
      const s = await db.pool.query(`select name from desk.mcp_server order by name`)
      expect(s.rows.map((x) => x.name)).toEqual(["vat-registry"])
      const n = await db.pool.query(
        `select remote_name, fingerprint, approved_by from desk.mcp_tool order by remote_name`,
      )
      expect(n.rows).toEqual([
        {
          remote_name: "bank_account_check",
          fingerprint: "19c8a3199bbd49bac72fdf5db8b254ce1e7e537288971e9f036c893cbcccf693",
          approved_by: "robert",
        },
        {
          remote_name: "vat_status",
          fingerprint: "5c8b05965afd3c3d2994872d4fb9fc70fa20486b30d5edaebb87d882b0ed51e3",
          approved_by: "robert",
        },
      ])
    })
  })
})
