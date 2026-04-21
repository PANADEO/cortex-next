"use client"

import type {
  AttachRuleRequest,
  CompileRuleRequest,
  DeletePackagesRequest,
  GetActionLogsQuery,
  GetDirtyPackagesQuery,
  GetPackagesQuery,
  GetRulesQuery,
  ImportMultiplePackagesBody,
  ImportPackageBody,
  PackageTransition,
  ReprocessRequest,
  RulePreviewRequest,
  SaveRuleVersionRequest,
  SetCustomStatusRequest,
  SetUserNotesRequest,
  SetUserPreferencesRequest,
  UpdateDeliveryTermsRequest,
  UpdateDocumentClassificationRequest,
  UpdateInvoiceLinesRequest,
  UpdateInvoiceRequest,
  UpdateInvoiceTotalsRequest,
  UpdatePartyRequest,
  UpdateTransportInfoRequest,
  UpsertDraftRequest,
  UpsertRuleRequest,
} from "@cortex/types"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { endpoints } from "./endpoints"
import { queryKeys } from "./query-keys"

export function useUser() {
  return useQuery({ queryKey: queryKeys.user(), queryFn: endpoints.user.me })
}

export function useUserPreferences() {
  return useQuery({
    queryKey: queryKeys.userPreferences(),
    queryFn: endpoints.user.getPreferences,
    staleTime: Infinity,
  })
}

export function useSetUserPreferences() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (body: SetUserPreferencesRequest) => endpoints.user.setPreferences(body),
    onSuccess: (res) => {
      client.setQueryData(queryKeys.userPreferences(), res)
    },
  })
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

export function usePackageSourceFiles(id: string) {
  return useQuery({
    queryKey: queryKeys.packages.sourceFiles(id),
    queryFn: () => endpoints.packages.sourceFiles(id),
    enabled: Boolean(id),
  })
}

export function useExportTemplates() {
  return useQuery({
    queryKey: queryKeys.exportTemplates(),
    queryFn: endpoints.packages.exportTemplates,
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
    mutationFn: (body: ImportPackageBody) => endpoints.packages.import(body),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: queryKeys.packages.all() })
      client.invalidateQueries({ queryKey: queryKeys.dashboardStats() })
    },
  })
}

export function useImportMultiplePackages() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (body: ImportMultiplePackagesBody) => endpoints.packages.importMultiple(body),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: queryKeys.packages.all() })
      client.invalidateQueries({ queryKey: queryKeys.dashboardStats() })
    },
  })
}

const TRANSITION_CALLS: Record<
  Exclude<PackageTransition, "reprocess">,
  (id: string) => Promise<Record<string, never>>
> = {
  start_verification: endpoints.packages.startVerification,
  cancel_verification: endpoints.packages.cancelVerification,
  finish_verification: endpoints.packages.finishVerification,
  reset_verification: endpoints.packages.resetVerification,
}

function useTransitionMutation(id: string, transition: Exclude<PackageTransition, "reprocess">) {
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

export function useReprocessPackage(id: string) {
  const invalidate = useInvalidatePackage(id)
  return useMutation({
    mutationFn: (body: ReprocessRequest = {}) => endpoints.packages.reprocess(id, body),
    onSuccess: invalidate,
  })
}

export function useSetCustomStatus(id: string) {
  const invalidate = useInvalidatePackage(id)
  return useMutation({
    mutationFn: (body: SetCustomStatusRequest) => endpoints.packages.setCustomStatus(id, body),
    onSuccess: invalidate,
  })
}

export function useSetUserNotes(id: string) {
  const invalidate = useInvalidatePackage(id)
  return useMutation({
    mutationFn: (body: SetUserNotesRequest) => endpoints.packages.setUserNotes(id, body),
    onSuccess: invalidate,
  })
}

export function useDeletePackages() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (body: DeletePackagesRequest) => endpoints.packages.deleteMany(body),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: queryKeys.packages.all() })
      client.invalidateQueries({ queryKey: queryKeys.dashboardStats() })
    },
  })
}

export function useRestorePackage(id: string) {
  const invalidate = useInvalidatePackage(id)
  return useMutation({
    mutationFn: () => endpoints.packages.restore(id),
    onSuccess: invalidate,
  })
}

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

// ── Classification ─────────────────────────────────────────────────
export function useDirtyPackages(query: GetDirtyPackagesQuery = {}) {
  return useQuery({
    queryKey: queryKeys.classification.list(query),
    queryFn: () => endpoints.classification.list(query),
    refetchInterval: 5_000,
  })
}

export function useDirtyPackage(id: string) {
  return useQuery({
    queryKey: queryKeys.classification.detail(id),
    queryFn: () => endpoints.classification.get(id),
    enabled: Boolean(id),
  })
}

function useInvalidateDirtyPackage(id: string) {
  const client = useQueryClient()
  return () => {
    client.invalidateQueries({ queryKey: queryKeys.classification.detail(id) })
    client.invalidateQueries({ queryKey: queryKeys.classification.all() })
  }
}

export function useAutoClassify(id: string) {
  const invalidate = useInvalidateDirtyPackage(id)
  return useMutation({
    mutationFn: () => endpoints.classification.autoClassify(id),
    onSuccess: invalidate,
  })
}

export function useUpdateDocumentClassification(id: string) {
  const invalidate = useInvalidateDirtyPackage(id)
  return useMutation({
    mutationFn: (args: { docId: string; body: UpdateDocumentClassificationRequest }) =>
      endpoints.classification.updateDocument(id, args.docId, args.body),
    onSuccess: invalidate,
  })
}

export function useUpsertDraft(id: string) {
  const invalidate = useInvalidateDirtyPackage(id)
  return useMutation({
    mutationFn: (body: UpsertDraftRequest) => endpoints.classification.upsertDraft(id, body),
    onSuccess: invalidate,
  })
}

export function useDeleteDraft(id: string) {
  const invalidate = useInvalidateDirtyPackage(id)
  return useMutation({
    mutationFn: (draftId: string) => endpoints.classification.deleteDraft(id, draftId),
    onSuccess: invalidate,
  })
}

export function usePromoteDirtyPackage(id: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: () => endpoints.classification.promote(id),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: queryKeys.classification.all() })
      client.invalidateQueries({ queryKey: queryKeys.packages.all() })
      client.invalidateQueries({ queryKey: queryKeys.dashboardStats() })
    },
  })
}

// ── Rules ──────────────────────────────────────────────────────────
export function useRules(query: GetRulesQuery = {}) {
  return useQuery({
    queryKey: queryKeys.rules.list(query),
    queryFn: () => endpoints.rules.list(query),
  })
}

export function useRule(id: string) {
  return useQuery({
    queryKey: queryKeys.rules.detail(id),
    queryFn: () => endpoints.rules.get(id),
    enabled: Boolean(id),
  })
}

export function useRuleTemplates() {
  return useQuery({
    queryKey: queryKeys.rules.templates(),
    queryFn: endpoints.rules.templates,
    staleTime: 5 * 60_000,
  })
}

export function useCreateRule() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (body: UpsertRuleRequest) => endpoints.rules.create(body),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: queryKeys.rules.all() })
    },
  })
}

export function useUpdateRule(id: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (body: UpsertRuleRequest) => endpoints.rules.update(id, body),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: queryKeys.rules.detail(id) })
      client.invalidateQueries({ queryKey: queryKeys.rules.all() })
    },
  })
}

export function useCompileRule() {
  return useMutation({
    mutationFn: (body: CompileRuleRequest) => endpoints.rules.compile(body),
  })
}

export function usePreviewRule() {
  return useMutation({
    mutationFn: (body: RulePreviewRequest) => endpoints.rules.preview(body),
  })
}

export function useSaveRuleVersion(id: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (body: SaveRuleVersionRequest) => endpoints.rules.saveVersion(id, body),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: queryKeys.rules.detail(id) })
      client.invalidateQueries({ queryKey: queryKeys.rules.all() })
    },
  })
}

export function usePackageRuleAttachments(packageId: string) {
  return useQuery({
    queryKey: queryKeys.packages.ruleAttachments(packageId),
    queryFn: () => endpoints.rules.listAttachments(packageId),
    enabled: Boolean(packageId),
  })
}

export function useAttachRule(packageId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (body: AttachRuleRequest) => endpoints.rules.attach(packageId, body),
    onSuccess: () => {
      client.invalidateQueries({
        queryKey: queryKeys.packages.ruleAttachments(packageId),
      })
    },
  })
}

export function useDetachRule(packageId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (attachmentId: string) => endpoints.rules.detach(packageId, attachmentId),
    onSuccess: () => {
      client.invalidateQueries({
        queryKey: queryKeys.packages.ruleAttachments(packageId),
      })
    },
  })
}

export function useRunAttachedRule(packageId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (attachmentId: string) =>
      endpoints.rules.runAttached(packageId, attachmentId),
    onSuccess: () => {
      client.invalidateQueries({
        queryKey: queryKeys.packages.ruleAttachments(packageId),
      })
    },
  })
}
