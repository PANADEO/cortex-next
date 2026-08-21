import { formatAbsolute, formatMoney } from "@cortex/utils"

// Domain enums — mirrors invoice_supervisor backend (src/domain) and the
// standalone frontend-next prototype's lib/domain-types.ts.

// Formatting — wraps @cortex/utils' generic formatMoney/formatAbsolute with
// this domain's fixed PL locale/currency conventions (prototype's
// formatCurrency/formatDate produced "12 500,00 zł" / "14.02.2025"). Shared
// here so every page/component in this tile formats money and dates
// identically instead of each hand-rolling Intl.NumberFormat calls.
export function formatInvoiceSupervisorCurrency(amount: number, currency = "PLN"): string {
  return formatMoney(String(amount), { currency, locale: "pl-PL" })
}

export function formatInvoiceSupervisorMultiCurrency(
  total: number,
  breakdown: Record<string, number> | undefined,
): string {
  if (!breakdown) return formatInvoiceSupervisorCurrency(total)
  const entries = Object.entries(breakdown)
  if (entries.length === 0) return formatInvoiceSupervisorCurrency(total)
  if (entries.length === 1) {
    const [currency, amount] = entries[0]!
    return formatInvoiceSupervisorCurrency(amount, currency)
  }
  return entries
    .map(([currency, amount]) => formatInvoiceSupervisorCurrency(amount, currency))
    .join(" · ")
}

export function formatInvoiceSupervisorDate(value: string): string {
  return formatAbsolute(value, "dd.MM.yyyy")
}

export function formatInvoiceSupervisorDateTime(value: string): string {
  return formatAbsolute(value, "dd.MM.yyyy, HH:mm")
}

export type InvoiceSupervisorEscalationStage =
  "proactive" | "first_reminder" | "follow_up_reminder" | "payment_demand"

export const INVOICE_SUPERVISOR_ESCALATION_STAGE_LABELS: Record<
  InvoiceSupervisorEscalationStage,
  string
> = {
  proactive: "Proaktywne",
  first_reminder: "Pierwsze przypomnienie",
  follow_up_reminder: "Kolejne przypomnienie",
  payment_demand: "Wezwanie do zapłaty",
}

// Tailwind classes per stage — deliberately escalating in visual intensity
// (blue -> amber -> orange -> red) so the urgency is legible at a glance.
export const INVOICE_SUPERVISOR_ESCALATION_STAGE_COLORS: Record<
  InvoiceSupervisorEscalationStage,
  string
> = {
  proactive: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  first_reminder: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  follow_up_reminder: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
  payment_demand: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
}

export type InvoiceSupervisorInvoiceStatus =
  "pending" | "upcoming" | "due_today" | "overdue" | "paid" | "partially_paid" | "disputed"

export const INVOICE_SUPERVISOR_INVOICE_STATUS_LABELS: Record<
  InvoiceSupervisorInvoiceStatus,
  string
> = {
  pending: "Oczekująca",
  upcoming: "Zbliża się termin",
  due_today: "Termin dzisiaj",
  overdue: "Po terminie",
  paid: "Zapłacona",
  partially_paid: "Częściowo zapłacona",
  disputed: "Sporna",
}

export const INVOICE_SUPERVISOR_INVOICE_STATUS_COLORS: Record<
  InvoiceSupervisorInvoiceStatus,
  string
> = {
  pending: "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300",
  upcoming: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  due_today: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  overdue: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
  paid: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  partially_paid: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
  disputed: "bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300",
}

export type InvoiceSupervisorChannel = "email" | "sms"

export const INVOICE_SUPERVISOR_CHANNEL_LABELS: Record<InvoiceSupervisorChannel, string> = {
  email: "E-mail",
  sms: "SMS",
}

export type InvoiceSupervisorProposalStatus =
  "pending" | "approved" | "rejected" | "edited" | "sent"

export type InvoiceSupervisorRestrictiveness = "mała" | "średnia" | "duża" | "surowa"

export type InvoiceSupervisorClientType = "nowy" | "stały" | "vip"

export const INVOICE_SUPERVISOR_CLIENT_TYPE_LABELS: Record<InvoiceSupervisorClientType, string> = {
  nowy: "Nowy",
  stały: "Stały",
  vip: "VIP",
}

// Invoices

export interface InvoiceSupervisorInvoice {
  id: number
  invoice_number: string
  client_id: number
  client_name: string
  issue_date: string
  due_date: string
  amount: number
  currency: string
  status: InvoiceSupervisorInvoiceStatus
  seller_name: string
  bank_account: string | null
  payment_date: string | null
  paid_amount: number
  remaining_amount?: number
  dispute_note: string | null
  disputed_at: string | null
}

export interface InvoiceSupervisorPayment {
  id: number
  invoice_id: number
  amount: number
  payment_date: string
  note: string | null
  created_at: string
  created_by: string | null
}

export interface InvoiceSupervisorInvoiceCreateInput {
  invoice_number: string
  client_name: string
  issue_date: string
  due_date: string
  amount: number
  currency: string
  seller_name: string
  bank_account?: string
}

export interface InvoiceSupervisorImportResult {
  imported: number[]
  errors: Array<{ row_number: number; message: string }>
  conflicts: Array<{
    row_number: number
    invoice_number: string
    existing_id: number
    row_data: Record<string, unknown>
  }>
  summary: { total_rows: number; imported: number; errors: number; conflicts: number }
}

// Clients

export interface InvoiceSupervisorClient {
  id: number
  name: string
  type: InvoiceSupervisorClientType
  description: string | null
  email: string | null
  phone: string | null
  assigned_to: string | null
}

export interface InvoiceSupervisorClientWithExposure {
  id: number
  name: string
  type: InvoiceSupervisorClientType
  email: string | null
  phone: string | null
  total_outstanding: number
  invoice_count: number
  currency_breakdown?: Record<string, number>
}

export interface InvoiceSupervisorClientExposure {
  total_outstanding: number
  invoice_count: number
  overdue_count: number
  currency_breakdown: Record<string, number>
}

export interface InvoiceSupervisorForceClientEscalationResult {
  escalated_invoice_count: number
  stage: string
}

// Policies & tones

export interface InvoiceSupervisorPolicy {
  id: number
  name: string
  description: string | null
  restrictiveness: InvoiceSupervisorRestrictiveness
  enable_email: boolean
  enable_sms: boolean
  client_id: number | null
  client_name: string | null
  tone_id: number | null
  tone_name: string | null
  payment_demand_threshold_days: number | null
  is_default: boolean
}

export interface InvoiceSupervisorTone {
  id: number
  kind: "corporate" | "colleague" | "custom"
  name: string
  description: string | null
  is_editable: boolean
}

// Templates

export interface InvoiceSupervisorMessageTemplate {
  id: number
  tone_id: number
  channel: InvoiceSupervisorChannel
  escalation_stage: InvoiceSupervisorEscalationStage
  subject: string | null
  body: string
  is_seed: boolean
}

export interface InvoiceSupervisorCoverageEntry {
  exists: boolean
  template_id: number | null
}

export type InvoiceSupervisorCoverageMatrix = Record<
  string,
  {
    tone_name: string
    kind: string
    channels: Record<string, Record<string, InvoiceSupervisorCoverageEntry>>
  }
>

export interface InvoiceSupervisorGenerateDraftInput {
  tone_name: string
  tone_description: string
  channel: InvoiceSupervisorChannel
  escalation_stage: InvoiceSupervisorEscalationStage
  selected_variable_keys: string[]
  extra_hint?: string
}

export interface InvoiceSupervisorGenerateDraftResult {
  subject: string | null
  body: string
}

export const INVOICE_SUPERVISOR_TEMPLATE_VARIABLES: Record<string, string> = {
  numer_faktury: "Numer faktury",
  kwota: "Kwota",
  kwota_pozostala: "Kwota pozostała",
  waluta: "Waluta",
  termin_platnosci: "Termin płatności",
  dni_po_terminie: "Dni po terminie",
  nazwa_klienta: "Nazwa klienta",
  link_platnosci: "Link do płatności",
  nazwa_sprzedawcy: "Nazwa sprzedawcy",
  numer_konta: "Numer konta",
}

// Notifications

export interface InvoiceSupervisorNotificationLogEntry {
  id: number
  invoice_id: number
  client_id: number
  channel: InvoiceSupervisorChannel
  recipient: string
  subject: string | null
  provider: string
  status: string
  external_id: string | null
  sent_at: string | null
  error_message: string | null
  retry_count: number
  invoice_number: string
  amount: number
  currency: string
  client_name: string
}

export interface InvoiceSupervisorFailedTask {
  id: string
  task_type: InvoiceSupervisorChannel
  invoice_id: number
  client_id: number
  status: string
  retry_count: number
  error_message: string | null
  last_error_at: string | null
}

// Settings / scheduler

export interface InvoiceSupervisorSchedulerConfig {
  enabled: boolean
  interval_hours: number
  start_hour: number
  start_minute: number
  days: string[]
  is_running: boolean
  next_run_time: string | null
}

export interface InvoiceSupervisorSchedulerRunResult {
  timestamp: string
  duration_seconds: number
  statuses_processed: number
  statuses_updated: number
  status_breakdown: Record<string, number>
  proposals_created: number
  proposals_skipped: number
  proposals_blocked_missing_template: number
}

// Inbox (Skrzynka) — AI-generated proposals awaiting human review.
//
// Safety-critical, do not lose these distinctions when building UI on top:
// - AI-002: "approve" only ever creates an outbox task — it never sends
//   anything itself (the notification worker polls independently).
// - ESC-003: proposals with escalation_stage === "payment_demand" must
//   never be bulk-approved or included in bulk-selection state — they
//   always require individual review/approval.

export interface InvoiceSupervisorProposal {
  id: string
  invoice_id: number
  client_id: number
  policy_id: number | null
  template_id: number | null
  channel: InvoiceSupervisorChannel
  escalation_stage: InvoiceSupervisorEscalationStage
  escalation_days_reference: number
  escalation_forced: 0 | 1
  proposal_subject: string | null
  proposal_content: string | null
  ai_reasoning: string | null
  status: InvoiceSupervisorProposalStatus
  generated_at: string
  reviewed_at: string | null
  reviewed_by: string | null
  invoice_number: string
  amount: number
  currency: string
  due_date: string
  invoice_status: string
  client_name: string
  client_type: string
  client_email: string | null
  client_phone: string | null
  policy_name: string | null
}

export interface InvoiceSupervisorBulkApproveResult {
  approved: number
  // ESC-003 — ids skipped because they were payment_demand stage; these
  // always require individual approval, never bulk.
  skipped_payment_demand: string[]
}

// Dashboard

export interface InvoiceSupervisorDashboardSummary {
  status_counts: Record<string, number>
  total_overdue: number
  overdue_currency_breakdown?: Record<string, number>
  due_today: Array<{
    id: number
    invoice_number: string
    client_name: string
    amount: number
    currency: string
    status: string
  }>
  total_invoices: number
}
