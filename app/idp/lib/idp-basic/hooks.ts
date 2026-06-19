"use client"

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { idpBasicApi } from "./api"
import type {
  IdpBasicFileListResponse,
  IdpBasicPackageDetail,
  IdpBasicPackageListResponse,
  IdpBasicPackageStatus,
} from "./types"

const ACTIVE_PACKAGE_REFETCH_MS = 2_000
const IDLE_LIST_REFETCH_MS = 10_000

export const idpBasicQueryKeys = {
  all: ["idp-basic"] as const,
  stats: () => [...idpBasicQueryKeys.all, "stats"] as const,
  settings: () => [...idpBasicQueryKeys.all, "settings"] as const,
  packages: (query: {
    limit?: number
    offset?: number
    status?: IdpBasicPackageStatus | "all"
    search?: string
  }) => [...idpBasicQueryKeys.all, "packages", query] as const,
  files: (query: {
    limit?: number
    offset?: number
    status?: IdpBasicPackageStatus | "all"
    search?: string
    reference?: string
    label?: string
    date_from?: string
    date_to?: string
  }) => [...idpBasicQueryKeys.all, "files", query] as const,
  packageDetail: (id: string) => [...idpBasicQueryKeys.all, "packages", id] as const,
  documentContent: (packageId: string, documentId: string) =>
    [...idpBasicQueryKeys.all, "documents", packageId, documentId] as const,
}

export function useIdpBasicStats() {
  return useQuery({
    queryKey: idpBasicQueryKeys.stats(),
    queryFn: idpBasicApi.stats,
    refetchInterval: 10_000,
    placeholderData: keepPreviousData,
    staleTime: 0,
  })
}

export function useIdpBasicSettings() {
  return useQuery({
    queryKey: idpBasicQueryKeys.settings(),
    queryFn: idpBasicApi.settings,
  })
}

export function useIdpBasicPackages(query: {
  limit?: number
  offset?: number
  status?: IdpBasicPackageStatus | "all"
  search?: string
}) {
  return useQuery({
    queryKey: idpBasicQueryKeys.packages(query),
    queryFn: () => idpBasicApi.packages(query),
    refetchInterval: (query) =>
      hasActivePackages(query.state.data) ? ACTIVE_PACKAGE_REFETCH_MS : IDLE_LIST_REFETCH_MS,
    placeholderData: keepPreviousData,
    staleTime: 0,
  })
}

export function useIdpBasicFiles(query: {
  limit?: number
  offset?: number
  status?: IdpBasicPackageStatus | "all"
  search?: string
  reference?: string
  label?: string
  date_from?: string
  date_to?: string
}) {
  return useQuery({
    queryKey: idpBasicQueryKeys.files(query),
    queryFn: () => idpBasicApi.files(query),
    refetchInterval: (query) =>
      hasActiveFiles(query.state.data) ? ACTIVE_PACKAGE_REFETCH_MS : IDLE_LIST_REFETCH_MS,
    placeholderData: keepPreviousData,
    staleTime: 0,
  })
}

export function useIdpBasicPackage(id: string) {
  return useQuery({
    queryKey: idpBasicQueryKeys.packageDetail(id),
    queryFn: () => idpBasicApi.packageDetail(id),
    enabled: Boolean(id),
    refetchInterval: (query) =>
      isActivePackage(query.state.data) ? ACTIVE_PACKAGE_REFETCH_MS : false,
    placeholderData: keepPreviousData,
    staleTime: 0,
  })
}

export function useIdpBasicDocumentContent(
  packageId: string,
  documentId: string,
  enabled: boolean,
) {
  return useQuery({
    queryKey: idpBasicQueryKeys.documentContent(packageId, documentId),
    queryFn: () => idpBasicApi.documentContent(packageId, documentId),
    enabled,
    staleTime: Infinity,
  })
}

export function useIdpBasicPollMail() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: idpBasicApi.pollMail,
    onSuccess: () => {
      client.invalidateQueries({ queryKey: idpBasicQueryKeys.all })
    },
  })
}

export function useIdpBasicUploadPackage() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: idpBasicApi.uploadPackage,
    onSuccess: (uploaded) => {
      client.invalidateQueries({ queryKey: idpBasicQueryKeys.all })
      client.setQueryData(idpBasicQueryKeys.packageDetail(uploaded.id), uploaded)
    },
  })
}

function hasActivePackages(data: IdpBasicPackageListResponse | undefined): boolean {
  return (
    data?.items.some((item) => item.status === "queued" || item.status === "processing") ?? true
  )
}

function hasActiveFiles(data: IdpBasicFileListResponse | undefined): boolean {
  return (
    data?.items.some(
      (item) => item.package_status === "queued" || item.package_status === "processing",
    ) ?? true
  )
}

function isActivePackage(data: IdpBasicPackageDetail | undefined): boolean {
  return data?.status === "queued" || data?.status === "processing" || data == null
}
