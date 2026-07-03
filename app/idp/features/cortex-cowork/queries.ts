"use client"

import { apiClient } from "@cortex/api"
import type {
  CoworkArtifact,
  CoworkSession,
  CoworkSkillSummary,
  SendMessageResponse,
} from "./types"

export const coworkQueryKeys = {
  all: ["cortex-cowork"] as const,
  catalog: () => [...coworkQueryKeys.all, "catalog"] as const,
  session: (sessionId: string) => [...coworkQueryKeys.all, "session", sessionId] as const,
  artifacts: (sessionId: string) =>
    [...coworkQueryKeys.all, "session", sessionId, "artifacts"] as const,
}

const basePath = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH)

function normalizeBasePath(value: string | undefined): string {
  if (!value) return ""
  const trimmed = value.trim()
  if (!trimmed || trimmed === "/") return ""
  return trimmed.startsWith("/") ? trimmed.replace(/\/+$/, "") : `/${trimmed.replace(/\/+$/, "")}`
}

export const coworkApi = {
  listSkillCatalog: () => apiClient.get<CoworkSkillSummary[]>("/api/cortex-cowork/skills"),
  createSession: () => apiClient.post<CoworkSession>("/api/cortex-cowork/sessions"),
  getSession: (sessionId: string) =>
    apiClient.get<CoworkSession>(`/api/cortex-cowork/sessions/${sessionId}`),
  sendMessage: (sessionId: string, content: string) =>
    apiClient.post<SendMessageResponse>(`/api/cortex-cowork/sessions/${sessionId}/messages`, {
      jsonBody: { content },
    }),
  listArtifacts: (sessionId: string) =>
    apiClient.get<CoworkArtifact[]>(`/api/cortex-cowork/sessions/${sessionId}/artifacts`),
  artifactDownloadHref: (sessionId: string, artifactId: string) =>
    `${basePath}/api/cortex-cowork/sessions/${sessionId}/artifacts/${artifactId}`,
}
