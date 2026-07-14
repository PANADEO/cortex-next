"use client"

import { apiClient } from "@cortex/api"
import type { CoworkArtifactExportResult, CoworkProjectTileInfo } from "@cortex/types"
import type {
  CoworkArtifact,
  CoworkInputFile,
  CoworkSession,
  CoworkSessionSummary,
  CoworkSkillSummary,
  SendMessageResponse,
} from "./types"

export const coworkQueryKeys = {
  all: ["cortex-cowork"] as const,
  catalog: () => [...coworkQueryKeys.all, "catalog"] as const,
  projects: () => [...coworkQueryKeys.all, "projects"] as const,
  sessions: (projectId: string) => [...coworkQueryKeys.all, "sessions", projectId] as const,
  session: (sessionId: string) => [...coworkQueryKeys.all, "session", sessionId] as const,
  myInstructions: () => [...coworkQueryKeys.all, "my-instructions"] as const,
  artifacts: (sessionId: string) =>
    [...coworkQueryKeys.all, "session", sessionId, "artifacts"] as const,
}

// Wire types shared with the server routes via @cortex/types; re-exported
// under the feature's historical names for existing consumers.
export type CoworkProjectTile = CoworkProjectTileInfo
export type ArtifactExportResult = CoworkArtifactExportResult

const basePath = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH)

function normalizeBasePath(value: string | undefined): string {
  if (!value) return ""
  const trimmed = value.trim()
  if (!trimmed || trimmed === "/") return ""
  return trimmed.startsWith("/") ? trimmed.replace(/\/+$/, "") : `/${trimmed.replace(/\/+$/, "")}`
}

export const coworkApi = {
  listSkillCatalog: () => apiClient.get<CoworkSkillSummary[]>("/api/cortex-cowork/skills"),
  listProjectTiles: () => apiClient.get<CoworkProjectTile[]>("/api/cortex-cowork/projects"),
  listSessions: (projectId: string) =>
    apiClient.get<CoworkSessionSummary[]>(
      `/api/cortex-cowork/sessions?projectId=${encodeURIComponent(projectId)}`,
    ),
  createSession: (projectId?: string) =>
    apiClient.post<CoworkSession>("/api/cortex-cowork/sessions", {
      jsonBody: projectId ? { projectId } : {},
    }),
  getSession: (sessionId: string) =>
    apiClient.get<CoworkSession>(`/api/cortex-cowork/sessions/${sessionId}`),
  deleteSession: (sessionId: string) =>
    apiClient.delete<{ ok: boolean }>(`/api/cortex-cowork/sessions/${sessionId}`),
  sendMessage: (sessionId: string, content: string) =>
    apiClient.post<SendMessageResponse>(`/api/cortex-cowork/sessions/${sessionId}/messages`, {
      jsonBody: { content },
    }),
  // SSE endpoint consumed with a raw fetch (EventSource cannot POST).
  streamMessagePath: (sessionId: string) =>
    `${basePath}/api/cortex-cowork/sessions/${sessionId}/messages/stream`,
  getMyInstructions: () =>
    apiClient.get<{ instructions: string }>("/api/cortex-cowork/my-instructions"),
  setMyInstructions: (instructions: string) =>
    apiClient.put<{ instructions: string }>("/api/cortex-cowork/my-instructions", {
      jsonBody: { instructions },
    }),
  uploadInputFiles: (sessionId: string, files: File[]) => {
    const form = new FormData()
    for (const file of files) form.append("files", file, file.name)
    return apiClient.post<{ files: CoworkInputFile[] }>(
      `/api/cortex-cowork/sessions/${sessionId}/files`,
      { body: form },
    )
  },
  listArtifacts: (sessionId: string) =>
    apiClient.get<CoworkArtifact[]>(`/api/cortex-cowork/sessions/${sessionId}/artifacts`),
  artifactDownloadHref: (sessionId: string, artifactId: string) =>
    `${basePath}/api/cortex-cowork/sessions/${sessionId}/artifacts/${artifactId}`,
  exportArtifact: (sessionId: string, artifactId: string) =>
    apiClient.post<ArtifactExportResult>(
      `/api/cortex-cowork/sessions/${sessionId}/artifacts/${artifactId}/export`,
    ),
}
