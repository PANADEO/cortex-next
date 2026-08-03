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
