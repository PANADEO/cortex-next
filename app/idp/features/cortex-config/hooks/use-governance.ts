"use client"

import { coworkQueryKeys } from "@/features/cortex-cowork"
import type { CoworkConnectorConfig, CoworkSkillSource } from "@cortex/types"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { configApi, configQueryKeys, type GovernanceUpdate, type ProjectInput } from "../queries"

export function useGovernanceConfig() {
  return useQuery({
    queryKey: configQueryKeys.governance(),
    queryFn: configApi.getGovernance,
    retry: false,
  })
}

/**
 * All governance mutations invalidate both the admin document and the public
 * project-tile list (the hub reflects config changes without a reload).
 */
function useInvalidateGovernance() {
  const client = useQueryClient()
  return () => {
    void client.invalidateQueries({ queryKey: configQueryKeys.all })
    void client.invalidateQueries({ queryKey: coworkQueryKeys.projects() })
  }
}

export function useUpdateGovernance() {
  const invalidate = useInvalidateGovernance()
  return useMutation({
    mutationFn: (update: GovernanceUpdate) => configApi.updateGovernance(update),
    onSettled: invalidate,
  })
}

export function useCreateProject() {
  const invalidate = useInvalidateGovernance()
  return useMutation({
    mutationFn: (input: ProjectInput) => configApi.createProject(input),
    onSettled: invalidate,
  })
}

export function useUpdateProject() {
  const invalidate = useInvalidateGovernance()
  return useMutation({
    mutationFn: (input: ProjectInput) => configApi.updateProject(input),
    onSettled: invalidate,
  })
}

export function useDeleteProject() {
  const invalidate = useInvalidateGovernance()
  return useMutation({
    mutationFn: (projectId: string) => configApi.deleteProject(projectId),
    onSettled: invalidate,
  })
}

export function useCredentialPaths() {
  return useQuery({
    queryKey: configQueryKeys.credentials(),
    queryFn: configApi.listCredentialPaths,
    retry: false,
  })
}

export function useSetCredential() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ path, value }: { path: string; value: string }) =>
      configApi.setCredential(path, value),
    onSettled: () => client.invalidateQueries({ queryKey: configQueryKeys.credentials() }),
  })
}

export function useDeleteCredential() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (path: string) => configApi.deleteCredential(path),
    onSettled: () => client.invalidateQueries({ queryKey: configQueryKeys.credentials() }),
  })
}

export function useCatalog() {
  return useQuery({
    queryKey: configQueryKeys.catalog(),
    queryFn: configApi.getCatalog,
    retry: false,
  })
}

/** Catalog mutations refresh the catalog, the project list, and the hub tiles. */
function useInvalidateCatalog() {
  const client = useQueryClient()
  return () => {
    void client.invalidateQueries({ queryKey: configQueryKeys.catalog() })
    void client.invalidateQueries({ queryKey: coworkQueryKeys.projects() })
  }
}

export function useUpdateDepartments() {
  const invalidate = useInvalidateCatalog()
  return useMutation({
    mutationFn: (departments: string[]) => configApi.updateDepartments(departments),
    onSettled: invalidate,
  })
}

export function useUpdateSkillSources() {
  const invalidate = useInvalidateCatalog()
  return useMutation({
    mutationFn: (sources: CoworkSkillSource[]) => configApi.updateSkillSources(sources),
    onSettled: invalidate,
  })
}

export function useUpdateConnectors() {
  const invalidate = useInvalidateCatalog()
  return useMutation({
    mutationFn: (connectors: CoworkConnectorConfig[]) => configApi.updateConnectors(connectors),
    onSettled: invalidate,
  })
}
