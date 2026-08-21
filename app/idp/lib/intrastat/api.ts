import i18n from "@/lib/i18n"
import type {
  IntrastatBatchDetail,
  IntrastatBatchFilterOptionsResponse,
  IntrastatBatchListResponse,
  IntrastatBatchStatus,
  IntrastatCnMatchStatus,
  IntrastatCnResourceRow,
  IntrastatCnResourceRowListResponse,
  IntrastatCnResourceRowRequest,
  IntrastatCnSuggestionListResponse,
  IntrastatDeclarationLine,
  IntrastatDownload,
  IntrastatFilesystemClient,
  IntrastatFilesystemClientListResponse,
  IntrastatFilesystemClientRequest,
  IntrastatFilesystemPreviewResponse,
  IntrastatLineCreateRequest,
  IntrastatLineListResponse,
  IntrastatLinePatchRequest,
  IntrastatPollResponse,
  IntrastatReprocessBatchRequest,
  IntrastatResourceInfo,
  IntrastatResourceUploadResponse,
  IntrastatSettings,
  IntrastatStats,
  IntrastatTransactionKind,
  IntrastatUploadResponse,
} from "./types"

type QueryValue = string | number | boolean | null | undefined

type IntrastatErrorBody = {
  detail?: unknown
  message?: unknown
}

/** Napis w języku wybranym w tej chwili. Klient HTTP jest wołany spoza
 *  komponentu, więc `t` nie ma skąd przyjść z kontekstu Reacta — bierzemy je
 *  z jedynej instancji i18next, wzorem `lib/breadcrumbs.ts`. */
function translate(key: string, options?: Record<string, unknown>): string {
  return i18n.t(key, { ns: "intrastat", ...options })
}

// Kod błędu z backendu -> KLUCZ tłumaczenia. Klucz, a nie gotowy napis, bo
// mapa jest stałą modułu: powstaje zanim użytkownik wybierze język, więc napis
// zamroziłby się na tym, który obowiązywał przy starcie aplikacji.
const INTRASTAT_ERROR_MESSAGE_KEYS: Record<string, string> = {
  "only-zip-files-supported": "errors.onlyZipFilesSupported",
  "empty-upload": "errors.emptyUpload",
  "invalid-zip-file": "errors.invalidZipFile",
  "zip-has-no-supported-documents": "errors.zipHasNoSupportedDocuments",
  "batch-create-failed": "errors.batchCreateFailed",
  "batch-not-found": "errors.batchNotFound",
  "batch-processing": "errors.batchProcessing",
  "line-not-found": "errors.lineNotFound",
  "document-not-found": "errors.documentNotFound",
  "document-content-not-found": "errors.documentContentNotFound",
  "filesystem-upload-metadata-required": "errors.filesystemUploadMetadataRequired",
  "invalid-cn-resource-xlsx": "errors.invalidCnResourceXlsx",
  "cn-resource-required-columns-missing": "errors.cnResourceRequiredColumnsMissing",
  "cn-resource-empty": "errors.cnResourceEmpty",
  "cn-resource-not-found": "errors.cnResourceNotFound",
  "cn-resource-editor-required": "errors.cnResourceEditorRequired",
  "cn-resource-row-not-found": "errors.cnResourceRowNotFound",
  "cn-resource-index-conflict": "errors.cnResourceIndexConflict",
  "cn-resource-index-required": "errors.cnResourceIndexRequired",
  "cn-resource-cn8-invalid": "errors.cnResourceCn8Invalid",
  "cn-resource-description-required": "errors.cnResourceDescriptionRequired",
  "filesystem-browser-not-directory": "errors.filesystemBrowserNotDirectory",
  "filesystem-delete-directory-not-supported": "errors.filesystemDeleteDirectoryNotSupported",
  "filesystem-file-not-found": "errors.filesystemFileNotFound",
  "filesystem-path-outside-root": "errors.filesystemPathOutsideRoot",
  "filesystem-client-required": "errors.filesystemClientRequired",
  "filesystem-client-not-found": "errors.filesystemClientNotFound",
  "filesystem-client-conflict": "errors.filesystemClientConflict",
  "filesystem-client-path-invalid": "errors.filesystemClientPathInvalid",
  "filesystem-client-name-required": "errors.filesystemClientNameRequired",
  "intrastat-config-editor-required": "errors.intrastatConfigEditorRequired",
}

// KLUCZE tej mapy to DANE, nie napisy interfejsu: dokładne zdania, które starsze
// wersje backendu zapisały przy wierszach deklaracji. Zostają po polsku, bo
// dopasowują się do zawartości bazy — przetłumaczenie ich zerwałoby dopasowanie.
const LEGACY_ALERT_MESSAGE_KEYS: Record<string, string> = {
  "Brak dopasowania CN w bazie i na fakturze.": "legacyAlerts.noCnMatch",
  "Brak indeksu towaru z faktury.": "legacyAlerts.missingItemIndex",
  "Brak kodu CN do eksportu Intrastat.": "legacyAlerts.missingCnCode",
  "Brak numeru VAT/NIP dla reguły WNT/WDT.": "legacyAlerts.missingVatNumber",
  "Brak numeru faktury korygowanej; korekta pominięta w podsumowaniu.":
    "legacyAlerts.missingCorrectedInvoiceNumber",
  "Brak sekcji przed korektą; korekta pominięta w podsumowaniu.":
    "legacyAlerts.missingBeforeCorrectionSection",
  "Stan przed korektą nie zgadza się z aktualnym stanem faktury; korekta wymaga weryfikacji.":
    "legacyAlerts.beforeCorrectionMismatch",
}

class IntrastatApiError extends Error {
  readonly status: number
  readonly detail: string | null

  constructor(status: number, message: string, detail: string | null) {
    super(message)
    this.name = "IntrastatApiError"
    this.status = status
    this.detail = detail
  }
}

export function isIntrastatErrorDetail(error: unknown, detail: string): boolean {
  return (
    error instanceof Error &&
    "detail" in error &&
    typeof error.detail === "string" &&
    error.detail === detail
  )
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
  return `${basePath}/intrastat/api${path}${qs ? `?${qs}` : ""}`
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  if (!headers.has("Accept")) headers.set("Accept", "application/json")

  const response = await fetch(buildUrl(path), {
    credentials: "include",
    cache: "no-store",
    ...init,
    headers,
  })
  return parseJsonResponse<T>(response)
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  if (!response.ok) throw await intrastatErrorFromResponse(response)
  return (await response.json()) as T
}

async function intrastatErrorFromResponse(response: Response): Promise<IntrastatApiError> {
  const body = await readErrorBody(response)
  const detail = detailToString(body?.detail)
  const messageKey = detail ? INTRASTAT_ERROR_MESSAGE_KEYS[detail] : undefined
  const message = detail ? (messageKey ? translate(messageKey) : detail) : null

  return new IntrastatApiError(
    response.status,
    message ??
      body?.message?.toString() ??
      translate("errors.requestFailed", { status: response.status }),
    detail,
  )
}

async function readErrorBody(response: Response): Promise<IntrastatErrorBody | null> {
  try {
    return (await response.json()) as IntrastatErrorBody
  } catch {
    return null
  }
}

function detailToString(detail: unknown): string | null {
  if (typeof detail === "string") return detail
  if (Array.isArray(detail)) {
    const first = detail[0]
    if (typeof first === "object" && first !== null && "msg" in first) return String(first.msg)
  }
  return null
}

function translateLegacyAlert(alert: string): string {
  const key = LEGACY_ALERT_MESSAGE_KEYS[alert]
  if (key) return translate(key)

  const ambiguousMatch = alert.match(/^Niejednoznaczne dopasowanie CN: (.+)\.$/)
  if (ambiguousMatch?.[1]) {
    return translate("legacyAlerts.ambiguousCnMatch", { match: ambiguousMatch[1] })
  }

  const invoiceTotalMatch = alert.match(
    /^Suma wartości pozycji \((.+)\) nie zgadza się z kwotą netto faktury \((.+)\)\.$/,
  )
  if (invoiceTotalMatch?.[1] && invoiceTotalMatch[2]) {
    return translate("legacyAlerts.invoiceTotalMismatch", {
      lines: invoiceTotalMatch[1],
      invoice: invoiceTotalMatch[2],
    })
  }

  const correctionTotalMatch = alert.match(
    /^Różnica wartości pozycji korekty \((.+)\) nie zgadza się z kwotą netto faktury \((.+)\)\.$/,
  )
  if (correctionTotalMatch?.[1] && correctionTotalMatch[2]) {
    return translate("legacyAlerts.correctionTotalMismatch", {
      difference: correctionTotalMatch[1],
      invoice: correctionTotalMatch[2],
    })
  }

  const correctedInvoiceMatch = alert.match(
    /^Brak faktury korygowanej (.+); korekta pominięta w bieżącym podsumowaniu\.$/,
  )
  if (correctedInvoiceMatch?.[1]) {
    return translate("legacyAlerts.correctedInvoiceNotFound", { invoice: correctedInvoiceMatch[1] })
  }

  return alert
}

const LINE_ALERT_FIELDS = ["cn_code", "net_weight", "origin_country", "delivery_terms"] as const

type LineAlertField = (typeof LINE_ALERT_FIELDS)[number]

function isLineAlertField(value: string): value is LineAlertField {
  return LINE_ALERT_FIELDS.some((field) => field === value)
}

function hasLineValue(line: IntrastatDeclarationLine, field: LineAlertField): boolean {
  const value = line[field]
  return typeof value === "string" ? value.trim().length > 0 : value !== null
}

function isResolvedMissingFieldAlert(line: IntrastatDeclarationLine, alert: string): boolean {
  const match = alert.match(/^([a-z_]+) not found for line item \d+\.?$/i)
  const field = match?.[1]?.toLowerCase()
  return field !== undefined && isLineAlertField(field) && hasLineValue(line, field)
}

function translateLegacyLineAlerts(line: IntrastatDeclarationLine): IntrastatDeclarationLine {
  return {
    ...line,
    alerts: line.alerts
      .map(translateLegacyAlert)
      .filter((alert) => !isResolvedMissingFieldAlert(line, alert)),
  }
}

export function formatIntrastatError(error: unknown, fallback: string): string {
  if (error instanceof IntrastatApiError) return error.message || fallback
  if (error instanceof Error) return error.message || fallback
  return fallback
}

export const intrastatApi = {
  stats: () => request<IntrastatStats>("/stats"),
  settings: () => request<IntrastatSettings>("/settings"),
  filesystemClients: () => request<IntrastatFilesystemClientListResponse>("/filesystem/clients"),
  createFilesystemClient: (payload: IntrastatFilesystemClientRequest) =>
    request<IntrastatFilesystemClient>("/filesystem/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  updateFilesystemClient: (clientId: string, payload: IntrastatFilesystemClientRequest) =>
    request<IntrastatFilesystemClient>(`/filesystem/clients/${clientId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  deleteFilesystemClient: async (clientId: string) => {
    const response = await fetch(buildUrl(`/filesystem/clients/${clientId}`), {
      method: "DELETE",
      credentials: "include",
      cache: "no-store",
      headers: { Accept: "application/json" },
    })
    if (!response.ok) throw await intrastatErrorFromResponse(response)
  },
  pollFilesystem: () =>
    request<IntrastatPollResponse>("/filesystem/poll", {
      method: "POST",
    }),
  filesystemPreview: (query?: {
    client_id?: string
    path?: string
    limit?: number
    offset?: number
  }) =>
    fetch(buildUrl("/filesystem/preview", query), {
      credentials: "include",
      cache: "no-store",
      headers: { Accept: "application/json" },
    }).then(parseJsonResponse<IntrastatFilesystemPreviewResponse>),
  downloadFilesystemFile: async ({
    path,
    clientId,
  }: {
    path: string
    clientId?: string
  }): Promise<IntrastatDownload> => {
    const response = await fetch(buildUrl("/filesystem/download", { path, client_id: clientId }), {
      credentials: "include",
      cache: "no-store",
    })
    if (!response.ok) throw await intrastatErrorFromResponse(response)
    return {
      blob: await response.blob(),
      filename: filenameFromContentDisposition(response.headers.get("Content-Disposition"), path),
    }
  },
  deleteFilesystemFile: async ({ path, clientId }: { path: string; clientId?: string }) => {
    const response = await fetch(buildUrl("/filesystem/file", { path, client_id: clientId }), {
      method: "DELETE",
      credentials: "include",
      cache: "no-store",
      headers: { Accept: "application/json" },
    })
    if (!response.ok) throw await intrastatErrorFromResponse(response)
  },
  uploadBatch: (
    file: File,
    transactionKind: IntrastatTransactionKind,
    options?: {
      uploadToFilesystem?: boolean
      clientName?: string
      periodMonth?: string
    },
  ) => {
    const formData = new FormData()
    formData.set("transaction_kind", transactionKind)
    if (options?.uploadToFilesystem) {
      formData.set("upload_to_filesystem", "true")
      formData.set("client_name", options.clientName ?? "")
      formData.set("period_month", options.periodMonth ?? "")
    }
    formData.set("file", file)
    return request<IntrastatUploadResponse>("/batches/upload", {
      method: "POST",
      body: formData,
    })
  },
  batches: (query: {
    limit?: number
    offset?: number
    status?: IntrastatBatchStatus | "all"
    transaction_kind?: IntrastatTransactionKind | "all"
    client_name?: string | "all"
    period_month?: string | "all"
    search?: string
  }) =>
    fetch(
      buildUrl("/batches", {
        ...query,
        status: query.status === "all" ? null : query.status,
        transaction_kind: query.transaction_kind === "all" ? null : query.transaction_kind,
        client_name: query.client_name === "all" ? null : query.client_name,
        period_month: query.period_month === "all" ? null : query.period_month,
      }),
      { credentials: "include", cache: "no-store", headers: { Accept: "application/json" } },
    ).then(parseJsonResponse<IntrastatBatchListResponse>),
  batchFilterOptions: () => request<IntrastatBatchFilterOptionsResponse>("/batches/filter-options"),
  batchDetail: (id: string) => request<IntrastatBatchDetail>(`/batches/${id}`),
  documentContent: (batchId: string, documentId: string) =>
    fetch(buildUrl(`/batches/${batchId}/documents/${documentId}/content`), {
      credentials: "include",
      cache: "no-store",
    }).then(async (response) => {
      if (!response.ok) throw await intrastatErrorFromResponse(response)
      return response.blob()
    }),
  deleteBatch: async (id: string) => {
    const response = await fetch(buildUrl(`/batches/${id}`), {
      method: "DELETE",
      credentials: "include",
      cache: "no-store",
      headers: { Accept: "application/json" },
    })
    if (!response.ok) throw await intrastatErrorFromResponse(response)
  },
  reprocessBatch: (id: string, payload: IntrastatReprocessBatchRequest) =>
    request<IntrastatBatchDetail>(`/batches/${id}/reprocess`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  lines: (
    batchId: string,
    query: {
      limit?: number
      offset?: number
      match_status?: IntrastatCnMatchStatus | "all"
      search?: string
    },
  ) =>
    fetch(
      buildUrl(`/batches/${batchId}/lines`, {
        ...query,
        match_status: query.match_status === "all" ? null : query.match_status,
      }),
      { credentials: "include", cache: "no-store", headers: { Accept: "application/json" } },
    )
      .then(parseJsonResponse<IntrastatLineListResponse>)
      .then((response) => ({
        ...response,
        items: response.items.map(translateLegacyLineAlerts),
      })),
  patchLine: (lineId: string, payload: IntrastatLinePatchRequest) =>
    request<IntrastatDeclarationLine>(`/lines/${lineId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(translateLegacyLineAlerts),
  createLine: (batchId: string, payload: IntrastatLineCreateRequest) =>
    request<IntrastatDeclarationLine>(`/batches/${batchId}/lines`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(translateLegacyLineAlerts),
  currentCnResource: () => request<IntrastatResourceInfo>("/resources/cn/current"),
  downloadCnResource: async (): Promise<IntrastatDownload> => {
    const response = await fetch(buildUrl("/resources/cn/download"), {
      credentials: "include",
      cache: "no-store",
    })
    if (!response.ok) throw await intrastatErrorFromResponse(response)
    return {
      blob: await response.blob(),
      filename: filenameFromContentDisposition(
        response.headers.get("Content-Disposition"),
        "cn-resource.xlsx",
      ),
    }
  },
  cnSuggestions: (search: string, limit = 5) =>
    request<IntrastatCnSuggestionListResponse>(
      `/resources/cn/suggestions?${new URLSearchParams({
        search,
        limit: String(limit),
      })}`,
    ),
  cnResourceRows: (query: { search?: string; limit?: number; offset?: number }) =>
    request<IntrastatCnResourceRowListResponse>(
      `/resources/cn/rows?${new URLSearchParams(
        Object.entries(query)
          .filter((entry): entry is [string, string | number] => entry[1] !== undefined)
          .map(([key, value]) => [key, String(value)]),
      )}`,
    ),
  createCnResourceRow: (payload: IntrastatCnResourceRowRequest) =>
    request<IntrastatCnResourceRow>("/resources/cn/rows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  upsertCnResourceRow: (payload: IntrastatCnResourceRowRequest, replaceConflict = false) =>
    request<IntrastatCnResourceRow>(
      `/resources/cn/rows/upsert${replaceConflict ? "?replace_conflict=true" : ""}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    ),
  updateCnResourceRow: (rowId: string, payload: IntrastatCnResourceRowRequest) =>
    request<IntrastatCnResourceRow>(`/resources/cn/rows/${rowId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  uploadCnResource: (file: File) => {
    const formData = new FormData()
    formData.set("file", file)
    return request<IntrastatResourceUploadResponse>("/resources/cn/upload", {
      method: "POST",
      body: formData,
    })
  },
  exportIntrastat: (batchIds: string[]) => exportWorkbook("/export/intrastat", batchIds),
  exportAudit: (batchIds: string[]) => exportWorkbook("/export/audit", batchIds),
}

async function exportWorkbook(path: string, batchIds: string[]): Promise<IntrastatDownload> {
  const response = await fetch(buildUrl(path), {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: {
      Accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ batch_ids: batchIds }),
  })
  if (!response.ok) throw await intrastatErrorFromResponse(response)
  return {
    blob: await response.blob(),
    filename: filenameFromContentDisposition(
      response.headers.get("Content-Disposition"),
      "intrastat.xlsx",
    ),
  }
}

function filenameFromContentDisposition(value: string | null, fallback: string): string {
  if (!value) return fallbackFilename(fallback)
  const utfMatch = value.match(/filename\*=UTF-8''([^;]+)/i)
  if (utfMatch?.[1]) return decodeURIComponent(utfMatch[1])
  const quotedMatch = value.match(/filename="([^"]+)"/i)
  if (quotedMatch?.[1]) return quotedMatch[1].trim()
  const plainMatch = value.match(/filename=([^;]+)/i)
  return plainMatch?.[1]?.trim() || fallbackFilename(fallback)
}

function fallbackFilename(value: string): string {
  return value.split("/").filter(Boolean).at(-1) || "download"
}
