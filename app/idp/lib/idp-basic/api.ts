import i18n from "@/lib/i18n"
import type {
  IdpBasicCsvColumnsResponse,
  IdpBasicCsvDownload,
  IdpBasicCsvExportRequest,
  IdpBasicFileListResponse,
  IdpBasicFilesystemUploadResponse,
  IdpBasicPackageDetail,
  IdpBasicPackageListResponse,
  IdpBasicPackageStatus,
  IdpBasicPollResponse,
  IdpBasicResultDetail,
  IdpBasicResultListResponse,
  IdpBasicSettings,
  IdpBasicStats,
} from "./types"

type QueryValue = string | number | boolean | null | undefined
type IdpBasicErrorBody = {
  detail?: unknown
  message?: unknown
}

/** Napis w języku wybranym w tej chwili. Klient HTTP jest wołany spoza
 *  komponentu, więc `t` nie ma skąd przyjść z kontekstu Reacta — bierzemy je
 *  z jedynej instancji i18next, wzorem `lib/intrastat/api.ts`. */
function translate(key: string, options?: Record<string, unknown>): string {
  return i18n.t(key, { ns: "idp-basic", ...options })
}

// Kod błędu z backendu -> KLUCZ tłumaczenia. Klucz, a nie gotowy napis, bo
// mapa jest stałą modułu: powstaje zanim użytkownik wybierze język, więc napis
// zamroziłby się na tym, który obowiązywał przy starcie aplikacji.
const IDP_BASIC_ERROR_MESSAGE_KEYS: Record<string, string> = {
  "only-zip-files-supported": "errors.onlyZipFilesSupported",
  "empty-upload": "errors.emptyUpload",
  "invalid-zip-file": "errors.invalidZipFile",
  "zip-has-no-documents": "errors.zipHasNoDocuments",
  "zip-has-no-supported-documents": "errors.zipHasNoSupportedDocuments",
  "package-create-failed": "errors.packageCreateFailed",
  "package-not-found": "errors.packageNotFound",
  "package-is-processing": "errors.packageIsProcessing",
  "package-source-files-missing": "errors.packageSourceFilesMissing",
  "result-not-found": "errors.resultNotFound",
  "document-not-found": "errors.documentNotFound",
  "document-content-not-found": "errors.documentContentNotFound",
  "csv-columns-required": "errors.csvColumnsRequired",
  "filesystem-watch-dir-not-configured": "errors.filesystemWatchDirNotConfigured",
  "filesystem-watch-dir-not-found": "errors.filesystemWatchDirNotFound",
  "filesystem-file-name-required": "errors.filesystemFileNameRequired",
  "filesystem-upload-empty": "errors.filesystemUploadEmpty",
  "filesystem-unsupported-file": "errors.filesystemUnsupportedFile",
  "filesystem-upload-failed": "errors.filesystemUploadFailed",
}

class IdpBasicApiError extends Error {
  readonly status: number
  readonly detail: string | null

  constructor(status: number, message: string, detail: string | null) {
    super(message)
    this.name = "IdpBasicApiError"
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
  return `${basePath}/idp-basic/api${path}${qs ? `?${qs}` : ""}`
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
  if (!response.ok) throw await idpBasicErrorFromResponse(response)
  return (await response.json()) as T
}

async function idpBasicErrorFromResponse(response: Response): Promise<IdpBasicApiError> {
  const body = await readErrorBody(response)
  const detail = detailToString(body?.detail)
  const messageKey = detail ? IDP_BASIC_ERROR_MESSAGE_KEYS[detail] : undefined
  const message = messageKey ? translate(messageKey) : detail

  if (response.status === 413) {
    return new IdpBasicApiError(response.status, translate("errors.zipTooLarge"), detail)
  }
  if (response.status === 404) {
    return new IdpBasicApiError(
      response.status,
      message ?? translate("errors.packageOrDocumentNotFound"),
      detail,
    )
  }

  return new IdpBasicApiError(
    response.status,
    message ??
      body?.message?.toString() ??
      translate("errors.requestFailed", { status: response.status }),
    detail,
  )
}

async function readErrorBody(response: Response): Promise<IdpBasicErrorBody | null> {
  try {
    return (await response.json()) as IdpBasicErrorBody
  } catch {
    return null
  }
}

function detailToString(detail: unknown): string | null {
  if (typeof detail === "string") return detail
  if (Array.isArray(detail)) {
    const first = detail[0]
    if (typeof first === "object" && first !== null && "msg" in first) {
      return String(first.msg)
    }
  }
  return null
}

export function formatIdpBasicError(error: unknown, fallback: string): string {
  if (error instanceof IdpBasicApiError) return error.message || fallback
  if (error instanceof Error) return error.message || fallback
  return fallback
}

export const idpBasicApi = {
  stats: () => request<IdpBasicStats>("/stats"),
  settings: () => request<IdpBasicSettings>("/settings"),
  csvColumns: () => request<IdpBasicCsvColumnsResponse>("/export/files/columns"),
  exportFilesCsv: async (payload: IdpBasicCsvExportRequest): Promise<IdpBasicCsvDownload> => {
    const response = await fetch(buildUrl("/export/files"), {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: {
        Accept: "text/csv",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...payload,
        status: payload.status === "all" ? null : payload.status,
      }),
    })
    if (!response.ok) throw await idpBasicErrorFromResponse(response)
    return {
      blob: await response.blob(),
      filename: filenameFromContentDisposition(response.headers.get("Content-Disposition")),
    }
  },
  pollMail: () => request<IdpBasicPollResponse>("/mail/poll", { method: "POST" }),
  uploadToFilesystem: (file: File) => {
    const formData = new FormData()
    formData.set("file", file)
    return request<IdpBasicFilesystemUploadResponse>("/filesystem/upload", {
      method: "POST",
      body: formData,
    })
  },
  uploadPackage: (file: File) => {
    const formData = new FormData()
    formData.set("file", file)
    return request<IdpBasicPackageDetail>("/packages/upload", {
      method: "POST",
      body: formData,
    })
  },
  packages: (query: {
    limit?: number
    offset?: number
    status?: IdpBasicPackageStatus | "all"
    search?: string
  }) =>
    fetch(
      buildUrl("/packages", {
        ...query,
        status: query.status === "all" ? null : query.status,
      }),
      { credentials: "include", cache: "no-store", headers: { Accept: "application/json" } },
    ).then(parseJsonResponse<IdpBasicPackageListResponse>),
  files: (query: {
    limit?: number
    offset?: number
    status?: IdpBasicPackageStatus | "all"
    search?: string
    reference?: string
    label?: string
    date_from?: string
    date_to?: string
  }) =>
    fetch(
      buildUrl("/files", {
        ...query,
        status: query.status === "all" ? null : query.status,
      }),
      { credentials: "include", cache: "no-store", headers: { Accept: "application/json" } },
    ).then(parseJsonResponse<IdpBasicFileListResponse>),
  results: (query: {
    limit?: number
    offset?: number
    status?: IdpBasicPackageStatus | "all"
    search?: string
    date_from?: string
    date_to?: string
  }) =>
    fetch(
      buildUrl("/results", {
        ...query,
        status: query.status === "all" ? null : query.status,
      }),
      { credentials: "include", cache: "no-store", headers: { Accept: "application/json" } },
    ).then(parseJsonResponse<IdpBasicResultListResponse>),
  resultDetail: (id: string) => request<IdpBasicResultDetail>(`/results/${id}`),
  packageDetail: (id: string) => request<IdpBasicPackageDetail>(`/packages/${id}`),
  reprocessPackage: (id: string) =>
    request<IdpBasicResultDetail>(`/packages/${id}/reprocess`, {
      method: "POST",
    }),
  deletePackage: (id: string) =>
    request<{ ok: boolean }>(`/packages/${id}`, {
      method: "DELETE",
    }),
  deleteDocument: (packageId: string, documentId: string) =>
    request<{ ok: boolean; remaining_documents: number }>(
      `/packages/${packageId}/documents/${documentId}`,
      {
        method: "DELETE",
      },
    ),
  documentContent: (packageId: string, documentId: string) =>
    fetch(buildUrl(`/packages/${packageId}/documents/${documentId}/content`), {
      credentials: "include",
      cache: "no-store",
    }).then(async (response) => {
      if (!response.ok) throw await idpBasicErrorFromResponse(response)
      return response.blob()
    }),
}

function filenameFromContentDisposition(value: string | null): string {
  if (!value) return "idp-basic-files.csv"
  const utfMatch = value.match(/filename\*=UTF-8''([^;]+)/i)
  if (utfMatch?.[1]) return decodeURIComponent(utfMatch[1])
  const quotedMatch = value.match(/filename="([^"]+)"/i)
  if (quotedMatch?.[1]) return quotedMatch[1]
  const plainMatch = value.match(/filename=([^;]+)/i)
  return plainMatch?.[1]?.trim() || "idp-basic-files.csv"
}
