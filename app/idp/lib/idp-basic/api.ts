import type {
  IdpBasicFileListResponse,
  IdpBasicPackageDetail,
  IdpBasicPackageListResponse,
  IdpBasicPackageStatus,
  IdpBasicPollResponse,
  IdpBasicSettings,
  IdpBasicStats,
} from "./types"

type QueryValue = string | number | boolean | null | undefined
type IdpBasicErrorBody = {
  detail?: unknown
  message?: unknown
}

const IDP_BASIC_ERROR_MESSAGES: Record<string, string> = {
  "only-zip-files-supported": "Choose a ZIP file",
  "empty-upload": "The uploaded ZIP is empty",
  "invalid-zip-file": "The uploaded file is not a valid ZIP",
  "zip-has-no-documents": "The ZIP does not contain any importable files",
  "package-create-failed": "The package could not be created",
  "package-not-found": "Package not found. Refresh the package list.",
  "document-not-found": "Document not found. Reopen the package.",
  "document-content-not-found": "Document file is missing from storage.",
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
  const message = detail ? (IDP_BASIC_ERROR_MESSAGES[detail] ?? detail) : null

  if (response.status === 413) {
    return new IdpBasicApiError(response.status, "The ZIP file is too large", detail)
  }
  if (response.status === 404) {
    return new IdpBasicApiError(
      response.status,
      message ?? "Package or document not found. Refresh the package list.",
      detail,
    )
  }

  return new IdpBasicApiError(
    response.status,
    message ?? body?.message?.toString() ?? `IDP Basic request failed: ${response.status}`,
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
  pollMail: () => request<IdpBasicPollResponse>("/mail/poll", { method: "POST" }),
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
  packageDetail: (id: string) => request<IdpBasicPackageDetail>(`/packages/${id}`),
  documentContent: (packageId: string, documentId: string) =>
    fetch(buildUrl(`/packages/${packageId}/documents/${documentId}/content`), {
      credentials: "include",
      cache: "no-store",
    }).then(async (response) => {
      if (!response.ok) throw await idpBasicErrorFromResponse(response)
      return response.blob()
    }),
}
