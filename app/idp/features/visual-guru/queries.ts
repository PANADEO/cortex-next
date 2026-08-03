import { apiClient } from "@cortex/api"
import type { GenerateRequestDto, GenerateResponseDto } from "./types"

const BASE = "/api/visual-guru"

export const endpoints = {
  generate: (body: GenerateRequestDto) =>
    apiClient.post<GenerateResponseDto>(`${BASE}/generate`, { jsonBody: body }),
}
