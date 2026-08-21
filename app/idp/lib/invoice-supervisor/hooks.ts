"use client"

import { useMe } from "@cortex/api"
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { formatInvoiceSupervisorError, invoiceSupervisorApi } from "./api"
import type {
  InvoiceSupervisorClient,
  InvoiceSupervisorEscalationStage,
  InvoiceSupervisorGenerateDraftInput,
  InvoiceSupervisorInvoice,
  InvoiceSupervisorInvoiceCreateInput,
  InvoiceSupervisorPolicy,
  InvoiceSupervisorSchedulerConfig,
} from "./types"
import { INVOICE_SUPERVISOR_ESCALATION_STAGE_LABEL_KEYS } from "./types"

// Periodic refetch cadence for operational lists/summaries the user actively monitors
// on-screen (inbox, invoices, clients, notifications) — matches the flat "stats" polling
// interval used by other tiles, see lib/idp-basic/hooks.ts and lib/intrastat/hooks.ts.
// Deliberately NOT applied to single-record detail queries (invoice/client/payments/
// exposure) since those back pages where the user is actively reviewing or editing one
// specific record — see per-hook comments below.
const OPERATIONAL_REFETCH_MS = 10_000

export const invoiceSupervisorQueryKeys = {
  all: ["invoice-supervisor"] as const,

  invoices: () => [...invoiceSupervisorQueryKeys.all, "invoices"] as const,
  invoiceSearch: (params: { status?: string; client_id?: number; query?: string }) =>
    [...invoiceSupervisorQueryKeys.invoices(), "search", params] as const,
  invoiceDetail: (id: number) => [...invoiceSupervisorQueryKeys.invoices(), "detail", id] as const,
  invoicePayments: (id: number) =>
    [...invoiceSupervisorQueryKeys.invoices(), id, "payments"] as const,

  clients: () => [...invoiceSupervisorQueryKeys.all, "clients"] as const,
  clientSearch: (query: string | undefined) =>
    [...invoiceSupervisorQueryKeys.clients(), "search", query] as const,
  clientsWithExposure: () => [...invoiceSupervisorQueryKeys.clients(), "with-exposure"] as const,
  clientDetail: (id: number) => [...invoiceSupervisorQueryKeys.clients(), "detail", id] as const,
  clientExposure: (id: number) =>
    [...invoiceSupervisorQueryKeys.clients(), id, "exposure"] as const,

  policies: () => [...invoiceSupervisorQueryKeys.all, "policies"] as const,
  tones: () => [...invoiceSupervisorQueryKeys.all, "tones"] as const,

  templates: () => [...invoiceSupervisorQueryKeys.all, "templates"] as const,
  templateCoverage: () => [...invoiceSupervisorQueryKeys.templates(), "coverage"] as const,

  notificationLog: () => [...invoiceSupervisorQueryKeys.all, "notifications", "log"] as const,
  failedTasks: () => [...invoiceSupervisorQueryKeys.all, "notifications", "failed-tasks"] as const,

  schedulerConfig: () => [...invoiceSupervisorQueryKeys.all, "settings", "scheduler"] as const,

  inboxPending: () => [...invoiceSupervisorQueryKeys.all, "inbox", "pending"] as const,
  inboxAll: () => [...invoiceSupervisorQueryKeys.all, "inbox", "all"] as const,

  dashboardSummary: () => [...invoiceSupervisorQueryKeys.all, "dashboard", "summary"] as const,
}

function invalidateInvoiceSupervisor(client: ReturnType<typeof useQueryClient>) {
  client.invalidateQueries({ queryKey: invoiceSupervisorQueryKeys.all })
}

// ---------------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------------

export function useInvoiceSupervisorInvoices(
  params: { status?: string; client_id?: number; query?: string } = {},
) {
  return useQuery({
    queryKey: invoiceSupervisorQueryKeys.invoiceSearch(params),
    queryFn: () => invoiceSupervisorApi.searchInvoices(params),
    placeholderData: keepPreviousData,
    refetchInterval: OPERATIONAL_REFETCH_MS,
  })
}

// No refetchInterval: backs the invoice detail/edit page (payment registration, dispute
// actions) — polling would refetch out from under an in-progress edit.
export function useInvoiceSupervisorInvoice(id: number) {
  return useQuery({
    queryKey: invoiceSupervisorQueryKeys.invoiceDetail(id),
    queryFn: () => invoiceSupervisorApi.getInvoice(id),
    enabled: Number.isFinite(id),
  })
}

// No refetchInterval: same invoice detail/edit page as above.
export function useInvoiceSupervisorPayments(id: number) {
  return useQuery({
    queryKey: invoiceSupervisorQueryKeys.invoicePayments(id),
    queryFn: () => invoiceSupervisorApi.getPayments(id),
    enabled: Number.isFinite(id),
  })
}

export function useInvoiceSupervisorCreateInvoice() {
  const client = useQueryClient()
  const { t } = useTranslation("invoice-supervisor")
  return useMutation({
    mutationFn: (data: InvoiceSupervisorInvoiceCreateInput) =>
      invoiceSupervisorApi.createInvoice(data),
    onSuccess: () => {
      toast.success(t("toasts.invoiceCreated"))
      invalidateInvoiceSupervisor(client)
    },
    onError: (error) => toast.error(formatInvoiceSupervisorError(error, t("errors.createInvoice"))),
  })
}

export function useInvoiceSupervisorUpdateInvoice(id: number) {
  const client = useQueryClient()
  const { t } = useTranslation("invoice-supervisor")
  return useMutation({
    mutationFn: (data: Partial<InvoiceSupervisorInvoice>) =>
      invoiceSupervisorApi.updateInvoice(id, data),
    onSuccess: () => {
      toast.success(t("toasts.invoiceUpdated"))
      invalidateInvoiceSupervisor(client)
    },
    onError: (error) => toast.error(formatInvoiceSupervisorError(error, t("errors.updateInvoice"))),
  })
}

export function useInvoiceSupervisorDeleteInvoice() {
  const client = useQueryClient()
  const { t } = useTranslation("invoice-supervisor")
  return useMutation({
    mutationFn: (id: number) => invoiceSupervisorApi.deleteInvoice(id),
    onSuccess: (_result, id) => {
      toast.success(t("toasts.invoiceDeleted"))
      client.removeQueries({ queryKey: invoiceSupervisorQueryKeys.invoiceDetail(id) })
      invalidateInvoiceSupervisor(client)
    },
    onError: (error) => toast.error(formatInvoiceSupervisorError(error, t("errors.deleteInvoice"))),
  })
}

export function useInvoiceSupervisorRegisterPayment(invoiceId: number) {
  const client = useQueryClient()
  const { t } = useTranslation("invoice-supervisor")
  return useMutation({
    mutationFn: ({
      amount,
      paymentDate,
      note,
    }: {
      amount: number
      paymentDate: string
      note?: string
    }) => invoiceSupervisorApi.registerPayment(invoiceId, amount, paymentDate, note),
    onSuccess: () => {
      toast.success(t("toasts.paymentRegistered"))
      invalidateInvoiceSupervisor(client)
    },
    onError: (error) =>
      toast.error(formatInvoiceSupervisorError(error, t("errors.registerPayment"))),
  })
}

export function useInvoiceSupervisorMarkDisputed(invoiceId: number) {
  const client = useQueryClient()
  const { t } = useTranslation("invoice-supervisor")
  return useMutation({
    mutationFn: (note: string) => invoiceSupervisorApi.markInvoiceDisputed(invoiceId, note),
    onSuccess: () => {
      toast.success(t("toasts.invoiceDisputed"))
      invalidateInvoiceSupervisor(client)
    },
    onError: (error) => toast.error(formatInvoiceSupervisorError(error, t("errors.markDisputed"))),
  })
}

export function useInvoiceSupervisorClearDispute(invoiceId: number) {
  const client = useQueryClient()
  const { t } = useTranslation("invoice-supervisor")
  return useMutation({
    mutationFn: () => invoiceSupervisorApi.clearInvoiceDispute(invoiceId),
    onSuccess: () => {
      toast.success(t("toasts.disputeCleared"))
      invalidateInvoiceSupervisor(client)
    },
    onError: (error) => toast.error(formatInvoiceSupervisorError(error, t("errors.clearDispute"))),
  })
}

export function useInvoiceSupervisorImportInvoices() {
  const client = useQueryClient()
  const { t } = useTranslation("invoice-supervisor")
  return useMutation({
    mutationFn: ({ file, onConflict }: { file: File; onConflict?: string }) =>
      invoiceSupervisorApi.importInvoices(file, onConflict),
    onSuccess: (result) => {
      toast.success(
        result.summary.conflicts
          ? t("toasts.invoicesImportedWithConflicts", {
              count: result.summary.imported,
              conflicts: result.summary.conflicts,
            })
          : t("toasts.invoicesImported", { count: result.summary.imported }),
      )
      invalidateInvoiceSupervisor(client)
    },
    onError: (error) =>
      toast.error(formatInvoiceSupervisorError(error, t("errors.importInvoices"))),
  })
}

export function useInvoiceSupervisorForceInvoiceEscalation(invoiceId: number) {
  const client = useQueryClient()
  const me = useMe()
  const { t } = useTranslation("invoice-supervisor")
  return useMutation({
    mutationFn: (stage: string) =>
      invoiceSupervisorApi.forceInvoiceEscalation(invoiceId, stage, me.data?.email ?? "unknown"),
    onSuccess: () => {
      toast.success(t("toasts.escalationForced"))
      invalidateInvoiceSupervisor(client)
    },
    onError: (error) =>
      toast.error(formatInvoiceSupervisorError(error, t("errors.forceEscalation"))),
  })
}

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------

export function useInvoiceSupervisorClients(query?: string) {
  return useQuery({
    queryKey: invoiceSupervisorQueryKeys.clientSearch(query),
    queryFn: () => invoiceSupervisorApi.listClients(query),
  })
}

export function useInvoiceSupervisorClientsWithExposure() {
  return useQuery({
    queryKey: invoiceSupervisorQueryKeys.clientsWithExposure(),
    queryFn: invoiceSupervisorApi.listClientsWithExposure,
    refetchInterval: OPERATIONAL_REFETCH_MS,
  })
}

// No refetchInterval: backs the client detail page, which hosts an edit dialog for this
// same client record — polling would refetch out from under an in-progress edit.
export function useInvoiceSupervisorClient(id: number) {
  return useQuery({
    queryKey: invoiceSupervisorQueryKeys.clientDetail(id),
    queryFn: () => invoiceSupervisorApi.getClient(id),
    enabled: Number.isFinite(id),
  })
}

// No refetchInterval: same client detail page as above.
export function useInvoiceSupervisorClientExposure(id: number) {
  return useQuery({
    queryKey: invoiceSupervisorQueryKeys.clientExposure(id),
    queryFn: () => invoiceSupervisorApi.getClientExposure(id),
    enabled: Number.isFinite(id),
  })
}

export function useInvoiceSupervisorCreateClient() {
  const client = useQueryClient()
  const { t } = useTranslation("invoice-supervisor")
  return useMutation({
    mutationFn: (data: Partial<InvoiceSupervisorClient>) => invoiceSupervisorApi.createClient(data),
    onSuccess: () => {
      toast.success(t("toasts.clientCreated"))
      invalidateInvoiceSupervisor(client)
    },
    onError: (error) => toast.error(formatInvoiceSupervisorError(error, t("errors.createClient"))),
  })
}

export function useInvoiceSupervisorUpdateClient(id: number) {
  const client = useQueryClient()
  const { t } = useTranslation("invoice-supervisor")
  return useMutation({
    mutationFn: (data: Partial<InvoiceSupervisorClient>) =>
      invoiceSupervisorApi.updateClient(id, data),
    onSuccess: () => {
      toast.success(t("toasts.clientUpdated"))
      invalidateInvoiceSupervisor(client)
    },
    onError: (error) => toast.error(formatInvoiceSupervisorError(error, t("errors.updateClient"))),
  })
}

export function useInvoiceSupervisorForceClientEscalation(clientId: number) {
  const client = useQueryClient()
  const me = useMe()
  const { t } = useTranslation("invoice-supervisor")
  return useMutation({
    mutationFn: (stage: string) =>
      invoiceSupervisorApi.forceClientEscalation(clientId, stage, me.data?.email ?? "unknown"),
    onSuccess: (result) => {
      // Backend zwraca etap jako `string` (surowy identyfikator, np. `payment_demand`).
      // Bez tego przekładu toast pokazywałby co innego niż okno potwierdzenia
      // tuż przed nim — ten sam wzorzec z zapasem stoi w notifications/page.tsx.
      const stageLabelKey =
        INVOICE_SUPERVISOR_ESCALATION_STAGE_LABEL_KEYS[
          result.stage as InvoiceSupervisorEscalationStage
        ]
      toast.success(
        t("toasts.clientEscalationForced", {
          count: result.escalated_invoice_count,
          stage: stageLabelKey ? t(stageLabelKey) : result.stage,
        }),
      )
      invalidateInvoiceSupervisor(client)
    },
    onError: (error) =>
      toast.error(formatInvoiceSupervisorError(error, t("errors.forceEscalation"))),
  })
}

// ---------------------------------------------------------------------------
// Policies & tones
// ---------------------------------------------------------------------------

export function useInvoiceSupervisorPolicies() {
  return useQuery({
    queryKey: invoiceSupervisorQueryKeys.policies(),
    queryFn: invoiceSupervisorApi.listPolicies,
  })
}

export function useInvoiceSupervisorTones() {
  return useQuery({
    queryKey: invoiceSupervisorQueryKeys.tones(),
    queryFn: invoiceSupervisorApi.listTones,
  })
}

export function useInvoiceSupervisorCreatePolicy() {
  const client = useQueryClient()
  const { t } = useTranslation("invoice-supervisor")
  return useMutation({
    mutationFn: (data: Partial<InvoiceSupervisorPolicy>) => invoiceSupervisorApi.createPolicy(data),
    onSuccess: () => {
      toast.success(t("toasts.policyCreated"))
      invalidateInvoiceSupervisor(client)
    },
    onError: (error) => toast.error(formatInvoiceSupervisorError(error, t("errors.createPolicy"))),
  })
}

export function useInvoiceSupervisorUpdatePolicy() {
  const client = useQueryClient()
  const { t } = useTranslation("invoice-supervisor")
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<InvoiceSupervisorPolicy> }) =>
      invoiceSupervisorApi.updatePolicy(id, data),
    onSuccess: () => {
      toast.success(t("toasts.policyUpdated"))
      invalidateInvoiceSupervisor(client)
    },
    onError: (error) => toast.error(formatInvoiceSupervisorError(error, t("errors.updatePolicy"))),
  })
}

export function useInvoiceSupervisorSetDefaultPolicy() {
  const client = useQueryClient()
  const { t } = useTranslation("invoice-supervisor")
  return useMutation({
    mutationFn: (id: number) => invoiceSupervisorApi.setDefaultPolicy(id),
    onSuccess: () => {
      toast.success(t("toasts.policyDefaultSet"))
      invalidateInvoiceSupervisor(client)
    },
    onError: (error) =>
      toast.error(formatInvoiceSupervisorError(error, t("errors.setDefaultPolicy"))),
  })
}

export function useInvoiceSupervisorCreateTone() {
  const client = useQueryClient()
  const { t } = useTranslation("invoice-supervisor")
  return useMutation({
    mutationFn: ({ name, description }: { name: string; description: string }) =>
      invoiceSupervisorApi.createTone(name, description),
    onSuccess: () => {
      toast.success(t("toasts.toneCreated"))
      invalidateInvoiceSupervisor(client)
    },
    onError: (error) => toast.error(formatInvoiceSupervisorError(error, t("errors.createTone"))),
  })
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export function useInvoiceSupervisorTemplates() {
  return useQuery({
    queryKey: invoiceSupervisorQueryKeys.templates(),
    queryFn: invoiceSupervisorApi.listTemplates,
  })
}

export function useInvoiceSupervisorTemplateCoverage() {
  return useQuery({
    queryKey: invoiceSupervisorQueryKeys.templateCoverage(),
    queryFn: invoiceSupervisorApi.templateCoverage,
  })
}

export function useInvoiceSupervisorSaveTemplate() {
  const client = useQueryClient()
  const { t } = useTranslation("invoice-supervisor")
  return useMutation({
    mutationFn: invoiceSupervisorApi.saveTemplate,
    onSuccess: () => {
      toast.success(t("toasts.templateSaved"))
      invalidateInvoiceSupervisor(client)
    },
    onError: (error) => toast.error(formatInvoiceSupervisorError(error, t("errors.saveTemplate"))),
  })
}

export function useInvoiceSupervisorGenerateDraft() {
  const { t } = useTranslation("invoice-supervisor")
  return useMutation({
    mutationFn: (data: InvoiceSupervisorGenerateDraftInput) =>
      invoiceSupervisorApi.generateTemplateDraft(data),
    onError: (error) => toast.error(formatInvoiceSupervisorError(error, t("errors.generateDraft"))),
  })
}

export function useInvoiceSupervisorDeleteTemplate() {
  const client = useQueryClient()
  const { t } = useTranslation("invoice-supervisor")
  return useMutation({
    mutationFn: (templateId: number) => invoiceSupervisorApi.deleteTemplate(templateId),
    onSuccess: () => {
      toast.success(t("toasts.templateDeleted"))
      invalidateInvoiceSupervisor(client)
    },
    onError: (error) =>
      toast.error(formatInvoiceSupervisorError(error, t("errors.deleteTemplate"))),
  })
}

// ---------------------------------------------------------------------------
// Notifications (read-only)
// ---------------------------------------------------------------------------

export function useInvoiceSupervisorNotificationLog() {
  return useQuery({
    queryKey: invoiceSupervisorQueryKeys.notificationLog(),
    queryFn: invoiceSupervisorApi.notificationLog,
    refetchInterval: OPERATIONAL_REFETCH_MS,
  })
}

export function useInvoiceSupervisorFailedTasks() {
  return useQuery({
    queryKey: invoiceSupervisorQueryKeys.failedTasks(),
    queryFn: invoiceSupervisorApi.failedTasks,
    refetchInterval: OPERATIONAL_REFETCH_MS,
  })
}

// ---------------------------------------------------------------------------
// Settings / scheduler
// ---------------------------------------------------------------------------

export function useInvoiceSupervisorSchedulerConfig() {
  return useQuery({
    queryKey: invoiceSupervisorQueryKeys.schedulerConfig(),
    queryFn: invoiceSupervisorApi.schedulerConfig,
  })
}

export function useInvoiceSupervisorUpdateSchedulerConfig() {
  const client = useQueryClient()
  const { t } = useTranslation("invoice-supervisor")
  return useMutation({
    mutationFn: (data: Partial<InvoiceSupervisorSchedulerConfig>) =>
      invoiceSupervisorApi.updateSchedulerConfig(data),
    onSuccess: () => {
      toast.success(t("toasts.schedulerUpdated"))
      invalidateInvoiceSupervisor(client)
    },
    onError: (error) => toast.error(formatInvoiceSupervisorError(error, t("errors.saveScheduler"))),
  })
}

export function useInvoiceSupervisorRunSchedulerNow() {
  const client = useQueryClient()
  const { t } = useTranslation("invoice-supervisor")
  return useMutation({
    mutationFn: invoiceSupervisorApi.runSchedulerNow,
    onSuccess: (result) => {
      toast.success(
        t("toasts.schedulerRun", {
          count: result.statuses_updated,
          created: result.proposals_created,
        }),
      )
      invalidateInvoiceSupervisor(client)
    },
    onError: (error) => toast.error(formatInvoiceSupervisorError(error, t("errors.runScheduler"))),
  })
}

// ---------------------------------------------------------------------------
// Inbox (Skrzynka) / proposals — AI-002/003/004, ESC-003.
// ---------------------------------------------------------------------------

export function useInvoiceSupervisorPendingProposals() {
  return useQuery({
    queryKey: invoiceSupervisorQueryKeys.inboxPending(),
    queryFn: invoiceSupervisorApi.listPendingProposals,
    refetchInterval: OPERATIONAL_REFETCH_MS,
  })
}

// No refetchInterval: not currently rendered by any page (no "all proposals" view exists
// yet) — add the same OPERATIONAL_REFETCH_MS once a consuming page shows up.
export function useInvoiceSupervisorAllProposals() {
  return useQuery({
    queryKey: invoiceSupervisorQueryKeys.inboxAll(),
    queryFn: invoiceSupervisorApi.listAllProposals,
  })
}

export function useInvoiceSupervisorApproveProposal() {
  const client = useQueryClient()
  const { t } = useTranslation("invoice-supervisor")
  return useMutation({
    mutationFn: (id: string) => invoiceSupervisorApi.approveProposal(id),
    onSuccess: () => {
      toast.success(t("toasts.proposalApproved"))
      invalidateInvoiceSupervisor(client)
    },
    onError: (error) =>
      toast.error(formatInvoiceSupervisorError(error, t("errors.approveProposal"))),
  })
}

// ESC-003: payment_demand proposals must never reach this hook via bulk
// selection — callers are responsible for excluding them from the ids they
// pass in (the backend also enforces this and reports skips, see
// InvoiceSupervisorBulkApproveResult.skipped_payment_demand).
export function useInvoiceSupervisorBulkApproveProposals() {
  const client = useQueryClient()
  const { t } = useTranslation("invoice-supervisor")
  return useMutation({
    mutationFn: (ids: string[]) => invoiceSupervisorApi.bulkApproveProposals(ids),
    onSuccess: (result) => {
      const skipped = result.skipped_payment_demand.length
      toast.success(
        skipped > 0
          ? t("toasts.proposalsApprovedWithSkipped", { count: result.approved, skipped })
          : t("toasts.proposalsApproved", { count: result.approved }),
      )
      invalidateInvoiceSupervisor(client)
    },
    onError: (error) =>
      toast.error(formatInvoiceSupervisorError(error, t("errors.approveProposal"))),
  })
}

export function useInvoiceSupervisorRejectProposal() {
  const client = useQueryClient()
  const { t } = useTranslation("invoice-supervisor")
  return useMutation({
    mutationFn: (id: string) => invoiceSupervisorApi.rejectProposal(id),
    onSuccess: () => {
      toast.success(t("toasts.proposalRejected"))
      invalidateInvoiceSupervisor(client)
    },
    onError: (error) =>
      toast.error(formatInvoiceSupervisorError(error, t("errors.rejectProposal"))),
  })
}

export function useInvoiceSupervisorBulkRejectProposals() {
  const client = useQueryClient()
  const { t } = useTranslation("invoice-supervisor")
  return useMutation({
    mutationFn: (ids: string[]) => invoiceSupervisorApi.bulkRejectProposals(ids),
    onSuccess: (result) => {
      toast.success(t("toasts.proposalsRejected", { count: result.rejected }))
      invalidateInvoiceSupervisor(client)
    },
    onError: (error) =>
      toast.error(formatInvoiceSupervisorError(error, t("errors.rejectProposal"))),
  })
}

export function useInvoiceSupervisorEditProposal() {
  const client = useQueryClient()
  const { t } = useTranslation("invoice-supervisor")
  return useMutation({
    mutationFn: ({
      id,
      subject,
      content,
    }: {
      id: string
      subject: string | null
      content: string
    }) => invoiceSupervisorApi.editProposal(id, subject, content),
    onSuccess: () => {
      toast.success(t("toasts.proposalSaved"))
      invalidateInvoiceSupervisor(client)
    },
    onError: (error) => toast.error(formatInvoiceSupervisorError(error, t("errors.saveProposal"))),
  })
}

export function useInvoiceSupervisorGenerateProposals() {
  const client = useQueryClient()
  const { t } = useTranslation("invoice-supervisor")
  return useMutation({
    mutationFn: invoiceSupervisorApi.generateProposals,
    onSuccess: (stats) => {
      toast.success(t("toasts.proposalsRefreshed", { created: stats.proposals_created ?? 0 }))
      invalidateInvoiceSupervisor(client)
    },
    onError: (error) =>
      toast.error(formatInvoiceSupervisorError(error, t("errors.refreshProposals"))),
  })
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export function useInvoiceSupervisorDashboardSummary() {
  return useQuery({
    queryKey: invoiceSupervisorQueryKeys.dashboardSummary(),
    queryFn: invoiceSupervisorApi.dashboardSummary,
    refetchInterval: OPERATIONAL_REFETCH_MS,
  })
}
