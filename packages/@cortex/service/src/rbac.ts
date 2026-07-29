// RBAC jako wewnętrzny serwis (nie HTTP) — jedyne miejsce, z którego code-api
// wolno wywołać sprawdzenie dostępu. Kontrakt: code-service/REFERENCE.md.
//
// FAIL-CLOSED bez wyjątków: brak nagłówka, brak użytkownika, użytkownik
// nieaktywny, brak roli, rola bez grantu ORAZ błąd/timeout bazy => allowed:false.
// Awaria Postgresa odcina wszystkich zamiast wpuszczać kogokolwiek — świadomy
// koszt, wymagany przez code-service/SKILL.md pkt 2.

import { loadGrantedApplicationCodes, loadGrantedScopes } from "./rbac-store"

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
const scopeCache = new Map<string, CacheEntry>()

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

/**
 * Warstwa GRANULARNA: czy użytkownik ma konkretną akcję W ŚRODKU kafelka
 * (np. "manage-templates" w Ilustromacie). Osobne pytanie od requireTileAccess(),
 * które odpowiada tylko "czy kafelek w ogóle".
 *
 * Fail-closed identycznie jak warstwa gruboziarnista, ale UWAGA na kolejność
 * w route: sam scope NIE wystarcza. Handler chroniący akcję administracyjną
 * musi przejść OBIE bramki — dostęp do kafelka i grant scope'u. Stąd ta
 * funkcja sprawdza jedno i drugie, zamiast ufać, że wołający pamiętał o obu.
 */
export async function requireTileScope(
  request: Request,
  entitlementCode: string,
  scopeCode: string,
): Promise<TileAccessResult> {
  const access = await requireTileAccess(request, entitlementCode)
  if (!access.allowed || !access.email) return access

  try {
    const scopes = await getGrantedScopes(access.email)
    return { allowed: scopes.includes(`${entitlementCode}:${scopeCode}`), email: access.email }
  } catch (error) {
    console.error("[rbac] odmowa dostępu — błąd odczytu scope'ów:", error)
    return { allowed: false, email: access.email }
  }
}

/** Czyści cache uprawnień. Do użycia w testach i po zmianie grantów z UI. */
export function clearTileAccessCache(): void {
  cache.clear()
  scopeCache.clear()
}

function getGrantedCodes(email: string): Promise<string[]> {
  return cached(cache, email, loadGrantedApplicationCodes)
}

function getGrantedScopes(email: string): Promise<string[]> {
  return cached(scopeCache, email, loadGrantedScopes)
}

/** Wspólny cache obu warstw uprawnień — osobne mapy, identyczna polityka
 *  (TTL + wyrzucanie najstarszego wpisu po przekroczeniu limitu). */
async function cached(
  store: Map<string, CacheEntry>,
  email: string,
  load: (email: string) => Promise<string[]>,
): Promise<string[]> {
  const entry = store.get(email)
  if (entry && entry.expiresAt >= Date.now()) return entry.codes
  if (entry) store.delete(email)

  const codes = await load(email)

  if (store.size >= CACHE_MAX_ENTRIES && !store.has(email)) {
    const oldest = store.keys().next().value
    if (oldest !== undefined) store.delete(oldest)
  }
  store.set(email, { codes, expiresAt: Date.now() + CACHE_TTL_MS })

  return codes
}
