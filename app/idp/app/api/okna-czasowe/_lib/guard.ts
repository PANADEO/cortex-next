// Bramka kafelka "Okna czasowe" na ścieżce ŻĄDANIA. Do 30.07.2026 moduł nie
// miał jej wcale: RBAC był wyłącznie wizualny (AppGate — komponent React, który
// nigdy nie owija Route Handlerów), więc anonimowy POST dopisywał film do
// bazy (201 Created), anonimowy DELETE kasował cudzy rekord, a anonimowy
// POST /scan wypuszczał z serwera ruch wychodzący do publicznego API JustWatch.
//
// Kształt 1:1 z app/idp/app/api/ilustromat/_lib/guard.ts — świadomie ten sam,
// żeby przegląd obu modułów był jednym porównaniem, a nie dwiema analizami.
// Ilustromat ma dodatkowo warstwę granularną (requireTileScope); tutaj jej nie
// ma, bo moduł nie rozróżnia ról w środku — każdy, kto ma kafelek, zarządza
// całą listą filmów.

import { requireTileAccess } from "@cortex/service"
import { NextResponse } from "next/server"

/** Kod uprawnienia, po którym pyta bramka tego modułu. Ten sam ciąg musi być na
 *  allowliście AUTHORIZED_APP_CODES w app/idp/app/api/_lib/access.ts — inaczej
 *  powłoka ukryje kafelek, mimo że API by go wpuściło. */
export const OKNA_CZASOWE_APP_CODE = "okna-czasowe"

/**
 * Zwraca gotową odpowiedź odmowną albo null, gdy wolno przepuścić dalej.
 * Kolejność wg code-api/SKILL.md: auth PRZED jakąkolwiek pracą — także przed
 * odczytem ciała żądania i przed dotknięciem store'a.
 */
export async function denyUnlessAllowed(request: Request): Promise<NextResponse | null> {
  const access = await requireTileAccess(request, OKNA_CZASOWE_APP_CODE)
  if (access.allowed) return null

  // Brak tożsamości to 401, tożsamość bez grantu to 403 — rozróżnienie ma
  // znaczenie dla klienta (zaloguj się vs poproś o uprawnienia).
  return access.email
    ? NextResponse.json({ error: "forbidden" }, { status: 403 })
    : NextResponse.json({ error: "missing-email" }, { status: 401 })
}
