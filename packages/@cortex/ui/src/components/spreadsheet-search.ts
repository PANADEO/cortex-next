export interface SpreadsheetSearchTerm {
  key: string
  value: string
  numericValue: string | null
  allowSubstring: boolean
  weight: number
}

export interface SpreadsheetRowMatch {
  rowIndex: number
  score: number
  matchedTermCount: number
  matchedCellIndexes: number[]
  matchedValues: string[]
}

export interface SpreadsheetSheetData {
  name: string
  rows: string[][]
}

export interface SpreadsheetSheetMatch extends SpreadsheetRowMatch {
  sheetName: string
}

const MINIMUM_ACCEPTED_SCORE = 5
const MINIMUM_SUBSTRING_LENGTH = 4

export function normalizeSpreadsheetText(value: string | number | null | undefined): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
}

export function normalizeSpreadsheetNumericValue(
  value: string | number | null | undefined,
): string | null {
  const text = String(value ?? "")
    .trim()
    .replace(/\s+/g, "")
    .replace(",", ".")
  if (!text) return null
  const parsed = Number(text)
  return Number.isFinite(parsed) ? parsed.toString() : null
}

function getCellScore(cell: string, term: SpreadsheetSearchTerm): number {
  const normalizedCell = normalizeSpreadsheetText(cell)
  if (!normalizedCell) return 0

  if (normalizedCell === term.value) return term.weight

  const numericCell = normalizeSpreadsheetNumericValue(cell)
  if (term.numericValue && numericCell && numericCell === term.numericValue) return term.weight

  if (
    term.allowSubstring &&
    term.value.length >= MINIMUM_SUBSTRING_LENGTH &&
    normalizedCell.includes(term.value)
  ) {
    return term.weight * 0.7
  }

  return 0
}

export function findBestSpreadsheetRowMatch(
  rows: string[][],
  terms: SpreadsheetSearchTerm[],
): SpreadsheetRowMatch | null {
  if (terms.length === 0) return null

  const matches: SpreadsheetRowMatch[] = []

  rows.forEach((row, rowIndex) => {
    let score = 0
    let matchedTermCount = 0
    const matchedCellIndexes = new Set<number>()
    const matchedValues = new Set<string>()

    for (const term of terms) {
      let bestTermScore = 0
      let bestCellIndex: number | null = null
      let bestCellValue = ""

      row.forEach((cell, cellIndex) => {
        const cellScore = getCellScore(cell, term)
        if (cellScore > bestTermScore) {
          bestTermScore = cellScore
          bestCellIndex = cellIndex
          bestCellValue = cell
        }
      })

      if (bestTermScore > 0 && bestCellIndex !== null) {
        score += bestTermScore
        matchedTermCount += 1
        matchedCellIndexes.add(bestCellIndex)
        matchedValues.add(bestCellValue)
      }
    }

    if (score > 0) {
      matches.push({
        rowIndex,
        score,
        matchedTermCount,
        matchedCellIndexes: Array.from(matchedCellIndexes),
        matchedValues: Array.from(matchedValues),
      })
    }
  })

  matches.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    if (b.matchedTermCount !== a.matchedTermCount) return b.matchedTermCount - a.matchedTermCount
    return a.rowIndex - b.rowIndex
  })

  const best = matches[0]
  return best && best.score >= MINIMUM_ACCEPTED_SCORE ? best : null
}

export function findBestSpreadsheetSheetMatch(
  sheets: SpreadsheetSheetData[],
  terms: SpreadsheetSearchTerm[],
): SpreadsheetSheetMatch | null {
  const matches = sheets
    .map((sheet) => {
      const rowMatch = findBestSpreadsheetRowMatch(sheet.rows, terms)
      return rowMatch ? { ...rowMatch, sheetName: sheet.name } : null
    })
    .filter((match): match is SpreadsheetSheetMatch => match !== null)

  matches.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    if (b.matchedTermCount !== a.matchedTermCount) return b.matchedTermCount - a.matchedTermCount
    return a.rowIndex - b.rowIndex
  })

  return matches[0] ?? null
}
