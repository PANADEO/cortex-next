// Kontrakt klient<->BFF. Kształt odpowiada temu, co zwraca
// POST /api/geo-score-calculator/analyze — 1:1 z AnalyzeGeoScoreResponse w
// lib/geo-score-calculator/integration-client.ts (kontrakt Next<->Python),
// bo kontroler dziś zwraca tę odpowiedź bez transformacji. Zdublowane celowo:
// to jest DTO warstwy klienta (features/), integration-client.ts jest
// server-only (code-integration) i nie wolno go importować z komponentu.

export interface PositionedMatchDto {
  value: string
  position: number
}

export type GeoScoreGrade = "A" | "B" | "C" | "D" | "F"

export interface AnalyzeGeoScoreRequestDto {
  text: string
}

export interface AnalyzeGeoScoreResponseDto {
  totalScore: number
  grade: GeoScoreGrade
  wordCount: number
  statistics: {
    score: number
    count: number
    per100Words: number
    examples: PositionedMatchDto[]
  }
  actionVerbs: {
    score: number
    actionVerbCount: number
    totalVerbCount: number
    ratio: number
    foundVerbs: string[]
    method: "spacy" | "heuristic"
  }
  structure: {
    score: number
    bulletCount: number
    per500Words: number
    hasHeaders: boolean
    paragraphCount: number
  }
  objectivity: {
    score: number
    subjectiveCount: number
    subjectiveRatio: number
    foundWords: PositionedMatchDto[]
  }
  recommendations: string[]
}

/**
 * Wiersz `/api/geo-score-calculator/history` (lista) — DTO trymowana do
 * kolumn `CortexDataGrid` (data/podgląd/wynik/ocena/słowa). Bez
 * textContent/result/configSnapshot — te trzy pola bywają duże i są
 * niepotrzebne na liście, patrz `GeoScoreCalculationDetailDto` niżej.
 */
export interface GeoScoreCalculationSummaryDto {
  id: string
  textPreview: string
  wordCount: number
  totalScore: number
  grade: GeoScoreGrade
  createdAt: string
}

/**
 * Wiersz `/api/geo-score-calculator/history/:id` (szczegóły) — PEŁNY,
 * łącznie z `result` (do renderu tym samym `GeoScoreResultView` co Kalkulator)
 * i `configSnapshot` (audytowalność, design doc §4.3).
 */
export interface GeoScoreCalculationDetailDto {
  id: string
  textContent: string
  textPreview: string
  wordCount: number
  totalScore: number
  grade: GeoScoreGrade
  statsScore: number
  verbsScore: number
  structureScore: number
  objectivityScore: number
  result: AnalyzeGeoScoreResponseDto
  configSnapshot: unknown
  createdAt: string
}
