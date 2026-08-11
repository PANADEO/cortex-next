// Adapter integracyjny do OpenWebUI (code-integration) — jedyne miejsce, z
// którego wolno wołać jego API. Kontrakt endpointów zweryfikowany wprost w
// ~/REPO/cortex-admin/openwebui.openapi.json (GroupForm, GroupUpdateForm,
// GroupResponse, UserIdsForm, UserListResponse) — GROUND TRUTH, nie ogólna
// wiedza o OpenWebUI. Pełne uzasadnienie decyzji:
// PROJECT/cortex-frontend-sync-uprawnien-openwebui-projekt.md, D4/D8.
//
// Zakres — SZEŚĆ wywołań (siedem, licząc listAllUserEmailIds), nie czternaście
// jak w cortex-admin: ten adapter NIE zakłada, nie aktualizuje ani nie kasuje
// kont użytkowników (D6).
//
// KOREKTA §1.1 dokumentu projektowego (zweryfikowana na żywo na OpenWebUI
// 0.11.0): teza "`/export` i `POST /id/{id}/users` NIE ISTNIEJĄ w API
// OpenWebUI" jest ODWRÓCONA. Obie ścieżki istnieją i na 0.11.0 są JEDYNYM
// sposobem odczytania członkostwa grupy — łańcuch fallbacków cortex-admina
// nie kompensował własnej pomyłki, tylko realną zmianę schematu. 0.11.0
// przeniosło członkostwo z kolumny JSON `user_ids` do tabeli łączącej
// `group_member`; `GroupResponse` niesie dziś `member_count`, NIE `user_ids`.
// Skutkiem czytania nieistniejącego pola był cichy błąd autoryzacji: odczyt
// zwracał [], więc `toRemove` był ZAWSZE pusty i odebranie roli nigdy nikogo
// nie wypychało z grupy, przy zielonym toaście i `last_sync_error` = NULL.
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

/**
 * Lista id — BEZ cichego defaultu. Pole nieobecne albo o innym kształcie to
 * "NIE UDAŁO SIĘ ODCZYTAĆ członkostwa", a nie "grupa nie ma nikogo": te dwa
 * zdania różnią się tym, że drugie każe reconcilerowi policzyć różnicę wobec
 * fałszywej przesłanki i uznać, że nie ma kogo usuwać. Dokładnie ta zamiana
 * (`?? []`) zamieniła zmianę schematu w OpenWebUI 0.11.0 w cichą awarię
 * autoryzacji — patrz nagłówek pliku. Element nie-string też jest awarią, nie
 * powodem do odfiltrowania: mieszana tablica znaczy, że kontrakt się zmienił.
 */
function requireStringArray(value: unknown, what: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new OpenwebuiClientError("malformed-response", `OpenWebUI nie zwrócił ${what}`)
  }
  return value as string[]
}

/**
 * Domknięcie tej samej dziury z drugiej strony. `requireStringArray` łapie
 * BRAK `user_ids` — ale upstream deklaruje je jako
 * `class GroupExportResponse(GroupResponse): user_ids: list[str] = []`
 * (zweryfikowane w źródle na kontenerze `chat`, 0.11.0), czyli z domyślną
 * PUSTĄ LISTĄ. Gdyby handler `/export` przestał kiedyś podawać to pole jawnie,
 * FastAPI wyserializuje `[]`, `requireStringArray` przyjmie je bez mrugnięcia
 * i wróci dokładnie ten błąd, który commit 1ab131b właśnie naprawił: reconciler
 * uzna, że nie ma kogo usunąć, i przestanie odbierać dostęp. Cicho.
 *
 * `member_count` z tej samej odpowiedzi jest kontrolą krzyżową, bo liczy się
 * OSOBNYM zapytaniem do tej samej tabeli `group_member`
 * (`select count(user_id) ... where group_id = ?` vs `select user_id ... where
 * group_id = ?` — Groups.get_group_member_count_by_id / get_group_user_ids_by_id).
 * Jedno pole nie umie zniknąć "w parze" z drugim; zweryfikowane na żywo:
 * po każdym add/remove oba szły w parze z liczbą wierszy w `group_member`.
 *
 * Brak `member_count` też jest awarią, choć jego domyślną wartością jest `None`
 * (a nie mylące `0`): to jedyny strażnik, jaki tu został, więc jego zniknięcie
 * musi być głośne — inaczej następna zmiana schematu znowu przejdzie po cichu.
 * Świadomie przyjęty koszt: równoległa zmiana członkostwa MIĘDZY tymi dwoma
 * zapytaniami da rozjazd i uzgodnienie padnie z `last_sync_error`. Padnięcie
 * jest odtwarzalne przy następnym uzgodnieniu, ciche odebranie dostępu nie.
 */
function requireMemberCountAgrees(value: unknown, userIds: string[], groupId: string): void {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new OpenwebuiClientError(
      "malformed-response",
      `OpenWebUI nie zwrócił member_count grupy ${groupId} — bez niego nie da się sprawdzić, czy user_ids to prawdziwe członkostwo, czy pusty default`,
    )
  }
  if (value !== userIds.length) {
    throw new OpenwebuiClientError(
      "malformed-response",
      `OpenWebUI zwrócił niespójne członkostwo grupy ${groupId}: member_count=${value}, a user_ids ma ${userIds.length} pozycji`,
    )
  }
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

/**
 * `GET /api/v1/groups/id/{id}/export` — GroupExportResponse, czyli
 * GroupResponse POSZERZONY o `user_ids`. To JEDYNE źródło członkostwa, jakiego
 * używa ten adapter: żadnego łańcucha fallbacków z cortex-admina, ale też
 * żadnego `GET /id/{id}`, które na 0.11.0 niesie już tylko `member_count`.
 *
 * Dlaczego `/export`, a nie `POST /id/{id}/users` (druga działająca ścieżka):
 *  - GET, czasownik bezpieczny — odczyt stanu nie ma prawa jechać POST-em;
 *  - zwraca WPROST id (`user_ids`), waluta reconcilera, bez kroku mapowania i
 *    bez ściągania PII (tamten zwraca pełne UserInfoResponse: e-mail, imię,
 *    bio) tylko po to, żeby wyłuskać `.id`;
 *  - dla NIEISTNIEJĄCEJ grupy `POST /id/{id}/users` zwraca `200 []`, więc
 *    grupa skasowana jest w nim NIEODRÓŻNIALNA od pustej — to znowu ten sam
 *    cichy default, który naprawiamy. `/export` w tym wypadku odpowiada
 *    błędem (zweryfikowane na żywo na 0.11.0);
 *  - `user_ids` to sedno kontraktu `/export` (eksport bez członkostwa byłby
 *    zepsutym eksportem), więc jest to ścieżka najmniej podatna na powtórkę
 *    dzisiejszej wpadki przy kolejnym bumpie obrazu `main`;
 *  - ta sama odpowiedź niesie `member_count`, czyli DRUGI, niezależny odczyt
 *    tego samego członkostwa — patrz requireMemberCountAgrees(). "Najmniej
 *    podatna" to nie to samo co "odporna", więc odczyt jest kontrolowany
 *    krzyżowo, a nie brany na słowo.
 *
 * `null` gdy grupa nie istnieje (usunięta ręcznie w OpenWebUI) — wołający
 * traktuje to jak brak danych do uzgodnienia, nie jak awarię sieci.
 * UWAGA: na 0.11.0 ta gałąź jest nieosiągalna, bo upstream na brak grupy
 * odpowiada 401 (`get_group_by_id`/`export_group_by_id` rzucają
 * HTTP_401_UNAUTHORIZED z detalem NOT_FOUND), co ląduje w `unauthorized`.
 * Świadomie NIE zgadujemy "skasowana" z 401: pomyłka w tę stronę zamieniłaby
 * realnie zły token w cichy no-op `emptyGroupMembership()`, czyli dokładnie tę
 * klasę błędu, którą ten commit likwiduje. Głośno i mylnie > cicho i błędnie.
 */
export async function getGroup(config: OpenwebuiConfig, groupId: string): Promise<OpenwebuiGroup | null> {
  try {
    const data = await request(config, "GET", `/api/v1/groups/id/${encodeURIComponent(groupId)}/export`)
    if (!isRecord(data) || typeof data.id !== "string" || typeof data.name !== "string") {
      throw new OpenwebuiClientError("malformed-response", "OpenWebUI nie zwrócił poprawnej grupy")
    }
    const userIds = requireStringArray(data.user_ids, `członkostwa grupy ${data.id} (pole user_ids)`)
    requireMemberCountAgrees(data.member_count, userIds, data.id)

    return {
      id: data.id,
      name: data.name,
      description: typeof data.description === "string" ? data.description : "",
      userIds,
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
 *
 * Na 0.11.0 `GroupUpdateForm` = `GroupForm` i pola `user_ids` już NIE ma —
 * czyli akurat ta pułapka na tej wersji nie wypala. Sygnatura zostaje ciasna
 * mimo to: wersja upstreamu jest ruchoma (obraz `main`), a to pole raz już
 * z tego formularza zniknęło, więc może i wrócić.
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

/** Konto w OpenWebUI z polami, które Cortex ma prawo nadpisywać. */
export interface OpenwebuiUser {
  id: string
  email: string
  name: string
  role: string
}

/**
 * Pełna lista kont, nie sama mapa e-mail→id (`listAllUserEmailIds` wyżej).
 * Potrzebna do uzgodnienia stanu KONT, bo bez `role` i `name` nie da się
 * powiedzieć, czy coś wymaga zmiany — a wysyłanie zapisu „na wszelki wypadek"
 * zamieniłoby uzgodnienie w bezwarunkowe nadpisanie cudzych danych.
 */
export async function listAllUsers(config: OpenwebuiConfig): Promise<OpenwebuiUser[]> {
  const data = await request(config, "GET", "/api/v1/users/all")
  const rows = isRecord(data) && Array.isArray(data.users) ? data.users : Array.isArray(data) ? data : null
  if (rows === null) {
    throw new OpenwebuiClientError("malformed-response", "Lista użytkowników OpenWebUI ma nieoczekiwany kształt")
  }

  const out: OpenwebuiUser[] = []
  for (const row of rows) {
    if (!isRecord(row)) continue
    if (typeof row.id !== "string" || typeof row.email !== "string") continue
    out.push({
      id: row.id,
      email: row.email.trim().toLowerCase(),
      name: typeof row.name === "string" ? row.name : "",
      role: typeof row.role === "string" ? row.role : "user",
    })
  }
  return out
}

/**
 * Zakłada konto. Hasło PUSTE i to nie jest niedopatrzenie: instancja stoi za
 * `WEBUI_AUTH_TRUSTED_EMAIL_HEADER`, więc logowanie idzie nagłówkiem od
 * oauth2-proxy, a hasło nie jest do niczego używane. Ten sam kształt żądania,
 * którego używał cortex-admin (`POST /api/v1/auths/add`).
 *
 * ZAŁOŻENIE DO POTWIERDZENIA NA ŻYWEJ INSTANCJI: pierwsze logowanie
 * trusted-header trafia w konto założone tędy (dopasowanie po adresie), a nie
 * tworzy drugiego. `OAUTH_MERGE_ACCOUNTS_BY_EMAIL=true` na kontenerze to
 * sugeruje, ale nie jest to sprawdzone zachowanie — patrz S0 w projekcie.
 */
export async function createUser(
  config: OpenwebuiConfig,
  input: { email: string; name: string; role: string },
): Promise<void> {
  await request(config, "POST", "/api/v1/auths/add", {
    email: input.email,
    name: input.name,
    password: "",
    role: input.role,
  })
}

/**
 * Zmienia rolę konta (`user`/`admin`/`pending`). `pending` to sposób OpenWebUI
 * na odcięcie dostępu BEZ kasowania konta — a konta nie kasujemy nigdy, bo
 * mieszka w nim historia rozmów człowieka.
 *
 * DLACZEGO NAJPIERW ODCZYT. Endpoint to `/update`, nie `/update/role`, a jego
 * `UserUpdateForm` wymaga KOMPLETU pól: `role`, `name`, `email`
 * i `profile_image_url` (sprawdzone w `openwebui.openapi.json`). Lista
 * `/users/all` nie zwraca `profile_image_url`, więc bez tego odczytu każdy
 * zapis roli kasowałby człowiekowi avatar, podmieniając go na domyślny.
 *
 * Pierwsza wersja strzelała w `/api/v1/users/{id}/update/role` z samą rolą —
 * ścieżka nieistniejąca w tej wersji OpenWebUI, więc KAŻDE odebranie dostępu
 * i każda zmiana admina kończyłyby się 404. Złapane przeglądem, potwierdzone
 * na specyfikacji i na żywej instancji.
 *
 * Świadomie NIE przenoszę z cortex-admina awaryjnego kasowania konta, gdy ten
 * zapis się nie uda. Nieudany zapis to zwykle chwilowy błąd sieci, a reakcją
 * było tam sięgnięcie po najbardziej nieodwracalną operację w mechanizmie.
 * Awaria ma zatrzymywać, nie eskalować.
 */
export async function updateUserRole(
  config: OpenwebuiConfig,
  userId: string,
  role: string,
): Promise<void> {
  const id = encodeURIComponent(userId)
  const current = await request(config, "GET", `/api/v1/users/${id}`)
  if (!isRecord(current) || typeof current.email !== "string") {
    throw new OpenwebuiClientError("malformed-response", `Konto ${userId} ma nieoczekiwany kształt`)
  }

  await request(config, "POST", `/api/v1/users/${id}/update`, {
    role,
    email: current.email,
    name: typeof current.name === "string" ? current.name : current.email,
    profile_image_url:
      typeof current.profile_image_url === "string" ? current.profile_image_url : "/user.png",
  })
}

/**
 * Konto, do którego należy token administracyjny. Potrzebne, żeby uzgodnienie
 * nie odcięło dostępu SAMEMU SOBIE — cortex-admin chronił ten adres przez
 * `get_session_user()` i było to jedyne zabezpieczenie jego obsługi sierot
 * warte przeniesienia.
 *
 * Zwraca `null` przy dowolnym problemie. Wołający MA OBOWIĄZEK potraktować to
 * jako powód do odmowy uzgodnienia, nie do przejścia dalej: nie wiadomo wtedy,
 * czego chronić.
 */
export async function getTokenOwnerEmail(config: OpenwebuiConfig): Promise<string | null> {
  try {
    const data = await request(config, "GET", "/api/v1/auths/")
    if (!isRecord(data) || typeof data.email !== "string") return null
    return data.email.trim().toLowerCase()
  } catch {
    return null
  }
}
