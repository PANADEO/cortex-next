import { apiClient } from "@cortex/api"
import type {
  GenerateRequestDto,
  GenerateResponseDto,
  GenerationDetailDto,
  GenerationListItemDto,
} from "./types"

const BASE = "/api/visual-guru"

export const queryKeys = {
  all: ["visual-guru"] as const,
  history: () => [...queryKeys.all, "history"] as const,
  historyItem: (id: string) => [...queryKeys.all, "history", id] as const,
}

export const endpoints = {
  generate: (body: GenerateRequestDto) =>
    apiClient.post<GenerateResponseDto>(`${BASE}/generate`, { jsonBody: body }),
  history: {
    list: () => apiClient.get<GenerationListItemDto[]>(`${BASE}/history`),
    get: (id: string) => apiClient.get<GenerationDetailDto>(`${BASE}/history/${id}`),
    delete: (id: string) => apiClient.delete<{ deleted: true }>(`${BASE}/history/${id}`),
  },
}
