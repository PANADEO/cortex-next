import { InvalidColorError } from "@/lib/ilustromat/color"
import { MissingFontFileError } from "@/lib/ilustromat/composer"
import { UnreadableFontError } from "@/lib/ilustromat/glyph-coverage"
import { InvalidLogoError } from "@/lib/ilustromat/logo"
import { IncompleteCustomFontError, TemplateNotFoundError } from "@/lib/ilustromat/render"
import {
  ILUSTROMAT_APP_CODE,
  MANAGE_TEMPLATES_SCOPE,
  UnknownTemplateError,
  requireTileAccess,
  requireTileScope,
} from "@cortex/service"
import { NextResponse } from "next/server"

/**
 * Bramka kafelka. Zwraca gotową odpowiedź odmowną albo null, gdy wolno
 * przepuścić dalej. Kolejność wg code-api/SKILL.md: auth PRZED jakąkolwiek pracą.
 */
export async function denyUnlessAllowed(request: Request): Promise<NextResponse | null> {
  const access = await requireTileAccess(request, ILUSTROMAT_APP_CODE)
  if (access.allowed) return null
  return denial(access.email)
}

/**
 * Druga, GRANULARNA bramka — dla akcji zmieniających markę ("Szablony marki").
 * requireTileScope() sprawdza obie warstwy naraz, więc dostęp do kafelka nie
 * wystarcza: trzeba mieć jawny grant scope'u. Odczyt szablonów celowo jej NIE
 * wymaga — end-user musi widzieć listę szablonów, żeby wybrać jeden do generacji.
 */
export async function denyUnlessTemplateManager(request: Request): Promise<NextResponse | null> {
  const access = await requireTileScope(request, ILUSTROMAT_APP_CODE, MANAGE_TEMPLATES_SCOPE)
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

/** Mapuje wyjątki warstwy serwisowej i renderującej na odpowiedzi HTTP. */
export function toErrorResponse(error: unknown): NextResponse {
  if (error instanceof TemplateNotFoundError || error instanceof UnknownTemplateError) {
    return NextResponse.json({ error: "not-found", message: error.message }, { status: 404 })
  }

  // Błędy WEJŚCIA użytkownika (zły plik fontu/logo, zły kolor) to 400 — nie
  // awaria serwera, tylko coś, co wołający może poprawić.
  if (
    error instanceof UnreadableFontError ||
    error instanceof InvalidLogoError ||
    error instanceof InvalidColorError
  ) {
    return NextResponse.json({ error: "invalid-asset", message: error.message }, { status: 400 })
  }

  // Brakujący plik fontu to niespójny STAN szablonu, nie zły request — 500 jest
  // tu właściwe. Nigdy nie degradujemy tego do cichego renderu fontem
  // zastępczym; taki kafelek wyglądałby "prawie dobrze".
  if (error instanceof MissingFontFileError || error instanceof IncompleteCustomFontError) {
    console.error("[ilustromat] szablon bez kompletu plików fontu:", error)
    return NextResponse.json(
      { error: "template-font-missing", message: error.message },
      { status: 500 },
    )
  }

  if (isUniqueViolation(error)) {
    return NextResponse.json({ error: "duplicate" }, { status: 409 })
  }

  console.error("[ilustromat] błąd obsługi żądania:", error)
  return NextResponse.json({ error: "internal-error" }, { status: 500 })
}

/** Błąd wywołania modelu przez cortex-proxy — upstream, nie my. */
export function toUpstreamErrorResponse(error: unknown): NextResponse {
  console.error("[ilustromat] błąd cortex-proxy:", error)
  const message = error instanceof Error ? error.message : "Błąd komunikacji z modelem"
  return NextResponse.json({ error: "upstream-error", message }, { status: 502 })
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505"
}
