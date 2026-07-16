"use client"

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useMe } from "@cortex/api"
import { toast } from "sonner"
import { formatInvoiceSupervisorError, invoiceSupervisorApi } from "./api"
import type {
  InvoiceSupervisorClient,
  InvoiceSupervisorGenerateDraftInput,
  InvoiceSupervisorInvoice,
  InvoiceSupervisorInvoiceCreateInput,
  InvoiceSupervisorPolicy,
  InvoiceSupervisorSchedulerConfig,
} from "./types"

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
  invoicePayments: (id: number) => [...invoiceSupervisorQueryKeys.invoices(), id, "payments"] as const,

  clients: () => [...invoiceSupervisorQueryKeys.all, "clients"] as const,
  clientSearch: (query: string | undefined) => [...invoiceSupervisorQueryKeys.clients(), "search", query] as const,
  clientsWithExposure: () => [...invoiceSupervisorQueryKeys.clients(), "with-exposure"] as const,
  clientDetail: (id: number) => [...invoiceSupervisorQueryKeys.clients(), "detail", id] as const,
  clientExposure: (id: number) => [...invoiceSupervisorQueryKeys.clients(), id, "exposure"] as const,

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

export function useInvoiceSupervisorInvoices(params: { status?: string; client_id?: number; query?: string } = {}) {
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
  return useMutation({
    mutationFn: (data: InvoiceSupervisorInvoiceCreateInput) => invoiceSupervisorApi.createInvoice(data),
    onSuccess: () => {
      toast.success("Faktura dodana")
      invalidateInvoiceSupervisor(client)
    },
    onError: (error) => toast.error(formatInvoiceSupervisorError(error, "Nie udało się dodać faktury")),
  })
}

export function useInvoiceSupervisorUpdateInvoice(id: number) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<InvoiceSupervisorInvoice>) => invoiceSupervisorApi.updateInvoice(id, data),
    onSuccess: () => {
      toast.success("Faktura zaktualizowana")
      invalidateInvoiceSupervisor(client)
    },
    onError: (error) => toast.error(formatInvoiceSupervisorError(error, "Nie udało się zaktualizować faktury")),
  })
}

export function useInvoiceSupervisorDeleteInvoice() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => invoiceSupervisorApi.deleteInvoice(id),
    onSuccess: (_result, id) => {
      toast.success("Faktura usunięta")
      client.removeQueries({ queryKey: invoiceSupervisorQueryKeys.invoiceDetail(id) })
      invalidateInvoiceSupervisor(client)
    },
    onError: (error) => toast.error(formatInvoiceSupervisorError(error, "Nie udało się usunąć faktury")),
  })
}

export function useInvoiceSupervisorRegisterPayment(invoiceId: number) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ amount, paymentDate, note }: { amount: number; paymentDate: string; note?: string }) =>
      invoiceSupervisorApi.registerPayment(invoiceId, amount, paymentDate, note),
    onSuccess: () => {
      toast.success("Wpłata zarejestrowana")
      invalidateInvoiceSupervisor(client)
    },
    onError: (error) => toast.error(formatInvoiceSupervisorError(error, "Nie udało się zarejestrować wpłaty")),
  })
}

export function useInvoiceSupervisorMarkDisputed(invoiceId: number) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (note: string) => invoiceSupervisorApi.markInvoiceDisputed(invoiceId, note),
    onSuccess: () => {
      toast.success("Faktura oznaczona jako sporna")
      invalidateInvoiceSupervisor(client)
    },
    onError: (error) => toast.error(formatInvoiceSupervisorError(error, "Nie udało się oznaczyć sporu")),
  })
}

export function useInvoiceSupervisorClearDispute(invoiceId: number) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: () => invoiceSupervisorApi.clearInvoiceDispute(invoiceId),
    onSuccess: () => {
      toast.success("Spór wyczyszczony")
      invalidateInvoiceSupervisor(client)
    },
    onError: (error) => toast.error(formatInvoiceSupervisorError(error, "Nie udało się wyczyścić sporu")),
  })
}

export function useInvoiceSupervisorImportInvoices() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ file, onConflict }: { file: File; onConflict?: string }) =>
      invoiceSupervisorApi.importInvoices(file, onConflict),
    onSuccess: (result) => {
      toast.success(
        `Zaimportowano ${result.summary.imported} faktur${
          result.summary.conflicts ? `, konfliktów: ${result.summary.conflicts}` : ""
        }`,
      )
      invalidateInvoiceSupervisor(client)
    },
    onError: (error) => toast.error(formatInvoiceSupervisorError(error, "Nie udało się zaimportować pliku")),
  })
}

export function useInvoiceSupervisorForceInvoiceEscalation(invoiceId: number) {
  const client = useQueryClient()
  const me = useMe()
  return useMutation({
    mutationFn: (stage: string) =>
      invoiceSupervisorApi.forceInvoiceEscalation(invoiceId, stage, me.data?.email ?? "unknown"),
    onSuccess: () => {
      toast.success("Etap eskalacji wymuszony")
      invalidateInvoiceSupervisor(client)
    },
    onError: (error) => toast.error(formatInvoiceSupervisorError(error, "Nie udało się wymusić eskalacji")),
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
  return useMutation({
    mutationFn: (data: Partial<InvoiceSupervisorClient>) => invoiceSupervisorApi.createClient(data),
    onSuccess: () => {
      toast.success("Klient dodany")
      invalidateInvoiceSupervisor(client)
    },
    onError: (error) => toast.error(formatInvoiceSupervisorError(error, "Nie udało się dodać klienta")),
  })
}

export function useInvoiceSupervisorUpdateClient(id: number) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<InvoiceSupervisorClient>) => invoiceSupervisorApi.updateClient(id, data),
    onSuccess: () => {
      toast.success("Klient zaktualizowany")
      invalidateInvoiceSupervisor(client)
    },
    onError: (error) => toast.error(formatInvoiceSupervisorError(error, "Nie udało się zaktualizować klienta")),
  })
}

export function useInvoiceSupervisorForceClientEscalation(clientId: number) {
  const client = useQueryClient()
  const me = useMe()
  return useMutation({
    mutationFn: (stage: string) =>
      invoiceSupervisorApi.forceClientEscalation(clientId, stage, me.data?.email ?? "unknown"),
    onSuccess: (result) => {
      toast.success(`Eskalowano ${result.escalated_invoice_count} faktur do etapu: ${result.stage}`)
      invalidateInvoiceSupervisor(client)
    },
    onError: (error) => toast.error(formatInvoiceSupervisorError(error, "Nie udało się wymusić eskalacji")),
  })
}

// ---------------------------------------------------------------------------
// Policies & tones
// ---------------------------------------------------------------------------

export function useInvoiceSupervisorPolicies() {
  return useQuery({ queryKey: invoiceSupervisorQueryKeys.policies(), queryFn: invoiceSupervisorApi.listPolicies })
}

export function useInvoiceSupervisorTones() {
  return useQuery({ queryKey: invoiceSupervisorQueryKeys.tones(), queryFn: invoiceSupervisorApi.listTones })
}

export function useInvoiceSupervisorCreatePolicy() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<InvoiceSupervisorPolicy>) => invoiceSupervisorApi.createPolicy(data),
    onSuccess: () => {
      toast.success("Polityka dodana")
      invalidateInvoiceSupervisor(client)
    },
    onError: (error) => toast.error(formatInvoiceSupervisorError(error, "Nie udało się dodać polityki")),
  })
}

export function useInvoiceSupervisorUpdatePolicy() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<InvoiceSupervisorPolicy> }) =>
      invoiceSupervisorApi.updatePolicy(id, data),
    onSuccess: () => {
      toast.success("Polityka zaktualizowana")
      invalidateInvoiceSupervisor(client)
    },
    onError: (error) => toast.error(formatInvoiceSupervisorError(error, "Nie udało się zaktualizować polityki")),
  })
}

export function useInvoiceSupervisorSetDefaultPolicy() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => invoiceSupervisorApi.setDefaultPolicy(id),
    onSuccess: () => {
      toast.success("Ustawiono jako domyślną")
      invalidateInvoiceSupervisor(client)
    },
    onError: (error) => toast.error(formatInvoiceSupervisorError(error, "Nie udało się ustawić domyślnej")),
  })
}

export function useInvoiceSupervisorCreateTone() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ name, description }: { name: string; description: string }) =>
      invoiceSupervisorApi.createTone(name, description),
    onSuccess: () => {
      toast.success("Ton dodany")
      invalidateInvoiceSupervisor(client)
    },
    onError: (error) => toast.error(formatInvoiceSupervisorError(error, "Nie udało się dodać tonu")),
  })
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export function useInvoiceSupervisorTemplates() {
  return useQuery({ queryKey: invoiceSupervisorQueryKeys.templates(), queryFn: invoiceSupervisorApi.listTemplates })
}

export function useInvoiceSupervisorTemplateCoverage() {
  return useQuery({
    queryKey: invoiceSupervisorQueryKeys.templateCoverage(),
    queryFn: invoiceSupervisorApi.templateCoverage,
  })
}

export function useInvoiceSupervisorSaveTemplate() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: invoiceSupervisorApi.saveTemplate,
    onSuccess: () => {
      toast.success("Szablon zapisany")
      invalidateInvoiceSupervisor(client)
    },
    onError: (error) => toast.error(formatInvoiceSupervisorError(error, "Nie udało się zapisać szablonu")),
  })
}

export function useInvoiceSupervisorGenerateDraft() {
  return useMutation({
    mutationFn: (data: InvoiceSupervisorGenerateDraftInput) => invoiceSupervisorApi.generateTemplateDraft(data),
    onError: (error) => toast.error(formatInvoiceSupervisorError(error, "Nie udało się wygenerować treści")),
  })
}

export function useInvoiceSupervisorDeleteTemplate() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (templateId: number) => invoiceSupervisorApi.deleteTemplate(templateId),
    onSuccess: () => {
      toast.success("Szablon usunięty")
      invalidateInvoiceSupervisor(client)
    },
    onError: (error) => toast.error(formatInvoiceSupervisorError(error, "Nie udało się usunąć szablonu")),
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
  return useMutation({
    mutationFn: (data: Partial<InvoiceSupervisorSchedulerConfig>) => invoiceSupervisorApi.updateSchedulerConfig(data),
    onSuccess: () => {
      toast.success("Harmonogram zaktualizowany")
      invalidateInvoiceSupervisor(client)
    },
    onError: (error) => toast.error(formatInvoiceSupervisorError(error, "Nie udało się zapisać harmonogramu")),
  })
}

export function useInvoiceSupervisorRunSchedulerNow() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: invoiceSupervisorApi.runSchedulerNow,
    onSuccess: (result) => {
      toast.success(
        `Sprawdzono statusy (${result.statuses_updated} zaktualizowanych) — nowych propozycji: ${result.proposals_created}. Nic nie wysłano automatycznie.`,
      )
      invalidateInvoiceSupervisor(client)
    },
    onError: (error) => toast.error(formatInvoiceSupervisorError(error, "Nie udało się uruchomić sprawdzenia")),
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
  return useQuery({ queryKey: invoiceSupervisorQueryKeys.inboxAll(), queryFn: invoiceSupervisorApi.listAllProposals })
}

export function useInvoiceSupervisorApproveProposal() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => invoiceSupervisorApi.approveProposal(id),
    onSuccess: () => {
      toast.success("Propozycja zatwierdzona — wysyłka trafiła do kolejki")
      invalidateInvoiceSupervisor(client)
    },
    onError: (error) => toast.error(formatInvoiceSupervisorError(error, "Nie udało się zatwierdzić propozycji")),
  })
}

// ESC-003: payment_demand proposals must never reach this hook via bulk
// selection — callers are responsible for excluding them from the ids they
// pass in (the backend also enforces this and reports skips, see
// InvoiceSupervisorBulkApproveResult.skipped_payment_demand).
export function useInvoiceSupervisorBulkApproveProposals() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (ids: string[]) => invoiceSupervisorApi.bulkApproveProposals(ids),
    onSuccess: (result) => {
      const skipped = result.skipped_payment_demand.length
      toast.success(
        skipped > 0
          ? `Zatwierdzono ${result.approved} propozycji — ${skipped} wezwań do zapłaty wymaga pojedynczej akceptacji`
          : `Zatwierdzono ${result.approved} propozycji`,
      )
      invalidateInvoiceSupervisor(client)
    },
    onError: (error) => toast.error(formatInvoiceSupervisorError(error, "Nie udało się zatwierdzić propozycji")),
  })
}

export function useInvoiceSupervisorRejectProposal() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => invoiceSupervisorApi.rejectProposal(id),
    onSuccess: () => {
      toast.success("Propozycja odrzucona")
      invalidateInvoiceSupervisor(client)
    },
    onError: (error) => toast.error(formatInvoiceSupervisorError(error, "Nie udało się odrzucić propozycji")),
  })
}

export function useInvoiceSupervisorBulkRejectProposals() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (ids: string[]) => invoiceSupervisorApi.bulkRejectProposals(ids),
    onSuccess: (result) => {
      toast.success(`Odrzucono ${result.rejected} propozycji`)
      invalidateInvoiceSupervisor(client)
    },
    onError: (error) => toast.error(formatInvoiceSupervisorError(error, "Nie udało się odrzucić propozycji")),
  })
}

export function useInvoiceSupervisorEditProposal() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, subject, content }: { id: string; subject: string | null; content: string }) =>
      invoiceSupervisorApi.editProposal(id, subject, content),
    onSuccess: () => {
      toast.success("Treść zapisana")
      invalidateInvoiceSupervisor(client)
    },
    onError: (error) => toast.error(formatInvoiceSupervisorError(error, "Nie udało się zapisać treści")),
  })
}

export function useInvoiceSupervisorGenerateProposals() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: invoiceSupervisorApi.generateProposals,
    onSuccess: (stats) => {
      toast.success(`Odświeżono — nowych propozycji: ${stats.proposals_created ?? 0}`)
      invalidateInvoiceSupervisor(client)
    },
    onError: (error) => toast.error(formatInvoiceSupervisorError(error, "Nie udało się odświeżyć")),
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
