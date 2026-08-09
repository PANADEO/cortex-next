import { apiClient } from "@cortex/api"
import type {
  Application,
  ApplicationInput,
  ApplicationPatch,
  ApplicationScope,
  ApplicationScopeGrant,
  AttachOpenwebuiGroupInput,
  InstanceAppearance,
  OpenwebuiGroupMapping,
  OpenwebuiRoleGroupState,
  OpenwebuiSyncResult,
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
  applicationScopes: (id: string) => [...queryKeys.applications(), id, "scopes"] as const,
  applicationScopeGrants: (id: string) => [...queryKeys.applications(), id, "scope-grants"] as const,
  unactivatedNativeApplications: () =>
    [...queryKeys.applications(), "unactivated-native"] as const,
  roleOpenwebuiGroup: (id: string) => [...queryKeys.roles(), id, "openwebui-group"] as const,
  appearance: () => [...queryKeys.all, "appearance"] as const,
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
    // Sekcja "Grupa OpenWebUI" (D8 zaadaptowane pod Wariant A — mapowanie po
    // roli, nie po aplikacji).
    getOpenwebuiGroup: (id: string) =>
      apiClient.get<OpenwebuiRoleGroupState>(`${BASE}/roles/${id}/openwebui-group`),
    attachOpenwebuiGroup: (id: string, body: AttachOpenwebuiGroupInput) =>
      apiClient.put<{ mapping: OpenwebuiGroupMapping }>(`${BASE}/roles/${id}/openwebui-group`, {
        jsonBody: body,
      }),
    detachOpenwebuiGroup: (id: string) =>
      apiClient.put<{ ok: true; detached: boolean }>(`${BASE}/roles/${id}/openwebui-group`, {
        jsonBody: { action: "detach" },
      }),
    syncOpenwebuiGroup: (id: string) =>
      apiClient.post<{ openwebuiSync: OpenwebuiSyncResult }>(`${BASE}/roles/${id}/openwebui-group`, {}),
  },
  applications: {
    list: () => apiClient.get<Application[]>(`${BASE}/applications`),
    create: (body: ApplicationInput) =>
      apiClient.post<Application>(`${BASE}/applications`, { jsonBody: body }),
    update: (id: string, body: ApplicationPatch) =>
      apiClient.patch<Application>(`${BASE}/applications/${id}`, { jsonBody: body }),
    remove: (id: string) => apiClient.delete<{ ok: true }>(`${BASE}/applications/${id}`),
    listRoles: (id: string) =>
      apiClient.get<{ roleIds: string[] }>(`${BASE}/applications/${id}/roles`),
    setRoles: (id: string, roleIds: string[]) =>
      apiClient.put<{ ok: true }>(`${BASE}/applications/${id}/roles`, { jsonBody: { roleIds } }),
    // D8-D10: katalog zakresów jest tylko do odczytu z tego panelu (brak
    // create/remove — nie ma tu endpointów POST/DELETE do wywołania).
    listScopes: (id: string) => apiClient.get<ApplicationScope[]>(`${BASE}/applications/${id}/scopes`),
    renameScope: (id: string, scopeId: string, name: string) =>
      apiClient.patch<ApplicationScope>(`${BASE}/applications/${id}/scopes/${scopeId}`, {
        jsonBody: { name },
      }),
    listScopeGrants: (id: string) =>
      apiClient.get<ApplicationScopeGrant[]>(`${BASE}/applications/${id}/scope-grants`),
    setScopeRoles: (id: string, scopeId: string, roleIds: string[]) =>
      apiClient.put<{ ok: true }>(`${BASE}/applications/${id}/scopes/${scopeId}/roles`, {
        jsonBody: { roleIds },
      }),
    // D6-rewizja/D10-rewizja d: kandydaci "Dodaj aplikację" dla kind=native —
    // manifesty zarejestrowane w kodzie, jeszcze nie aktywowane w tej instancji.
    listUnactivatedNative: () =>
      apiClient.get<Application[]>(`${BASE}/applications/unactivated-native`),
    // Jedyny sposób powstania wiersza kind=native — aktywacja po kodzie
    // manifestu, nie POST/create (ten zostaje wyłącznie dla external-link/iframe).
    activate: (code: string) =>
      apiClient.post<Application>(`${BASE}/applications/activate`, { jsonBody: { code } }),
  },
  // Wygląd instancji (E5). Tylko panel administratora tędy chodzi — zwykły
  // użytkownik dostaje preset instancji wyrenderowany w HTML-u, bez zapytania
  // (patrz app/idp/lib/presets/instance-preset.tsx).
  appearance: {
    get: () => apiClient.get<InstanceAppearance>(`${BASE}/appearance`),
    set: (preset: string | null) =>
      apiClient.put<InstanceAppearance>(`${BASE}/appearance`, { jsonBody: { preset } }),
  },
}
