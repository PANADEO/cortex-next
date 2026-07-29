import { SYSTEM_CONFIG_APP_CODE, requireTileAccess } from "@cortex/service"
import { NextResponse } from "next/server"

/**
 * Bramka modułu — moduł administracyjny pilnuje sam siebie. Zwraca gotową
 * odpowiedź odmowną albo null, gdy wolno przepuścić dalej.
 *
 * Kolejność wg code-api/SKILL.md: auth PRZED jakąkolwiek pracą.
 */
export async function denyUnlessAllowed(request: Request): Promise<NextResponse | null> {
  const access = await requireTileAccess(request, SYSTEM_CONFIG_APP_CODE)
  if (access.allowed) return null

  // Brak tożsamości to 401, tożsamość bez grantu to 403 — rozróżnienie ma
  // znaczenie dla klienta (zaloguj się vs poproś o uprawnienia).
  return access.email
    ? NextResponse.json({ error: "forbidden" }, { status: 403 })
    : NextResponse.json({ error: "missing-email" }, { status: 401 })
}

/** Mapuje wyjątki warstwy serwisowej na odpowiedzi HTTP. */
export function toErrorResponse(error: unknown): NextResponse {
  if (isUniqueViolation(error)) {
    return NextResponse.json({ error: "duplicate-code" }, { status: 409 })
  }

  console.error("[system-config] błąd obsługi żądania:", error)
  return NextResponse.json({ error: "internal-error" }, { status: 500 })
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505"
}
