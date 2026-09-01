import { migrate, pool } from "./db"

/**
 * Dziennik jest NASZ i leży poza zasięgiem zapisu agenta.
 * Widok przyjdzie później — punkty zapisu muszą istnieć od pierwszego dnia.
 */
export async function write(who: string, type: string, details: Record<string, unknown> = {}) {
  await migrate()
  await pool.query(`insert into desk.audit_log (who, type, details) values ($1,$2,$3)`, [
    who,
    type,
    JSON.stringify(details),
  ])
}

export async function latest(limit = 100) {
  await migrate()
  const r = await pool.query(
    `select at, who, type, details from desk.audit_log order by at desc limit $1`,
    [limit],
  )
  return r.rows
}
