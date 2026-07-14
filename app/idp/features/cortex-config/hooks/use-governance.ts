"use client"

import { coworkQueryKeys } from "@/features/cortex-cowork"
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
