// Bramka kafelka Content Guru (code-api). Kolejność wg code-api/SKILL.md:
// auth PRZED jakąkolwiek pracą. DWIE warstwy od Round B (wzorem Ilustromatu,
// design doc D6/D9): `requireContentGuruAccess` (kafelek) i
// `requireContentGuruManageTemplates` (granularny scope nad szablonami,
// zasobem WSPÓLNYM między userami — GET listy zostaje za samą pierwszą
// warstwą, bo end-user musi widzieć szablony, żeby wybrać jeden do
// generowania; mutacje wymagają obu).
//
// Zwraca `{ email }` znormalizowany przez requireTileAccess()/
// requireTileScope() (nigdy surowy nagłówek) — code-service "Rekordy
// per-user" pkt 3: userEmail przekazywany dalej do warstwy serwisowej MUSI
// pochodzić stąd, nigdy z ciała żądania.

import { requireTileAccess, requireTileScope } from "@cortex/service"
import { NextResponse } from "next/server"
import { CONTENT_GURU_APP_CODE, CONTENT_GURU_MANAGE_TEMPLATES_SCOPE } from "@/lib/content-guru/config"

export type ContentGuruAccessResult = { email: string } | { deny: NextResponse }

function denyFor(email: string | null): NextResponse {
  // Brak tożsamości to 401, tożsamość bez grantu to 403 — rozróżnienie ma
  // znaczenie dla klienta (zaloguj się vs poproś o uprawnienia).
  return email
    ? NextResponse.json({ error: "forbidden" }, { status: 403 })
    : NextResponse.json({ error: "missing-email" }, { status: 401 })
}

export async function requireContentGuruAccess(request: Request): Promise<ContentGuruAccessResult> {
  const access = await requireTileAccess(request, CONTENT_GURU_APP_CODE)
  if (access.allowed && access.email) return { email: access.email }
  return { deny: denyFor(access.email) }
}

/** Druga, GRANULARNA bramka — dla akcji zmieniających szablony (create/
 *  update/delete/duplicate/test-generation). `requireTileScope()` sprawdza
 *  OBIE warstwy naraz (kafelek + scope), więc dostęp do kafelka samo w sobie
 *  nie wystarcza. */
export async function requireContentGuruManageTemplates(
  request: Request,
): Promise<ContentGuruAccessResult> {
  const access = await requireTileScope(
    request,
    CONTENT_GURU_APP_CODE,
    CONTENT_GURU_MANAGE_TEMPLATES_SCOPE,
  )
  if (access.allowed && access.email) return { email: access.email }
  return { deny: denyFor(access.email) }
}

/** Naruszenie unikalności Postgresa (23505) — `templates.category+name` albo
 *  `{client,market}_profiles.userEmail+profileName`. Mapowane na 409, nie 500
 *  — to błąd WEJŚCIA (nazwa już zajęta), nie awaria serwera. Wzorem
 *  `isUniqueViolation()` w app/idp/app/api/ilustromat/_lib/guard.ts. */
export function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505"
}
