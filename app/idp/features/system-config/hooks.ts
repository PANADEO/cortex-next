"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { endpoints, queryKeys } from "./queries"
import type { ApplicationInput } from "./types"

export function useKonfiguracjaUsers() {
  return useQuery({ queryKey: queryKeys.users(), queryFn: endpoints.users.list })
}

export function useKonfiguracjaRoles() {
  return useQuery({ queryKey: queryKeys.roles(), queryFn: endpoints.roles.list })
}

export function useKonfiguracjaApplications() {
  return useQuery({ queryKey: queryKeys.applications(), queryFn: endpoints.applications.list })
}

export function useSetUserRoles() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, roleIds }: { id: string; roleIds: string[] }) =>
      endpoints.users.setRoles(id, roleIds),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.users() }),
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
    mutationFn: ({ id, body }: { id: string; body: ApplicationInput }) =>
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
