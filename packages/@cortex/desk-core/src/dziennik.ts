import { migracja, pool } from "./db"

/**
 * Dziennik jest NASZ i leży poza zasięgiem zapisu agenta.
 * Widok przyjdzie później — punkty zapisu muszą istnieć od pierwszego dnia.
 */
export async function zapisz(kto: string, typ: string, szczegoly: Record<string, unknown> = {}) {
  await migracja()
  await pool.query(`insert into desk.dziennik (kto, typ, szczegoly) values ($1,$2,$3)`, [
    kto,
    typ,
    JSON.stringify(szczegoly),
  ])
}

export async function ostatnie(limit = 100) {
  await migracja()
  const r = await pool.query(
    `select at, kto, typ, szczegoly from desk.dziennik order by at desc limit $1`,
    [limit],
  )
  return r.rows
}
