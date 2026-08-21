// Opis fontu dla Pango. Testowana jest JEDNA rzecz, ale najgroźniejsza
// w całym module: czy nazwa rodziny dociera do silnika tekstu w całości.
//
// Pango parsuje opis jako "[FAMILY-LIST] [STYLE-OPTIONS] [SIZE]" i zjada
// z KOŃCA nazwy rodziny każde słowo, które rozpozna jako styl/wagę/szerokość.
// Rodziny użyte niżej to nie przypadki teoretyczne — to zmierzone w Alpine
// ofiary tego parsowania (Times New Roman, Arial Black), przy których render
// wychodził cudzym krojem CICHO, bez błędu. Georgia jest kontrolą: rodzina
// bez słowa kluczowego nie może ucierpieć na poprawce.

import { describe, expect, it } from "vitest"
import { pangoFontDescription } from "./pango"

/** Ostatnie słowo każdej z tych rodzin jest słowem kluczowym Pango. */
const KEYWORD_FAMILIES = [
  "Times New Roman",
  "Arial Black",
  "Gotham Book",
  "Futura Medium",
  "Helvetica Neue Light",
  "Trade Gothic Condensed",
  "Noto Sans Italic",
] as const

describe("pangoFontDescription()", () => {
  it("kończy listę rodzin przecinkiem, więc nazwa nie jest obcinana o słowo kluczowe", () => {
    for (const family of KEYWORD_FAMILIES) {
      expect(pangoFontDescription({ family, bold: false, size: 64 })).toBe(`${family}, 64`)
      expect(pangoFontDescription({ family, bold: true, size: 64 })).toBe(`${family}, Bold 64`)
    }
  })

  it("zachowuje pełną nazwę rodziny przed jakimkolwiek stylem i rozmiarem", () => {
    for (const family of [...KEYWORD_FAMILIES, "Georgia", "Noto Sans"]) {
      const description = pangoFontDescription({ family, bold: true, size: 44 })
      const [familyList, rest] = description.split(",")
      expect(familyList).toBe(family)
      expect(rest).toBe(" Bold 44")
    }
  })

  it("dla rodziny bez słowa kluczowego jest bezstratna wobec zwykłego przypadku", () => {
    expect(pangoFontDescription({ family: "Georgia", bold: false, size: 64 })).toBe("Georgia, 64")
    expect(pangoFontDescription({ family: "Noto Sans", bold: false, size: 44 })).toBe(
      "Noto Sans, 44",
    )
  })

  it("waga jedzie w opisie, bo sam plik fontu jej nie narzuca (LUKA 3)", () => {
    expect(pangoFontDescription({ family: "Noto Sans", bold: true, size: 44 })).toBe(
      "Noto Sans, Bold 44",
    )
  })
})
