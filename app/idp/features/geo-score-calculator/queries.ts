import { apiClient } from "@cortex/api"
import type { AnalyzeGeoScoreRequestDto, AnalyzeGeoScoreResponseDto } from "./types"

const BASE = "/api/geo-score-calculator"

export const endpoints = {
  analyze: (body: AnalyzeGeoScoreRequestDto) =>
    apiClient.post<AnalyzeGeoScoreResponseDto>(`${BASE}/analyze`, { jsonBody: body }),
}
