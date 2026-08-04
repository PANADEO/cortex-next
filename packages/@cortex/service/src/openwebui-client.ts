// Adapter integracyjny do OpenWebUI (code-integration) — jedyne miejsce, z
// którego wolno wołać jego API. Kontrakt endpointów zweryfikowany wprost w
// ~/REPO/cortex-admin/openwebui.openapi.json (GroupForm, GroupUpdateForm,
// GroupResponse, UserIdsForm, UserListResponse) — GROUND TRUTH, nie ogólna
// wiedza o OpenWebUI. Pełne uzasadnienie decyzji:
// PROJECT/cortex-frontend-sync-uprawnien-openwebui-projekt.md, D4/D8.
//
// Zakres — SZEŚĆ wywołań (siedem, licząc listAllUserEmailIds), nie czternaście
// jak w cortex-admin: ten adapter NIE zakłada, nie aktualizuje ani nie kasuje
// kont użytkowników (D6) i nie zna `/export`/`POST users` — te dwie ścieżki z
// cortex-admin NIE ISTNIEJĄ w API OpenWebUI (§1.1 dokumentu projektowego).
//
// Sekret WYŁĄCZNIE jawnym argumentem (OpenwebuiConfig), nigdy czytany z
// process.env tutaj — wzorem fetchProxyUsage() w cortex-proxy-client.ts.
// Konfigurację (leniwą, Zod) czyta openwebui-sync.ts (D8).
//
// Niezmiennik do utrzymania: ten plik NIE importuje @cortex/db. Adapter zna
// HTTP, nie zna Postgresa.

const REQUEST_TIMEOUT_MS = 5_000

export interface OpenwebuiConfig {
  /** Bez końcowego "/" — normalizowane przy odczycie configu. */
  baseUrl: string
  adminToken: string
}

export interface OpenwebuiGroupSummary {
  id: string
  name: string
}

export interface OpenwebuiGroup extends OpenwebuiGroupSummary {
  description: string
  userIds: string[]
}

/**
 * Rodzaj awarii, nie tekst — wołający (openwebui-sync.ts) mapuje to na
 * `last_sync_error` i na status HTTP odpowiedzi mutacji. Ten sam kształt co
 * `CortexProxyUsageFailure` w cortex-proxy-client.ts.
 */
export type OpenwebuiClientFailure =
  | "unauthorized"
  | "not-found"
  | "upstream-error"
  | "unreachable"
  | "malformed-response"

export class OpenwebuiClientError extends Error {
  readonly failure: OpenwebuiClientFailure
  readonly status: number | null

  constructor(failure: OpenwebuiClientFailure, message: string, status: number | null = null) {
    super(message)
    this.name = "OpenwebuiClientError"
    this.failure = failure
    this.status = status
  }
}

async function request(
  config: OpenwebuiConfig,
  method: "GET" | "POST",
  path: string,
  body?: unknown,
): Promise<unknown> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  let response: Response
  // `cache: "no-store"` (opt-out z Next.js Data Cache, patrz fetchProxyUsage()
  // w cortex-proxy-client.ts) NIE jest w typie `RequestInit` z @types/node
  // (undici-types, brak `lib: dom` w tsconfig tego pakietu — code-integration:
  // adapter jest server-only). Budowane przez zmienną, nie jako świeży literał
  // w wywołaniu fetch() — TS sprawdza wtedy przypisywalność strukturalnie, nie
  // "excess property", więc pole nadal trafia do realnego żądania w runtime
  // Next.js, który patchuje globalThis.fetch niezależnie od tych typów.
  const init = {
    method,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      // Sekret WYŁĄCZNIE nagłówkiem — nigdy w query stringu (patrz nagłówek
      // pliku i fetchProxyUsage() w cortex-proxy-client.ts).
      Authorization: `Bearer ${config.adminToken}`,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: controller.signal,
    cache: "no-store" as const,
  }

  try {
    response = await fetch(`${config.baseUrl}${path}`, init)
  } catch {
    // Komunikat świadomie własny — wyjątek warstwy sieciowej potrafi nieść
    // pełny URL, który nie ma prawa trafić do logu ani do klienta.
    const reason = controller.signal.aborted ? "przekroczono limit czasu" : "brak połączenia"
    throw new OpenwebuiClientError("unreachable", `OpenWebUI nieosiągalny (${reason})`)
  } finally {
    clearTimeout(timeout)
  }

  if (response.status === 404) {
    throw new OpenwebuiClientError("not-found", "OpenWebUI zwrócił 404", 404)
  }
  if (response.status === 401 || response.status === 403) {
    throw new OpenwebuiClientError(
      "unauthorized",
      "OpenWebUI odrzucił token administracyjny (sprawdź OPENWEBUI_ADMIN_TOKEN)",
      response.status,
    )
  }
  if (!response.ok) {
    throw new OpenwebuiClientError("upstream-error", `OpenWebUI zwrócił ${response.status}`, response.status)
  }

  if (response.status === 204) return null

  try {
    return await response.json()
  } catch {
    throw new OpenwebuiClientError(
      "malformed-response",
      "OpenWebUI zwrócił odpowiedź, której nie da się sparsować jako JSON",
      response.status,
    )
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []
}

/** `GET /api/v1/groups/` — lista wszystkich grup (przy podpinaniu istniejącej). */
export async function listGroups(config: OpenwebuiConfig): Promise<OpenwebuiGroupSummary[]> {
  const data = await request(config, "GET", "/api/v1/groups/")
  if (!Array.isArray(data)) {
    throw new OpenwebuiClientError("malformed-response", "Lista grup OpenWebUI nie jest tablicą")
  }
  return data
    .filter(isRecord)
    .filter((row) => typeof row.id === "string" && typeof row.name === "string")
    .map((row) => ({ id: row.id as string, name: row.name as string }))
}

/** `POST /api/v1/groups/create` — GroupForm { name, description, permissions }.
 *  `permissions: {}` — wymiar C (workspace/chat) świadomie POZA MVP (§8/D-wymiar C). */
export async function createGroup(
  config: OpenwebuiConfig,
  name: string,
  description: string,
): Promise<OpenwebuiGroupSummary> {
  const data = await request(config, "POST", "/api/v1/groups/create", {
    name,
    description,
    permissions: {},
  })
  if (!isRecord(data) || typeof data.id !== "string" || typeof data.name !== "string") {
    throw new OpenwebuiClientError("malformed-response", "OpenWebUI nie zwrócił poprawnej grupy po utworzeniu")
  }
  return { id: data.id, name: data.name }
}

/** `GET /api/v1/groups/id/{id}` — GroupResponse.user_ids, BEZ łańcucha
 *  fallbacków `/export`/`POST users` z cortex-admina (te ścieżki nie istnieją
 *  w API OpenWebUI — §1.1 dokumentu projektowego). `null` gdy grupa nie
 *  istnieje (usunięta ręcznie w OpenWebUI) — wołający traktuje to jak brak
 *  danych do uzgodnienia, nie jak awarię sieci. */
export async function getGroup(config: OpenwebuiConfig, groupId: string): Promise<OpenwebuiGroup | null> {
  try {
    const data = await request(config, "GET", `/api/v1/groups/id/${encodeURIComponent(groupId)}`)
    if (!isRecord(data) || typeof data.id !== "string" || typeof data.name !== "string") {
      throw new OpenwebuiClientError("malformed-response", "OpenWebUI nie zwrócił poprawnej grupy")
    }
    return {
      id: data.id,
      name: data.name,
      description: typeof data.description === "string" ? data.description : "",
      userIds: asStringArray(data.user_ids),
    }
  } catch (error) {
    if (error instanceof OpenwebuiClientError && error.failure === "not-found") return null
    throw error
  }
}

/**
 * `POST /api/v1/groups/id/{id}/update` — GroupUpdateForm { name, description }.
 *
 * NIGDY `user_ids` — D4: `GroupUpdateForm` DOPUSZCZA to pole, i przekazanie go
 * NADPISUJE całe członkostwo grupy. Ta funkcja celowo nie przyjmuje go jako
 * parametru, żeby ta pomyłka była niemożliwa do popełnienia z tego adaptera,
 * nie tylko "niezalecana".
 */
export async function updateGroupMeta(
  config: OpenwebuiConfig,
  groupId: string,
  name: string,
  description: string,
): Promise<void> {
  await request(config, "POST", `/api/v1/groups/id/${encodeURIComponent(groupId)}/update`, {
    name,
    description,
  })
}

/** `POST /api/v1/groups/id/{id}/users/add` — UserIdsForm { user_ids }.
 *  Pusta lista = no-op, zero żądania (jak w cortex-admin, ale bez logów PL). */
export async function addUsersToGroup(
  config: OpenwebuiConfig,
  groupId: string,
  userIds: string[],
): Promise<void> {
  if (userIds.length === 0) return
  await request(config, "POST", `/api/v1/groups/id/${encodeURIComponent(groupId)}/users/add`, {
    user_ids: userIds,
  })
}

/** `POST /api/v1/groups/id/{id}/users/remove` — UserIdsForm { user_ids }. */
export async function removeUsersFromGroup(
  config: OpenwebuiConfig,
  groupId: string,
  userIds: string[],
): Promise<void> {
  if (userIds.length === 0) return
  await request(config, "POST", `/api/v1/groups/id/${encodeURIComponent(groupId)}/users/remove`, {
    user_ids: userIds,
  })
}

/**
 * `GET /api/v1/users/all` — JEDYNE dotknięcie kont użytkowników (D6: adapter
 * nigdy nie tworzy/aktualizuje/kasuje konto, wyłącznie czyta, żeby dopasować
 * e-mail z system_config na id konta w OpenWebUI). Użytkownik, który nigdy
 * się nie zalogował do OpenWebUI, nie ma tu wiersza — wołający (openwebui-
 * sync.ts) pomija go bez błędu (D6, skutek uboczny zaakceptowany świadomie).
 *
 * Klucze mapy znormalizowane do lowercase — dopasowanie z system_config.users
 * (kolumna trzyma wyłącznie lowercase) musi być case-insensitive.
 */
export async function listAllUserEmailIds(config: OpenwebuiConfig): Promise<Map<string, string>> {
  const data = await request(config, "GET", "/api/v1/users/all")
  const rows = isRecord(data) && Array.isArray(data.users) ? data.users : Array.isArray(data) ? data : null
  if (rows === null) {
    throw new OpenwebuiClientError("malformed-response", "Lista użytkowników OpenWebUI ma nieoczekiwany kształt")
  }

  const byEmail = new Map<string, string>()
  for (const row of rows) {
    if (!isRecord(row)) continue
    if (typeof row.id !== "string" || typeof row.email !== "string") continue
    byEmail.set(row.email.trim().toLowerCase(), row.id)
  }
  return byEmail
}
