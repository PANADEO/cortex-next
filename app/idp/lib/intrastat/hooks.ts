"use client"

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { intrastatApi } from "./api"
import type {
  IntrastatBatchListResponse,
  IntrastatBatchStatus,
  IntrastatCnMatchStatus,
  IntrastatLineListResponse,
  IntrastatLinePatchRequest,
  IntrastatTransactionKind,
} from "./types"

const ACTIVE_BATCH_REFETCH_MS = 2_000
const IDLE_LIST_REFETCH_MS = 10_000

export const intrastatQueryKeys = {
  all: ["intrastat"] as const,
  stats: () => [...intrastatQueryKeys.all, "stats"] as const,
  settings: () => [...intrastatQueryKeys.all, "settings"] as const,
  filesystemPreview: (query: { path?: string; limit?: number; offset?: number }) =>
    [...intrastatQueryKeys.all, "filesystem-preview", query] as const,
  batchFilterOptions: () => [...intrastatQueryKeys.all, "batch-filter-options"] as const,
  cnResource: () => [...intrastatQueryKeys.all, "cn-resource"] as const,
  cnSuggestions: (search: string) =>
    [...intrastatQueryKeys.all, "cn-resource", "suggestions", search] as const,
  batches: (query: {
    limit?: number
    offset?: number
    status?: IntrastatBatchStatus | "all"
    transaction_kind?: IntrastatTransactionKind | "all"
    client_name?: string | "all"
    period_month?: string | "all"
    search?: string
  }) => [...intrastatQueryKeys.all, "batches", query] as const,
  batchDetail: (id: string) => [...intrastatQueryKeys.all, "batches", id] as const,
  documentContent: (batchId: string, documentId: string) =>
    [...intrastatQueryKeys.all, "documents", batchId, documentId] as const,
  lines: (
    batchId: string,
    query: {
      limit?: number
      offset?: number
      match_status?: IntrastatCnMatchStatus | "all"
      search?: string
    },
  ) => [...intrastatQueryKeys.all, "batches", batchId, "lines", query] as const,
}

export function useIntrastatStats() {
  return useQuery({
    queryKey: intrastatQueryKeys.stats(),
    queryFn: intrastatApi.stats,
    refetchInterval: 10_000,
    placeholderData: keepPreviousData,
    staleTime: 0,
  })
}

export function useIntrastatSettings() {
  return useQuery({
    queryKey: intrastatQueryKeys.settings(),
    queryFn: intrastatApi.settings,
  })
}

export function useIntrastatFilesystemPreview(
  query: { path?: string; limit?: number; offset?: number },
  enabled: boolean,
) {
  return useQuery({
    queryKey: intrastatQueryKeys.filesystemPreview(query),
    queryFn: () => intrastatApi.filesystemPreview(query),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 5_000,
  })
}

export function useIntrastatDownloadFilesystemFile() {
  return useMutation({
    mutationFn: intrastatApi.downloadFilesystemFile,
  })
}

export function useIntrastatBatchFilterOptions() {
  return useQuery({
    queryKey: intrastatQueryKeys.batchFilterOptions(),
    queryFn: intrastatApi.batchFilterOptions,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })
}

export function useIntrastatCnResource() {
  return useQuery({
    queryKey: intrastatQueryKeys.cnResource(),
    queryFn: intrastatApi.currentCnResource,
  })
}

export function useIntrastatCnSuggestions(search: string, enabled: boolean) {
  return useQuery({
    queryKey: intrastatQueryKeys.cnSuggestions(search),
    queryFn: () => intrastatApi.cnSuggestions(search),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })
}

export function useIntrastatBatches(query: {
  limit?: number
  offset?: number
  status?: IntrastatBatchStatus | "all"
  transaction_kind?: IntrastatTransactionKind | "all"
  client_name?: string | "all"
  period_month?: string | "all"
  search?: string
}) {
  return useQuery({
    queryKey: intrastatQueryKeys.batches(query),
    queryFn: () => intrastatApi.batches(query),
    refetchInterval: (query) =>
      hasActiveBatches(query.state.data) ? ACTIVE_BATCH_REFETCH_MS : IDLE_LIST_REFETCH_MS,
    placeholderData: keepPreviousData,
    staleTime: 0,
  })
}

export function useIntrastatBatch(id: string) {
  return useQuery({
    queryKey: intrastatQueryKeys.batchDetail(id),
    queryFn: () => intrastatApi.batchDetail(id),
    enabled: Boolean(id),
    refetchInterval: (query) =>
      isActiveBatch(query.state.data?.status) ? ACTIVE_BATCH_REFETCH_MS : false,
    placeholderData: keepPreviousData,
    staleTime: 0,
  })
}

export function useIntrastatDocumentContent(batchId: string, documentId: string, enabled: boolean) {
  return useQuery({
    queryKey: intrastatQueryKeys.documentContent(batchId, documentId),
    queryFn: () => intrastatApi.documentContent(batchId, documentId),
    enabled,
    staleTime: Infinity,
  })
}

export function useIntrastatLines(
  batchId: string,
  query: {
    limit?: number
    offset?: number
    match_status?: IntrastatCnMatchStatus | "all"
    search?: string
  },
) {
  return useQuery({
    queryKey: intrastatQueryKeys.lines(batchId, query),
    queryFn: () => intrastatApi.lines(batchId, query),
    enabled: Boolean(batchId),
    refetchInterval: (query) =>
      hasActiveLines(query.state.data) ? ACTIVE_BATCH_REFETCH_MS : IDLE_LIST_REFETCH_MS,
    placeholderData: keepPreviousData,
    staleTime: 0,
  })
}

export function useIntrastatUploadBatch() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({
      file,
      transactionKind,
      uploadToFilesystem,
      clientName,
      periodMonth,
    }: {
      file: File
      transactionKind: IntrastatTransactionKind
      uploadToFilesystem?: boolean
      clientName?: string
      periodMonth?: string
    }) => {
      const options: {
        uploadToFilesystem?: boolean
        clientName?: string
        periodMonth?: string
      } = {}
      if (uploadToFilesystem !== undefined) options.uploadToFilesystem = uploadToFilesystem
      if (clientName !== undefined) options.clientName = clientName
      if (periodMonth !== undefined) options.periodMonth = periodMonth
      return intrastatApi.uploadBatch(file, transactionKind, options)
    },
    onSuccess: (uploaded) => {
      invalidateIntrastatMetadata(client)
      client.invalidateQueries({ queryKey: intrastatQueryKeys.batchDetail(uploaded.id) })
    },
  })
}

export function useIntrastatUploadCnResource() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: intrastatApi.uploadCnResource,
    onSuccess: () => {
      client.invalidateQueries({ queryKey: intrastatQueryKeys.cnResource() })
      invalidateIntrastatMetadata(client)
    },
  })
}

export function useIntrastatPollFilesystem() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: intrastatApi.pollFilesystem,
    onSuccess: () => invalidateIntrastatMetadata(client),
  })
}

export function useIntrastatDeleteFilesystemFile() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: intrastatApi.deleteFilesystemFile,
    onSuccess: () => {
      client.invalidateQueries({ queryKey: [...intrastatQueryKeys.all, "filesystem-preview"] })
    },
  })
}

export function useIntrastatPatchLine(batchId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ lineId, payload }: { lineId: string; payload: IntrastatLinePatchRequest }) =>
      intrastatApi.patchLine(lineId, payload),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: [...intrastatQueryKeys.all, "batches", batchId] })
      invalidateIntrastatMetadata(client)
    },
  })
}

export function useIntrastatReprocessBatch() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: intrastatApi.reprocessBatch,
    onSuccess: (batch) => {
      client.setQueryData(intrastatQueryKeys.batchDetail(batch.id), batch)
      invalidateIntrastatMetadata(client)
    },
  })
}

export function useIntrastatDeleteBatch() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: intrastatApi.deleteBatch,
    onSuccess: (_deleted, batchId) => {
      client.removeQueries({ queryKey: intrastatQueryKeys.batchDetail(batchId) })
      client.removeQueries({ queryKey: [...intrastatQueryKeys.all, "batches", batchId, "lines"] })
      invalidateIntrastatMetadata(client)
    },
  })
}

export function useIntrastatExportIntrastat() {
  return useMutation({
    mutationFn: intrastatApi.exportIntrastat,
  })
}

export function useIntrastatExportAudit() {
  return useMutation({
    mutationFn: intrastatApi.exportAudit,
  })
}

function invalidateIntrastatMetadata(client: ReturnType<typeof useQueryClient>) {
  client.invalidateQueries({ queryKey: intrastatQueryKeys.all })
}

function hasActiveBatches(data: IntrastatBatchListResponse | undefined): boolean {
  return data?.items.some((item) => isActiveBatch(item.status)) ?? true
}

function hasActiveLines(data: IntrastatLineListResponse | undefined): boolean {
  return data?.items.some(() => false) ?? true
}

function isActiveBatch(status: IntrastatBatchStatus | undefined): boolean {
  return status === "queued" || status === "processing"
}
