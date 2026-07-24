"use client"

import { coworkQueryKeys } from "@/features/cortex-cowork"
import { ApiError, toastApiError } from "@cortex/api"
import type { CoworkConnectorConfig, CoworkSkillSource } from "@cortex/types"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { configApi, configQueryKeys, type GovernanceUpdate, type ProjectInput } from "../queries"

// The project save endpoint (POST/PUT .../projects) rejects a composition
// whose grants point at a deleted/nonexistent skill, connector, department,
// or secret with 400 { message, invalidReferences }. `invalidReferences`
// rides in `ApiError.details` (not the common message/errorCode/variables
// fields toastApiError reads), so this app needs its own toast to also list
// which specific references are broken - otherwise the admin only sees a
// generic "reference unknown catalog resources" with no lead on what to fix.
interface InvalidGrantReference {
  kind: "skills" | "connectors" | "secrets"
  part: "branches" | "leaves"
  value: string
}

const GRANT_KIND_LABELS: Record<InvalidGrantReference["kind"], string> = {
  skills: "Skille",
  connectors: "Konektory",
  secrets: "Sekrety",
}

const GRANT_PART_LABELS: Record<InvalidGrantReference["part"], string> = {
  branches: "gałąź",
  leaves: "pozycja",
}

function isInvalidGrantReferenceList(value: unknown): value is InvalidGrantReference[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => {
      const ref = item as Partial<InvalidGrantReference> | null
      return (
        typeof ref === "object" &&
        ref !== null &&
        typeof ref.kind === "string" &&
        typeof ref.part === "string" &&
        typeof ref.value === "string"
      )
    })
  )
}

function toastProjectSaveError(error: unknown): void {
  if (error instanceof ApiError) {
    const body = error.details as { invalidReferences?: unknown } | undefined
    if (isInvalidGrantReferenceList(body?.invalidReferences)) {
      const description = body.invalidReferences
        .map(
          (ref) =>
            `${GRANT_KIND_LABELS[ref.kind] ?? ref.kind} - ${GRANT_PART_LABELS[ref.part] ?? ref.part}: ${ref.value}`,
        )
        .join("\n")
      toast.error(error.message, { description })
      return
    }
  }
  toastApiError(error, "Nie udało się zapisać projektu")
}

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
    onError: toastProjectSaveError,
    onSettled: invalidate,
  })
}

export function useUpdateProject() {
  const invalidate = useInvalidateGovernance()
  return useMutation({
    mutationFn: (input: ProjectInput) => configApi.updateProject(input),
    onError: toastProjectSaveError,
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
