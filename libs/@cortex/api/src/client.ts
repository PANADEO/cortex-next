import { AUTH_HEADER } from "@cortex/types"
import { ApiError } from "./error"

interface ApiClientConfig {
  baseUrl: string
  getAuthEmail: () => string | null
}

let config: ApiClientConfig = {
  baseUrl: "",
  getAuthEmail: () => null,
}

export function configureApiClient(next: Partial<ApiClientConfig>): void {
  config = { ...config, ...next }
}

function buildAuthHeaders(): Record<string, string> {
  const email = config.getAuthEmail()
  return email ? { [AUTH_HEADER]: email } : {}
}

type QueryValue = string | number | boolean | null | undefined

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
    ...buildAuthHeaders(),
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
  delete: <T>(path: string, opts?: RequestOptions) => request<T>("DELETE", path, opts),
}
