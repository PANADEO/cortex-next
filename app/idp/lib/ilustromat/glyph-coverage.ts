// Weryfikacja wgranego fontu — port check_polish_glyph_coverage() z
// core/templates.py (tam: fontTools.TTFont().getBestCmap()).
//
// `fontkit` to czysty JS, bez binarek natywnych, i rozwiązuje DWA problemy
// naraz, dlatego jest jedną zależnością zamiast dwóch:
//   1. pokrycie polskich znaków (to, co robił fontTools),
//   2. nazwę rodziny fontu — bez niej opis Pango nie ma czego podać, a Pango
//      po cichu dobiera inny font (LUKA 3 projektu).
//
// Alternatywę "wyrenderuj i poszukaj tofu" świadomie odrzucam — jest zawodna
// (brakujący glif bywa renderowany jako spacja, nie jako widoczny prostokąt).

import * as fontkit from "fontkit"
import { REQUIRED_POLISH_CHARS } from "./presets"

export interface FontInspection {
  /** Nazwa rodziny widziana przez Pango. */
  family: string
  /** BRAKUJĄCE wymagane polskie znaki — pusta lista = pełne pokrycie. */
  missingPolishChars: string[]
}

/**
 * POWÓD odrzucenia jako KOD, nie zdanie. Trzy przypadki różnią się tym, co
 * użytkownik ma zrobić dalej, więc kontroler musi je rozróżnić, żeby wybrać
 * właściwy klucz tłumaczenia — samo `message` byłoby napisem w jednym języku,
 * wpisanym na stałe w kodzie.
 */
export type UnreadableFontReason = "unparsable" | "font-collection" | "no-family-name"

/** Zdania diagnostyczne dla LOGU i `Error.stack` — nie trafiają na ekran. */
const UNREADABLE_FONT_DIAGNOSTICS: Record<UnreadableFontReason, string> = {
  unparsable: "plik nie daje się sparsować",
  "font-collection": "plik zawiera kolekcję krojów (.ttc)",
  "no-family-name": "plik nie deklaruje nazwy rodziny (name table)",
}

export class UnreadableFontError extends Error {
  /** Pola STRUKTURALNE dla kontrolera: `reason` wybiera klucz komunikatu,
   *  `detail` niesie surową diagnostykę parsera (pusta poza `unparsable`). */
  readonly reason: UnreadableFontReason
  readonly detail: string

  constructor(reason: UnreadableFontReason, detail = "") {
    const diagnostics = UNREADABLE_FONT_DIAGNOSTICS[reason]
    super(
      `Nie udało się odczytać pliku fontu: ${detail ? `${diagnostics} (${detail})` : diagnostics}`,
    )
    this.name = "UnreadableFontError"
    this.reason = reason
    this.detail = detail
  }
}

/**
 * Otwiera font z bufora i sprawdza go pod kątem wymagań produktu.
 * Rzuca przy pliku, którego nie da się sparsować — świadomie, zamiast
 * zwracać "brak pokrycia" i pozwolić zapisać uszkodzony plik jako szablon.
 */
export function inspectFont(bytes: Buffer): FontInspection {
  let font: ReturnType<typeof fontkit.create>
  try {
    font = fontkit.create(bytes)
  } catch (error) {
    throw new UnreadableFontError(
      "unparsable",
      error instanceof Error ? error.message : String(error),
    )
  }

  // Kolekcja (.ttc) nie ma jednej rodziny ani jednego cmapa — kreator przyjmuje
  // pojedynczy krój, więc odrzucamy ją jawnie zamiast zgadywać, który wariant.
  if (!("hasGlyphForCodePoint" in font) || typeof font.hasGlyphForCodePoint !== "function") {
    throw new UnreadableFontError("font-collection")
  }

  const family = font.familyName?.trim()
  if (!family) {
    throw new UnreadableFontError("no-family-name")
  }

  const missingPolishChars = [...REQUIRED_POLISH_CHARS].filter(
    (char) => !font.hasGlyphForCodePoint(char.codePointAt(0)!),
  )

  return { family, missingPolishChars }
}
