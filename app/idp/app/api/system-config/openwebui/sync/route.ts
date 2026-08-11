// „Synchronizuj wszystko" — pełne uzgodnienie kont i grup OpenWebUI ze stanem
// Konfiguracji Systemu (PROJECT/cortex-frontend/ARTIFACTS/openwebui/
// cortex-frontend-openwebui-jedno-zrodlo-prawdy-projekt.md).
//
// GET  — PODGLĄD. Liczy różnicę, nie zapisuje nic.
// POST — zastosowanie planu. Wymaga jawnego `{ "apply": true }` w ciele.
//
// Dlaczego zapis jest pod POST-em z jawną flagą, a nie pod samym POST-em:
// pierwsze uruchomienie na instancji jest najbardziej destrukcyjnym momentem w
// życiu tego mechanizmu — różnica liczy się wobec stanu, którego nikt nigdy nie
// uzgadniał, więc każda niepełność danych w Cortexie trafia do OpenWebUI
// hurtem. Przypadkowe wywołanie ma być niemożliwe, nie mało prawdopodobne.

import { reconcileEverything } from "@cortex/service"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { z } from "zod"
import { denyUnlessAllowed, toErrorResponse } from "../../_lib/guard"

export const runtime = "nodejs"

const bodySchema = z.object({ apply: z.literal(true) })

export async function GET(request: NextRequest): Promise<NextResponse> {
  const denied = await denyUnlessAllowed(request)
  if (denied) return denied

  try {
    return NextResponse.json(await reconcileEverything({ dryRun: true }))
  } catch (error) {
    return toErrorResponse(error)
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const denied = await denyUnlessAllowed(request)
  if (denied) return denied

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: "apply-required", message: "Zapis wymaga jawnego { apply: true }" },
      { status: 400 },
    )
  }

  try {
    return NextResponse.json(await reconcileEverything({ dryRun: false }))
  } catch (error) {
    return toErrorResponse(error)
  }
}
