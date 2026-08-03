import { describe, expect, it } from "vitest"
import { findMatchedForbiddenPhrases, resolveGenerationStatus } from "./forbidden-phrase-check"

describe("findMatchedForbiddenPhrases", () => {
  it("zwraca [] gdy lista zakazanych fraz jest pusta", () => {
    expect(findMatchedForbiddenPhrases("dowolna treść", [])).toEqual([])
  })

  it("zwraca [] gdy treść jest pusta", () => {
    expect(findMatchedForbiddenPhrases("", ["fraza"])).toEqual([])
  })

  it("łapie dokładne dopasowanie podłańcuchowe", () => {
    expect(findMatchedForbiddenPhrases("Jesteśmy liderem rynku.", ["liderem rynku"])).toEqual([
      "liderem rynku",
    ])
  })

  it("jest case-insensitive w obie strony", () => {
    expect(findMatchedForbiddenPhrases("Jesteśmy NAJLEPSI w branży.", ["najlepsi"])).toEqual([
      "najlepsi",
    ])
    expect(findMatchedForbiddenPhrases("jesteśmy najlepsi w branży.", ["NAJLEPSI"])).toEqual([
      "NAJLEPSI",
    ])
  })

  it("zwraca frazę w DOSŁOWNYM zapisie z listy usera, nie z treści", () => {
    const result = findMatchedForbiddenPhrases("Firma jest NR 1 na rynku.", ["nr 1"])
    expect(result).toEqual(["nr 1"])
  })

  it("nie łapie fraz, których nie ma w treści", () => {
    expect(findMatchedForbiddenPhrases("Neutralny tekst bez niczego złego.", ["gwarancja"])).toEqual(
      [],
    )
  })

  it("łapie wiele różnych fraz naraz, w kolejności listy usera", () => {
    const result = findMatchedForbiddenPhrases(
      "Oferujemy gwarancję sukcesu i jesteśmy liderem rynku.",
      ["liderem rynku", "gwarancję sukcesu", "nieużywana fraza"],
    )
    expect(result).toEqual(["liderem rynku", "gwarancję sukcesu"])
  })

  it("dedupikuje frazy różniące się tylko wielkością liter na liście usera", () => {
    const result = findMatchedForbiddenPhrases("Nasz produkt to Gwarancja jakości.", [
      "gwarancja jakości",
      "Gwarancja jakości",
      "GWARANCJA JAKOŚCI",
    ])
    expect(result).toEqual(["gwarancja jakości"])
  })

  it("ignoruje puste/białoznakowe wpisy na liście fraz", () => {
    expect(findMatchedForbiddenPhrases("dowolna treść", ["", "   "])).toEqual([])
  })

  it("przycina białe znaki wokół frazy przed porównaniem", () => {
    expect(findMatchedForbiddenPhrases("zawiera frazę testową", ["  frazę testową  "])).toEqual([
      "frazę testową",
    ])
  })
})

describe("resolveGenerationStatus", () => {
  it("zwraca 'done' gdy brak dopasowań", () => {
    expect(resolveGenerationStatus([])).toBe("done")
  })

  it("zwraca 'done-with-warnings' gdy jest co najmniej jedno dopasowanie", () => {
    expect(resolveGenerationStatus(["fraza"])).toBe("done-with-warnings")
  })
})
