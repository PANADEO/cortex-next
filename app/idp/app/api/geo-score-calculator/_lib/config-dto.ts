// DTO wspólny dla GET/PUT config/route.ts i POST config/reset/route.ts —
// oba zwracają dokładnie ten sam kształt (pełny wiersz `config` minus `id`,
// który jest technicznym trikiem singletonu, nie polem, które ma sens po
// stronie klienta).

import type { ConfigRow } from "@cortex/db"

export interface GeoScoreConfigDto {
  weightStatistics: number
  weightActionVerbs: number
  weightStructure: number
  weightObjectivity: number
  benchmarkStats: number
  benchmarkVerbs: number
  benchmarkStructure: number
  benchmarkObjectivity: number
  gradeAMin: number
  gradeBMin: number
  gradeCMin: number
  gradeDMin: number
  actionVerbs: string[]
  subjectiveWords: string[]
  falsePositives: string[]
  bulletPatterns: string[]
  updatedAt: string
  updatedBy: string
}

export function toGeoScoreConfigDto(row: ConfigRow): GeoScoreConfigDto {
  return {
    weightStatistics: row.weightStatistics,
    weightActionVerbs: row.weightActionVerbs,
    weightStructure: row.weightStructure,
    weightObjectivity: row.weightObjectivity,
    benchmarkStats: row.benchmarkStats,
    benchmarkVerbs: row.benchmarkVerbs,
    benchmarkStructure: row.benchmarkStructure,
    benchmarkObjectivity: row.benchmarkObjectivity,
    gradeAMin: row.gradeAMin,
    gradeBMin: row.gradeBMin,
    gradeCMin: row.gradeCMin,
    gradeDMin: row.gradeDMin,
    actionVerbs: row.actionVerbs,
    subjectiveWords: row.subjectiveWords,
    falsePositives: row.falsePositives,
    bulletPatterns: row.bulletPatterns,
    updatedAt: row.updatedAt.toISOString(),
    updatedBy: row.updatedBy,
  }
}
