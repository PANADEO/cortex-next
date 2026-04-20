"use client"

import type {
  GetActionLogsQuery,
  GetPackagesQuery,
  PackageTransition,
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

const TRANSITION_CALLS: Record<PackageTransition, (id: string) => Promise<Record<string, never>>> = {
  start_verification: endpoints.packages.startVerification,
  cancel_verification: endpoints.packages.cancelVerification,
  finish_verification: endpoints.packages.finishVerification,
  reset_verification: endpoints.packages.resetVerification,
  reprocess: endpoints.packages.reprocess,
}

function useTransitionMutation(id: string, transition: PackageTransition) {
  const invalidate = useInvalidatePackage(id)
  return useMutation({
    mutationFn: () => TRANSITION_CALLS[transition](id),
    onSuccess: invalidate,
  })
}

export const useStartVerification = (id: string) => useTransitionMutation(id, "start_verification")
export const useCancelVerification = (id: string) =>
  useTransitionMutation(id, "cancel_verification")
export const useFinishVerification = (id: string) =>
  useTransitionMutation(id, "finish_verification")
export const useResetVerification = (id: string) =>
  useTransitionMutation(id, "reset_verification")
export const useReprocessPackage = (id: string) => useTransitionMutation(id, "reprocess")

interface TransportOrderArgs<T> {
  packageId: string
  orderId: string
  body: T
}

interface InvoiceArgs<T> {
  packageId: string
  orderId: string
  invoiceId: string
  body: T
}

function useTransportOrderMutation<Args extends { packageId: string }, R>(
  fn: (args: Args) => Promise<R>,
) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: (_res, args) => {
      client.invalidateQueries({ queryKey: queryKeys.packages.detail(args.packageId) })
      client.invalidateQueries({ queryKey: queryKeys.packages.actions(args.packageId) })
      client.invalidateQueries({
        queryKey: queryKeys.packages.transportOrders(args.packageId),
      })
    },
  })
}

export const useUpdateSeller = () =>
  useTransportOrderMutation((a: TransportOrderArgs<UpdatePartyRequest>) =>
    endpoints.transportOrders.updateSeller(a.packageId, a.orderId, a.body),
  )

export const useUpdateBuyer = () =>
  useTransportOrderMutation((a: TransportOrderArgs<UpdatePartyRequest>) =>
    endpoints.transportOrders.updateBuyer(a.packageId, a.orderId, a.body),
  )

export const useUpdateConsignor = () =>
  useTransportOrderMutation((a: TransportOrderArgs<UpdatePartyRequest>) =>
    endpoints.transportOrders.updateConsignor(a.packageId, a.orderId, a.body),
  )

export const useUpdateConsignee = () =>
  useTransportOrderMutation((a: TransportOrderArgs<UpdatePartyRequest>) =>
    endpoints.transportOrders.updateConsignee(a.packageId, a.orderId, a.body),
  )

export const useUpdateTransportInfo = () =>
  useTransportOrderMutation((a: TransportOrderArgs<UpdateTransportInfoRequest>) =>
    endpoints.transportOrders.updateTransportInfo(a.packageId, a.orderId, a.body),
  )

export const useUpdateInvoice = () =>
  useTransportOrderMutation((a: InvoiceArgs<UpdateInvoiceRequest>) =>
    endpoints.transportOrders.updateInvoice(a.packageId, a.orderId, a.invoiceId, a.body),
  )

export const useUpdateInvoiceLines = () =>
  useTransportOrderMutation((a: InvoiceArgs<UpdateInvoiceLinesRequest>) =>
    endpoints.transportOrders.updateInvoiceLines(a.packageId, a.orderId, a.invoiceId, a.body),
  )

export const useUpdateInvoiceTotals = () =>
  useTransportOrderMutation((a: InvoiceArgs<UpdateInvoiceTotalsRequest>) =>
    endpoints.transportOrders.updateInvoiceTotals(a.packageId, a.orderId, a.invoiceId, a.body),
  )

export const useUpdateDeliveryTerms = () =>
  useTransportOrderMutation((a: InvoiceArgs<UpdateDeliveryTermsRequest>) =>
    endpoints.transportOrders.updateDeliveryTerms(a.packageId, a.orderId, a.invoiceId, a.body),
  )
