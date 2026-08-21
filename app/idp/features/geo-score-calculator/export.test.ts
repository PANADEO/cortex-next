import { describe, expect, it } from "vitest"
import { buildHistoryCsv, buildHistoryJson, escapeCsvField } from "./export"
import type { GeoScoreCalculationSummaryDto } from "./types"

const ROWS: GeoScoreCalculationSummaryDto[] = [
  {
    id: "calc-1",
    textPreview: "Spółka zainwestowała 5 mln w nowy zakład.",
    wordCount: 7,
    totalScore: 82.4,
    grade: "B",
    createdAt: "2026-08-03T10:00:00.000Z",
  },
  {
    id: "calc-2",
    textPreview: 'Tekst z "cudzysłowem", przecinkiem, i, nową\nlinią',
    wordCount: 5,
    totalScore: 25,
    grade: "F",
    createdAt: "2026-08-02T09:30:00.000Z",
  },
]

describe("buildHistoryCsv", () => {
  it("produkuje poprawny CSV z BOM, nagłówkiem i wierszami — parsowalny wprost", () => {
    const csv = buildHistoryCsv(ROWS)

    expect(csv.startsWith("﻿")).toBe(true)
    const withoutBom = csv.slice(1)
    const lines = withoutBom.split("\r\n")

    expect(lines[0]).toBe("Data,Podgląd tekstu,Wynik,Ocena,Liczba słów")
    expect(lines[1]).toBe(
      "2026-08-03T10:00:00.000Z,Spółka zainwestowała 5 mln w nowy zakład.,82.4,B,7",
    )

    // Pole z cudzysłowem/przecinkiem/nową linią musi być poprawnie zacytowane
    // wg RFC 4180 — sprawdzamy przez realny round-trip parsera, nie tylko
    // przez oczekiwany literał (dowód, że plik faktycznie da się z powrotem
    // odczytać, nie tylko że "wygląda podobnie"). parsed[0]=nagłówek,
    // parsed[1]=ROWS[0] (prosty), parsed[2]=ROWS[1] (ze znakami specjalnymi).
    const parsed = parseCsv(withoutBom)
    expect(parsed).toHaveLength(3)
    expect(parsed[2]).toEqual([
      "2026-08-02T09:30:00.000Z",
      'Tekst z "cudzysłowem", przecinkiem, i, nową\nlinią',
      "25.0",
      "F",
      "5",
    ])
  })

  it("neutralizuje wiodące = + - @ apostrofem — ochrona przed CSV injection z podglądu wklejonego tekstu", () => {
    const csv = buildHistoryCsv([{ ...ROWS[0]!, textPreview: "=CMD('calc.exe')" }])
    const parsed = parseCsv(csv.slice(1))
    expect(parsed[1]?.[1]).toBe("'=CMD('calc.exe')")
  })

  it("pusta historia: tylko BOM + nagłówek", () => {
    const csv = buildHistoryCsv([])
    expect(csv).toBe("﻿Data,Podgląd tekstu,Wynik,Ocena,Liczba słów")
  })
})

describe("buildHistoryJson", () => {
  it("produkuje poprawny, parsowalny JSON z DOKŁADNIE tymi samymi danymi", () => {
    const json = buildHistoryJson(ROWS)
    const parsed = JSON.parse(json)

    expect(parsed).toEqual(ROWS)
  })
})

describe("escapeCsvField", () => {
  it("nie cytuje pól bez znaków specjalnych", () => {
    expect(escapeCsvField("zwykly-tekst")).toBe("zwykly-tekst")
  })

  it("cytuje i podwaja cudzysłowy wewnętrzne", () => {
    expect(escapeCsvField('ma "cudzysłów"')).toBe('"ma ""cudzysłów"""')
  })
})

/** Minimalny, poprawny parser CSV (RFC 4180: cudzysłów, podwojony cudzysłów,
 *  przecinek/nowa linia wewnątrz pola) — używany WYŁĄCZNIE w teście, żeby
 *  dowieść, że wygenerowany plik faktycznie da się odczytać z powrotem, nie
 *  tylko że wygląda poprawnie na oko. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]!
    if (inQuotes) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"'
        i++
      } else if (char === '"') {
        inQuotes = false
      } else {
        field += char
      }
    } else if (char === '"') {
      inQuotes = true
    } else if (char === ",") {
      row.push(field)
      field = ""
    } else if (char === "\r" && text[i + 1] === "\n") {
      row.push(field)
      rows.push(row)
      row = []
      field = ""
      i++
    } else {
      field += char
    }
  }
  row.push(field)
  rows.push(row)
  return rows
}
