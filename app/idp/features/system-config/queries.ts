import { apiClient } from "@cortex/api"
import type { Application, ApplicationInput, RoleSummary, UserWithRoles } from "./types"

const BASE = "/api/system-config"

export const queryKeys = {
  all: ["system-config"] as const,
  users: () => [...queryKeys.all, "users"] as const,
  roles: () => [...queryKeys.all, "roles"] as const,
  applications: () => [...queryKeys.all, "applications"] as const,
  applicationRoles: (id: string) => [...queryKeys.applications(), id, "roles"] as const,
}

export const endpoints = {
  users: {
    list: () => apiClient.get<UserWithRoles[]>(`${BASE}/users`),
    setRoles: (id: string, roleIds: string[]) =>
      apiClient.put<{ ok: true }>(`${BASE}/users/${id}/roles`, { jsonBody: { roleIds } }),
  },
  roles: {
    list: () => apiClient.get<RoleSummary[]>(`${BASE}/roles`),
  },
  applications: {
    list: () => apiClient.get<Application[]>(`${BASE}/applications`),
    create: (body: ApplicationInput) =>
      apiClient.post<Application>(`${BASE}/applications`, { jsonBody: body }),
    update: (id: string, body: ApplicationInput) =>
      apiClient.patch<Application>(`${BASE}/applications/${id}`, { jsonBody: body }),
    remove: (id: string) => apiClient.delete<{ ok: true }>(`${BASE}/applications/${id}`),
    listRoles: (id: string) =>
      apiClient.get<{ roleIds: string[] }>(`${BASE}/applications/${id}/roles`),
    setRoles: (id: string, roleIds: string[]) =>
      apiClient.put<{ ok: true }>(`${BASE}/applications/${id}/roles`, { jsonBody: { roleIds } }),
  },
}
