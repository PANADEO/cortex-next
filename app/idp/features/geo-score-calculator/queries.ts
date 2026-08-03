import { apiClient } from "@cortex/api"
import type {
  AnalyzeGeoScoreRequestDto,
  AnalyzeGeoScoreResponseDto,
  GeoScoreCalculationDetailDto,
  GeoScoreCalculationSummaryDto,
  GeoScoreConfigDto,
  UpdateGeoScoreConfigRequestDto,
} from "./types"

const BASE = "/api/geo-score-calculator"

export const queryKeys = {
  all: ["geo-score-calculator"] as const,
  history: () => [...queryKeys.all, "history"] as const,
  calculation: (id: string) => [...queryKeys.all, "history", id] as const,
  config: () => [...queryKeys.all, "config"] as const,
}

export const endpoints = {
  analyze: (body: AnalyzeGeoScoreRequestDto) =>
    apiClient.post<AnalyzeGeoScoreResponseDto>(`${BASE}/analyze`, { jsonBody: body }),
  history: {
    list: () => apiClient.get<GeoScoreCalculationSummaryDto[]>(`${BASE}/history`),
    get: (id: string) => apiClient.get<GeoScoreCalculationDetailDto>(`${BASE}/history/${id}`),
    remove: (id: string) => apiClient.delete<{ ok: true }>(`${BASE}/history/${id}`),
  },
  config: {
    get: () => apiClient.get<GeoScoreConfigDto>(`${BASE}/config`),
    update: (body: UpdateGeoScoreConfigRequestDto) =>
      apiClient.put<GeoScoreConfigDto>(`${BASE}/config`, { jsonBody: body }),
    reset: () => apiClient.post<GeoScoreConfigDto>(`${BASE}/config/reset`, {}),
  },
}
