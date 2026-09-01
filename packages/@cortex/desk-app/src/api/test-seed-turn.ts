import { migrate, pool } from "@cortex/desk-core/db"
import { whoAmI } from "@cortex/desk-core/identity"
import type { DeskEvent } from "@cortex/desk-core/types"
import { NextResponse } from "next/server"

/**
 * Wyłącznie dla testów: zakłada sprawę i wsypuje do niej podane zdarzenia.
 *
 * DLACZEGO TO ISTNIEJE. Kart, które ekran rysuje po TURZE — awaria, przerwanie,
 * wyczerpanie limitu kroków — nie da się zobaczyć inaczej niż doprowadzając do nich
 * naprawdę, a to znaczy: zepsuć dostawcę modelu albo zapłacić za dwanaście kroków.
 * Obie drogi są poza zasięgiem bramki, więc te karty nie miały ANI JEDNEGO scenariusza
 * i przez to potrafiły nie renderować się w ogóle: `exhausted` przez pierwsze wersje
 * nie było obsłużone w `case-view` i wyglądało na ekranie jak sukces.
 *
 * Zasiewamy WYŁĄCZNIE zdarzenia — ekran, złączenia i tłumaczenia sprawdzamy naprawdę.
 * Poza trybem deweloperskim trasa odpowiada 404, tak samo jak dwie pozostałe testowe.
 */
export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production" && !process.env.DESK_ALLOW_RESET) {
    return NextResponse.json({ error: "Nie ma takiej trasy." }, { status: 404 })
  }
  const u = await whoAmI()
  const b = (await req.json()) as { title?: string; status?: string; events?: DeskEvent[] }
  if (!b.title || !Array.isArray(b.events)) {
    return NextResponse.json({ error: "Potrzebne są `title` i `events`." }, { status: 400 })
  }
  await migrate()
  await pool.query(`delete from desk.case_file where owner=$1 and title=$2`, [u.id, b.title])
  const id = `seed-${Date.now()}`
  await pool.query(`insert into desk.case_file (id, owner, title, status) values ($1,$2,$3,$4)`, [
    id,
    u.id,
    b.title,
    b.status ?? "done",
  ])
  for (const e of b.events) {
    await pool.query(`insert into desk.event (case_id, payload) values ($1,$2)`, [
      id,
      JSON.stringify(e),
    ])
  }
  return NextResponse.json({ ok: true, id })
}
