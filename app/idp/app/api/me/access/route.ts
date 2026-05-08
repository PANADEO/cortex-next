// SECURITY: This handler trusts the `x-auth-request-email` header. It MUST run
// behind oauth2-proxy / Caddy `forward_auth`, which strips any client-supplied
// value and re-injects the authenticated email. Exposing this route directly to
// the public internet would let anyone forge identity by setting the header.
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

interface CacheEntry {
  result: AccessResult
  expiresAt: number
}

interface AccessResult {
  allowed: boolean
  email: string
}

const CACHE_TTL_MS = 30_000
const CACHE_MAX_ENTRIES = 10_000
const REQUEST_TIMEOUT_MS = 5_000

const cache = new Map<string, CacheEntry>()

function getCachedResult(email: string): AccessResult | null {
  const entry = cache.get(email)
  if (!entry) return null
  if (entry.expiresAt < Date.now()) {
    cache.delete(email)
    return null
  }
  return entry.result
}

function setCachedResult(email: string, result: AccessResult): void {
  if (cache.size >= CACHE_MAX_ENTRIES && !cache.has(email)) {
    // Map preserves insertion order — drop the oldest entry to bound memory.
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }
  cache.set(email, { result, expiresAt: Date.now() + CACHE_TTL_MS })
}

async function checkAccessAtCortexAdmin(email: string, appCode: string): Promise<boolean> {
  const baseUrl = process.env.CORTEX_ADMIN_API_BASE_URL
  const apiKey = process.env.CORTEX_ADMIN_API_KEY

  if (!baseUrl || !apiKey) {
    // Fail-closed when not configured. Operator must set env vars before deploy.
    return false
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const url = new URL(`${baseUrl.replace(/\/$/, "")}/user/authorized-apps`)
    url.searchParams.set("email", email)
    url.searchParams.append("apps", appCode)

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      cache: "no-store",
    })

    if (!response.ok) return false

    const data = (await response.json()) as { apps?: string[] }
    return Array.isArray(data.apps) && data.apps.includes(appCode)
  } catch {
    return false
  } finally {
    clearTimeout(timeout)
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const devFallback = process.env.NODE_ENV !== "production" ? process.env.DEV_USER_EMAIL : undefined
  const email = request.headers.get("x-auth-request-email") ?? devFallback ?? null

  if (!email) {
    return NextResponse.json({ error: "missing-email" }, { status: 401 })
  }

  const cached = getCachedResult(email)
  if (cached) return NextResponse.json(cached)

  const appCode = process.env.CORTEX_APP_CODE ?? "idp"
  const allowed = await checkAccessAtCortexAdmin(email, appCode)
  const result: AccessResult = { allowed, email }
  setCachedResult(email, result)

  return NextResponse.json(result)
}
