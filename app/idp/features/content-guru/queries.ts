import { apiClient } from "@cortex/api"
import type {
  ContentGuruConfigDto,
  GenerateContentRequestDto,
  GenerateContentResponseDto,
} from "./types"

const BASE = "/api/content-guru"

export const queryKeys = {
  all: ["content-guru"] as const,
  config: () => [...queryKeys.all, "config"] as const,
}

export const endpoints = {
  config: () => apiClient.get<ContentGuruConfigDto>(`${BASE}/config`),
  generate: (body: GenerateContentRequestDto) =>
    apiClient.post<GenerateContentResponseDto>(`${BASE}/generate`, { jsonBody: body }),
}
