import "server-only"
import { migracja, pool } from "../db"
import * as dziennik from "../dziennik"
import { NARZEDZIA_BIALEJ_LISTY, type SerwerMcp, type ZatwierdzoneNarzedzie } from "./katalog"

/**
 * KATALOG W BAZIE, nie w kodzie.
 *
 * Do kroku 6 lista zatwierdzonych narzędzi stała w pliku źródłowym. To działało, dopóki
 * zatwierdzającym byłem ja — ale zgoda na narzędzie ma należeć do przełożonego i mieć jego
 * nazwisko, datę i możliwość wycofania bez wdrożenia nowej wersji aplikacji.
 */

export type NarzedzieWKatalogu = ZatwierdzoneNarzedzie & {
  stan: "zatwierdzone" | "wstrzymane"
  powod: string | null
  zatwierdzil: string
  at: string
}

export type SerwerWKatalogu = Omit<SerwerMcp, "narzedzia"> & {
  dodal: string
  narzedzia: NarzedzieWKatalogu[]
}

const naNarzedzie = (r: Record<string, unknown>): NarzedzieWKatalogu => ({
  // Wiersz z `pg` przychodzi bez typu — rzutujemy przy odczycie POLA, nie na całym wierszu,
  // żeby literówka w nazwie kolumny dalej dawała `undefined`, a nie cichy `any`.
  serwer: r.serwer as string,
  nazwaZdalna: r.nazwa_zdalna as string,
  opis: r.opis as string,
  krotko: r.krotko as string,
  zdolnoscId: r.zdolnosc as string,
  odcisk: r.odcisk as string,
  stan: r.stan as NarzedzieWKatalogu["stan"],
  powod: r.powod as string,
  zatwierdzil: r.zatwierdzil as string,
  at: r.at as string,
})

/**
 * Pierwsze uruchomienie przenosi to, co dotąd stało w kodzie, do bazy — raz, i tylko gdy
 * baza jest pusta. Bez tego wdrożenie tej wersji odebrałoby Annie zdolność, którą już ma.
 */
export async function zasiej() {
  await migracja()
  const url = process.env.MCP_BIALA_LISTA_URL
  if (!url) return
  const jest = await pool.query(`select 1 from desk.serwer_mcp where nazwa='biala-lista'`)
  if (jest.rowCount) return

  await pool.query(
    `insert into desk.serwer_mcp (nazwa, etykieta, url, dodal) values ($1,$2,$3,$4)
     on conflict (nazwa) do nothing`,
    ["biala-lista", "wykaz podatników VAT", url, "seed"],
  )
  for (const n of NARZEDZIA_BIALEJ_LISTY) {
    await pool.query(
      `insert into desk.narzedzie_mcp (serwer, nazwa_zdalna, opis, krotko, zdolnosc, odcisk, zatwierdzil)
       values ($1,$2,$3,$4,$5,$6,'seed') on conflict do nothing`,
      [n.serwer, n.nazwaZdalna, n.opis, n.krotko, n.zdolnoscId, n.odcisk],
    )
  }
}

/** To, co naprawdę wolno zarejestrować w rejestrze modelu: wyłącznie stan „zatwierdzone". */
export async function katalogSerwerow(): Promise<SerwerMcp[]> {
  await zasiej()
  const s = await pool.query(`select * from desk.serwer_mcp order by nazwa`)
  const n = await pool.query(
    `select * from desk.narzedzie_mcp where stan='zatwierdzone' order by nazwa_zdalna`,
  )
  return s.rows
    .map((x) => ({
      nazwa: x.nazwa,
      etykieta: x.etykieta,
      url: x.url,
      narzedzia: n.rows
        .filter((y) => y.serwer === x.nazwa)
        .map(naNarzedzie) as ZatwierdzoneNarzedzie[],
    }))
    .filter((x) => x.narzedzia.length > 0)
}

/** Widok dla przełożonego — razem z wstrzymanymi, bo to o nich musi się dowiedzieć. */
export async function pelnyKatalog(): Promise<SerwerWKatalogu[]> {
  await zasiej()
  const s = await pool.query(`select * from desk.serwer_mcp order by nazwa`)
  const n = await pool.query(`select * from desk.narzedzie_mcp order by nazwa_zdalna`)
  return s.rows.map((x) => ({
    nazwa: x.nazwa,
    etykieta: x.etykieta,
    url: x.url,
    dodal: x.dodal,
    narzedzia: n.rows.filter((y) => y.serwer === x.nazwa).map(naNarzedzie),
  }))
}

export async function dodajSerwer(kto: string, nazwa: string, etykieta: string, url: string) {
  await migracja()
  await pool.query(
    `insert into desk.serwer_mcp (nazwa, etykieta, url, dodal) values ($1,$2,$3,$4)
     on conflict (nazwa) do update set etykieta=excluded.etykieta, url=excluded.url`,
    [nazwa, etykieta, url, kto],
  )
  await dziennik.zapisz(kto, "mcp.serwer.dodany", { nazwa, url })
}

export async function zatwierdzNarzedzie(kto: string, n: ZatwierdzoneNarzedzie) {
  await migracja()
  await pool.query(
    `insert into desk.narzedzie_mcp (serwer, nazwa_zdalna, opis, krotko, zdolnosc, odcisk, stan, powod, zatwierdzil, at)
     values ($1,$2,$3,$4,$5,$6,'zatwierdzone',null,$7,now())
     on conflict (serwer, nazwa_zdalna) do update set
       opis=excluded.opis, krotko=excluded.krotko, zdolnosc=excluded.zdolnosc,
       odcisk=excluded.odcisk, stan='zatwierdzone', powod=null,
       zatwierdzil=excluded.zatwierdzil, at=now()`,
    [n.serwer, n.nazwaZdalna, n.opis, n.krotko, n.zdolnoscId, n.odcisk, kto],
  )
  await dziennik.zapisz(kto, "mcp.narzedzie.zatwierdzone", {
    serwer: n.serwer,
    narzedzie: n.nazwaZdalna,
    zdolnosc: n.zdolnoscId,
    odcisk: n.odcisk,
  })
}

export async function wycofajNarzedzie(kto: string, serwer: string, nazwaZdalna: string) {
  await migracja()
  await pool.query(`delete from desk.narzedzie_mcp where serwer=$1 and nazwa_zdalna=$2`, [
    serwer,
    nazwaZdalna,
  ])
  await dziennik.zapisz(kto, "mcp.narzedzie.wycofane", { serwer, narzedzie: nazwaZdalna })
}

/**
 * Dryf: serwer zmienił narzędzie po zatwierdzeniu. Wstrzymujemy je fail-closed — nie
 * zarejestruje się do czasu, aż człowiek obejrzy różnicę i zatwierdzi ponownie.
 * Nie kasujemy wpisu, bo to zatarłoby ślad, że zgoda w ogóle istniała.
 */
export async function wstrzymaj(serwer: string, nazwaZdalna: string, powod: string) {
  await migracja()
  const r = await pool.query(
    `update desk.narzedzie_mcp set stan='wstrzymane', powod=$3
     where serwer=$1 and nazwa_zdalna=$2 and stan<>'wstrzymane'`,
    [serwer, nazwaZdalna, powod],
  )
  if (r.rowCount)
    await dziennik.zapisz("system", "mcp.narzedzie.wstrzymane", {
      serwer,
      narzedzie: nazwaZdalna,
      powod,
    })
}
