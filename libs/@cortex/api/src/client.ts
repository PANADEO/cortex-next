import { ApiError } from "./error"

interface ApiClientConfig {
  baseUrl: string
}

let config: ApiClientConfig = {
  baseUrl: normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH),
}

export function configureApiClient(next: Partial<ApiClientConfig>): void {
  config = { ...config, ...next }
}

type ForbiddenHandler = (path: string) => void
let forbiddenHandler: ForbiddenHandler | null = null

export function setForbiddenHandler(handler: ForbiddenHandler | null): void {
  forbiddenHandler = handler
}

const FORBIDDEN_HANDLER_EXEMPT_PATHS: ReadonlySet<string> = new Set([
  "/user/me",
  "/api/me/access",
  "/config/feature-flags",
])

function shouldNotifyForbidden(path: string): boolean {
  return !FORBIDDEN_HANDLER_EXEMPT_PATHS.has(path)
}

type QueryValue = string | number | boolean | null | undefined

function normalizeBasePath(value: string | undefined): string {
  if (!value) return ""
  const trimmed = value.trim()
  if (!trimmed || trimmed === "/") return ""
  return trimmed.startsWith("/") ? trimmed.replace(/\/+$/, "") : `/${trimmed.replace(/\/+$/, "")}`
}

function buildUrl(path: string, params?: Record<string, QueryValue>): string {
  const url = `${config.baseUrl}${path}`
  if (!params) return url

  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value == null) continue
    search.append(key, String(value))
  }
  const qs = search.toString()
  return qs ? `${url}?${qs}` : url
}

interface RequestOptions {
  params?: Record<string, QueryValue>
  body?: BodyInit | null
  jsonBody?: unknown
  headers?: Record<string, string>
  signal?: AbortSignal
  parse?: "json" | "blob" | "text" | "none"
}

async function request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
  const parseMode = options.parse ?? "json"
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...options.headers,
  }

  const init: RequestInit = {
    method,
    headers,
    credentials: "include",
  }

  if (options.signal) init.signal = options.signal

  if (options.jsonBody !== undefined) {
    headers["Content-Type"] = "application/json"
    init.body = JSON.stringify(options.jsonBody)
  } else if (options.body !== undefined) {
    init.body = options.body
  }

  const response = await fetch(buildUrl(path, options.params), init)

  if (!response.ok) {
    if (response.status === 403 && forbiddenHandler && shouldNotifyForbidden(path)) {
      forbiddenHandler(path)
    }
    throw await ApiError.fromResponse(response)
  }

  if (parseMode === "none") return undefined as T
  if (parseMode === "blob") return (await response.blob()) as T
  if (parseMode === "text") return (await response.text()) as T
  if (response.status === 204) return undefined as T
  const text = await response.text()
  if (!text) return undefined as T
  return JSON.parse(text) as T
}

export const apiClient = {
  get: <T>(path: string, opts?: RequestOptions) => request<T>("GET", path, opts),
  post: <T>(path: string, opts?: RequestOptions) => request<T>("POST", path, opts),
  put: <T>(path: string, opts?: RequestOptions) => request<T>("PUT", path, opts),
  patch: <T>(path: string, opts?: RequestOptions) => request<T>("PATCH", path, opts),
  delete: <T>(path: string, opts?: RequestOptions) => request<T>("DELETE", path, opts),
}
