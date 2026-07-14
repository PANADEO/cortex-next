"use client"

import { apiClient } from "@cortex/api"
import type {
  CoworkCatalogSkill,
  CoworkConnectorConfig,
  CoworkGovernanceConfig,
  CoworkProjectConfig,
  CoworkRole,
  CoworkSkillSource,
} from "@cortex/types"

export const configQueryKeys = {
  all: ["cortex-config"] as const,
  governance: () => [...configQueryKeys.all, "governance"] as const,
  credentials: () => [...configQueryKeys.all, "credentials"] as const,
  catalog: () => [...configQueryKeys.all, "catalog"] as const,
}

export interface GovernanceUpdate {
  roles?: CoworkRole[]
  userAssignments?: Record<string, string[]>
  adminEmails?: string[]
}

export type ProjectInput = Omit<CoworkProjectConfig, "createdAt" | "updatedAt">

/** Resource catalog snapshot for the admin panel. */
export interface CatalogSnapshot {
  departments: string[]
  skills: CoworkCatalogSkill[]
  skillSources: CoworkSkillSource[]
  connectors: CoworkConnectorConfig[]
}

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
  listCredentialPaths: () => apiClient.get<{ paths: string[] }>("/api/cortex-config/credentials"),
  setCredential: (path: string, value: string) =>
    apiClient.put<{ ok: boolean }>("/api/cortex-config/credentials", {
      jsonBody: { path, value },
    }),
  deleteCredential: (path: string) =>
    apiClient.delete<{ ok: boolean }>("/api/cortex-config/credentials", {
      jsonBody: { path },
    }),
  getCatalog: () => apiClient.get<CatalogSnapshot>("/api/cortex-config/catalog"),
  updateDepartments: (departments: string[]) =>
    apiClient.put<{ departments: string[] }>("/api/cortex-config/catalog/departments", {
      jsonBody: { departments },
    }),
  updateSkillSources: (sources: CoworkSkillSource[]) =>
    apiClient.put<{ skillSources: CoworkSkillSource[] }>(
      "/api/cortex-config/catalog/skill-sources",
      { jsonBody: { sources } },
    ),
  updateConnectors: (connectors: CoworkConnectorConfig[]) =>
    apiClient.put<{ connectors: CoworkConnectorConfig[] }>(
      "/api/cortex-config/catalog/connectors",
      { jsonBody: { connectors } },
    ),
}
