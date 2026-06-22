"use client"

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { idpBasicApi } from "./api"
import type {
  IdpBasicCsvExportRequest,
  IdpBasicFileListResponse,
  IdpBasicPackageDetail,
  IdpBasicPackageListResponse,
  IdpBasicPackageStatus,
  IdpBasicResultDetail,
  IdpBasicResultListResponse,
} from "./types"

const ACTIVE_PACKAGE_REFETCH_MS = 2_000
const IDLE_LIST_REFETCH_MS = 10_000

export const idpBasicQueryKeys = {
  all: ["idp-basic"] as const,
  stats: () => [...idpBasicQueryKeys.all, "stats"] as const,
  settings: () => [...idpBasicQueryKeys.all, "settings"] as const,
  csvColumns: () => [...idpBasicQueryKeys.all, "csv-columns"] as const,
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
  results: (query: {
    limit?: number
    offset?: number
    status?: IdpBasicPackageStatus | "all"
    search?: string
    date_from?: string
    date_to?: string
  }) => [...idpBasicQueryKeys.all, "results", query] as const,
  resultDetail: (id: string) => [...idpBasicQueryKeys.all, "results", id] as const,
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

export function useIdpBasicCsvColumns() {
  return useQuery({
    queryKey: idpBasicQueryKeys.csvColumns(),
    queryFn: idpBasicApi.csvColumns,
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

export function useIdpBasicResults(query: {
  limit?: number
  offset?: number
  status?: IdpBasicPackageStatus | "all"
  search?: string
  date_from?: string
  date_to?: string
}) {
  return useQuery({
    queryKey: idpBasicQueryKeys.results(query),
    queryFn: () => idpBasicApi.results(query),
    refetchInterval: (query) =>
      hasActiveResults(query.state.data) ? ACTIVE_PACKAGE_REFETCH_MS : IDLE_LIST_REFETCH_MS,
    placeholderData: keepPreviousData,
    staleTime: 0,
  })
}

export function useIdpBasicResult(id: string) {
  return useQuery({
    queryKey: idpBasicQueryKeys.resultDetail(id),
    queryFn: () => idpBasicApi.resultDetail(id),
    enabled: Boolean(id),
    refetchInterval: (query) =>
      isActiveResult(query.state.data) ? ACTIVE_PACKAGE_REFETCH_MS : false,
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

export function useIdpBasicUploadToFilesystem() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: idpBasicApi.uploadToFilesystem,
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

export function useIdpBasicDeletePackage() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (packageId: string) => idpBasicApi.deletePackage(packageId),
    onSuccess: (_deleted, packageId) => {
      client.removeQueries({ queryKey: idpBasicQueryKeys.packageDetail(packageId) })
      client.removeQueries({ queryKey: idpBasicQueryKeys.resultDetail(packageId) })
      invalidateIdpBasicMetadata(client)
    },
  })
}

export function useIdpBasicDeleteDocument(packageId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (documentId: string) => idpBasicApi.deleteDocument(packageId, documentId),
    onSuccess: () => {
      invalidateIdpBasicMetadata(client)
    },
  })
}

export function useIdpBasicExportCsv() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (request: IdpBasicCsvExportRequest) => idpBasicApi.exportFilesCsv(request),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: idpBasicQueryKeys.csvColumns() })
    },
  })
}

function invalidateIdpBasicMetadata(client: ReturnType<typeof useQueryClient>) {
  client.invalidateQueries({
    predicate: ({ queryKey }) =>
      queryKey[0] === idpBasicQueryKeys.all[0] && queryKey[1] !== "documents",
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

function hasActiveResults(data: IdpBasicResultListResponse | undefined): boolean {
  return (
    data?.items.some((item) => item.status === "queued" || item.status === "processing") ?? true
  )
}

function isActiveResult(data: IdpBasicResultDetail | undefined): boolean {
  return data?.status === "queued" || data?.status === "processing" || data == null
}

function isActivePackage(data: IdpBasicPackageDetail | undefined): boolean {
  return data?.status === "queued" || data?.status === "processing" || data == null
}
