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

/** Jedna warstwa cache'a: wpisy + odczyty-w-locie dla tej konkretnej warstwy
 *  uprawnień (gruboziarnista `accessLayer` vs granularna `scopeLayer`). Osobne
 *  mapy per warstwa, żeby dedup odczytów-w-locie jednej warstwy nie blokował
 *  drugiej. */
interface CacheLayer {
  store: Map<string, CacheEntry>
  inFlight: Map<string, Promise<string[]>>
}

const CACHE_TTL_MS = 30_000
const CACHE_MAX_ENTRIES = 10_000

const accessLayer: CacheLayer = { store: new Map(), inFlight: new Map() }
const scopeLayer: CacheLayer = { store: new Map(), inFlight: new Map() }

// Rośnie przy każdym czyszczeniu cache (obu warstw naraz — clearTileAccessCache()
// zawsze czyści oba). Odczyt rozpoczęty PRZED unieważnieniem nie ma prawa
// zapisać swojego (już nieaktualnego) wyniku po nim — inaczej odebranie
// uprawnień wracałoby do cache na kolejne 30 s.
let generation = 0

/**
 * Tożsamość z nagłówka wstrzykniętego przez oauth2-proxy, z fallbackiem na
 * DEV_USER_EMAIL gdy nagłówek jest nieobecny. Jedyna implementacja tej reguły
 * w repo — app/idp/lib/cortex-governance/request-identity.ts to cienki adapter
 * wołający wprost tę funkcję, nie równoległa kopia.
 *
 * Fallback bramkowany WYŁĄCZNIE obecnością DEV_USER_EMAIL — celowo NIE
 * `NODE_ENV !== "production"`. `next build` zawsze kompiluje się z
 * NODE_ENV=production (Dockerfile, etap `runner`: `ENV NODE_ENV=production`),
 * a webpack DefinePlugin zamraża `process.env.NODE_ENV` w skompilowanym
 * standalone outpucie na stałe — ustawienie NODE_ENV w env kontenera w ogóle
 * nie ma wpływu na tę gałąź, bo runtime już jej nie odczytuje. Efekt: warunek
 * `NODE_ENV !== "production"` jest w obrazie Dockera zamrożony na `false` na
 * zawsze, więc DEV_USER_EMAIL nigdy nie działał w skompilowanym artefakcie —
 * ani lokalnie (docker-compose.yml), ani na demo-dev — zweryfikowane
 * empirycznie 03.08.2026: `next build` + standalone `server.js` z
 * NODE_ENV=production i DEV_USER_EMAIL ustawionym w env procesu (dokładnie
 * układ z docker-compose.yml) → `GET /api/me/access` zwracał 401
 * `{"error":"missing-email"}` na starym kodzie; na tym niżej — 200 z
 * poprawnie rozpoznanym e-mailem. Nawet ustawienie NODE_ENV=development W
 * RUNTIME (symulacja "a może pomoże") nie zmieniało wyniku — potwierdza to,
 * że wartość jest zamrożona w bundlu, nie odczytywana na żywo.
 *
 * Bezpieczne mimo usunięcia gałęzi NODE_ENV: prawdziwy deploy (Ansible/
 * Semaphore, docker-compose.image.yml + `.env` z sekretów) nigdy nie
 * definiuje DEV_USER_EMAIL — nie ma jej w żadnym miejscu tej konfiguracji.
 * Nawet gdyby ktoś ją tam przez pomyłkę dodał, fallback ma NIŻSZY priorytet
 * niż nagłówek `x-auth-request-email` (patrz `??` niżej) i włącza się tylko,
 * gdy ten nagłówek jest w ogóle nieobecny — a na demo-dev/produkcji Caddy +
 * oauth2-proxy zatrzymują nieautoryzowany ruch PRZED Next.js (CLAUDE.md,
 * sekcja Auth), więc żądanie bez nagłówka tam w ogóle nie dociera do tej
 * funkcji.
 *
 * E-mail normalizowany do lowercase — kolumna users.email trzyma wyłącznie
 * lowercase, więc bez tego "Jan@Firma.pl" nie trafiłby w swój wiersz.
 */
export function getRequestEmail(headers: Headers): string | null {
  const raw = headers.get("x-auth-request-email") ?? process.env.DEV_USER_EMAIL ?? null
  const normalized = normalizeEmail(raw)
  return normalized ? normalized : null
}

/** Kanoniczna postać adresu: kolumna users.email trzyma wyłącznie lowercase.
 *  Eksportowana — createUser() w system-config.ts musi znormalizować e-mail
 *  DOKŁADNIE tak samo jak odczyt, inaczej "Jan@Firma.pl" utworzony przez UI
 *  nigdy nie dopasuje się do znormalizowanego adresu z nagłówka auth. */
export function normalizeEmail(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? ""
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

/**
 * WSZYSTKIE kody aplikacji przyznane temu e-mailowi — pytanie "co ten user w
 * ogóle ma", nie "czy ma ten konkretny kafelek". Jedyny konsument to bramka
 * powłoki (`GET /api/me/access`), która musi oddać klientowi całą listę.
 *
 * Dzieli DOKŁADNIE tę samą warstwę cache'a co requireTileAccess() — ta sama
 * `accessLayer`, ten sam TTL, ta sama inwalidacja przez clearTileAccessCache().
 * To nie jest detal implementacyjny: drugi, równoległy cache uprawnień oznaczał
 * -by, że odebranie dostępu z UI działa natychmiast w API modułów, a w powłoce
 * dopiero po wygaśnięciu cudzego TTL.
 *
 * W przeciwieństwie do requireTileAccess() ta funkcja NIE połyka błędu bazy —
 * propaguje wyjątek. Fail-closed egzekwuje wołający, dzięki czemu awaria bazy
 * jest logowalna i odróżnialna od "user nie ma żadnych grantów".
 */
export function getGrantedApplicationCodes(email: string): Promise<string[]> {
  // Normalizacja także tutaj, mimo że route dostaje adres już z
  // getRequestEmail(): to jedyna publiczna funkcja tego modułu przyjmująca
  // gołego stringa, więc bez tego wołający z "Jan@Firma.pl" dostałby po cichu
  // pustą listę (i osobny wpis w cache) zamiast swoich uprawnień.
  return getGrantedCodes(normalizeEmail(email))
}

/**
 * Czyści cache uprawnień (obie warstwy). Wołane z każdej mutacji uprawnień w
 * @cortex/service/system-config.ts, żeby odebranie dostępu działało
 * natychmiast, a nie po wygaśnięciu TTL.
 *
 * ZAKRES: cache jest per-proces. Przy wielu instancjach appu pozostałe nadal
 * dogaszają wpisy po TTL (do 30 s) — świadomie zaakceptowany limit, patrz
 * code-service/REFERENCE.md.
 */
export function clearTileAccessCache(): void {
  accessLayer.store.clear()
  accessLayer.inFlight.clear()
  scopeLayer.store.clear()
  scopeLayer.inFlight.clear()
  generation += 1
}

function getGrantedCodes(email: string): Promise<string[]> {
  return cached(accessLayer, email, loadGrantedApplicationCodes)
}

function getGrantedScopes(email: string): Promise<string[]> {
  return cached(scopeLayer, email, loadGrantedScopes)
}

/** Wspólna logika obu warstw uprawnień: TTL + dedup odczytów-w-locie (jeden
 *  request do bazy na e-mail przy zimnym cache) + odporność na wyścig z
 *  unieważnieniem (odczyt rozpoczęty przed clearTileAccessCache() nie zapisuje
 *  już nieaktualnego wyniku po nim) + wyrzucanie najstarszego wpisu po
 *  przekroczeniu limitu. */
async function cached(
  layer: CacheLayer,
  email: string,
  load: (email: string) => Promise<string[]>,
): Promise<string[]> {
  const entry = layer.store.get(email)
  if (entry && entry.expiresAt >= Date.now()) return entry.codes
  if (entry) layer.store.delete(email)

  const pending = layer.inFlight.get(email)
  if (pending) return pending

  const startedAt = generation
  const request = load(email)
    .then((codes) => {
      if (generation === startedAt) remember(layer, email, codes)
      return codes
    })
    .finally(() => {
      if (layer.inFlight.get(email) === request) layer.inFlight.delete(email)
    })

  layer.inFlight.set(email, request)
  return request
}

function remember(layer: CacheLayer, email: string, codes: string[]): void {
  if (layer.store.size >= CACHE_MAX_ENTRIES && !layer.store.has(email)) {
    const oldest = layer.store.keys().next().value
    if (oldest !== undefined) layer.store.delete(oldest)
  }
  layer.store.set(email, { codes, expiresAt: Date.now() + CACHE_TTL_MS })
}
