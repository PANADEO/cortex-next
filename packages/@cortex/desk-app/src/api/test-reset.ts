import * as audit from "@cortex/desk-core/audit-log"
import { migrate, pool } from "@cortex/desk-core/db"
import { NextResponse } from "next/server"

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
  if (process.env.NODE_ENV === "production" && !process.env.DESK_ALLOW_RESET) {
    return NextResponse.json({ error: "Nie ma takiej trasy." }, { status: 404 })
  }
  await migrate()
  await pool.query(`delete from desk.grant`)
  await pool.query(`delete from desk.access_request`)
  // Zerowanie kasuje prawdziwą liczbę — a to jedyna liczba, z której da się oszacować
  // dzienny koszt Biurka. Zapisujemy ją więc do dziennika, ZANIM zniknie.
  const before = await pool.query<{ usd: string; cases: string }>(
    `select coalesce(sum(cost_usd),0)::text as usd, count(*)::text as cases
     from desk.case_file where created_at >= current_date`,
  )
  // `sum` z `coalesce` zawsze zwraca dokładnie jeden wiersz, ale typ tego nie wie —
  // a zerowanie kosztu bez zapisania, ile go było, jest właśnie tym błędem, przed którym
  // broni ten wpis do dziennika. Lepiej odmówić niż wyzerować po cichu.
  const status = before.rows[0]
  if (!status)
    return NextResponse.json(
      { error: "Nie udało się odczytać dzisiejszego kosztu." },
      { status: 500 },
    )
  const k = await pool.query(
    `update desk.case_file set cost_usd=0 where created_at >= current_date`,
  )
  await audit.write("system", "cost.reset", {
    usd: Number(status.usd),
    cases: Number(status.cases),
  })
  return NextResponse.json({
    ok: true,
    resetCases: k.rowCount,
    resetUsd: Number(status.usd),
  })
}
