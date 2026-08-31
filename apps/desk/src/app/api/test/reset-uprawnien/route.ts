import { NextResponse } from 'next/server'
import { pool, migracja } from '@cortex/desk-core/db'

/**
 * Wyłącznie dla testów i pokazu: przywraca stan początkowy, żeby scenariusz zaczynał się
 * zawsze tak samo. Poza trybem deweloperskim odpowiada 404.
 *
 * Zeruje też DZISIEJSZY KOSZT, i to nie jest wygoda: dzienny limit jest prawdziwy
 * i egzekwowany, więc kilka przebiegów pełnego zestawu w jednym dniu wyczerpuje budżet
 * Anny i kolejne tury dostają 429. Bez tego bramka przestaje mierzyć kod, a zaczyna
 * mierzyć to, ile razy dziś ją uruchomiono.
 */
export async function POST() {
  if (process.env.NODE_ENV === 'production' && !process.env.DESK_POZWOL_RESET) {
    return NextResponse.json({ blad: 'Nie ma takiej trasy.' }, { status: 404 })
  }
  await migracja()
  await pool.query(`delete from desk.grant`)
  await pool.query(`delete from desk.prosba`)
  const k = await pool.query(`update desk.sprawa set koszt_usd=0 where utworzona >= current_date`)
  return NextResponse.json({ ok: true, wyzerowanychSpraw: k.rowCount })
}
