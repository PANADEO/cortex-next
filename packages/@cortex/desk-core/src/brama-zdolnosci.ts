import { createHash } from "node:crypto"
import zdolnosciJson from "../seed/zdolnosci.json"
import { migracja, pool } from "./db"
import type { Polityka, Rola, Uzytkownik, Zdolnosc } from "./typy"

const KATALOG = zdolnosciJson.zdolnosci as Zdolnosc[]
const ROLE = zdolnosciJson.role as Record<Rola, string[]>
const LIMITY = zdolnosciJson.limity as Record<Rola, { usdNaDzien: number }>

export const katalogZdolnosci = KATALOG

/**
 * F1 · BRAMA ZDOLNOŚCI — jedyna warstwa, której nikt nam nie sprzeda.
 *
 * Zestaw powstaje z dwóch źródeł: z roli (plik seed) oraz z indywidualnych nadań
 * w tabeli `desk.grant`. Kontrakt się nie zmienia: resolve(user) → zmaterializowany zestaw,
 * a odcisk obejmuje OBA źródła, więc nadanie zmienia zakres widoczny w dzienniku.
 */
export async function polityka(u: Uzytkownik): Promise<Polityka> {
  await migracja()
  const g = await pool.query<{ zdolnosc: string }>(`select zdolnosc from desk.grant where kto=$1`, [
    u.id,
  ])
  const nadane = g.rows.map((r) => r.zdolnosc)
  return zbuduj(u, nadane)
}

/** Wariant bez bazy — do miejsc, które nie mogą czekać, oraz do testów bramy. */
export function politykaZRoli(u: Uzytkownik): Polityka {
  return zbuduj(u, [])
}

function zbuduj(u: Uzytkownik, nadane: string[]): Polityka {
  const znane = new Set(KATALOG.map((z) => z.id))
  const idsPrzyznane = new Set([...(ROLE[u.rola] ?? []), ...nadane.filter((z) => znane.has(z))])
  const przyznane = KATALOG.filter((z) => idsPrzyznane.has(z.id))
  const zablokowane = KATALOG.filter((z) => !idsPrzyznane.has(z.id))
  const odcisk = createHash("sha256")
    .update(`${u.id}|${u.rola}|${[...idsPrzyznane].sort().join(",")}`)
    .digest("hex")
    .slice(0, 12)
  return {
    uzytkownik: u.id,
    rola: u.rola,
    przyznane,
    zablokowane,
    limitUsdNaDzien: LIMITY[u.rola]?.usdNaDzien ?? 1,
    odcisk,
  }
}

export function maZdolnosc(p: Polityka, id: string) {
  return p.przyznane.some((z) => z.id === id)
}

export async function wydanoDzisiaj(uzytkownik: string): Promise<number> {
  await migracja()
  const r = await pool.query<{ suma: string }>(
    `select coalesce(sum(koszt_usd),0)::text as suma from desk.sprawa
     where wlasciciel=$1 and zmieniona::date = now()::date`,
    [uzytkownik],
  )
  return Number(r.rows[0]?.suma ?? 0)
}
