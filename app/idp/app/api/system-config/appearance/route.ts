import {
  getInstanceAppearance,
  instanceAppearanceInputSchema,
  setInstanceAppearance,
} from "@cortex/service"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { denyUnlessAllowed, toErrorResponse } from "../_lib/guard"

export const runtime = "nodejs"

/**
 * Wygląd instancji — czytany i zapisywany WYŁĄCZNIE przez panel administratora,
 * dlatego ta sama bramka co u rodzeństwa (`requireTileAccess(system-config)`).
 *
 * Nie ma tu drugiej, otwartej trasy „odczyt dla wszystkich", choć preset
 * instancji musi dosięgnąć każdego użytkownika: dostarcza go RENDER SERWEROWY
 * (`app/idp/app/layout.tsx` czyta serwis wprost i wstawia klasę skinu oraz
 * `data-preset` do HTML-a). To nie jest obejście bramki, tylko powód, dla
 * którego jej tu nie trzeba luzować — przeglądarka nigdy nie pyta o tę wartość,
 * dostaje ją gotową. Otwarcie GET-a „dla wygody frontu" dołożyłoby publiczną
 * powierzchnię, która niczego nie obsługuje.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const denied = await denyUnlessAllowed(request)
  if (denied) return denied

  try {
    return NextResponse.json(await getInstanceAppearance())
  } catch (error) {
    return toErrorResponse(error)
  }
}

/**
 * PUT, nie PATCH: ustawienie jest jedno i zapis podaje jego pełną wartość.
 * `preset: null` to POPRAWNE ciało, nie brak pola — tak się zdejmuje wygląd
 * narzucony instancji. Dlatego `nullable()` w schemacie, a nie `optional()`:
 * przy `optional()` „wyczyść" byłoby nieodróżnialne od „nie ruszaj".
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  const denied = await denyUnlessAllowed(request)
  if (denied) return denied

  const parsed = instanceAppearanceInputSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid-request" }, { status: 400 })
  }

  try {
    return NextResponse.json(await setInstanceAppearance(parsed.data))
  } catch (error) {
    return toErrorResponse(error)
  }
}
