import i18n from "@/lib/i18n"
import type {
  InvoiceSupervisorBulkApproveResult,
  InvoiceSupervisorClient,
  InvoiceSupervisorClientExposure,
  InvoiceSupervisorClientWithExposure,
  InvoiceSupervisorCoverageMatrix,
  InvoiceSupervisorDashboardSummary,
  InvoiceSupervisorFailedTask,
  InvoiceSupervisorForceClientEscalationResult,
  InvoiceSupervisorGenerateDraftInput,
  InvoiceSupervisorGenerateDraftResult,
  InvoiceSupervisorImportResult,
  InvoiceSupervisorInvoice,
  InvoiceSupervisorInvoiceCreateInput,
  InvoiceSupervisorMessageTemplate,
  InvoiceSupervisorNotificationLogEntry,
  InvoiceSupervisorPayment,
  InvoiceSupervisorPolicy,
  InvoiceSupervisorProposal,
  InvoiceSupervisorSchedulerConfig,
  InvoiceSupervisorSchedulerRunResult,
  InvoiceSupervisorTone,
} from "./types"

type QueryValue = string | number | boolean | null | undefined

type InvoiceSupervisorErrorBody = {
  error_code?: unknown
  message?: unknown
  // AuthMiddleware's own 401/403/400 responses use {"detail": ...}, not the
  // {error_code, message} shape BusinessError produces — fall back to it too.
  detail?: unknown
}

/** Napis w języku wybranym w tej chwili. Klient HTTP jest wołany spoza
 *  komponentu, więc `t` nie ma skąd przyjść z kontekstu Reacta — bierzemy je
 *  z jedynej instancji i18next, wzorem `lib/breadcrumbs.ts`. */
function translate(key: string, options?: Record<string, unknown>): string {
  return i18n.t(key, { ns: "invoice-supervisor", ...options })
}

// Overrides for backend error_code values (see backend src/shared/error_codes.py)
// that need friendlier client-facing copy than the backend's own formatted
// message. Anything not listed here falls back to the backend's message
// field, which is already a formatted sentence (see BusinessError handler
// in backend src/main.py) — just not translated.
//
// Wartości to KLUCZE tłumaczeń, nie napisy: mapa jest stałą modułu, a więc
// powstaje ZANIM użytkownik wybierze język — gotowy napis zamroziłby się na
// języku startowym.
const INVOICE_SUPERVISOR_ERROR_MESSAGE_KEYS: Record<string, string> = {
  BULK_APPROVAL_NOT_ALLOWED: "errors.bulkApprovalNotAllowed",
}

class InvoiceSupervisorApiError extends Error {
  readonly status: number
  readonly errorCode: string | null

  constructor(status: number, message: string, errorCode: string | null) {
    super(message)
    this.name = "InvoiceSupervisorApiError"
    this.status = status
    this.errorCode = errorCode
  }
}

const basePath = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH)

function normalizeBasePath(value: string | undefined): string {
  if (!value) return ""
  const trimmed = value.trim()
  if (!trimmed || trimmed === "/") return ""
  return trimmed.startsWith("/") ? trimmed.replace(/\/+$/, "") : `/${trimmed.replace(/\/+$/, "")}`
}

function buildUrl(path: string, params?: Record<string, QueryValue>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value == null || value === "") continue
    search.set(key, String(value))
  }
  const qs = search.toString()
  return `${basePath}/invoice-supervisor/api${path}${qs ? `?${qs}` : ""}`
}

async function request<T>(
  path: string,
  params?: Record<string, QueryValue>,
  init?: RequestInit,
): Promise<T> {
  const headers = new Headers(init?.headers)
  if (!headers.has("Accept")) headers.set("Accept", "application/json")

  const response = await fetch(buildUrl(path, params), {
    credentials: "include",
    cache: "no-store",
    ...init,
    headers,
  })
  return parseJsonResponse<T>(response)
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  if (!response.ok) throw await invoiceSupervisorErrorFromResponse(response)
  return (await response.json()) as T
}

async function invoiceSupervisorErrorFromResponse(
  response: Response,
): Promise<InvoiceSupervisorApiError> {
  const body = await readErrorBody(response)
  const errorCode = typeof body?.error_code === "string" ? body.error_code : null
  const backendMessage =
    (typeof body?.message === "string" ? body.message : null) ??
    (typeof body?.detail === "string" ? body.detail : null)
  const messageKey = errorCode ? INVOICE_SUPERVISOR_ERROR_MESSAGE_KEYS[errorCode] : undefined
  const message =
    (messageKey ? translate(messageKey) : undefined) ??
    backendMessage ??
    translate("errors.requestFailed", { status: response.status })

  return new InvoiceSupervisorApiError(response.status, message, errorCode)
}

async function readErrorBody(response: Response): Promise<InvoiceSupervisorErrorBody | null> {
  try {
    return (await response.json()) as InvoiceSupervisorErrorBody
  } catch {
    return null
  }
}

export function formatInvoiceSupervisorError(error: unknown, fallback: string): string {
  if (error instanceof InvoiceSupervisorApiError) return error.message || fallback
  if (error instanceof Error) return error.message || fallback
  return fallback
}

function get<T>(path: string, params?: Record<string, QueryValue>): Promise<T> {
  return request<T>(path, params)
}

function jsonInit(method: string, body?: unknown): RequestInit {
  const init: RequestInit = { method, headers: { "Content-Type": "application/json" } }
  if (body !== undefined) init.body = JSON.stringify(body)
  return init
}

function post<T>(path: string, body?: unknown, params?: Record<string, QueryValue>): Promise<T> {
  return request<T>(path, params, jsonInit("POST", body))
}

function put<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, undefined, jsonInit("PUT", body))
}

function patch<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, undefined, jsonInit("PATCH", body))
}

function del<T>(path: string): Promise<T> {
  return request<T>(path, undefined, { method: "DELETE" })
}

export const invoiceSupervisorApi = {
  // Invoices — INV-*, PAY-001/002
  searchInvoices: (params: { status?: string; client_id?: number; query?: string }) =>
    get<InvoiceSupervisorInvoice[]>("/invoices", params),
  getInvoice: (id: number) => get<InvoiceSupervisorInvoice>(`/invoices/${id}`),
  createInvoice: (data: InvoiceSupervisorInvoiceCreateInput) =>
    post<{ id: number }>("/invoices", data),
  updateInvoice: (id: number, data: Partial<InvoiceSupervisorInvoice>) =>
    put<{ success: boolean }>(`/invoices/${id}`, data),
  deleteInvoice: (id: number) => del<{ success: boolean }>(`/invoices/${id}`),
  registerPayment: (id: number, amount: number, paymentDate: string, note?: string) =>
    post<{ id: number }>(`/invoices/${id}/payments`, { amount, payment_date: paymentDate, note }),
  getPayments: (id: number) => get<InvoiceSupervisorPayment[]>(`/invoices/${id}/payments`),
  markInvoiceDisputed: (id: number, note: string) =>
    post<{ success: boolean }>(`/invoices/${id}/dispute`, { note }),
  clearInvoiceDispute: (id: number) => post<{ success: boolean }>(`/invoices/${id}/dispute/clear`),
  importInvoices: (file: File, onConflict: string = "ask") => {
    const formData = new FormData()
    formData.set("file", file)
    return request<InvoiceSupervisorImportResult>(
      "/invoices/import",
      { on_conflict: onConflict },
      { method: "POST", body: formData },
    )
  },
  forceInvoiceEscalation: (id: number, stage: string, user: string) =>
    post<{ success: boolean }>(`/invoices/${id}/escalation/force`, { stage, user }),

  // Clients — CLI-*
  listClients: (query?: string) =>
    get<InvoiceSupervisorClient[]>("/clients", query ? { query } : undefined),
  listClientsWithExposure: () =>
    get<InvoiceSupervisorClientWithExposure[]>("/clients", { with_exposure: true }),
  getClient: (id: number) => get<InvoiceSupervisorClient>(`/clients/${id}`),
  getClientExposure: (id: number) =>
    get<InvoiceSupervisorClientExposure>(`/clients/${id}/exposure`),
  createClient: (data: Partial<InvoiceSupervisorClient>) => post<{ id: number }>("/clients", data),
  updateClient: (id: number, data: Partial<InvoiceSupervisorClient>) =>
    put<{ success: boolean }>(`/clients/${id}`, data),
  forceClientEscalation: (clientId: number, stage: string, user: string) =>
    post<InvoiceSupervisorForceClientEscalationResult>(`/clients/${clientId}/escalation/force`, {
      stage,
      user,
    }),

  // Policies — POL-*
  listPolicies: () => get<InvoiceSupervisorPolicy[]>("/policies"),
  createPolicy: (data: Partial<InvoiceSupervisorPolicy>) => post<{ id: number }>("/policies", data),
  updatePolicy: (id: number, data: Partial<InvoiceSupervisorPolicy>) =>
    put<{ success: boolean }>(`/policies/${id}`, data),
  setDefaultPolicy: (id: number) => post<{ success: boolean }>(`/policies/${id}/set-default`),

  // Tones — policy-adjacent
  listTones: () => get<InvoiceSupervisorTone[]>("/tones"),
  createTone: (name: string, description: string) =>
    post<{ id: number }>("/tones", { name, description }),

  // Templates — TMPL-*
  listTemplates: () => get<InvoiceSupervisorMessageTemplate[]>("/templates"),
  templateCoverage: () => get<InvoiceSupervisorCoverageMatrix>("/templates/coverage"),
  saveTemplate: (data: {
    tone_id: number
    channel: string
    escalation_stage: string
    body: string
    subject?: string | null
  }) => put<{ id: number }>("/templates", data),
  generateTemplateDraft: (data: InvoiceSupervisorGenerateDraftInput) =>
    post<InvoiceSupervisorGenerateDraftResult>("/templates/generate-draft", data),
  deleteTemplate: (templateId: number) => del<{ success: boolean }>(`/templates/${templateId}`),

  // Notifications — AI-005 audit trail
  notificationLog: () => get<InvoiceSupervisorNotificationLogEntry[]>("/notifications/log"),
  failedTasks: () => get<InvoiceSupervisorFailedTask[]>("/notifications/failed-tasks"),

  // Settings / scheduler — SCH-001
  schedulerConfig: () => get<InvoiceSupervisorSchedulerConfig>("/settings/scheduler"),
  updateSchedulerConfig: (data: Partial<InvoiceSupervisorSchedulerConfig>) =>
    put<{ success: boolean }>("/settings/scheduler", data),
  runSchedulerNow: () => post<InvoiceSupervisorSchedulerRunResult>("/settings/scheduler/run-now"),

  // Inbox (Skrzynka) / proposals — AI-002/003/004, ESC-003. See
  // InvoiceSupervisorProposal / InvoiceSupervisorBulkApproveResult in
  // types.ts for the safety-critical contract this surface must preserve.
  listPendingProposals: () => get<InvoiceSupervisorProposal[]>("/proposals", { status: "pending" }),
  listAllProposals: () => get<InvoiceSupervisorProposal[]>("/proposals"),
  approveProposal: (id: string) => post<{ success: boolean }>(`/proposals/${id}/approve`),
  bulkApproveProposals: (proposalIds: string[]) =>
    post<InvoiceSupervisorBulkApproveResult>("/proposals/bulk-approve", {
      proposal_ids: proposalIds,
    }),
  rejectProposal: (id: string) => post<{ success: boolean }>(`/proposals/${id}/reject`),
  bulkRejectProposals: (proposalIds: string[]) =>
    post<{ rejected: number }>("/proposals/bulk-reject", { proposal_ids: proposalIds }),
  editProposal: (id: string, subject: string | null, content: string) =>
    patch<{ success: boolean }>(`/proposals/${id}`, { subject, content }),
  generateProposals: () => post<Record<string, number>>("/proposals/generate"),

  // Dashboard — STAT-001
  dashboardSummary: () => get<InvoiceSupervisorDashboardSummary>("/dashboard"),
}
