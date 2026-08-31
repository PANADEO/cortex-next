import { NextResponse } from 'next/server'
import { pool, migracja } from '@cortex/desk-core/db'
import * as dziennik from '@cortex/desk-core/dziennik'

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
  // Zerowanie kasuje prawdziwą liczbę — a to jedyna liczba, z której da się oszacować
  // dzienny koszt Biurka. Zapisujemy ją więc do dziennika, ZANIM zniknie.
  const przed = await pool.query<{ usd: string; n: string }>(
    `select coalesce(sum(koszt_usd),0)::text as usd, count(*)::text as n
     from desk.sprawa where utworzona >= current_date`,
  )
  // `sum` z `coalesce` zawsze zwraca dokładnie jeden wiersz, ale typ tego nie wie —
  // a zerowanie kosztu bez zapisania, ile go było, jest właśnie tym błędem, przed którym
  // broni ten wpis do dziennika. Lepiej odmówić niż wyzerować po cichu.
  const stan = przed.rows[0]
  if (!stan) return NextResponse.json({ blad: 'Nie udało się odczytać dzisiejszego kosztu.' }, { status: 500 })
  const k = await pool.query(`update desk.sprawa set koszt_usd=0 where utworzona >= current_date`)
  await dziennik.zapisz('system', 'koszt.wyzerowany', { usd: Number(stan.usd), spraw: Number(stan.n) })
  return NextResponse.json({ ok: true, wyzerowanychSpraw: k.rowCount, wyzerowaneUsd: Number(stan.usd) })
}
