import { migrate, pool } from "@cortex/desk-core/db"
import { NextResponse } from "next/server"

/**
 * Wyłącznie dla testów i pokazu: przywraca stan początkowy, żeby scenariusz zaczynał się
 * zawsze tak samo. Poza trybem deweloperskim odpowiada 404.
 *
 * NIE ZERUJE KOSZTU I NIE WOLNO TEGO PRZYWRACAĆ. Robił to przez długi czas — `update
 * desk.case_file set cost_usd=0 where created_at >= current_date` — w przekonaniu, że
 * odblokowuje dzienny limit przed kolejnym przebiegiem zestawu. To przekonanie przestało
 * być prawdą w dniu, w którym `spentToday` przeszło na ZDARZENIA kosztu (patrz komentarz
 * w `capability-gate.ts`): limit liczy się dziś ze zdarzeń, których ta trasa nie tyka,
 * więc zerowanie niczego nie odblokowywało. Zostawało samo zniszczenie.
 *
 * Zmierzone na bazie deweloperskiej: 1866 wywołań, 4,74 USD skasowanej historii, 438 spraw
 * ze zdarzeniem kosztu wobec 38 z niezerowym `cost_usd`. Kasowało też sprawy CZŁOWIEKA,
 * bo warunek brzmiał „z dzisiaj", a nie „z testu" — ktoś klikał w Biurku, w tle szedł
 * `pnpm test:e2e` i koszt jego własnej sprawy znikał mu z ekranu.
 */
export async function POST() {
  if (process.env.NODE_ENV === "production" && !process.env.DESK_ALLOW_RESET) {
    return NextResponse.json({ error: "Nie ma takiej trasy." }, { status: 404 })
  }
  await migrate()
  await pool.query(`delete from desk.grant`)
  await pool.query(`delete from desk.access_request`)
  return NextResponse.json({ ok: true })
}
