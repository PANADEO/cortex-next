import {
  ModuleNotLicensedError,
  NativeApplicationImmutableError,
  type NativeApplicationImmutableReason,
  NativeCreationNotAllowedError,
  OpenwebuiGroupAlreadyMappedError,
  SYSTEM_CONFIG_APP_CODE,
  SelfLockoutError,
  type SelfLockoutReason,
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

/** Powód samo-zablokowania -> klucz zdania w przestrzeni `system-config`.
 *  Eksportowana, żeby test wyprowadzał z niej przypadki zamiast przepisywać —
 *  nowy wariant `SelfLockoutReason` wymusza wtedy wpis TU, a nie w dwóch
 *  miejscach naraz. */
export const SELF_LOCKOUT_MESSAGE_KEYS: Record<SelfLockoutReason, string> = {
  "application-delete": "errors.selfLockout.applicationDelete",
  "application-code": "errors.selfLockout.applicationCode",
  "application-deactivate": "errors.selfLockout.applicationDeactivate",
  "application-target": "errors.selfLockout.applicationTarget",
  "application-roles": "errors.selfLockout.applicationRoles",
  "user-roles": "errors.selfLockout.userRoles",
  "role-applications": "errors.selfLockout.roleApplications",
  "user-active": "errors.selfLockout.userActive",
  "role-deleted": "errors.selfLockout.roleDeleted",
}

/** Powód niezmienności wiersza natywnego -> klucz zdania. Eksportowana z
 *  tego samego powodu co mapa wyżej. */
export const NATIVE_IMMUTABLE_MESSAGE_KEYS: Record<NativeApplicationImmutableReason, string> = {
  "kind-to-native": "errors.nativeImmutable.kindToNative",
  "identity-locked": "errors.nativeImmutable.identityLocked",
}

/**
 * Mapuje wyjątki warstwy serwisowej na odpowiedzi HTTP.
 *
 * Ciało niesie KLUCZ komunikatu i jego parametry, nie gotowe zdanie: serwer
 * nie zna języka użytkownika (wybór siedzi w localStorage przeglądarki), więc
 * napis powstaje na kliencie (lib/i18n/api-error.ts), wzorem
 * api/ilustromat/_lib/guard.ts. Samo skasowanie `message` byłoby tu REGRESEM —
 * te wyjątki niosą KONKRET („nie możesz odebrać sobie ostatniej roli
 * administratora", „ta grupa stoi już za rolą X"), a ogólny zapas wołającego
 * („Nie udało się zapisać ról") tej informacji nie odtworzy. `error.message`
 * zostaje diagnostyką do logu i do asercji testów.
 */
export function toErrorResponse(error: unknown): NextResponse {
  // PATCH waliduje reguły międzypolowe dopiero po scaleniu z wierszem w bazie,
  // czyli już w serwisie — bez tego błąd kształtu wracałby jako 500.
  if (error instanceof z.ZodError) {
    return NextResponse.json({ error: "invalid-request" }, { status: 400 })
  }

  if (error instanceof SelfLockoutError) {
    return NextResponse.json(
      { error: "self-lockout", messageKey: SELF_LOCKOUT_MESSAGE_KEYS[error.reason] },
      { status: 409 },
    )
  }

  if (error instanceof SystemRoleProtectedError) {
    return NextResponse.json(
      {
        error: "system-role-protected",
        messageKey: "errors.systemRoleProtected",
        messageParams: { name: error.roleName },
      },
      { status: 409 },
    )
  }

  if (error instanceof NativeCreationNotAllowedError) {
    return NextResponse.json(
      { error: "native-requires-activation", messageKey: "errors.nativeCreationNotAllowed" },
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
      {
        error: "module-not-licensed",
        messageKey: "errors.moduleNotLicensed",
        messageParams: { code: error.code },
      },
      { status: 403 },
    )
  }

  // 409 jak SelfLockoutError: żądanie jest poprawne, tylko kłóci się ze STANEM
  // danych (tę grupę trzyma już inna rola). Osobno od `duplicate-code` niżej,
  // bo TU umiemy nazwać kolidującą rolę — samo naruszenie UNIQUE(group_id)
  // wpadłoby tam i wróciło bez tej informacji.
  if (error instanceof OpenwebuiGroupAlreadyMappedError) {
    return NextResponse.json(
      {
        error: "openwebui-group-already-mapped",
        messageKey: "errors.openwebuiGroupAlreadyMapped",
        messageParams: { role: error.conflictingRoleCode },
      },
      { status: 409 },
    )
  }

  if (error instanceof NativeApplicationImmutableError) {
    return NextResponse.json(
      {
        error: "native-application-immutable",
        messageKey: NATIVE_IMMUTABLE_MESSAGE_KEYS[error.reason],
      },
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
