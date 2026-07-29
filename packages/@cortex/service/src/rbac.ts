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

// Odczyty w locie, po jednym na e-mail — dwa równoległe żądania tego samego
// użytkownika przy zimnym cache dzielą jedno zapytanie do bazy.
const inFlight = new Map<string, Promise<string[]>>()

// Rośnie przy każdym czyszczeniu cache. Odczyt rozpoczęty PRZED unieważnieniem
// nie ma prawa zapisać swojego (już nieaktualnego) wyniku po nim — inaczej
// odebranie uprawnień wracałoby do cache na kolejne 30 s.
let generation = 0

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
 * Czyści cache uprawnień. Wołane z każdej mutacji uprawnień w
 * @cortex/service/system-config.ts, żeby odebranie dostępu działało
 * natychmiast, a nie po wygaśnięciu TTL.
 *
 * ZAKRES: cache jest per-proces. Przy wielu instancjach appu pozostałe nadal
 * dogaszają wpisy po TTL (do 30 s) — świadomie zaakceptowany limit, patrz
 * code-service/REFERENCE.md.
 */
export function clearTileAccessCache(): void {
  cache.clear()
  inFlight.clear()
  generation += 1
}

async function getGrantedCodes(email: string): Promise<string[]> {
  const entry = cache.get(email)
  if (entry && entry.expiresAt >= Date.now()) return entry.codes
  if (entry) cache.delete(email)

  const pending = inFlight.get(email)
  if (pending) return pending

  const startedAt = generation
  const load = loadGrantedApplicationCodes(email)
    .then((codes) => {
      if (generation === startedAt) rememberCodes(email, codes)
      return codes
    })
    .finally(() => {
      if (inFlight.get(email) === load) inFlight.delete(email)
    })

  inFlight.set(email, load)
  return load
}

function rememberCodes(email: string, codes: string[]): void {
  if (cache.size >= CACHE_MAX_ENTRIES && !cache.has(email)) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }
  cache.set(email, { codes, expiresAt: Date.now() + CACHE_TTL_MS })
}
