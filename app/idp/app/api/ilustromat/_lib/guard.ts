import { InvalidColorError } from "@/lib/ilustromat/color"
import { MissingFontFileError } from "@/lib/ilustromat/composer"
import { UnreadableFontError, type UnreadableFontReason } from "@/lib/ilustromat/glyph-coverage"
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

/** Powód odrzucenia fontu -> klucz zdania w przestrzeni `ilustromat`. */
const UNREADABLE_FONT_MESSAGE_KEYS: Record<UnreadableFontReason, string> = {
  unparsable: "errors.fontUnparsable",
  "font-collection": "errors.fontCollection",
  "no-family-name": "errors.fontNoFamilyName",
}

/**
 * Mapuje wyjątki warstwy serwisowej i renderującej na odpowiedzi HTTP.
 *
 * Ciało niesie KLUCZ komunikatu i jego parametry, nie gotowe zdanie: serwer
 * nie zna języka użytkownika (wybór siedzi w localStorage przeglądarki), więc
 * napis powstaje na kliencie (lib/i18n/api-error.ts), wzorem
 * lib/document-parser/constraints.ts. Samo skasowanie `message` byłoby tu
 * REGRESEM — w odróżnieniu od błędu upstreamu te wyjątki niosą KONKRET (który
 * szablon, który plik, dlaczego), a ogólny zapas wołającego („Nie udało się
 * zapisać szablonu") tej informacji nie odtworzy. `error.message` zostaje
 * diagnostyką do logu i do asercji testów.
 */
export function toErrorResponse(error: unknown): NextResponse {
  if (error instanceof TemplateNotFoundError || error instanceof UnknownTemplateError) {
    return NextResponse.json(
      {
        error: "not-found",
        messageKey: "errors.templateMissing",
        messageParams: { id: error.templateId },
      },
      { status: 404 },
    )
  }

  // Błędy WEJŚCIA użytkownika (zły plik fontu/logo, zły kolor) to 400 — nie
  // awaria serwera, tylko coś, co wołający może poprawić.
  //
  // Trzy powody nieczytelnego fontu, trzy różne rady dla użytkownika —
  // dlatego `reason` jest kodem, a nie zdaniem. `detail` (diagnostyka
  // fontkita, po angielsku) ma sens wyłącznie tam, gdzie plik w ogóle nie dał
  // się sparsować.
  if (error instanceof UnreadableFontError) {
    return NextResponse.json(
      {
        error: "invalid-asset",
        messageKey: UNREADABLE_FONT_MESSAGE_KEYS[error.reason],
        messageParams: { detail: error.detail },
      },
      { status: 400 },
    )
  }

  if (error instanceof InvalidLogoError) {
    return NextResponse.json(
      {
        error: "invalid-asset",
        messageKey: "errors.logoUnreadable",
        messageParams: { detail: error.detail },
      },
      { status: 400 },
    )
  }

  if (error instanceof InvalidColorError) {
    return NextResponse.json(
      {
        error: "invalid-asset",
        messageKey: "errors.invalidColor",
        messageParams: { value: error.value },
      },
      { status: 400 },
    )
  }

  // Brakujący plik fontu to niespójny STAN szablonu, nie zły request — 500 jest
  // tu właściwe. Nigdy nie degradujemy tego do cichego renderu fontem
  // zastępczym; taki kafelek wyglądałby "prawie dobrze".
  if (error instanceof MissingFontFileError) {
    console.error("[ilustromat] szablon bez kompletu plików fontu:", error)
    return NextResponse.json(
      {
        error: "template-font-missing",
        messageKey: "errors.fontFileMissing",
        messageParams: { path: error.path },
      },
      { status: 500 },
    )
  }

  if (error instanceof IncompleteCustomFontError) {
    console.error("[ilustromat] szablon bez kompletu plików fontu:", error)
    return NextResponse.json(
      {
        error: "template-font-missing",
        messageKey: "errors.incompleteCustomFont",
        messageParams: { id: error.templateId, kind: error.kind },
      },
      { status: 500 },
    )
  }

  if (isUniqueViolation(error)) {
    return NextResponse.json({ error: "duplicate" }, { status: 409 })
  }

  console.error("[ilustromat] błąd obsługi żądania:", error)
  return NextResponse.json({ error: "internal-error" }, { status: 500 })
}

/**
 * Błąd wywołania modelu przez cortex-proxy — upstream, nie my.
 *
 * Sam KOD, bez napisu: serwer nie zna języka użytkownika (wybór siedzi w
 * localStorage przeglądarki), więc zdanie powstaje na kliencie
 * (toasts.generateFailed / toasts.assistFailed). `error.message` z adaptera
 * jest diagnostyką do logu wyżej, nie zdaniem dla człowieka — przepuszczony
 * do ciała odpowiedzi trafiał na ekran po polsku, niezależnie od wyboru
 * języka.
 */
export function toUpstreamErrorResponse(error: unknown): NextResponse {
  console.error("[ilustromat] błąd cortex-proxy:", error)
  return NextResponse.json({ error: "upstream-error" }, { status: 502 })
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505"
}
