import { VISUAL_GURU_APP_CODE, requireTileAccess } from "@cortex/service"
import { NextResponse } from "next/server"

export interface VisualGuruAccessGranted {
  allowed: true
  /** JEDYNE dozwolone źródło userEmail dla warstwy serwisowej
   *  (code-service/SKILL.md "Rekordy per-user" pkt 3) — nigdy z body/query. */
  email: string
}

export interface VisualGuruAccessDenied {
  allowed: false
  response: NextResponse
}

/**
 * Bramka kafelka — jeden poziom dostępu (D7, design doc §2): Visual Guru nie
 * ma zasobu współdzielonego do zarządzania, więc brak drugiej, granularnej
 * bramki (requireTileScope) jak w Ilustromacie. Zwraca albo e-mail
 * uwierzytelnionego użytkownika, albo gotową odpowiedź odmowną — wołający
 * nigdy nie sięga po nagłówek samodzielnie.
 */
export async function requireVisualGuruAccess(
  request: Request,
): Promise<VisualGuruAccessGranted | VisualGuruAccessDenied> {
  const access = await requireTileAccess(request, VISUAL_GURU_APP_CODE)
  if (access.allowed && access.email) return { allowed: true, email: access.email }
  return { allowed: false, response: denial(access.email) }
}

// Brak tożsamości to 401, tożsamość bez grantu to 403 — rozróżnienie ma
// znaczenie dla klienta (zaloguj się vs poproś o uprawnienia).
function denial(email: string | null): NextResponse {
  return email
    ? NextResponse.json({ error: "forbidden" }, { status: 403 })
    : NextResponse.json({ error: "missing-email" }, { status: 401 })
}

/**
 * Błąd wywołania modelu przez cortex-proxy — upstream, nie my.
 *
 * Sam KOD, bez napisu, dokładnie jak w bliźniaczej bramce Ilustromatu: serwer
 * nie zna języka użytkownika (wybór siedzi w localStorage przeglądarki), a
 * `error.message` z adaptera jest diagnostyką do logu wyżej. Zdanie powstaje
 * na kliencie — generator.errors.generateFailed.
 */
export function toUpstreamErrorResponse(error: unknown): NextResponse {
  console.error("[visual-guru] błąd cortex-proxy:", error)
  return NextResponse.json({ error: "upstream-error" }, { status: 502 })
}

/** Błędy warstwy serwisowej/nieoczekiwane — 500, nie zdradzamy szczegółów. */
export function toErrorResponse(error: unknown): NextResponse {
  console.error("[visual-guru] błąd obsługi żądania:", error)
  return NextResponse.json({ error: "internal-error" }, { status: 500 })
}
