// Bramka kafelka (code-api). Kolejność wg code-api/SKILL.md: auth PRZED
// jakąkolwiek pracą. Wzorem app/idp/app/api/document-parser/_lib/guard.ts —
// Faza 1 (analyze/route.ts) woła requireTileAccess() bezpośrednio, bo w tamtej
// rundzie istniał tylko jeden route; od Fazy 2 (dwa kolejne pliki: history/,
// history/[id]/) ekstrakcja tego samego wywołania do wspólnego helpera jest
// tańsza niż trzecia kopia identycznego kodu — guard-coverage.test.ts obok
// i tak sprawdza WSZYSTKIE route.ts tego modułu (przez import.meta.glob),
// niezależnie od tego, który z dwóch stylów wywołania dana route wybrała.

import { GEO_SCORE_CALCULATOR_APP_CODE, requireTileAccess } from "@cortex/service"
import { NextResponse } from "next/server"

/**
 * Zwraca gotową odpowiedź odmowną albo `null`, gdy wolno przepuścić dalej.
 * Brak tożsamości to 401, tożsamość bez grantu to 403 — rozróżnienie ma
 * znaczenie dla klienta (zaloguj się vs poproś o uprawnienia).
 */
export async function denyUnlessAllowed(request: Request): Promise<NextResponse | null> {
  const access = await requireTileAccess(request, GEO_SCORE_CALCULATOR_APP_CODE)
  if (access.allowed) return null
  return access.email
    ? NextResponse.json({ error: "forbidden" }, { status: 403 })
    : NextResponse.json({ error: "missing-email" }, { status: 401 })
}
