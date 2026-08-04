"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { endpoints, queryKeys } from "./queries"
import type {
  ApplicationInput,
  ApplicationPatch,
  AttachOpenwebuiGroupInput,
  RoleInput,
  RolePatch,
  UserInput,
  UserPatch,
} from "./types"

interface SetApplicationScopeRolesVars {
  id: string
  scopeId: string
  roleIds: string[]
}

interface RenameApplicationScopeVars {
  id: string
  scopeId: string
  name: string
}

export function useUsers() {
  return useQuery({ queryKey: queryKeys.users(), queryFn: endpoints.users.list })
}

export function useRoles() {
  return useQuery({ queryKey: queryKeys.roles(), queryFn: endpoints.roles.list })
}

export function useApplications() {
  return useQuery({ queryKey: queryKeys.applications(), queryFn: endpoints.applications.list })
}

export function useCreateUser() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (body: UserInput) => endpoints.users.create(body),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.users() }),
  })
}

export function useUpdateUser() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UserPatch }) => endpoints.users.update(id, body),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.users() }),
  })
}

export function useSetUserRoles() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, roleIds }: { id: string; roleIds: string[] }) =>
      endpoints.users.setRoles(id, roleIds),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.users() }),
  })
}

export function useCreateRole() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (body: RoleInput) => endpoints.roles.create(body),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.roles() }),
  })
}

export function useUpdateRole() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: RolePatch }) => endpoints.roles.update(id, body),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.roles() }),
  })
}

export function useDeleteRole() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => endpoints.roles.remove(id),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.roles() }),
  })
}

/** Stan sekcji "Grupa OpenWebUI" — mapowanie, podgląd bez zapisu, grupy do
 *  wyboru przy podpinaniu. `undefined` (nie pusty string) dopóki dialog
 *  edycji roli jest zamknięty — `enabled` steruje, kiedy w ogóle odpytywać. */
export function useRoleOpenwebuiGroup(roleId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.roleOpenwebuiGroup(roleId ?? ""),
    queryFn: () => endpoints.roles.getOpenwebuiGroup(roleId as string),
    enabled: Boolean(roleId),
  })
}

export function useAttachRoleOpenwebuiGroup() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: AttachOpenwebuiGroupInput }) =>
      endpoints.roles.attachOpenwebuiGroup(id, body),
    onSuccess: (_data, { id }) => client.invalidateQueries({ queryKey: queryKeys.roleOpenwebuiGroup(id) }),
  })
}

export function useDetachRoleOpenwebuiGroup() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => endpoints.roles.detachOpenwebuiGroup(id),
    onSuccess: (_data, id) => client.invalidateQueries({ queryKey: queryKeys.roleOpenwebuiGroup(id) }),
  })
}

/** "Synchronizuj teraz" dla TEJ jednej roli — odpowiednik przycisku z
 *  cortex-adminowego panelu (D3, jedyny element tamtego UI wart zachowania). */
export function useSyncRoleOpenwebuiGroup() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => endpoints.roles.syncOpenwebuiGroup(id),
    onSuccess: (_data, id) => client.invalidateQueries({ queryKey: queryKeys.roleOpenwebuiGroup(id) }),
  })
}

export function useCreateApplication() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (body: ApplicationInput) => endpoints.applications.create(body),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.applications() }),
  })
}

export function useUpdateApplication() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: ApplicationPatch }) =>
      endpoints.applications.update(id, body),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.applications() }),
  })
}

export function useDeleteApplication() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => endpoints.applications.remove(id),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.applications() }),
  })
}

/** Kandydaci "Dodaj aplikację" dla kind=native (D6-rewizja/D10-rewizja d) —
 *  pobierane tylko gdy dialog jest otwarty i typ wybrany to native (wołający
 *  steruje `enabled`, patrz applications/page.tsx). */
export function useUnactivatedNativeApplications(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.unactivatedNativeApplications(),
    queryFn: endpoints.applications.listUnactivatedNative,
    enabled,
  })
}

/** Aktywuje jeden zarejestrowany manifest — jedyna droga do wiersza
 *  kind=native (zastępuje createApplication dla tej ścieżki formularza). */
export function useActivateApplication() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (code: string) => endpoints.applications.activate(code),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: queryKeys.applications() })
      client.invalidateQueries({ queryKey: queryKeys.unactivatedNativeApplications() })
    },
  })
}

export function useApplicationRoles(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.applicationRoles(id ?? ""),
    queryFn: () => endpoints.applications.listRoles(id as string),
    enabled: Boolean(id),
  })
}

export function useSetApplicationRoles() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, roleIds }: { id: string; roleIds: string[] }) =>
      endpoints.applications.setRoles(id, roleIds),
    onSuccess: (_data, { id }) =>
      client.invalidateQueries({ queryKey: queryKeys.applicationRoles(id) }),
  })
}

/** Katalog zakresów TEJ aplikacji (D8: definiowany przez kod modułu — tylko
 *  odczyt, brak create/remove z tego panelu). */
export function useApplicationScopes(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.applicationScopes(id ?? ""),
    queryFn: () => endpoints.applications.listScopes(id as string),
    enabled: Boolean(id),
  })
}

/** Macierz zakres -> role w jednym zapytaniu (D9). */
export function useApplicationScopeGrants(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.applicationScopeGrants(id ?? ""),
    queryFn: () => endpoints.applications.listScopeGrants(id as string),
    enabled: Boolean(id),
  })
}

/** Zapis JEDNEJ kolumny macierzy (jeden zakres -> komplet ról). Wołający
 *  (applications/[code]/page.tsx) decyduje o wsadowości — woła to raz per
 *  zmienioną kolumnę, równolegle przez Promise.all (D9). */
export function useSetApplicationScopeRoles() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, scopeId, roleIds }: SetApplicationScopeRolesVars) =>
      endpoints.applications.setScopeRoles(id, scopeId, roleIds),
    onSuccess: (_data, { id }) =>
      client.invalidateQueries({ queryKey: queryKeys.applicationScopeGrants(id) }),
  })
}

/** Zmiana etykiety (`name`) zakresu. Endpoint istnieje od razu (D10); UI do
 *  jej wywołania (inline-edycja w nagłówku kolumny macierzy) to świadome
 *  cięcie v1 (D9) — ten hook dziś nie ma jeszcze konsumenta w page.tsx. */
export function useRenameApplicationScope() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, scopeId, name }: RenameApplicationScopeVars) =>
      endpoints.applications.renameScope(id, scopeId, name),
    onSuccess: (_data, { id }) => client.invalidateQueries({ queryKey: queryKeys.applicationScopes(id) }),
  })
}
