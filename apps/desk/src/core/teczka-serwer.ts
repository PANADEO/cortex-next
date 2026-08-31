import 'server-only'
import { pool } from './db'
import * as biurko from './biurko'
import type { DeskEvent } from './typy'

/** Ile GOTOWYCH dokumentów ma każda ze spraw — załączniki człowieka się nie liczą. */
export async function policzWyniki(uzytkownik: string, sprawy: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>()
  if (!sprawy.length) return out

  const z = await pool.query<{ sprawa_id: string; payload: DeskEvent }>(
    `select sprawa_id, payload from desk.zdarzenie
     where sprawa_id = any($1) and payload->>'typ' = 'mysl'`,
    [sprawy],
  )
  const zalaczniki = new Map<string, Set<string>>()
  for (const r of z.rows) {
    if (r.payload.typ !== 'mysl') continue
    const zbior = zalaczniki.get(r.sprawa_id) ?? new Set<string>()
    for (const n of r.payload.zalaczniki ?? []) zbior.add(n)
    zalaczniki.set(r.sprawa_id, zbior)
  }

  await Promise.all(sprawy.map(async (id) => {
    const pliki = await biurko.lista(uzytkownik, biurko.katalogSprawy(uzytkownik, id)).catch(() => [])
    const odCzlowieka = zalaczniki.get(id) ?? new Set<string>()
    out.set(id, pliki.filter((p) => !p.katalog && !odCzlowieka.has(p.nazwa)).length)
  }))
  return out
}
