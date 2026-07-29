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

export class UnreadableFontError extends Error {
  constructor(reason: string) {
    super(`Nie udało się odczytać pliku fontu: ${reason}`)
    this.name = "UnreadableFontError"
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
    throw new UnreadableFontError(error instanceof Error ? error.message : String(error))
  }

  // Kolekcja (.ttc) nie ma jednej rodziny ani jednego cmapa — kreator przyjmuje
  // pojedynczy krój, więc odrzucamy ją jawnie zamiast zgadywać, który wariant.
  if (!("hasGlyphForCodePoint" in font) || typeof font.hasGlyphForCodePoint !== "function") {
    throw new UnreadableFontError(
      "plik zawiera kolekcję krojów (.ttc); wgraj pojedynczy plik .ttf lub .otf",
    )
  }

  const family = font.familyName?.trim()
  if (!family) {
    throw new UnreadableFontError("plik nie deklaruje nazwy rodziny (name table)")
  }

  const missingPolishChars = [...REQUIRED_POLISH_CHARS].filter(
    (char) => !font.hasGlyphForCodePoint(char.codePointAt(0)!),
  )

  return { family, missingPolishChars }
}
