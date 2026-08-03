import { DOCUMENT_PARSER_APP_CODE, requireTileAccess } from "@cortex/service"
import { NextResponse } from "next/server"

/**
 * Bramka kafelka. Zwraca gotową odpowiedź odmowną albo null, gdy wolno
 * przepuścić dalej. Kolejność wg code-api/SKILL.md: auth PRZED jakąkolwiek
 * pracą. Wzorem ilustromat/_lib/guard.ts `denyUnlessAllowed`.
 */
export async function denyUnlessAllowed(request: Request): Promise<NextResponse | null> {
  const access = await requireTileAccess(request, DOCUMENT_PARSER_APP_CODE)
  if (access.allowed) return null
  return denial(access.email)
}

// Brak tożsamości to 401, tożsamość bez grantu to 403 — rozróżnienie ma
// znaczenie dla klienta (zaloguj się vs poproś o uprawnienia).
function denial(email: string | null): NextResponse {
  return email
    ? NextResponse.json({ error: "forbidden" }, { status: 403 })
    : NextResponse.json({ error: "missing-email" }, { status: 401 })
}
