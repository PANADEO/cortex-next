import * as audit from "@cortex/desk-core/audit-log"
import { migrate } from "@cortex/desk-core/db"
import { whoAmI } from "@cortex/desk-core/identity"
import { outcomes } from "@cortex/desk-core/outcomes"
import { deskT } from "@cortex/desk-ui/i18n/server"
import { NextResponse } from "next/server"

/**
 * CO SIĘ NIE UDAŁO — zestawienie dla przełożonego. Wyłącznie do czytania: nie ma tu
 * POST-a i nie będzie, bo z tego ekranu nie podejmuje się decyzji, tylko się je widzi.
 * Zdolność włącza „Zespół", zgodę na narzędzie wydaje „Narzędzia" — drugiego miejsca,
 * w którym da się to zrobić, mieć nie wolno.
 *
 * ODMOWA JEST ODMOWĄ, nie pustą listą. Pracownica, która trafi na ten adres, dostaje 403
 * i ślad w dzienniku, bo „zero porażek" i „nie wolno ci tego widzieć" to dwie zupełnie
 * różne odpowiedzi. Zestawienie, które na pytanie o cudze porażki oddaje puste tablice,
 * uczy czytającego, że ich nie było — a to jest gorsze niż brak ekranu.
 *
 * ODMOWA JEST 403, choć sam EKRAN nadzoru oddaje pracownicy 404. To nie jest niezgodność:
 * strona ukrywa swoje ISTNIENIE przed kimś, kto nie ma po co o niej wiedzieć, a trasa
 * odpowiada na pytanie zadane wprost, więc musi powiedzieć, że odmawia. Tak samo robią
 * `/api/team` i `/api/mcp`.
 */
export async function GET() {
  await migrate()
  const u = await whoAmI()
  const translate = await deskT()
  if (u.role !== "management") {
    // `what` idzie do dziennika, nie na ekran — zostaje w języku instancji.
    await audit.write(u.id, "access.denied", { what: "zestawienie porażek" })
    return NextResponse.json({ error: translate("api.managerOnly") }, { status: 403 })
  }
  return NextResponse.json(await outcomes())
}
