// Logika uzgodnienia + konfiguracja modułu (code-service). Reconciler, NIE
// propagacja zdarzeń (D3 dokumentu projektowego) — stan docelowy jest zawsze
// w pełni wyliczalny z Postgresa, więc przegapione wywołanie kosztuje
// opóźnienie do następnego uzgodnienia, nigdy utratę/niespójność danych.
//
// Wariant A (decyzja Alexa 31.07.2026): grupy OpenWebUI lustrzanie
// odwzorowują ROLE — jedna zmapowana rola = jedna grupa, członkostwo = komplet
// AKTYWNYCH użytkowników trzymających tę rolę. Kierunek WYŁĄCZNIE
// system_config -> OpenWebUI (D2) — ten plik nigdy nie zapisuje niczego do
// Postgresa poza własnym stanem synchronizacji (last_synced_at/last_sync_error).
//
// Niezmiennik do utrzymania: ten plik NIE woła fetch() bezpośrednio — całe
// HTTP idzie przez openwebui-client.ts. Dostęp do bazy idzie przez
// openwebui-sync-store.ts (testowalność bez Postgresa, patrz jej nagłówek).
//
// PROJECT/cortex-frontend-sync-uprawnien-openwebui-projekt.md — D1 (Wariant A,
// decyzja Alexa), D2 (kierunek), D3 (wyzwalanie/budżet czasu), D4 (przyrostowo,
// nigdy groups/update z user_ids), D6 (nie tworzymy/kasujemy kont), D7
// (co dokładnie robi każde zdarzenie).

import { z } from "zod"
import * as client from "./openwebui-client"
import * as store from "./openwebui-sync-store"

export interface OpenwebuiSyncResult {
  status: "ok" | "skipped" | "failed"
  message?: string
}

/** D3: "Promise.race z timeoutem rzędu 5 s, wynik złapany i zapisany do
 *  last_sync_error" — budżet dla CAŁEGO uzgodnienia jednej grupy, nie per
 *  wywołanie HTTP (te mają własny timeout w openwebui-client.ts). */
const SYNC_BUDGET_MS = 5_000

export const GROUP_NAME_PREFIX = "cortex:"
export const GROUP_DESCRIPTION =
  "Zarządzane przez Konfigurację Systemu Cortex360 — nie edytuj członkostwa ręcznie."

export function groupNameForRoleCode(code: string): string {
  return `${GROUP_NAME_PREFIX}${code}`
}

const configSchema = z.object({
  OPENWEBUI_URL: z.string().url(),
  OPENWEBUI_ADMIN_TOKEN: z.string().min(1),
})

/** Pusty string to NIE jest wartość — docker-compose wstawia `VAR: ${VAR:-}`
 *  (ten sam wzorzec co ilustromatConfig()). */
function orUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

/**
 * Czytane przy każdym wywołaniu, nie przy imporcie (D5) — testy i build nie
 * muszą mieć kompletu zmiennych. `null` = funkcja WYŁĄCZONA, nie awaria:
 * każdy wołający tej funkcji ma obowiązek zwrócić `{status: "skipped"}` w tym
 * przypadku, reszta aplikacji działa normalnie.
 */
export function openwebuiConfig(): client.OpenwebuiConfig | null {
  const parsed = configSchema.safeParse({
    OPENWEBUI_URL: orUndefined(process.env.OPENWEBUI_URL),
    OPENWEBUI_ADMIN_TOKEN: orUndefined(process.env.OPENWEBUI_ADMIN_TOKEN),
  })
  if (!parsed.success) return null

  return {
    baseUrl: parsed.data.OPENWEBUI_URL.replace(/\/$/, ""),
    adminToken: parsed.data.OPENWEBUI_ADMIN_TOKEN,
  }
}

/**
 * Uzgadnia członkostwo JEDNEJ zmapowanej grupy z jej aktualnym zbiorem
 * docelowym (D7: różnica symetryczna wobec ŻYWEGO stanu OpenWebUI, nigdy
 * nadpisanie całej grupy — D4). NIGDY nie rzuca — każda awaria (brak configu,
 * brak mapowania, błąd sieci, timeout, grupa skasowana w OpenWebUI) wraca
 * jako `{status: "failed"|"skipped", message}`, zapisana też do
 * `last_sync_error` na wierszu mapowania. To jest granica izolacji: żadna
 * awaria tej funkcji nie ma prawa wywrócić mutacji RBAC, która ją wywołała
 * (D3, R1 dokumentu projektowego).
 */
export async function reconcileRoleGroup(roleId: string): Promise<OpenwebuiSyncResult> {
  const config = openwebuiConfig()
  if (!config) return { status: "skipped" }

  const mapping = await store.getRoleGroupMapping(roleId).catch(() => null)
  if (!mapping) return { status: "skipped" }

  try {
    await withBudget(() => pushGroupState(config, mapping.roleId, mapping.groupId, mapping.groupName), SYNC_BUDGET_MS)
    await store.recordSyncResult(roleId, null)
    return { status: "ok" }
  } catch (error) {
    const message = errorMessage(error)
    await store.recordSyncResult(roleId, message).catch(() => {
      // Zapis WYNIKU nie ma prawa dołożyć drugiej awarii do pierwszej —
      // najwyżej last_sync_error zostaje z poprzedniego uzgodnienia.
    })
    return { status: "failed", message }
  }
}

async function pushGroupState(
  config: client.OpenwebuiConfig,
  roleId: string,
  groupId: string,
  groupName: string,
): Promise<void> {
  const [targetEmails, group, emailToId] = await Promise.all([
    store.loadActiveRoleMemberEmails(roleId),
    client.getGroup(config, groupId),
    client.listAllUserEmailIds(config),
  ])

  if (!group) {
    throw new Error(`Grupa ${groupId} nie istnieje już w OpenWebUI (usunięta ręcznie?)`)
  }

  // D6: użytkownik bez konta w OpenWebUI (nigdy się nie zalogował) jest
  // pomijany bez błędu — dołączy przy następnym uzgodnieniu po pierwszym
  // logowaniu. `undefined` filtrowany przez `Boolean`.
  const targetIds = new Set(
    targetEmails.map((email) => emailToId.get(email.toLowerCase())).filter((id): id is string => Boolean(id)),
  )
  const currentIds = new Set(group.userIds)

  const toAdd = [...targetIds].filter((id) => !currentIds.has(id))
  const toRemove = [...currentIds].filter((id) => !targetIds.has(id))

  // Przyrostowo — D4: NIGDY groups/update z user_ids (nadpisałoby całą grupę).
  await client.addUsersToGroup(config, groupId, toAdd)
  await client.removeUsersFromGroup(config, groupId, toRemove)
  // Nazwa/opis odświeżane tanio przy każdym uzgodnieniu (D1) — NIGDY do
  // dopasowania, wyłącznie do czytelności w panelu OpenWebUI.
  await client.updateGroupMeta(config, groupId, groupName, GROUP_DESCRIPTION)
}

/**
 * Wiele ról naraz — jedna awaria NIE blokuje uzgodnienia pozostałych
 * (izolacja awarii jest per-grupa, nie per-wywołanie). Używane przez
 * setUserRoles (role dodane+odebrane) i updateUser/isActive (wszystkie role
 * użytkownika).
 */
export async function reconcileRoleGroups(roleIds: string[]): Promise<OpenwebuiSyncResult> {
  const unique = [...new Set(roleIds)]
  if (unique.length === 0) return { status: "skipped" }

  const results = await Promise.all(unique.map((roleId) => reconcileRoleGroup(roleId)))
  return summarize(results)
}

/** "Synchronizuj teraz" dla WSZYSTKICH zmapowanych ról naraz — ścieżka naprawy
 *  po oknie rozjazdu (R1) albo po ręcznej zmianie w OpenWebUI (D2). */
export async function reconcileAllMappedGroups(): Promise<OpenwebuiSyncResult> {
  const roleIds = await store.listMappedRoleIds().catch(() => [])
  return reconcileRoleGroups(roleIds)
}

/**
 * Opróżnia członkostwo grupy BEZPOŚREDNIO po groupId, bez czytania/pisania
 * wiersza mapowania — używane przez deleteRole() PO commicie transakcji,
 * gdy `ON DELETE CASCADE` już skasował wiersz `openwebui_group_mappings` razem
 * z rolą (D7: "przed usunięciem: opróżnij grupę, potem DELETE kasuje mapowanie
 * kaskadą. Grupy w OpenWebUI NIE usuwamy."). Brak configu/grupy = no-op,
 * traktowany jako sukces (nic do zrobienia), nie awaria.
 */
export async function emptyGroupMembership(groupId: string): Promise<OpenwebuiSyncResult> {
  const config = openwebuiConfig()
  if (!config) return { status: "skipped" }

  try {
    await withBudget(async () => {
      const group = await client.getGroup(config, groupId)
      if (!group) return
      await client.removeUsersFromGroup(config, groupId, group.userIds)
    }, SYNC_BUDGET_MS)
    return { status: "ok" }
  } catch (error) {
    return { status: "failed", message: errorMessage(error) }
  }
}

export interface RoleGroupSyncPreview {
  status: "ok"
  groupName: string
  /** Ilu aktywnych użytkowników z rolą ma dziś konto w OpenWebUI — mianownik
   *  dla "toAdd"/"toRemove" w UI. */
  targetCount: number
  /** Ilu przybędzie do grupy przy najbliższym "Synchronizuj teraz". */
  toAdd: number
  /** Ilu ubędzie z grupy przy najbliższym "Synchronizuj teraz" — R2: to jest
   *  liczba, która ma ostrzec admina PRZED podpięciem cudzej/niewłaściwej
   *  grupy, zanim jej członkostwo zostanie nadpisane. */
  toRemove: number
}

/**
 * Odczyt-bez-zapisu: co zrobiłoby najbliższe `reconcileRoleGroup()`, bez
 * wysyłania ANI JEDNEGO żądania zmieniającego stan (R2 dokumentu projektowego
 * — "przy podpinaniu pokazać liczbę użytkowników, którzy zostaną dodani i
 * usunięci"). Używane przez GET .../openwebui-group, żeby UI mogło pokazać
 * podgląd przed kliknięciem "Synchronizuj teraz".
 */
export async function previewRoleGroupSync(
  roleId: string,
): Promise<RoleGroupSyncPreview | { status: "skipped" } | { status: "failed"; message: string }> {
  const config = openwebuiConfig()
  if (!config) return { status: "skipped" }

  const mapping = await store.getRoleGroupMapping(roleId).catch(() => null)
  if (!mapping) return { status: "skipped" }

  try {
    const { targetIds, group } = await withBudget(async () => {
      const [targetEmails, groupState, emailToId] = await Promise.all([
        store.loadActiveRoleMemberEmails(roleId),
        client.getGroup(config, mapping.groupId),
        client.listAllUserEmailIds(config),
      ])
      const ids = new Set(
        targetEmails.map((email) => emailToId.get(email.toLowerCase())).filter((id): id is string => Boolean(id)),
      )
      return { targetIds: ids, group: groupState }
    }, SYNC_BUDGET_MS)

    if (!group) {
      return { status: "failed", message: `Grupa ${mapping.groupId} nie istnieje już w OpenWebUI` }
    }

    const currentIds = new Set(group.userIds)
    const toAdd = [...targetIds].filter((id) => !currentIds.has(id)).length
    const toRemove = [...currentIds].filter((id) => !targetIds.has(id)).length

    return { status: "ok", groupName: mapping.groupName, targetCount: targetIds.size, toAdd, toRemove }
  } catch (error) {
    return { status: "failed", message: errorMessage(error) }
  }
}

function summarize(results: OpenwebuiSyncResult[]): OpenwebuiSyncResult {
  if (results.length === 0 || results.every((result) => result.status === "skipped")) {
    return { status: "skipped" }
  }

  const failed = results.filter((result) => result.status === "failed")
  if (failed.length > 0) {
    return { status: "failed", message: failed.map((result) => result.message).join("; ") }
  }

  return { status: "ok" }
}

function withBudget<T>(fn: () => Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<T>((_resolve, reject) => {
      setTimeout(() => reject(new Error(`Przekroczono budżet czasu synchronizacji (${ms} ms)`)), ms)
    }),
  ])
}

function errorMessage(error: unknown): string {
  if (error instanceof client.OpenwebuiClientError) return error.message
  if (error instanceof Error) return error.message
  return "Nieznany błąd synchronizacji z OpenWebUI"
}

// ---------------------------------------------------------------------------
// Podpięcie/odpięcie mapowania (route openwebui-group, PUT) — akcja RĘCZNA
// admina, celowo BEZ automatycznego pushu członkostwa od razu (D7: "utworzenie
// aplikacji/roli: nic" — mapowanie zakłada się osobnym, jawnym działaniem;
// pierwszy realny push odbywa się dopiero na "Synchronizuj teraz" albo przy
// najbliższej mutacji ról. Świadome cięcie zamiast dry-run z R2: admin widzi
// pustą/nietkniętą grupę zaraz po podpięciu, ma moment na anulowanie zanim
// jakiekolwiek członkostwo się zmieni).
// ---------------------------------------------------------------------------

export type AttachRoleGroupError = "not-configured" | "unknown-role" | "group-not-found"

/**
 * Próba podpięcia grupy OpenWebUI, która stoi już za INNĄ rolą. Klasa wyjątku,
 * nie kolejny wariant `AttachRoleGroupError`, bo w odróżnieniu od tamtych
 * niesie DANE (kod kolidującej roli) — tak samo jak SelfLockoutError /
 * ModuleNotLicensedError, które też muszą powiedzieć adminowi CO konkretnie
 * blokuje, a nie tylko że coś blokuje. Bramka modułu mapuje ją na 409
 * (konflikt ze stanem danych, dokładnie ta klasa co SelfLockoutError).
 */
export class OpenwebuiGroupAlreadyMappedError extends Error {
  readonly conflictingRoleCode: string

  constructor(conflictingRoleCode: string) {
    super(
      `Ta grupa OpenWebUI jest już podpięta pod rolę "${conflictingRoleCode}". Jedna grupa może ` +
        "stać za najwyżej jedną rolą — inaczej obie role wyliczają dla niej różne członkostwo i " +
        "przy każdej synchronizacji wyrzucają nawzajem swoich użytkowników. Odepnij grupę od " +
        `roli "${conflictingRoleCode}" albo wybierz inną grupę.`,
    )
    this.name = "OpenwebuiGroupAlreadyMappedError"
    this.conflictingRoleCode = conflictingRoleCode
  }
}

export interface AttachRoleGroupInput {
  roleId: string
  /** `{kind: "create"}` — nowa grupa `cortex:<code roli>`.
   *  `{kind: "existing", groupId}` — podłącz już istniejącą grupę (R2: może
   *  gatować wrażliwego asystenta — UI ma to jawnie ostrzec przed potwierdzeniem). */
  action: { kind: "create" } | { kind: "existing"; groupId: string }
}

export async function attachRoleGroup(
  input: AttachRoleGroupInput,
): Promise<{ mapping: Awaited<ReturnType<typeof store.upsertRoleGroupMapping>> } | { error: AttachRoleGroupError }> {
  const config = openwebuiConfig()
  if (!config) return { error: "not-configured" }

  const role = await store.getRole(input.roleId)
  if (!role) return { error: "unknown-role" }

  const groupName = groupNameForRoleCode(role.code)

  let groupId: string
  if (input.action.kind === "create") {
    // Świeżo utworzona grupa dostaje NOWY identyfikator od OpenWebUI, więc
    // kolizja jest tu niemożliwa — sprawdzanie po utworzeniu tylko zostawiałoby
    // osieroconą grupę w OpenWebUI przy odmowie.
    const created = await client.createGroup(config, groupName, GROUP_DESCRIPTION)
    groupId = created.id
  } else {
    // GWARANCJĄ jest UNIQUE(group_id) w bazie (migracja 0004) — to ono, i tylko
    // ono, sprawia, że dwóch ról nie da się wpiąć w jedną grupę; sprawdzenie
    // niżej samo w sobie jest wyścigiem sprawdź-potem-wstaw. Jest tu WYŁĄCZNIE
    // dla ergonomii: nagie naruszenie ograniczenia wraca z bramki jako
    // ogólne 409 "duplicate-code", które adminowi nie mówi nic o tym, KTÓRA
    // rola trzyma tę grupę. Jeśli ten `if` kiedyś zniknie, niezmiennik zostaje
    // — zepsuje się tylko komunikat.
    const owner = await store.findGroupMappingOwner(input.action.groupId)
    // Ponowne podpięcie TEJ SAMEJ grupy pod TĘ SAMĄ rolę to odświeżenie
    // mapowania (upsert po roleId), nie konflikt — inaczej admin nie mógłby
    // powtórzyć operacji, która nic nie zmienia.
    if (owner && owner.roleId !== input.roleId) {
      throw new OpenwebuiGroupAlreadyMappedError(owner.roleCode)
    }

    const existing = await client.getGroup(config, input.action.groupId)
    if (!existing) return { error: "group-not-found" }
    groupId = existing.id
  }

  const mapping = await store.upsertRoleGroupMapping(input.roleId, groupId, groupName)
  return { mapping }
}

/**
 * Usuwa WYŁĄCZNIE mapowanie — celowo NIE dotyka członkostwa grupy w
 * OpenWebUI. Po odpięciu system_config przestaje rościć sobie kontrolę nad tą
 * grupą; jej ostatni znany, zsynchronizowany stan zostaje taki, jaki jest
 * (nie jest to "usunięcie roli" z D7, które PRZED kasowaniem opróżnia grupę —
 * tu rola dalej istnieje, tylko przestaje być zmapowana). Jeśli admin chce
 * też opróżnić grupę, robi to ręcznie w OpenWebUI albo odpina i kasuje rolę.
 */
export function detachRoleGroup(roleId: string): Promise<boolean> {
  return store.deleteRoleGroupMapping(roleId)
}

export function getRoleGroupMapping(roleId: string) {
  return store.getRoleGroupMapping(roleId)
}

export function listOpenwebuiGroups(config: client.OpenwebuiConfig) {
  return client.listGroups(config)
}

/**
 * PEŁNE UZGODNIENIE KONT — „Synchronizuj wszystko" z panelu.
 *
 * Odpowiada na pytanie, na które haki zdarzeniowe odpowiedzieć NIE MOGĄ: czy
 * OpenWebUI odzwierciedla dzisiejszy stan Cortexa. Haki obejmują wyłącznie
 * zmiany zrobione po ich wdrożeniu i milkną, gdy OpenWebUI nie odpowiada —
 * zapis w Cortexie i tak przechodzi, bo odbieranie dostępu nie może zależeć od
 * tego, czy czat żyje. Pełne uzgodnienie jest jedynym momentem, w którym da
 * się powiedzieć „stan jest zgodny", i jest idempotentne: wolno je puszczać
 * dowolnie wiele razy.
 *
 * TRYB DOMYŚLNY TO PODGLĄD (`dryRun: true`). Pierwsze uruchomienie na
 * instancji jest najbardziej destrukcyjnym momentem w życiu tego mechanizmu —
 * różnica liczy się wtedy wobec stanu, którego nikt nigdy nie uzgadniał, więc
 * każda niepełność danych w Cortexie trafia do OpenWebUI hurtem. Zapis wymaga
 * jawnego `dryRun: false`.
 */
export interface OpenwebuiPlanEntry {
  email: string
  action: "create" | "promote-admin" | "demote-user" | "revoke" | "orphan-revoke"
  detail: string
}

export interface OpenwebuiFullSyncResult extends OpenwebuiSyncResult {
  dryRun: boolean
  plan: OpenwebuiPlanEntry[]
  groups: OpenwebuiSyncResult
  applied: number
  failures: string[]
}

/** Adresy, których uzgodnienie NIE MOŻE tknąć. Poza listą z konfiguracji
 *  zawsze chronione jest konto właściciela tokenu — inaczej pierwszy przebieg
 *  potrafi odciąć sam siebie od instancji, którą właśnie synchronizuje.
 *  Zabezpieczenie przeniesione z cortex-admina jako jedyne z jego obsługi
 *  sierot, które warto było wziąć. */
function protectedEmails(): Set<string> {
  const raw = process.env.OPENWEBUI_SYNC_PROTECTED_EMAILS ?? ""
  return new Set(
    raw
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  )
}

export async function reconcileEverything(
  options: { dryRun?: boolean } = {},
): Promise<OpenwebuiFullSyncResult> {
  const dryRun = options.dryRun !== false
  const empty: OpenwebuiFullSyncResult = {
    status: "skipped",
    dryRun,
    plan: [],
    groups: { status: "skipped" },
    applied: 0,
    failures: [],
  }

  const config = openwebuiConfig()
  if (!config) return { ...empty, message: "OpenWebUI nie jest skonfigurowane (OPENWEBUI_URL/TOKEN)" }

  let target: Awaited<ReturnType<typeof store.loadOpenwebuiTargetUsers>>
  let knownEmails: string[]
  let existing: client.OpenwebuiUser[]
  try {
    ;[target, knownEmails, existing] = await Promise.all([
      store.loadOpenwebuiTargetUsers(),
      store.loadAllKnownEmails(),
      client.listAllUsers(config),
    ])
  } catch (error) {
    return { ...empty, status: "failed", message: errorMessage(error) }
  }

  const protectedSet = protectedEmails()
  const byEmail = new Map(existing.map((row) => [row.email, row]))
  const targetByEmail = new Map(target.map((row) => [row.email.toLowerCase(), row]))
  const known = new Set(knownEmails.map((email) => email.toLowerCase()))

  const plan: OpenwebuiPlanEntry[] = []

  // (1) Konta, które mają istnieć, oraz rola konta.
  for (const wanted of target) {
    const email = wanted.email.toLowerCase()
    if (protectedSet.has(email)) continue

    const wantedRole = wanted.isAdmin ? "admin" : "user"
    const current = byEmail.get(email)

    if (!current) {
      plan.push({ email, action: "create", detail: `załóż konto (${wantedRole})` })
      continue
    }
    // `pending` traktowane jak każda inna niezgodność roli — człowiek, który
    // odzyskał dostęp, ma wrócić do `user`/`admin` bez ręcznej interwencji.
    if (current.role !== wantedRole) {
      plan.push({
        email,
        action: wantedRole === "admin" ? "promote-admin" : "demote-user",
        detail: `${current.role} → ${wantedRole}`,
      })
    }
  }

  // (2) Konta w OpenWebUI, które dostępu mieć NIE POWINNY.
  for (const row of existing) {
    if (protectedSet.has(row.email)) continue
    if (targetByEmail.has(row.email)) continue
    if (row.role === "pending") continue

    plan.push({
      email: row.email,
      // Rozróżnienie jest istotne przy czytaniu podglądu: „sierota" znaczy
      // konto nieznane Cortexowi w ogóle, a nie takie, któremu odebrano rolę.
      action: known.has(row.email) ? "revoke" : "orphan-revoke",
      detail: `${row.role} → pending`,
    })
  }

  if (dryRun) {
    return { ...empty, status: "ok", plan, groups: { status: "skipped" } }
  }

  // (3) Zapis. Każda pozycja osobno — jedna awaria nie przerywa reszty, bo
  // uzgodnienie częściowe jest lepsze niż żadne, a to, co nie przeszło, zostaje
  // w `failures` i pojawi się w następnym podglądzie.
  const failures: string[] = []
  let applied = 0

  for (const entry of plan) {
    try {
      if (entry.action === "create") {
        const wanted = targetByEmail.get(entry.email)
        await client.createUser(config, {
          email: entry.email,
          name: wanted?.fullName?.trim() || entry.email,
          role: wanted?.isAdmin ? "admin" : "user",
        })
      } else {
        const current = byEmail.get(entry.email)
        if (!current) continue
        const nextRole =
          entry.action === "promote-admin" ? "admin" : entry.action === "demote-user" ? "user" : "pending"
        await client.updateUserRole(config, current.id, nextRole)
      }
      applied += 1
    } catch (error) {
      failures.push(`${entry.email}: ${errorMessage(error)}`)
    }
  }

  // (4) Członkostwo grup przez istniejącą ścieżkę — nie duplikujemy jej tutaj.
  const groups = await reconcileAllMappedGroups()

  return {
    status: failures.length === 0 && groups.status !== "failed" ? "ok" : "failed",
    dryRun: false,
    plan,
    groups,
    applied,
    failures,
    ...(failures.length > 0 ? { message: `${failures.length} operacji nie powiodło się` } : {}),
  }
}
