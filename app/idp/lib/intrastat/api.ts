import type {
  IntrastatBatchDetail,
  IntrastatBatchFilterOptionsResponse,
  IntrastatBatchListResponse,
  IntrastatBatchStatus,
  IntrastatCnMatchStatus,
  IntrastatCnSuggestionListResponse,
  IntrastatDeclarationLine,
  IntrastatDownload,
  IntrastatFilesystemPreviewResponse,
  IntrastatLineListResponse,
  IntrastatLinePatchRequest,
  IntrastatPollResponse,
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

const INTRASTAT_ERROR_MESSAGES: Record<string, string> = {
  "only-zip-files-supported": "Choose a ZIP file",
  "empty-upload": "The uploaded ZIP is empty",
  "invalid-zip-file": "The uploaded file is not a valid ZIP",
  "zip-has-no-supported-documents": "The ZIP does not contain supported PDF invoices",
  "batch-create-failed": "The batch could not be created",
  "batch-not-found": "Batch not found. Refresh the list.",
  "batch-processing": "The batch is currently processing. Try again after it finishes.",
  "line-not-found": "Declaration line not found. Refresh the review table.",
  "document-not-found": "Document not found. Refresh the batch.",
  "document-content-not-found": "Document file is missing from storage.",
  "filesystem-upload-metadata-required": "Enter client and month",
  "invalid-cn-resource-xlsx": "Choose a valid XLSX CN resource",
  "cn-resource-required-columns-missing": "The CN workbook is missing required columns",
  "cn-resource-empty": "The CN workbook contains no usable resource rows",
  "filesystem-browser-not-directory": "This path is not a folder",
  "filesystem-delete-directory-not-supported": "Folder delete is not supported",
  "filesystem-file-not-found": "File not found. Refresh the folder.",
  "filesystem-path-outside-root": "Path is outside the watch folder",
}

const LEGACY_ALERT_MESSAGES: Record<string, string> = {
  "Brak dopasowania CN w bazie i na fakturze.": "No CN match found in the resource or invoice.",
  "Brak indeksu towaru z faktury.": "Missing item index from the invoice.",
  "Brak kodu CN do eksportu Intrastat.": "Missing CN code for Intrastat export.",
  "Brak numeru VAT/NIP dla reguły WNT/WDT.": "Missing VAT number for WNT/WDT rules.",
  "Brak numeru faktury korygowanej; korekta pominięta w podsumowaniu.":
    "Missing corrected invoice number; correction excluded from the summary.",
  "Brak sekcji przed korektą; korekta pominięta w podsumowaniu.":
    "Missing before-correction section; correction excluded from the summary.",
  "Stan przed korektą nie zgadza się z aktualnym stanem faktury; korekta wymaga weryfikacji.":
    "Before-correction state does not match the current invoice state; correction requires review.",
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
  const message = detail ? (INTRASTAT_ERROR_MESSAGES[detail] ?? detail) : null

  return new IntrastatApiError(
    response.status,
    message ?? body?.message?.toString() ?? `Intrastat request failed: ${response.status}`,
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
  const translated = LEGACY_ALERT_MESSAGES[alert]
  if (translated) return translated

  const ambiguousMatch = alert.match(/^Niejednoznaczne dopasowanie CN: (.+)\.$/)
  if (ambiguousMatch?.[1]) return `Ambiguous CN match: ${ambiguousMatch[1]}.`

  const invoiceTotalMatch = alert.match(
    /^Suma wartości pozycji \((.+)\) nie zgadza się z kwotą netto faktury \((.+)\)\.$/,
  )
  if (invoiceTotalMatch?.[1] && invoiceTotalMatch[2]) {
    return `Sum of line values (${invoiceTotalMatch[1]}) does not match the invoice net total (${invoiceTotalMatch[2]}).`
  }

  const correctionTotalMatch = alert.match(
    /^Różnica wartości pozycji korekty \((.+)\) nie zgadza się z kwotą netto faktury \((.+)\)\.$/,
  )
  if (correctionTotalMatch?.[1] && correctionTotalMatch[2]) {
    return `Difference in correction line values (${correctionTotalMatch[1]}) does not match the invoice net total (${correctionTotalMatch[2]}).`
  }

  const correctedInvoiceMatch = alert.match(
    /^Brak faktury korygowanej (.+); korekta pominięta w bieżącym podsumowaniu\.$/,
  )
  if (correctedInvoiceMatch?.[1]) {
    return `Corrected invoice ${correctedInvoiceMatch[1]} not found; correction excluded from the current summary.`
  }

  return alert
}

function translateLegacyLineAlerts(line: IntrastatDeclarationLine): IntrastatDeclarationLine {
  return { ...line, alerts: line.alerts.map(translateLegacyAlert) }
}

export function formatIntrastatError(error: unknown, fallback: string): string {
  if (error instanceof IntrastatApiError) return error.message || fallback
  if (error instanceof Error) return error.message || fallback
  return fallback
}

export const intrastatApi = {
  stats: () => request<IntrastatStats>("/stats"),
  settings: () => request<IntrastatSettings>("/settings"),
  pollFilesystem: () =>
    request<IntrastatPollResponse>("/filesystem/poll", {
      method: "POST",
    }),
  filesystemPreview: (query?: { path?: string; limit?: number; offset?: number }) =>
    fetch(buildUrl("/filesystem/preview", query), {
      credentials: "include",
      cache: "no-store",
      headers: { Accept: "application/json" },
    }).then(parseJsonResponse<IntrastatFilesystemPreviewResponse>),
  downloadFilesystemFile: async (path: string): Promise<IntrastatDownload> => {
    const response = await fetch(buildUrl("/filesystem/download", { path }), {
      credentials: "include",
      cache: "no-store",
    })
    if (!response.ok) throw await intrastatErrorFromResponse(response)
    return {
      blob: await response.blob(),
      filename: filenameFromContentDisposition(response.headers.get("Content-Disposition"), path),
    }
  },
  deleteFilesystemFile: async (path: string) => {
    const response = await fetch(buildUrl("/filesystem/file", { path }), {
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
  reprocessBatch: (id: string) =>
    request<IntrastatBatchDetail>(`/batches/${id}/reprocess`, {
      method: "POST",
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
  currentCnResource: () => request<IntrastatResourceInfo>("/resources/cn/current"),
  cnSuggestions: (search: string, limit = 5) =>
    request<IntrastatCnSuggestionListResponse>(
      `/resources/cn/suggestions?${new URLSearchParams({
        search,
        limit: String(limit),
      })}`,
    ),
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
