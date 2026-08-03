import { apiClient } from "@cortex/api"
import type {
  ClientProfileDto,
  ClientProfileInputDto,
  ContentGuruConfigDto,
  CreateGenerationJobRequestDto,
  CreateGenerationJobResponseDto,
  GenerateContentRequestDto,
  GenerateContentResponseDto,
  GenerationJobDto,
  MarketProfileDto,
  MarketProfileInputDto,
  TemplateDto,
  TemplateInputDto,
  TestTemplateGenerationRequestDto,
  TestTemplateGenerationResponseDto,
} from "./types"

const BASE = "/api/content-guru"

export const queryKeys = {
  all: ["content-guru"] as const,
  config: () => [...queryKeys.all, "config"] as const,
  templates: () => [...queryKeys.all, "templates"] as const,
  clientProfiles: () => [...queryKeys.all, "client-profiles"] as const,
  marketProfiles: () => [...queryKeys.all, "market-profiles"] as const,
  job: (id: string) => [...queryKeys.all, "jobs", id] as const,
}

export const endpoints = {
  config: () => apiClient.get<ContentGuruConfigDto>(`${BASE}/config`),
  generate: (body: GenerateContentRequestDto) =>
    apiClient.post<GenerateContentResponseDto>(`${BASE}/generate`, { jsonBody: body }),
  templates: {
    list: () => apiClient.get<TemplateDto[]>(`${BASE}/templates`),
    create: (body: TemplateInputDto) =>
      apiClient.post<TemplateDto>(`${BASE}/templates`, { jsonBody: body }),
    update: (id: string, body: TemplateInputDto) =>
      apiClient.put<TemplateDto>(`${BASE}/templates/${id}`, { jsonBody: body }),
    remove: (id: string) => apiClient.delete<{ deleted: true }>(`${BASE}/templates/${id}`),
    duplicate: (id: string) => apiClient.post<TemplateDto>(`${BASE}/templates/${id}/duplicate`),
    testGeneration: (body: TestTemplateGenerationRequestDto) =>
      apiClient.post<TestTemplateGenerationResponseDto>(`${BASE}/templates/test-generation`, {
        jsonBody: body,
      }),
  },
  clientProfiles: {
    list: () => apiClient.get<ClientProfileDto[]>(`${BASE}/client-profiles`),
    create: (body: ClientProfileInputDto) =>
      apiClient.post<ClientProfileDto>(`${BASE}/client-profiles`, { jsonBody: body }),
    update: (id: string, body: ClientProfileInputDto) =>
      apiClient.put<ClientProfileDto>(`${BASE}/client-profiles/${id}`, { jsonBody: body }),
    remove: (id: string) => apiClient.delete<{ deleted: true }>(`${BASE}/client-profiles/${id}`),
  },
  marketProfiles: {
    list: () => apiClient.get<MarketProfileDto[]>(`${BASE}/market-profiles`),
    create: (body: MarketProfileInputDto) =>
      apiClient.post<MarketProfileDto>(`${BASE}/market-profiles`, { jsonBody: body }),
    update: (id: string, body: MarketProfileInputDto) =>
      apiClient.put<MarketProfileDto>(`${BASE}/market-profiles/${id}`, { jsonBody: body }),
    remove: (id: string) => apiClient.delete<{ deleted: true }>(`${BASE}/market-profiles/${id}`),
  },
  jobs: {
    create: (body: CreateGenerationJobRequestDto) =>
      apiClient.post<CreateGenerationJobResponseDto>(`${BASE}/jobs`, { jsonBody: body }),
    get: (id: string) => apiClient.get<GenerationJobDto>(`${BASE}/jobs/${id}`),
  },
}
