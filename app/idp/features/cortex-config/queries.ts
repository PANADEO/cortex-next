"use client"

import { apiClient } from "@cortex/api"
import type {
  CoworkGovernanceConfig,
  CoworkProjectConfig,
  CoworkRole,
  CoworkSkillGroup,
} from "@cortex/types"

export const configQueryKeys = {
  all: ["cortex-config"] as const,
  governance: () => [...configQueryKeys.all, "governance"] as const,
  credentials: () => [...configQueryKeys.all, "credentials"] as const,
}

export interface GovernanceUpdate {
  skillGroups?: CoworkSkillGroup[]
  roles?: CoworkRole[]
  userAssignments?: Record<string, string[]>
  adminEmails?: string[]
}

export type ProjectInput = Omit<CoworkProjectConfig, "createdAt" | "updatedAt">

export const configApi = {
  getGovernance: () => apiClient.get<CoworkGovernanceConfig>("/api/cortex-config"),
  updateGovernance: (update: GovernanceUpdate) =>
    apiClient.put<CoworkGovernanceConfig>("/api/cortex-config/governance", {
      jsonBody: update,
    }),
  createProject: (input: ProjectInput) =>
    apiClient.post<CoworkProjectConfig>("/api/cortex-config/projects", { jsonBody: input }),
  updateProject: (input: ProjectInput) =>
    apiClient.put<CoworkProjectConfig>(`/api/cortex-config/projects/${input.id}`, {
      jsonBody: input,
    }),
  deleteProject: (projectId: string) =>
    apiClient.delete<{ ok: boolean }>(`/api/cortex-config/projects/${projectId}`),
  listCredentialPaths: () =>
    apiClient.get<{ paths: string[] }>("/api/cortex-config/credentials"),
  setCredential: (path: string, value: string) =>
    apiClient.put<{ ok: boolean }>("/api/cortex-config/credentials", {
      jsonBody: { path, value },
    }),
  deleteCredential: (path: string) =>
    apiClient.delete<{ ok: boolean }>("/api/cortex-config/credentials", {
      jsonBody: { path },
    }),
}
