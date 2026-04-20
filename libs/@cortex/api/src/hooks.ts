"use client"

import type {
  GetActionLogsQuery,
  GetPackagesQuery,
  UpdateDeliveryTermsRequest,
  UpdateInvoiceLinesRequest,
  UpdateInvoiceRequest,
  UpdateInvoiceTotalsRequest,
  UpdatePartyRequest,
  UpdateTransportInfoRequest,
} from "@cortex/types"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { endpoints } from "./endpoints"
import { queryKeys } from "./query-keys"

export function useUser() {
  return useQuery({ queryKey: queryKeys.user(), queryFn: endpoints.user.me })
}

export function useDashboardStats() {
  return useQuery({
    queryKey: queryKeys.dashboardStats(),
    queryFn: endpoints.packages.dashboardStats,
    refetchInterval: 5_000,
  })
}

export function usePackages(query: GetPackagesQuery = {}) {
  return useQuery({
    queryKey: queryKeys.packages.list(query),
    queryFn: () => endpoints.packages.list(query),
    refetchInterval: 5_000,
  })
}

export function usePackage(id: string, options: { polling?: boolean } = {}) {
  const { polling = true } = options
  return useQuery({
    queryKey: queryKeys.packages.detail(id),
    queryFn: () => endpoints.packages.get(id),
    refetchInterval: polling ? 5_000 : false,
    enabled: Boolean(id),
  })
}

export function usePackageActions(id: string, options: { polling?: boolean } = {}) {
  const { polling = true } = options
  return useQuery({
    queryKey: queryKeys.packages.actions(id),
    queryFn: () => endpoints.packages.actions(id),
    refetchInterval: polling ? 5_000 : false,
    enabled: Boolean(id),
  })
}

export function usePackageTransportOrders(id: string, options: { polling?: boolean } = {}) {
  const { polling = true } = options
  return useQuery({
    queryKey: queryKeys.packages.transportOrders(id),
    queryFn: () => endpoints.packages.transportOrders(id),
    refetchInterval: polling ? 5_000 : false,
    enabled: Boolean(id),
  })
}

export function usePackageTransitions(id: string) {
  return useQuery({
    queryKey: queryKeys.packages.transitions(id),
    queryFn: () => endpoints.packages.transitions(id),
    enabled: Boolean(id),
  })
}

export function useActionLogs(query: GetActionLogsQuery = {}) {
  return useQuery({
    queryKey: queryKeys.actionLogs(query),
    queryFn: () => endpoints.packages.actionLogs(query),
  })
}

function useInvalidatePackage(id: string) {
  const client = useQueryClient()
  return () => {
    client.invalidateQueries({ queryKey: queryKeys.packages.detail(id) })
    client.invalidateQueries({ queryKey: queryKeys.packages.actions(id) })
    client.invalidateQueries({ queryKey: queryKeys.packages.transitions(id) })
    client.invalidateQueries({ queryKey: queryKeys.packages.transportOrders(id) })
    client.invalidateQueries({ queryKey: queryKeys.packages.all() })
    client.invalidateQueries({ queryKey: queryKeys.dashboardStats() })
  }
}

export function useImportPackage() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (file: File) => endpoints.packages.import(file),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: queryKeys.packages.all() })
      client.invalidateQueries({ queryKey: queryKeys.dashboardStats() })
    },
  })
}

export function useImportMultiplePackages() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (files: File[]) => endpoints.packages.importMultiple(files),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: queryKeys.packages.all() })
      client.invalidateQueries({ queryKey: queryKeys.dashboardStats() })
    },
  })
}

export function useStartVerification(id: string) {
  const invalidate = useInvalidatePackage(id)
  return useMutation({
    mutationFn: () => endpoints.packages.startVerification(id),
    onSuccess: invalidate,
  })
}

export function useCancelVerification(id: string) {
  const invalidate = useInvalidatePackage(id)
  return useMutation({
    mutationFn: () => endpoints.packages.cancelVerification(id),
    onSuccess: invalidate,
  })
}

export function useFinishVerification(id: string) {
  const invalidate = useInvalidatePackage(id)
  return useMutation({
    mutationFn: () => endpoints.packages.finishVerification(id),
    onSuccess: invalidate,
  })
}

export function useResetVerification(id: string) {
  const invalidate = useInvalidatePackage(id)
  return useMutation({
    mutationFn: () => endpoints.packages.resetVerification(id),
    onSuccess: invalidate,
  })
}

export function useReprocessPackage(id: string) {
  const invalidate = useInvalidatePackage(id)
  return useMutation({
    mutationFn: () => endpoints.packages.reprocess(id),
    onSuccess: invalidate,
  })
}

interface TransportOrderMutationArgs<T> {
  packageId: string
  orderId: string
  body: T
}

interface InvoiceMutationArgs<T> {
  packageId: string
  orderId: string
  invoiceId: string
  body: T
}

export function useUpdateSeller() {
  return useMutation({
    mutationFn: ({ packageId, orderId, body }: TransportOrderMutationArgs<UpdatePartyRequest>) =>
      endpoints.transportOrders.updateSeller(packageId, orderId, body),
  })
}

export function useUpdateBuyer() {
  return useMutation({
    mutationFn: ({ packageId, orderId, body }: TransportOrderMutationArgs<UpdatePartyRequest>) =>
      endpoints.transportOrders.updateBuyer(packageId, orderId, body),
  })
}

export function useUpdateConsignor() {
  return useMutation({
    mutationFn: ({ packageId, orderId, body }: TransportOrderMutationArgs<UpdatePartyRequest>) =>
      endpoints.transportOrders.updateConsignor(packageId, orderId, body),
  })
}

export function useUpdateConsignee() {
  return useMutation({
    mutationFn: ({ packageId, orderId, body }: TransportOrderMutationArgs<UpdatePartyRequest>) =>
      endpoints.transportOrders.updateConsignee(packageId, orderId, body),
  })
}

export function useUpdateTransportInfo() {
  return useMutation({
    mutationFn: ({
      packageId,
      orderId,
      body,
    }: TransportOrderMutationArgs<UpdateTransportInfoRequest>) =>
      endpoints.transportOrders.updateTransportInfo(packageId, orderId, body),
  })
}

export function useUpdateInvoice() {
  return useMutation({
    mutationFn: ({
      packageId,
      orderId,
      invoiceId,
      body,
    }: InvoiceMutationArgs<UpdateInvoiceRequest>) =>
      endpoints.transportOrders.updateInvoice(packageId, orderId, invoiceId, body),
  })
}

export function useUpdateInvoiceLines() {
  return useMutation({
    mutationFn: ({
      packageId,
      orderId,
      invoiceId,
      body,
    }: InvoiceMutationArgs<UpdateInvoiceLinesRequest>) =>
      endpoints.transportOrders.updateInvoiceLines(packageId, orderId, invoiceId, body),
  })
}

export function useUpdateInvoiceTotals() {
  return useMutation({
    mutationFn: ({
      packageId,
      orderId,
      invoiceId,
      body,
    }: InvoiceMutationArgs<UpdateInvoiceTotalsRequest>) =>
      endpoints.transportOrders.updateInvoiceTotals(packageId, orderId, invoiceId, body),
  })
}

export function useUpdateDeliveryTerms() {
  return useMutation({
    mutationFn: ({
      packageId,
      orderId,
      invoiceId,
      body,
    }: InvoiceMutationArgs<UpdateDeliveryTermsRequest>) =>
      endpoints.transportOrders.updateDeliveryTerms(packageId, orderId, invoiceId, body),
  })
}
