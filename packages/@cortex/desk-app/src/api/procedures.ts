import { whoAmI } from "@cortex/desk-core/identity"
import { names } from "@cortex/desk-core/people"
import { activeProcedures, type StoredProcedure } from "@cortex/desk-core/procedures/store"
import { visibleFor } from "@cortex/desk-core/procedures/visible"
import { NextResponse } from "next/server"

/**
 * PROCEDURY WIDZIANE PRZEZ PRACOWNIKA — dokładnie te, które wchodzą do JEGO tury.
 *
 * Zasięg liczy `visibleFor`, czyli TA SAMA funkcja, którą `runtime.ts` odsiewa procedury
 * przed złożeniem promptu. Drugie sito po stronie ekranu rozjechałoby się z pierwszym przy
 * pierwszej zmianie reguły — a rozjazd byłby cichy w najgorszą stronę: człowiek czytałby
 * na ekranie zasadę, według której asystent u niego nie pracuje.
 *
 * PRZEŁOŻONY NIE MA TU OBEJŚCIA i to jest decyzja z `visible.ts`, nie przeoczenie: na tym
 * ekranie każdy pyta „według czego mam pracować JA". Widok całej firmy jest na ekranie
 * nadzoru i wchodzi się do niego rolą.
 */
export async function GET() {
  const u = await whoAmI()
  const [all, people] = await Promise.all([activeProcedures(), names()])
  return NextResponse.json({
    department: u.department,
    procedures: visibleFor(all, u.department).map((p) => forReading(p, people)),
  })
}

/**
 * Ani `loading`, ani `paths`, ani odcisk. To są pojęcia z ekranu przełożonego; tutaj
 * niosłyby wyłącznie hałas dla kogoś, kto chce przeczytać, jak się u nas coś robi.
 *
 * `signedBy` bywa PUSTE i to jest informacja, nie brak danych: procedura z zasiewu ma
 * w kolumnie autora wartość `seed`, bo nie podpisał jej żaden człowiek. Podstawienie
 * tam czyjegokolwiek nazwiska byłoby zmyśleniem podpisu pod dokumentem.
 */
function forReading(p: StoredProcedure, people: Record<string, string>) {
  return {
    name: p.name,
    title: p.title,
    description: p.description,
    body: p.current.body,
    edition: p.current.edition,
    signedBy: people[p.current.author] ?? null,
    at: p.current.at,
  }
}
