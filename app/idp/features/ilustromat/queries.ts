import { apiClient } from "@cortex/api"
import type {
  AssistRequestDto,
  ComposeRequestDto,
  FrameTemplateDto,
  FrameTemplateInputDto,
  GenerateRequestDto,
  GenerateResponseDto,
} from "./types"

const BASE = "/api/ilustromat"

export const queryKeys = {
  all: ["ilustromat"] as const,
  templates: (activeOnly?: boolean) => [...queryKeys.all, "templates", activeOnly ?? false] as const,
}

export const endpoints = {
  templates: {
    list: (activeOnly?: boolean) =>
      apiClient.get<FrameTemplateDto[]>(
        `${BASE}/templates`,
        activeOnly ? { params: { activeOnly: true } } : {},
      ),
    create: (body: FrameTemplateInputDto) =>
      apiClient.post<FrameTemplateDto>(`${BASE}/templates`, { jsonBody: body }),
    update: (id: string, template: FrameTemplateInputDto) =>
      apiClient.patch<FrameTemplateDto>(`${BASE}/templates/${id}`, {
        jsonBody: { action: "update", template },
      }),
    setActive: (id: string, isActive: boolean) =>
      apiClient.patch<FrameTemplateDto>(`${BASE}/templates/${id}`, {
        jsonBody: { action: "set-active", isActive },
      }),
    duplicate: (id: string) =>
      apiClient.patch<FrameTemplateDto>(`${BASE}/templates/${id}`, {
        jsonBody: { action: "duplicate" },
      }),
    remove: (id: string) => apiClient.delete<{ deleted: true }>(`${BASE}/templates/${id}`),
    /** Live preview kreatora — ta sama compose() co generacja produkcyjna. */
    preview: (id: string, body: Record<string, unknown>) =>
      apiClient.post<Blob>(`${BASE}/templates/${id}/preview`, { jsonBody: body, parse: "blob" }),
    uploadAsset: (id: string, kind: string, file: File) => {
      const form = new FormData()
      form.append("kind", kind)
      form.append("file", file)
      return apiClient.post<{ kind: string; fontFamily?: string }>(
        `${BASE}/templates/${id}/assets`,
        { body: form },
      )
    },
  },
  generate: (body: GenerateRequestDto) =>
    apiClient.post<GenerateResponseDto>(`${BASE}/generate`, { jsonBody: body }),
  /** Rekompozycja bez AI — zwraca gotowy PNG. */
  compose: (body: ComposeRequestDto) =>
    apiClient.post<Blob>(`${BASE}/compose`, { jsonBody: body, parse: "blob" }),
  assist: (body: AssistRequestDto) =>
    apiClient.post<{ text: string }>(`${BASE}/enhance`, { jsonBody: body }),
}
