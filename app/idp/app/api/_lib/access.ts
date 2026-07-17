import { AI_TOOL_APP_CODES, AI_TOOLS_TILE_ID } from "@/lib/ai-tools/app-codes"

export interface AccessResult {
  allowed: boolean
  apps: string[]
  email: string
}

interface CacheEntry {
  result: AccessResult
  expiresAt: number
}

const CACHE_TTL_MS = 30_000
const CACHE_MAX_ENTRIES = 10_000
const REQUEST_TIMEOUT_MS = 5_000

const SHELL_APP_CODES = ["idp", "idp-basic", "intrastat", "invoice-supervisor", AI_TOOLS_TILE_ID] as const
const AUTHORIZED_APP_CODES = [
  ...SHELL_APP_CODES,
  "intrastat-cn-editor",
  "intrastat-config-editor",
  ...AI_TOOL_APP_CODES,
] as const

const cache = new Map<string, CacheEntry>()

export function getRequestEmail(headers: Headers): string | null {
  const devFallback = process.env.NODE_ENV !== "production" ? process.env.DEV_USER_EMAIL : undefined
  return headers.get("x-auth-request-email") ?? devFallback ?? null
}

export function getCachedAccessResult(email: string): AccessResult | null {
  const entry = cache.get(email)
  if (!entry) return null
  if (entry.expiresAt < Date.now()) {
    cache.delete(email)
    return null
  }
  return entry.result
}

export function setCachedAccessResult(email: string, result: AccessResult): void {
  if (cache.size >= CACHE_MAX_ENTRIES && !cache.has(email)) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }
  cache.set(email, { result, expiresAt: Date.now() + CACHE_TTL_MS })
}

export async function getAuthorizedAppsAtCortexAdmin(email: string): Promise<string[]> {
  const baseUrl = process.env.CORTEX_ADMIN_API_BASE_URL
  const apiKey = process.env.CORTEX_ADMIN_API_KEY

  if (!baseUrl || !apiKey) {
    return []
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  const allowedApps = new Set<string>(AUTHORIZED_APP_CODES)

  try {
    const url = new URL(`${baseUrl.replace(/\/$/, "")}/user/authorized-apps`)
    url.searchParams.set("email", email)
    for (const appCode of AUTHORIZED_APP_CODES) {
      url.searchParams.append("apps", appCode)
    }

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      cache: "no-store",
    })

    if (!response.ok) return []

    const data = (await response.json()) as { apps?: string[] }
    if (!Array.isArray(data.apps)) return []

    return data.apps.filter((appCode) => allowedApps.has(appCode))
  } catch {
    return []
  } finally {
    clearTimeout(timeout)
  }
}

export async function getAccessResult(email: string): Promise<AccessResult> {
  const cached = getCachedAccessResult(email)
  if (cached) return cached

  const apps = getUniqueApps(await getAuthorizedAppsAtCortexAdmin(email))
  const result: AccessResult = { allowed: apps.length > 0, apps, email }
  setCachedAccessResult(email, result)
  return result
}

function getUniqueApps(apps: string[]): string[] {
  const seen = new Set<string>()
  return apps.filter((app) => {
    if (seen.has(app)) return false
    seen.add(app)
    return true
  })
}
