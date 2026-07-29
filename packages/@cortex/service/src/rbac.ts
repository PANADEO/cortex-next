// RBAC jako wewnętrzny serwis (nie HTTP) — jedyne miejsce, z którego code-api
// wolno wywołać sprawdzenie dostępu. Kontrakt: code-service/REFERENCE.md.
//
// FAIL-CLOSED bez wyjątków: brak nagłówka, brak użytkownika, użytkownik
// nieaktywny, brak roli, rola bez grantu ORAZ błąd/timeout bazy => allowed:false.
// Awaria Postgresa odcina wszystkich zamiast wpuszczać kogokolwiek — świadomy
// koszt, wymagany przez code-service/SKILL.md pkt 2.

import { loadGrantedApplicationCodes } from "./rbac-store"

export interface TileAccessResult {
  allowed: boolean
  email: string | null
}

interface CacheEntry {
  codes: string[]
  expiresAt: number
}

const CACHE_TTL_MS = 30_000
const CACHE_MAX_ENTRIES = 10_000

const cache = new Map<string, CacheEntry>()

/**
 * Tożsamość z nagłówka wstrzykniętego przez oauth2-proxy; poza produkcją
 * dopuszczalny fallback na DEV_USER_EMAIL. Wzorzec 1:1 z
 * app/idp/app/api/_lib/access.ts (getRequestEmail).
 *
 * E-mail normalizowany do lowercase — kolumna users.email trzyma wyłącznie
 * lowercase, więc bez tego "Jan@Firma.pl" nie trafiłby w swój wiersz.
 */
export function getRequestEmail(headers: Headers): string | null {
  const devFallback = process.env.NODE_ENV !== "production" ? process.env.DEV_USER_EMAIL : undefined
  const raw = headers.get("x-auth-request-email") ?? devFallback ?? null
  const normalized = raw?.trim().toLowerCase()
  return normalized ? normalized : null
}

export async function requireTileAccess(
  request: Request,
  entitlementCode: string,
): Promise<TileAccessResult> {
  const email = getRequestEmail(request.headers)
  if (!email) return { allowed: false, email: null }

  try {
    const codes = await getGrantedCodes(email)
    return { allowed: codes.includes(entitlementCode), email }
  } catch (error) {
    console.error("[rbac] odmowa dostępu — błąd odczytu uprawnień:", error)
    return { allowed: false, email }
  }
}

/** Czyści cache uprawnień. Do użycia w testach i po zmianie grantów z UI. */
export function clearTileAccessCache(): void {
  cache.clear()
}

async function getGrantedCodes(email: string): Promise<string[]> {
  const entry = cache.get(email)
  if (entry && entry.expiresAt >= Date.now()) return entry.codes
  if (entry) cache.delete(email)

  const codes = await loadGrantedApplicationCodes(email)

  if (cache.size >= CACHE_MAX_ENTRIES && !cache.has(email)) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }
  cache.set(email, { codes, expiresAt: Date.now() + CACHE_TTL_MS })

  return codes
}
