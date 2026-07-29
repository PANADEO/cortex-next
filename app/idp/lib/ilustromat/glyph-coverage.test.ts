// Weryfikacja wgrywanego fontu na PRAWDZIWYCH plikach, nie na atrapach —
// "czy ten font ma polskie znaki" to pytanie o zawartość binarki, więc mock
// niczego by tu nie dowiódł.

import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { resolveFontLibraryEntry } from "./font-library"
import { UnreadableFontError, inspectFont } from "./glyph-coverage"
import { REQUIRED_POLISH_CHARS } from "./presets"

const entry = resolveFontLibraryEntry("noto-sans")

describe("inspectFont", () => {
  it("czyta nazwę rodziny, której potrzebuje opis Pango", () => {
    // LUKA 3: gdyby ta nazwa nie zgadzała się z zawartością pliku, Pango po
    // cichu dobrałby inny krój — dlatego zapisujemy ją razem z plikiem.
    expect(inspectFont(readFileSync(entry.regularPath)).family).toBe("Noto Sans")
    expect(inspectFont(readFileSync(entry.boldPath)).family).toBe("Noto Sans")
  })

  it("potwierdza pełne pokrycie polskich znaków w foncie z biblioteki", () => {
    expect(inspectFont(readFileSync(entry.regularPath)).missingPolishChars).toEqual([])
    expect(inspectFont(readFileSync(entry.boldPath)).missingPolishChars).toEqual([])
  })

  it("sprawdza komplet wymaganych znaków, nie próbkę", () => {
    // Test testu: gdyby REQUIRED_POLISH_CHARS kiedyś się skurczyło do pustego
    // zestawu, powyższe asercje przechodziłyby trywialnie.
    expect(REQUIRED_POLISH_CHARS.length).toBe(18)
  })

  it("rzuca na pliku, który nie jest fontem, zamiast zwracać 'brak pokrycia'", () => {
    // Uszkodzony plik MUSI zatrzymać zapis szablonu — inaczej dałoby się
    // utrwalić szablon, którego nigdy nie da się wyrenderować.
    expect(() => inspectFont(Buffer.from("to zdecydowanie nie jest font"))).toThrow(
      UnreadableFontError,
    )
  })

  it("odrzuca kolekcję krojów (.ttc) jawnym komunikatem", () => {
    // Nagłówek kolekcji TrueType: "ttcf" + wersja + liczba krojów.
    const header = Buffer.alloc(16)
    header.write("ttcf", 0, "ascii")
    header.writeUInt32BE(0x00010000, 4)
    header.writeUInt32BE(0, 8)

    expect(() => inspectFont(header)).toThrow(UnreadableFontError)
  })
})
