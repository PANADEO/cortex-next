import {
  SYSTEM_CONFIG_APP_CODE,
  ModuleNotLicensedError,
  NativeApplicationImmutableError,
  NativeCreationNotAllowedError,
  OpenwebuiGroupAlreadyMappedError,
  SelfLockoutError,
  SystemRoleProtectedError,
  requireTileAccess,
} from "@cortex/service"
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

  if (error instanceof SystemRoleProtectedError) {
    return NextResponse.json(
      { error: "system-role-protected", message: error.message },
      { status: 409 },
    )
  }

  if (error instanceof NativeCreationNotAllowedError) {
    return NextResponse.json(
      { error: "native-requires-activation", message: error.message },
      { status: 400 },
    )
  }

  // 403, nie 400/404/409: żądanie jest poprawne, moduł istnieje w rejestrze i
  // admin ma pełny grant do tego panelu — odmawia INSTANCJA, bo nie ma licencji
  // na ten moduł. To ta sama klasa odpowiedzi co odmowa bramki wyżej
  // (denyUnlessAllowed): "wiem, o co prosisz, i nie autoryzuję". 409 zostaje
  // zarezerwowane dla konfliktów ze STANEM danych (self-lockout, rola
  // systemowa, niezmienny wiersz native), a licencja stanem danych nie jest.
  if (error instanceof ModuleNotLicensedError) {
    return NextResponse.json(
      { error: "module-not-licensed", message: error.message },
      { status: 403 },
    )
  }

  // 409 jak SelfLockoutError: żądanie jest poprawne, tylko kłóci się ze STANEM
  // danych (tę grupę trzyma już inna rola). Osobno od `duplicate-code` niżej,
  // bo TU umiemy nazwać kolidującą rolę — samo naruszenie UNIQUE(group_id)
  // wpadłoby tam i wróciło bez tej informacji.
  if (error instanceof OpenwebuiGroupAlreadyMappedError) {
    return NextResponse.json(
      { error: "openwebui-group-already-mapped", message: error.message },
      { status: 409 },
    )
  }

  if (error instanceof NativeApplicationImmutableError) {
    return NextResponse.json(
      { error: "native-application-immutable", message: error.message },
      { status: 409 },
    )
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
