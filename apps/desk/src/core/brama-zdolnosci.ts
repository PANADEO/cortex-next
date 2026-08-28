import { createHash } from 'node:crypto'
import zdolnosciJson from '../../seed/zdolnosci.json'
import type { Polityka, Rola, Uzytkownik, Zdolnosc } from './typy'
import { pool, migracja } from './db'

const KATALOG = zdolnosciJson.zdolnosci as Zdolnosc[]
const ROLE = zdolnosciJson.role as Record<Rola, string[]>
const LIMITY = zdolnosciJson.limity as Record<Rola, { usdNaDzien: number }>

/**
 * F1 · BRAMA ZDOLNOŚCI — jedyna warstwa, której nikt nam nie sprzeda.
 * W POC źródłem jest plik seed; w produkcji tabela grantów w Postgresie.
 * Kontrakt się nie zmienia: resolve(user) -> zmaterializowany zestaw.
 */
export function polityka(u: Uzytkownik): Polityka {
  const idsPrzyznane = new Set(ROLE[u.rola] ?? [])
  const przyznane = KATALOG.filter((z) => idsPrzyznane.has(z.id))
  const zablokowane = KATALOG.filter((z) => !idsPrzyznane.has(z.id))
  const odcisk = createHash('sha256')
    .update(`${u.id}|${u.rola}|${[...idsPrzyznane].sort().join(',')}`)
    .digest('hex')
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
