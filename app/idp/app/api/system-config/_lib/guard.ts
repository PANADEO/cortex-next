import { SYSTEM_CONFIG_APP_CODE, SelfLockoutError, requireTileAccess } from "@cortex/service"
import { NextResponse } from "next/server"
import { z } from "zod"

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

const uuidSchema = z.string().uuid()

/**
 * Waliduje identyfikator ze ścieżki ZANIM trafi do zapytania. Bez tego
 * nie-UUID leci do Postgresa i wraca jako 500 zamiast czytelnego 400.
 */
export function parseIdParam(id: string): NextResponse | null {
  return uuidSchema.safeParse(id).success
    ? null
    : NextResponse.json({ error: "invalid-id" }, { status: 400 })
}

/** Mapuje wyjątki warstwy serwisowej na odpowiedzi HTTP. */
export function toErrorResponse(error: unknown): NextResponse {
  // PATCH waliduje reguły międzypolowe dopiero po scaleniu z wierszem w bazie,
  // czyli już w serwisie — bez tego błąd kształtu wracałby jako 500.
  if (error instanceof z.ZodError) {
    return NextResponse.json(
      { error: "invalid-request", message: error.issues[0]?.message },
      { status: 400 },
    )
  }

  if (error instanceof SelfLockoutError) {
    return NextResponse.json({ error: "self-lockout", message: error.message }, { status: 409 })
  }

  if (isUniqueViolation(error)) {
    return NextResponse.json({ error: "duplicate-code" }, { status: 409 })
  }

  console.error("[system-config] błąd obsługi żądania:", error)
  return NextResponse.json({ error: "internal-error" }, { status: 500 })
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505"
}
