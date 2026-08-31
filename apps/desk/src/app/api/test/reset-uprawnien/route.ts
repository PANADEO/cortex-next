import { NextResponse } from 'next/server'
import { pool, migracja } from '@/core/db'

/**
 * Wyłącznie dla testów i pokazu: kasuje nadania i prośby, żeby scenariusz governance
 * zaczynał się od tego samego stanu. Poza trybem deweloperskim odpowiada 404.
 */
export async function POST() {
  if (process.env.NODE_ENV === 'production' && !process.env.DESK_POZWOL_RESET) {
    return NextResponse.json({ blad: 'Nie ma takiej trasy.' }, { status: 404 })
  }
  await migracja()
  await pool.query(`delete from desk.grant`)
  await pool.query(`delete from desk.prosba`)
  return NextResponse.json({ ok: true })
}
