import { apiClient } from "@cortex/api"
import type {
  Application,
  ApplicationInput,
  RoleInput,
  RolePatch,
  RoleRecord,
  RoleSummary,
  UserInput,
  UserPatch,
  UserRecord,
  UserWithRoles,
} from "./types"

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
    create: (body: UserInput) => apiClient.post<UserRecord>(`${BASE}/users`, { jsonBody: body }),
    update: (id: string, body: UserPatch) =>
      apiClient.patch<UserRecord>(`${BASE}/users/${id}`, { jsonBody: body }),
    setRoles: (id: string, roleIds: string[]) =>
      apiClient.put<{ ok: true }>(`${BASE}/users/${id}/roles`, { jsonBody: { roleIds } }),
  },
  roles: {
    list: () => apiClient.get<RoleSummary[]>(`${BASE}/roles`),
    create: (body: RoleInput) => apiClient.post<RoleRecord>(`${BASE}/roles`, { jsonBody: body }),
    update: (id: string, body: RolePatch) =>
      apiClient.patch<RoleRecord>(`${BASE}/roles/${id}`, { jsonBody: body }),
    remove: (id: string) => apiClient.delete<{ ok: true }>(`${BASE}/roles/${id}`),
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
