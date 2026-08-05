// Logika modułu Konfiguracja Systemu (code-service). Kontrolery w
// app/idp/app/api/system-config/** tylko walidują wejście i wołają to.
// Zero surowego SQL poza tym plikiem i rbac-store.ts — dostęp przez Drizzle.

import {
  applicationScopes,
  applications,
  getDb,
  permissionsMatrix,
  roleApplicationScopes,
  roles,
  userRoles,
  users,
  type ApplicationRow,
  type ApplicationScopeRow,
  type RoleRow,
  type UserRow,
} from "@cortex/db"
import { isHttpUrl, isInternalRoute, TileKind } from "@cortex/tile-sdk"
import { and, asc, eq, inArray, isNotNull, isNull, ne, or } from "drizzle-orm"
import { z } from "zod"
import { isModuleEnabled, moduleLicensingConfig } from "./module-licensing"
import {
  emptyGroupMembership,
  getRoleGroupMapping as getOpenwebuiRoleGroupMapping,
  reconcileRoleGroups,
  type OpenwebuiSyncResult,
} from "./openwebui-sync"
import { clearTileAccessCache, normalizeEmail } from "./rbac"

export const ADMIN_ROLE_CODE = "admin"
export const SYSTEM_CONFIG_APP_CODE = "system-config"

export interface RoleSummary {
  id: string
  code: string
  name: string
  description: string | null
  isSystem: boolean
}

export interface UserWithRoles {
  id: string
  email: string
  fullName: string | null
  isActive: boolean
  roles: RoleSummary[]
}

const applicationFieldsSchema = z.object({
  code: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9-]+$/, "Kod może zawierać tylko małe litery, cyfry i myślnik"),
  name: z.string().min(1).max(120),
  description: z.string().max(500).nullish(),
  icon: z.string().max(64).nullish(),
  // `category` (wolny tekst) świadomie NIE JEST tu polem — wycofana 05.08.2026,
  // patrz komentarz przy kolumnie w @cortex/db. Kolumna została w bazie, ale
  // żadna ścieżka zapisu jej już nie dotyka: Zod odrzuca ją milcząco (obiekt
  // nie-strict), więc stary klient wysyłający to pole nie dostaje błędu, tylko
  // nic nie nadpisuje.
  kind: TileKind,
  route: z.string().max(200).nullish(),
  url: z.string().url().max(500).nullish(),
  target: z.enum(["_self", "_blank"]).nullish(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
  // Hub-render (Krok 1/3, PROJECT/cortex-frontend-hub-db-driven-projekt.md
  // D1/D2/D3). Zestaw dozwolonych wartości (5 funkcji, 5 kategorii) egzekwuje
  // formularz (select/multi-select), nie ten schemat — celowo, żeby nie
  // dublować enuma zdefiniowanego po stronie klienta (app/idp/lib/tiles.ts).
  showOnHub: z.boolean().optional(),
  color: z.string().max(32).nullish(),
  categoryFunctional: z.string().max(64).nullish(),
  categoryDepartment: z.array(z.string().max(64)).max(20).nullish(),
})

/** Kafelek natywny opisuje `route`; zewnętrzny/iframe opisuje `url`.
 *  Ten sam niezmiennik jest wymuszony check constraintem w bazie — walidacja
 *  tutaj daje czytelny błąd 400 zamiast błędu Postgresa. */
export const applicationInputSchema = applicationFieldsSchema
  .refine((value) => (value.kind === "native" ? Boolean(value.route) : true), {
    message: "Kafelek natywny wymaga pola route",
    path: ["route"],
  })
  .refine((value) => (value.kind === "native" ? !value.url : true), {
    message: "Kafelek natywny nie może mieć url",
    path: ["url"],
  })
  .refine((value) => (value.kind === "native" ? true : Boolean(value.url)), {
    message: "Kafelek zewnętrzny wymaga pola url",
    path: ["url"],
  })
  .refine((value) => (value.kind === "native" ? true : !value.route), {
    message: "Kafelek zewnętrzny nie może mieć route",
    path: ["route"],
  })
  .refine((value) => (value.kind === "native" && value.route ? isInternalRoute(value.route) : true), {
    message: "Ścieżka musi zaczynać się od pojedynczego / i wskazywać na tę aplikację",
    path: ["route"],
  })
  .refine((value) => (value.kind !== "native" && value.url ? isHttpUrl(value.url) : true), {
    message: "Adres musi zaczynać się od http:// albo https://",
    path: ["url"],
  })

export type ApplicationInput = z.infer<typeof applicationInputSchema>

/**
 * Wejście PATCH-a: każde pole opcjonalne, BEZ reguł międzypolowych. Te reguły
 * (natywny ma route, zewnętrzny ma url) mają sens dopiero na scalonym wierszu,
 * więc sprawdza je updateApplication na wyniku merge'a — inaczej `PATCH {name}`
 * musiałby powtarzać cały wiersz, a pominięte pola lądowałyby jako domyślne.
 */
export const applicationPatchSchema = applicationFieldsSchema.partial()

export type ApplicationPatch = z.infer<typeof applicationPatchSchema>

/**
 * Wejście aktywacji (D10-rewizja d, PROJECT/cortex-frontend-hub-db-driven-projekt.md):
 * jedyne pole to `code` — ten sam kod, którym manifest zarejestrował się w
 * `seed-tile-manifests.mjs`. Ten sam regex/limit co `applications.code`.
 */
export const activateApplicationInputSchema = z.object({
  code: applicationFieldsSchema.shape.code,
})

export type ActivateApplicationInput = z.infer<typeof activateApplicationInputSchema>

/**
 * "Utworzenie użytkownika" tutaj oznacza wyłącznie pre-provisioning — wiersz z
 * e-mailem, żeby dało się nadać rolę zanim ta osoba się zaloguje. Brak hasła:
 * jedynym mechanizmem uwierzytelniania jest nagłówek X-Auth-Request-Email
 * z oauth2-proxy (CLAUDE.md § Auth).
 */
export const userInputSchema = z.object({
  email: z.string().email().max(320),
  fullName: z.string().max(200).nullish(),
})

export type UserInput = z.infer<typeof userInputSchema>

/** Bez e-maila — zmiana tożsamości nie jest edycją, tylko innym użytkownikiem.
 *  isActive tu, nie w osobnej funkcji: to pole przechodzi przez DOKŁADNIE ten
 *  sam niezmiennik co reszta PATCH-a, więc nie ma powodu na osobną ścieżkę. */
export const userPatchSchema = z
  .object({
    fullName: z.string().max(200).nullish(),
    isActive: z.boolean(),
  })
  .partial()

export type UserPatch = z.infer<typeof userPatchSchema>

/** Kod roli, identyczny regex jak applications.code — niezmienny po utworzeniu
 *  (patrz updateRole): seed (seed-system-config.mjs) robi idempotentny
 *  `on conflict (code) do update` na tej kolumnie. `isSystem` celowo POZA tym
 *  schematem — nigdy nie jest polem formularza, ani przy tworzeniu, ani edycji. */
export const roleInputSchema = z.object({
  code: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9-]+$/, "Kod może zawierać tylko małe litery, cyfry i myślnik"),
  name: z.string().min(1).max(120),
  description: z.string().max(500).nullish(),
})

export type RoleInput = z.infer<typeof roleInputSchema>

/** Bez `code` (niezmienny) i bez `isSystem` (nigdy z formularza). */
export const rolePatchSchema = z
  .object({
    name: z.string().min(1).max(120),
    description: z.string().max(500).nullish(),
  })
  .partial()

export type RolePatch = z.infer<typeof rolePatchSchema>

export interface ApplicationScopeSummary {
  id: string
  code: string
  name: string
}

/** Macierz rola -> zakres: jeden wpis per zakres tej aplikacji, z listą ról,
 *  które go dziś mają (pusta lista, nie brak wpisu, gdy zakres bez grantów). */
export interface ApplicationScopeGrant {
  scopeId: string
  roleIds: string[]
}

/** Wyłącznie etykieta (`name`) — `code` jest niezmienny z poziomu tego API
 *  (D8: katalog zakresów jest własnością seeda modułu, nie system-config). */
export const applicationScopePatchSchema = z.object({
  name: z.string().min(1).max(120),
})

export type ApplicationScopePatch = z.infer<typeof applicationScopePatchSchema>

export async function listUsers(): Promise<UserWithRoles[]> {
  const db = getDb()

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      isActive: users.isActive,
      roleId: roles.id,
      roleCode: roles.code,
      roleName: roles.name,
      roleDescription: roles.description,
      roleIsSystem: roles.isSystem,
    })
    .from(users)
    .leftJoin(userRoles, eq(userRoles.userId, users.id))
    .leftJoin(roles, eq(roles.id, userRoles.roleId))
    .orderBy(asc(users.email))

  const byId = new Map<string, UserWithRoles>()
  for (const row of rows) {
    const existing = byId.get(row.id)
    const user =
      existing ??
      ({
        id: row.id,
        email: row.email,
        fullName: row.fullName,
        isActive: row.isActive,
        roles: [],
      } satisfies UserWithRoles)

    if (!existing) byId.set(row.id, user)

    if (row.roleId && row.roleCode && row.roleName !== null) {
      user.roles.push({
        id: row.roleId,
        code: row.roleCode,
        name: row.roleName,
        description: row.roleDescription,
        isSystem: row.roleIsSystem ?? false,
      })
    }
  }

  return [...byId.values()]
}

/**
 * Pre-provisioning: wstawia wiersz z e-mailem, bez ról. Nowy użytkownik nie ma
 * jeszcze żadnego grantu, więc nie może zmienić niczyjego dostępu — bez
 * clearTileAccessCache() (wzorem createApplication, który też go nie woła).
 */
export async function createUser(input: UserInput): Promise<UserRow> {
  const [created] = await getDb()
    .insert(users)
    .values({ email: normalizeEmail(input.email), fullName: input.fullName ?? null })
    .returning()

  return created as UserRow
}

/**
 * PATCH z prawdziwą semantyką częściową (patrz updateApplication) — pola
 * nieobecne w `patch` zostają takie, jakie są w bazie.
 *
 * `isActive` jest jedynym polem tego PATCH-a, które może odciąć kogoś od
 * modułu administracyjnego, więc dopiero TU (nie w formularzu) egzekwowany
 * jest niezmiennik: dezaktywacja ostatniego aktywnego posiadacza dostępu do
 * system-config rzuca SelfLockoutError, PRZED zapisem. Reaktywacja nigdy nie
 * pogarsza sytuacji, więc przechodzi przez ten sam tor i zawsze się udaje.
 */
export async function updateUser(
  id: string,
  patch: UserPatch,
): Promise<{ user: UserRow; openwebuiSync: OpenwebuiSyncResult } | null> {
  const db = getDb()
  let activeChanged = false
  let roleIdsHeld: string[] = []

  const updated = await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(users).where(eq(users.id, id))
    if (!existing) return null

    const nextIsActive = patch.isActive ?? existing.isActive
    activeChanged = nextIsActive !== existing.isActive
    if (activeChanged) {
      await assertModuleStaysReachable(tx, { direction: "user-active", userId: id, isActive: nextIsActive })
      // OpenWebUI (Wariant A): isActive gasi/przywraca WSZYSTKIE grupy ról
      // tego użytkownika naraz — zbiór ról zebrany TU, wewnątrz transakcji,
      // razem z resztą jej odczytów.
      roleIdsHeld = (
        await tx.select({ roleId: userRoles.roleId }).from(userRoles).where(eq(userRoles.userId, id))
      ).map((row) => row.roleId)
    }

    const [row] = await tx
      .update(users)
      .set({
        fullName: "fullName" in patch ? (patch.fullName ?? null) : existing.fullName,
        isActive: nextIsActive,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning()

    return (row as UserRow) ?? null
  })

  if (!updated) return null
  clearTileAccessCache()

  // Reszta pól (fullName) jest czysto opisowa i nie rusza członkostwa — patrz
  // updateRole niżej dla ten sam rozstrzygnięcie na roli.
  const openwebuiSync = activeChanged
    ? await reconcileRoleGroups(roleIdsHeld)
    : ({ status: "skipped" } satisfies OpenwebuiSyncResult)

  return { user: updated, openwebuiSync }
}

export async function listRoles(): Promise<RoleSummary[]> {
  const rows = await getDb()
    .select({
      id: roles.id,
      code: roles.code,
      name: roles.name,
      description: roles.description,
      isSystem: roles.isSystem,
    })
    .from(roles)
    .orderBy(asc(roles.code))

  return rows
}

/** Nowa rola nie ma jeszcze żadnego użytkownika ani grantu, więc nie może
 *  zmienić niczyjego dostępu — bez clearTileAccessCache() (wzorem createApplication). */
export async function createRole(input: RoleInput): Promise<RoleRow> {
  const [created] = await getDb()
    .insert(roles)
    .values({ code: input.code, name: input.name, description: input.description ?? null })
    .returning()

  return created as RoleRow
}

/**
 * `name`/`description` są czysto opisowe — nie wpływają na to, kto ma dostęp
 * do czego (autoryzacja idzie przez role.id, nigdy przez kod ani nazwę), więc
 * ta funkcja nie przechodzi przez assertModuleStaysReachable i nie musi czyścić
 * cache'a uprawnień. `code` i `isSystem` nie są w rolePatchSchema — niezmienne
 * z poziomu tego API.
 */
export async function updateRole(id: string, patch: RolePatch): Promise<RoleRow | null> {
  const db = getDb()

  const [existing] = await db.select().from(roles).where(eq(roles.id, id))
  if (!existing) return null

  const [updated] = await db
    .update(roles)
    .set({
      name: patch.name ?? existing.name,
      description: "description" in patch ? (patch.description ?? null) : existing.description,
      updatedAt: new Date(),
    })
    .where(eq(roles.id, id))
    .returning()

  return (updated as RoleRow) ?? null
}

/**
 * Usuwa rolę. `role_application_scopes`, `user_roles` i `permissions_matrix`
 * mają ON DELETE CASCADE na role_id — ten DELETE automatycznie kasuje
 * WSZYSTKIE granty tej roli, przypisania użytkowników do niej i jej granty
 * zakresów, bez wywołania żadnego dzisiejszego niezmiennika. Stąd jawne
 * wywołanie assertModuleStaysReachable PRZED DELETE, w tej samej transakcji.
 *
 * Kolejność dwóch checków jest świadoma i celowa: `isSystem` sprawdzany
 * PIERWSZY, przed wzięciem blokady wiersza `applications` i policzeniem
 * aktywnych posiadaczy dostępu. Rola systemowa nie da się usunąć NIEZALEŻNIE
 * od tego, czy akurat jest (czy nie jest) ostatnim posiadaczem dostępu do
 * system-config — to prostsza, bardziej absolutna reguła, więc wygrywa: gdy
 * oba warunki są prawdziwe naraz, klient dostaje 409 system-role-protected,
 * nie 409 self-lockout. Patrz test w system-config.integration.test.ts,
 * który wprost sprawdza tę kolejność.
 */
export async function deleteRole(id: string): Promise<{ removed: boolean; openwebuiSync: OpenwebuiSyncResult }> {
  const db = getDb()

  // Złapane PRZED transakcją — best-effort, w duchu D3 ("wyścigi... nie warto
  // tu blokad"). `ON DELETE CASCADE` skasuje wiersz mapowania RAZEM z rolą,
  // więc groupId trzeba znać, zanim to się stanie.
  const mapping = await getOpenwebuiRoleGroupMapping(id).catch(() => null)

  const removed = await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(roles).where(eq(roles.id, id))
    if (!existing) return false

    if (existing.isSystem) {
      throw new SystemRoleProtectedError(
        `Nie można usunąć roli systemowej "${existing.name}" — role systemowe są chronione przed usunięciem.`,
      )
    }

    await assertModuleStaysReachable(tx, { direction: "role-deleted", roleId: id })

    const deleted = await tx.delete(roles).where(eq(roles.id, id)).returning()
    return deleted.length > 0
  })

  if (!removed) return { removed: false, openwebuiSync: { status: "skipped" } }
  clearTileAccessCache()

  // D7: "przed usunięciem: opróżnij grupę, potem DELETE kasuje mapowanie
  // kaskadą. Grupy w OpenWebUI NIE usuwamy." Wiersz mapowania już nie istnieje
  // w naszej bazie (kaskada powyżej) — opróżnianie idzie po groupId złapanym
  // przed transakcją, bez odczytu/zapisu nieistniejącego już wiersza.
  const openwebuiSync = mapping ? await emptyGroupMembership(mapping.groupId) : { status: "skipped" as const }

  return { removed: true, openwebuiSync }
}

/**
 * Ustawia komplet ról użytkownika (zastępuje, nie dokłada).
 * W transakcji — inaczej nieudany insert zostawiłby użytkownika bez ról.
 */
export async function setUserRoles(userId: string, roleIds: string[]): Promise<OpenwebuiSyncResult> {
  const db = getDb()
  const wanted = unique(roleIds)
  let previousRoleIds: string[] = []

  await db.transaction(async (tx) => {
    const [user] = await tx.select({ id: users.id }).from(users).where(eq(users.id, userId))
    if (!user) throw new UnknownUserError(userId)

    await assertRolesExist(tx, wanted)
    await assertModuleStaysReachable(tx, { direction: "user-roles", userId, roleIds: wanted })

    previousRoleIds = (
      await tx.select({ roleId: userRoles.roleId }).from(userRoles).where(eq(userRoles.userId, userId))
    ).map((row) => row.roleId)

    await tx.delete(userRoles).where(eq(userRoles.userId, userId))
    if (wanted.length > 0) {
      await tx.insert(userRoles).values(wanted.map((roleId) => ({ userId, roleId })))
    }
  })

  clearTileAccessCache()

  // OpenWebUI (Wariant A, D1/D3): uzgadniamy WYŁĄCZNIE role, których
  // członkostwo TEGO użytkownika mogło się zmienić — suma poprzedniego i
  // nowego zestawu (rola dodana ALBO odebrana). Awaitowane z budżetem czasu
  // wewnątrz reconcileRoleGroups(), nigdy nie rzuca — patrz openwebui-sync.ts.
  return reconcileRoleGroups([...previousRoleIds, ...wanted])
}

/**
 * Katalog dla ekranu admina Aplikacje. Wyklucza wiersze `kind='native'` z
 * `activated_at is null` (Krok 5, PROJECT/cortex-frontend-hub-db-driven-projekt.md
 * — "rozróżnienie wizualne na liście Aplikacje"): taki wiersz jest tylko
 * REJESTRACJĄ manifestu (`seed-tile-manifests.mjs`, D10-rewizja c), nigdy nie
 * aktywowaną w tej instancji — żyje wyłącznie w
 * `listUnactivatedNativeApplications()`/SELECT-cie "Dodaj aplikację", dopóki
 * ktoś go nie aktywuje. Bez tego filtra każdy zarejestrowany-ale-nieaktywny
 * manifest wyglądałby na liście jak zwykły wyłączony wiersz, nieodróżnialny
 * od aplikacji, którą admin świadomie wyłączył (`isActive=false` PO
 * aktywacji) — dokładnie rozróżnienie, po które wprowadzono `activated_at`
 * (D6-rewizja).
 *
 * Wiersz `native` aktywowany, a potem ręcznie wyłączony (`activated_at`
 * ustawione, `isActive=false`) NIE jest tu filtrowany — pojawia się na
 * liście jak każdy inny wyłączony wiersz, zgodnie z dzisiejszą konwencją
 * (Badge "Wyłączona", `691da0c`).
 */
export async function listApplications(): Promise<ApplicationRow[]> {
  return getDb()
    .select()
    .from(applications)
    .where(or(ne(applications.kind, "native"), isNotNull(applications.activatedAt)))
    .orderBy(asc(applications.sortOrder), asc(applications.code))
}

/**
 * Katalog kafelków huba — WYŁĄCZNIE metadane wyglądu, ZERO logiki dostępu
 * (D7, PROJECT/cortex-frontend-hub-db-driven-projekt.md). Siostra
 * listApplications(), ale filtrowana i celowo węższa: tylko wiersze aktywne
 * I oznaczone jako kafelek (AND, nie OR — wiersz typu "sam grant zbiorczy",
 * np. `ai-tools`, ma `show_on_hub=false` mimo `is_active=true` i nie ma tu
 * się pojawić).
 *
 * To zapytanie NIE JEST per-user i NIE WOLNO mu nim zostać: żaden JOIN z
 * `permissions_matrix`/`user_roles`. "Kto widzi który kafelek" nadal
 * rozstrzyga wyłącznie canAccessTile() po stronie klienta na liście z
 * `/api/me/access` — powtórzenie tej reguły w SQL byłoby TRZECIM miejscem z
 * tą samą logiką biznesową i realnie gubiłoby userów z samym zbiorczym
 * grantem `ai-tools` (D7, rozważona i odrzucona alternatywa (b)).
 */
export async function listHubApplications(): Promise<ApplicationRow[]> {
  return getDb()
    .select()
    .from(applications)
    .where(and(eq(applications.isActive, true), eq(applications.showOnHub, true)))
    .orderBy(asc(applications.sortOrder), asc(applications.code))
}

/**
 * Kandydaci do aktywacji: wiersze `kind=native` bez historii aktywacji —
 * pre-utworzone przez `seed-tile-manifests.mjs` z manifestu (`defineTile()`
 * w kodzie modułu), jeszcze nigdy nie włączone w tej instancji (D6-rewizja/
 * D10-rewizja d). WYŁĄCZNIE admin-tooling: ta sama bramka co
 * `GET /api/system-config/applications` (`requireTileAccess`,
 * `SYSTEM_CONFIG_APP_CODE`) — Ryzyko #1 (hub-render, publiczny endpoint) tej
 * ścieżki nie dotyczy.
 *
 * Bramka `ENABLED_MODULES` (PROJECT/cortex-frontend-module-licensing-mvp.md
 * D2/D3): filtrowanie SERWEROWE, przed zwróceniem listy — nie klienckie, bo
 * klient trywialnie by je obszedł, a to ma być realne ograniczenie na
 * poziomie instancji. Bezpieczne dla wierszy już aktywowanych/legacy z
 * konstrukcji tego zapytania: `activated_at is null` już wyklucza wszystko,
 * co kiedykolwiek zostało włączone w tej instancji (w tym całą ~24-elementową
 * legacy listę z Kroku 1 migracji) — filtr niżej dotyka WYŁĄCZNIE świeżo
 * zarejestrowanych, jeszcze nieaktywowanych kandydatów.
 */
export async function listUnactivatedNativeApplications(): Promise<ApplicationRow[]> {
  const { enabledModules } = moduleLicensingConfig()

  return getDb()
    .select()
    .from(applications)
    .where(
      and(
        eq(applications.kind, "native"),
        isNull(applications.activatedAt),
        enabledModules === null ? undefined : inArray(applications.code, enabledModules),
      ),
    )
    .orderBy(asc(applications.code))
}

/**
 * Aktywuje jeden zarejestrowany-ale-nieaktywny wiersz `native` — jedyny
 * sposób, w jaki `kind=native` może stać się widoczny/aktywny (D6-rewizja).
 * UPDATE, nie INSERT: wiersz już istnieje (utworzony przez
 * seed-tile-manifests.mjs). `kind='native'` w WHERE jest dodatkową obroną
 * ponad zapis z projektu (ten sam mechanizm nie ma zastosowania do
 * `external-link`/`iframe` — te powstają przez `createApplication()`, nigdy
 * przez aktywację) — NIE osłabia `activated_at is null`, tylko go zawęża.
 *
 * `activated_at is null` w WHERE czyni operację bezpieczną na wyścig: drugie
 * kliknięcie/drugi request na już aktywowanym kodzie aktualizuje zero
 * wierszy, więc poniżej dociągamy wiersz zwykłym SELECT-em i zwracamy go
 * NIE ZMIENIONY — no-op, nie błąd, nie podwójna aktywacja. `null` wraca
 * WYŁĄCZNIE gdy kod w ogóle nie istnieje w rejestrze (pomyłka wywołania, nie
 * wyścig).
 *
 * Bramka `ENABLED_MODULES` (D9, PROJECT/cortex-frontend-licencjonowanie-
 * projekt.md) domyka ścieżkę MUTACJI: filtr w
 * listUnactivatedNativeApplications() chronił wyłącznie ODCZYT listy, a wiersz
 * kandydata istnieje w bazie niezależnie od allowlisty (wstawia go
 * seed-tile-manifests.mjs przy każdym deployu), więc `POST .../activate` z
 * kodem spoza allowlisty aktywował moduł mimo bramki. Sprawdzenie stoi PRZED
 * `getDb()` i jest czystym predykatem na env: odmowa nie wykonuje ANI JEDNEGO
 * zapytania, więc nie może zmienić `is_active`/`show_on_hub`/`activated_at`
 * żadnego wiersza (D4 — licencja nigdy nie zapisuje do danych instancji).
 * Nieustawione/puste `ENABLED_MODULES` => isModuleEnabled() zawsze `true` =>
 * zachowanie bez zmian.
 */
export async function activateApplication(code: string): Promise<ApplicationRow | null> {
  if (!isModuleEnabled(code)) throw new ModuleNotLicensedError(code)

  const db = getDb()

  const [activated] = await db
    .update(applications)
    .set({ isActive: true, showOnHub: true, activatedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(applications.code, code), eq(applications.kind, "native"), isNull(applications.activatedAt)))
    .returning()

  if (activated) {
    clearTileAccessCache()
    return activated as ApplicationRow
  }

  const [existing] = await db.select().from(applications).where(eq(applications.code, code))
  return (existing as ApplicationRow) ?? null
}

/**
 * `kind='native'` odrzucony PRZED insertem — jedyny sposób, w jaki wiersz
 * `native` może dziś powstać, to aktywacja zarejestrowanego manifestu
 * (`activateApplication`), nigdy dowolny tekst z formularza "Dodaj aplikację"
 * (D6-rewizja/D10-rewizja d). To jest egzekwowanie w SERWISIE, nie tylko w
 * UI: samo ukrycie pola `route` w formularzu niczego by nie gwarantowało dla
 * żądania wysłanego z pominięciem przeglądarki.
 */
export async function createApplication(input: ApplicationInput): Promise<ApplicationRow> {
  if (input.kind === "native") {
    throw new NativeCreationNotAllowedError()
  }

  const [created] = await getDb()
    .insert(applications)
    .values(toApplicationValues(input))
    .returning()

  return created as ApplicationRow
}

/**
 * PATCH z prawdziwą semantyką częściową: pola nieobecne w `patch` zostają takie,
 * jakie są w bazie. Wcześniej ta funkcja przyjmowała komplet i nadpisywała
 * pominięte pola domyślnymi wartościami — każda edycja z formularza po cichu
 * kasowała `target`, `description`, `icon` i zerowała `sortOrder`.
 *
 * Reguły międzypolowe sprawdzamy na SCALONYM wierszu (rzuca ZodError → 400).
 */
export async function updateApplication(
  id: string,
  patch: ApplicationPatch,
): Promise<ApplicationRow | null> {
  const db = getDb()

  const [existing] = await db.select().from(applications).where(eq(applications.id, id))
  if (!existing) return null

  const merged = applicationInputSchema.parse(mergeApplicationInput(existing, patch))
  assertKeepsModuleReachable(existing, merged)
  assertNativeApplicationImmutable(existing, merged)

  const [updated] = await db
    .update(applications)
    .set({ ...toApplicationValues(merged), updatedAt: new Date() })
    .where(eq(applications.id, id))
    .returning()

  if (!updated) return null

  clearTileAccessCache()
  return updated
}

export async function deleteApplication(id: string): Promise<boolean> {
  const db = getDb()

  const [existing] = await db.select().from(applications).where(eq(applications.id, id))
  if (!existing) return false
  assertKeepsModuleReachable(existing, null)

  const deleted = await db.delete(applications).where(eq(applications.id, id)).returning()
  if (deleted.length === 0) return false

  clearTileAccessCache()
  return true
}

/** Granty roli do kafelków (warstwa gruboziarnista) — kierunek "rola -> aplikacje". */
export async function setRoleApplications(roleId: string, applicationIds: string[]): Promise<void> {
  const db = getDb()
  const wanted = unique(applicationIds)

  await db.transaction(async (tx) => {
    const [role] = await tx.select({ id: roles.id }).from(roles).where(eq(roles.id, roleId))
    if (!role) throw new UnknownRoleError()

    if (wanted.length > 0) {
      const existing = await tx
        .select({ id: applications.id })
        .from(applications)
        .where(inArray(applications.id, wanted))
      if (existing.length !== wanted.length) throw new UnknownApplicationError()
    }

    // Trzecia oś tego samego niezmiennika. Ta funkcja nie ma dziś route'a, więc
    // guard-coverage.test.ts jej NIE pilnuje (widzi tylko app/**/route.ts) —
    // niezmiennik musi tu być, zanim ktoś dorobi ekran "rola -> aplikacje",
    // bo inaczej lockout wróciłby bez ani jednego sygnału z testów.
    await assertModuleStaysReachable(tx, {
      direction: "role-applications",
      roleId,
      applicationIds: wanted,
    })

    await tx.delete(permissionsMatrix).where(eq(permissionsMatrix.roleId, roleId))
    if (wanted.length > 0) {
      await tx
        .insert(permissionsMatrix)
        .values(wanted.map((applicationId) => ({ roleId, applicationId })))
    }
  })

  clearTileAccessCache()
}

/** Role, które mają dostęp do danej aplikacji. Kierunek odwrotny do
 *  setRoleApplications — tak pyta ekran szczegółów aplikacji. */
export async function listApplicationRoleIds(applicationId: string): Promise<string[]> {
  const rows = await getDb()
    .select({ roleId: permissionsMatrix.roleId })
    .from(permissionsMatrix)
    .where(eq(permissionsMatrix.applicationId, applicationId))

  return rows.map((row) => row.roleId)
}

/**
 * Granty do JEDNEJ aplikacji (kierunek "aplikacja -> role") — zapis zawężony do
 * edytowanego wiersza, więc równoległa edycja innej aplikacji nie skasuje tych
 * grantów, jak zrobiłby to setRoleApplications wołany z ekranu aplikacji.
 */
export async function setApplicationRoles(applicationId: string, roleIds: string[]): Promise<void> {
  const db = getDb()
  const wanted = unique(roleIds)

  await db.transaction(async (tx) => {
    const [application] = await tx
      .select({ id: applications.id })
      .from(applications)
      .where(eq(applications.id, applicationId))
    if (!application) throw new UnknownApplicationError()

    await assertRolesExist(tx, wanted)
    // Ten sam powód co przy dezaktywacji wiersza: moduł administracyjny, do
    // którego nie sięga już ani jeden aktywny człowiek, da się odkręcić
    // wyłącznie ręcznie w bazie. Odebranie grantu POJEDYNCZEJ roli zostaje
    // dozwolone — dopóki zostaje ktokolwiek, jest komu to cofnąć.
    await assertModuleStaysReachable(tx, {
      direction: "application-roles",
      applicationId,
      roleIds: wanted,
    })

    await tx.delete(permissionsMatrix).where(eq(permissionsMatrix.applicationId, applicationId))
    if (wanted.length > 0) {
      await tx.insert(permissionsMatrix).values(wanted.map((roleId) => ({ roleId, applicationId })))
    }
  })

  clearTileAccessCache()
}

/**
 * Katalog zakresów granularnych TEJ aplikacji (D8: wariant C — katalog jest
 * DEFINIOWANY PRZEZ KOD MODUŁU, który z niego korzysta, poprzez własny seed;
 * ta funkcja tylko go czyta). Świadomie brak create/delete tutaj — patrz
 * brak POST/DELETE w route'ach `.../scopes`.
 */
export async function listApplicationScopes(applicationId: string): Promise<ApplicationScopeSummary[]> {
  return getDb()
    .select({ id: applicationScopes.id, code: applicationScopes.code, name: applicationScopes.name })
    .from(applicationScopes)
    .where(eq(applicationScopes.applicationId, applicationId))
    .orderBy(asc(applicationScopes.code))
}

/**
 * Zmiana etykiety (`name`) zakresu — czysto opisowa, zero wpływu na runtime:
 * autoryzacja (`requireTileScope`) sprawdza `code`, nigdy `name`, więc ta
 * funkcja nie woła `clearTileAccessCache()` i nie przechodzi przez żaden
 * niezmiennik dostępności modułu.
 *
 * `applicationId` ze ścieżki MUSI się zgadzać z applicationId wiersza — bez
 * tego warunku w WHERE dałoby się przez pomyloną parę (id aplikacji z jednego
 * ekranu, id zakresu z innego) po cichu przemianować zakres cudzej aplikacji.
 * Zero dopasowanych wierszy (zakres nie istnieje ALBO należy do innej
 * aplikacji) zwraca `null`, które route mapuje na 404 — wzorem
 * updateRole/updateApplication/updateUser, nie ciche zaakceptowanie.
 */
export async function renameApplicationScope(
  applicationId: string,
  scopeId: string,
  name: string,
): Promise<ApplicationScopeRow | null> {
  const [updated] = await getDb()
    .update(applicationScopes)
    .set({ name })
    .where(and(eq(applicationScopes.id, scopeId), eq(applicationScopes.applicationId, applicationId)))
    .returning()

  return (updated as ApplicationScopeRow) ?? null
}

/**
 * Macierz zakres -> role W JEDNYM zapytaniu (D9: matryca ładuje się naraz,
 * nie N osobnych żądań). LEFT JOIN, żeby zakres bez ANI JEDNEGO grantu też
 * pojawił się w wyniku (z pustą listą `roleIds`) — bez tego kolumna w UI nie
 * odróżniałaby "zakres istnieje, nikt go nie ma" od "zakres nie istnieje".
 */
export async function listApplicationScopeGrants(applicationId: string): Promise<ApplicationScopeGrant[]> {
  const rows = await getDb()
    .select({ scopeId: applicationScopes.id, roleId: roleApplicationScopes.roleId })
    .from(applicationScopes)
    .leftJoin(roleApplicationScopes, eq(roleApplicationScopes.applicationScopeId, applicationScopes.id))
    .where(eq(applicationScopes.applicationId, applicationId))
    .orderBy(asc(applicationScopes.code))

  const byScope = new Map<string, string[]>()
  for (const row of rows) {
    const list = byScope.get(row.scopeId) ?? []
    if (row.roleId) list.push(row.roleId)
    byScope.set(row.scopeId, list)
  }

  return [...byScope.entries()].map(([scopeId, roleIds]) => ({ scopeId, roleIds }))
}

/**
 * Granty JEDNEJ kolumny macierzy (jeden zakres -> komplet ról, które go
 * mają) — zapis zawężony do edytowanego zakresu, analogicznie do
 * setApplicationRoles. `applicationId` ze ścieżki jest zweryfikowany tak
 * samo jak w renameApplicationScope (obrona przed pomyloną parą id).
 *
 * Świadomie BEZ assertModuleStaysReachable: warstwa granularna nigdy nie
 * gatuje samego system-config — moduł administracyjny sprawdza WYŁĄCZNIE
 * requireTileAccess, nigdy requireTileScope (zweryfikowane w
 * app/idp/app/api/system-config/_lib/guard.ts), więc odebranie grantu
 * zakresu nie może odciąć nikogo od tego modułu. Gdyby system-config kiedyś
 * zaczął używać własnych zakresów wewnętrznych, ta funkcja będzie musiała
 * dostać analogiczny niezmiennik jak D1/D2 (patrz `updateUser`/`deleteRole`)
 * — nie teraz.
 */
export async function setApplicationScopeRoles(
  applicationId: string,
  scopeId: string,
  roleIds: string[],
): Promise<void> {
  const db = getDb()
  const wanted = unique(roleIds)

  await db.transaction(async (tx) => {
    const [scope] = await tx
      .select({ id: applicationScopes.id })
      .from(applicationScopes)
      .where(and(eq(applicationScopes.id, scopeId), eq(applicationScopes.applicationId, applicationId)))
    if (!scope) throw new UnknownApplicationScopeError()

    await assertRolesExist(tx, wanted)

    await tx.delete(roleApplicationScopes).where(eq(roleApplicationScopes.applicationScopeId, scopeId))
    if (wanted.length > 0) {
      await tx
        .insert(roleApplicationScopes)
        .values(wanted.map((roleId) => ({ roleId, applicationScopeId: scopeId })))
    }
  })

  clearTileAccessCache()
}

export class UnknownUserError extends Error {
  constructor(userId: string) {
    super(`Nie ma użytkownika o id ${userId}`)
    this.name = "UnknownUserError"
  }
}

export class UnknownRoleError extends Error {
  constructor() {
    super("Co najmniej jedna ze wskazanych ról nie istnieje")
    this.name = "UnknownRoleError"
  }
}

export class UnknownApplicationError extends Error {
  constructor() {
    super("Co najmniej jedna ze wskazanych aplikacji nie istnieje")
    this.name = "UnknownApplicationError"
  }
}

/** Zakres nie istnieje ALBO nie należy do aplikacji ze ścieżki (pomylona para
 *  id) — patrz setApplicationScopeRoles. */
export class UnknownApplicationScopeError extends Error {
  constructor() {
    super("Zakres nie istnieje dla tej aplikacji")
    this.name = "UnknownApplicationScopeError"
  }
}

/** Próba odcięcia sobie dostępu do modułu, z którego właśnie się korzysta. */
export class SelfLockoutError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "SelfLockoutError"
  }
}

/** Próba usunięcia roli systemowej (np. `admin`) — chroniona niezależnie od
 *  tego, ilu aktywnych użytkowników akurat ją trzyma. */
export class SystemRoleProtectedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "SystemRoleProtectedError"
  }
}

/** Próba utworzenia `kind='native'` przez `createApplication()` (formularz
 *  "Dodaj aplikację" / POST bezpośredni) — D6-rewizja: jedyna droga do
 *  natywnego wiersza jest aktywacja zarejestrowanego manifestu. */
export class NativeCreationNotAllowedError extends Error {
  constructor() {
    super(
      "Kafelek natywny (kind=\"native\") można utworzyć wyłącznie przez aktywację zarejestrowanego " +
        "manifestu — wybierz go z listy niezaktywowanych modułów, nie z tego formularza.",
    )
    this.name = "NativeCreationNotAllowedError"
  }
}

/** Próba zmiany `route`/`code`/`kind` na już istniejącym wierszu
 *  `kind='native'` przez `updateApplication()` — patrz
 *  assertNativeApplicationImmutable. */
export class NativeApplicationImmutableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "NativeApplicationImmutableError"
  }
}

/** Próba aktywacji kodu spoza `ENABLED_MODULES` (D9,
 *  PROJECT/cortex-frontend-licencjonowanie-projekt.md) — patrz
 *  activateApplication. Osobna klasa, nie `null`: wywołujący musi odróżnić
 *  "instancja nie ma licencji na ten moduł" (kod istnieje, żądanie poprawne,
 *  odmowa autoryzacji -> 403) od "takiego kodu nie ma w rejestrze" (-> 404). */
export class ModuleNotLicensedError extends Error {
  constructor(code: string) {
    super(
      `Moduł "${code}" nie jest objęty licencją tej instancji — nie ma go na liście ` +
        "ENABLED_MODULES, więc nie można go aktywować. Skontaktuj się z dostawcą " +
        "platformy, żeby rozszerzyć zakres licencji.",
    )
    this.name = "ModuleNotLicensedError"
  }
}

/**
 * Ochrona przed samo-zablokowaniem, egzekwowana W SERWISIE, nie w formularzu —
 * blokada pola w UI nie zatrzymuje żądania wysłanego curlem.
 *
 * Wiersz `system-config` jest jednocześnie kodem uprawnienia, po którym pyta
 * bramka tego modułu, więc zmiana jego kodu, dezaktywacja albo usunięcie
 * odcinałaby WSZYSTKICH administratorów od jedynego miejsca, w którym da się to
 * cofnąć — zostaje tylko ręczna naprawa w bazie.
 *
 * `input === null` oznacza próbę usunięcia wiersza.
 */
function assertKeepsModuleReachable(existing: ApplicationRow, input: ApplicationInput | null): void {
  if (existing.code !== SYSTEM_CONFIG_APP_CODE) return

  if (input === null) {
    throw new SelfLockoutError(
      "Nie można usunąć aplikacji Konfiguracja Systemu — to jej uprawnieniem chroniony jest ten moduł.",
    )
  }

  if (input.code !== existing.code) {
    throw new SelfLockoutError(
      "Nie można zmienić kodu aplikacji Konfiguracja Systemu — po tym kodzie pyta bramka tego modułu.",
    )
  }

  if (input.isActive === false) {
    throw new SelfLockoutError(
      "Nie można dezaktywować aplikacji Konfiguracja Systemu — odcięłoby to dostęp do tego modułu wszystkim administratorom.",
    )
  }

  // Ten wiersz nie jest zwykłym wpisem w rejestrze — opisuje SAM moduł
  // administracyjny, który jest stroną w tej aplikacji. Podmiana typu na
  // `external-link`/`iframe` albo ścieżki na obcy adres zamienia wejście do
  // administracji w przekierowanie poza aplikację (finding 8 zastosowany do
  // kafelka samej administracji), więc te pola też są niezmienne.
  const next = toApplicationValues(input)
  if (next.kind !== existing.kind || next.route !== existing.route || next.url !== existing.url) {
    throw new SelfLockoutError(
      "Nie można zmienić typu ani adresu aplikacji Konfiguracja Systemu — ten wiersz opisuje sam moduł administracyjny, a podmiana go na adres zewnętrzny wyprowadzałaby administratorów poza tę aplikację.",
    )
  }
}

/**
 * `route`/`code`/`kind` niezmienne dla WSZYSTKICH wierszy `kind='native'` po
 * utworzeniu, nie tylko dla `system-config` (to pilnuje osobno
 * `assertKeepsModuleReachable` wyżej, wołane PRZED tą funkcją — dla wiersza
 * `system-config` to on rzuca pierwszy, z bardziej szczegółowym komunikatem
 * o samo-zablokowaniu; ta funkcja dotyczy WSZYSTKICH POZOSTAŁYCH natywnych
 * wierszy). D10-rewizja d: bez tego niezmiennik D6-rewizja ("kind=native
 * powstaje wyłącznie przez aktywację manifestu") byłby prawdziwy tylko w
 * momencie TWORZENIA — admin mógłby dzień później przez zwykłą edycję
 * przepisać `route` aktywnego kafelka na dowolną, nieistniejącą ścieżkę,
 * odtwarzając ten sam bug przesunięty w czasie. Blokuje WYŁĄCZNIE tę,
 * ręczną ścieżkę admina (`updateApplication`/PATCH z UI) — NIE dotyczy
 * `seed-tile-manifests.mjs`, który robi własny, osobny SQL upsert (poza tą
 * funkcją w ogóle) i ma PRAWO resynchronizować `route`/`kind`/`url`/`target`
 * z manifestu przy każdym deployu — `route` jako fakt kodu (D11) ma tam
 * zawsze wygrywać, niezależnie od tego, czy wiersz był już aktywowany.
 *
 * Druga, symetryczna połowa tego samego niezmiennika (dopisana po review,
 * które pokazało dziurę na żywym wierszu `meeting-guru`): PROMOCJA wiersza
 * NIE-natywnego (`external-link`/`iframe`) DO `kind='native'` przez ten sam
 * PATCH. `createApplication` blokuje `kind='native'` przy TWORZENIU
 * (`NativeCreationNotAllowedError`), a ta funkcja dotąd pilnowała tylko
 * wiersze JUŻ natywne (`if (existing.kind !== "native") return` — cichy
 * no-op dla reszty) — więc `PATCH {"kind":"native","route":"/x"}` na
 * istniejącym `external-link` wracał 200 i tworzył wiersz `native` z
 * fabrykowaną trasą bez żadnego kodu za nią, drugą, nieogrodzoną drogą do
 * dokładnie tego, przed czym broni D6-rewizja. `kind='native'` MOŻE dziś
 * powstać wyłącznie przez `activateApplication()` (UPDATE na wierszu już
 * zarejestrowanym przez manifest) — nigdy przez tę funkcję, niezależnie od
 * tego, jaki był `existing.kind` PRZED edycją.
 */
function assertNativeApplicationImmutable(existing: ApplicationRow, input: ApplicationInput): void {
  const next = toApplicationValues(input)

  if (existing.kind !== "native") {
    if (next.kind === "native") {
      throw new NativeApplicationImmutableError(
        "Nie można ustawić kind=\"native\" przez edycję (PATCH) — kafelek natywny powstaje wyłącznie " +
          "przez aktywację zarejestrowanego manifestu, nie przez zmianę typu na istniejącym wierszu.",
      )
    }
    return
  }

  if (next.code !== existing.code || next.kind !== existing.kind || next.route !== existing.route) {
    throw new NativeApplicationImmutableError(
      "Nie można zmienić kodu, typu ani ścieżki aktywowanego kafelka natywnego — route/code/kind ustala wyłącznie aktywacja zarejestrowanego manifestu.",
    )
  }
}

/**
 * Zmiana, która może odciąć ludzi od modułu administracyjnego. Pięć kierunków,
 * jeden niezmiennik — dlatego jeden typ, nie pięć osobnych ścieżek.
 *
 * `user-active` (PATCH { isActive: false } na użytkowniku) i `role-deleted`
 * (deleteRole) dokładają się do trójki, którą ta funkcja pilnowała od
 * początku (application-roles/user-roles/role-applications) — żaden z tamtych
 * trzech kierunków nie modeluje "ten sam zestaw ról, ale użytkownik przestaje
 * być aktywny" ani "rola znika w całości razem ze WSZYSTKIMI swoimi grantami
 * (kaskada FK)". To dokładnie ten sam kształt luki, który audyt bezpieczeństwa
 * tego modułu znalazł już wcześniej — poprawka na jednej warstwie (np.
 * `assertKeepsModuleReachable` dla wiersza `applications`), nie przeniesiona
 * na drugą (mutacje, które omijają tamten wiersz, a i tak potrafią odciąć
 * wszystkich).
 */
type ModuleAccessChange =
  | { direction: "application-roles"; applicationId: string; roleIds: string[] }
  | { direction: "user-roles"; userId: string; roleIds: string[] }
  | { direction: "role-applications"; roleId: string; applicationIds: string[] }
  | { direction: "user-active"; userId: string; isActive: boolean }
  | { direction: "role-deleted"; roleId: string }

/**
 * Niezmiennik: po tej operacji CO NAJMNIEJ JEDEN AKTYWNY UŻYTKOWNIK zachowuje
 * dostęp do `system-config`.
 *
 * Liczenie samych RÓL nie wystarczało: rola bez ani jednego aktywnego
 * użytkownika wygląda jak zabezpieczenie, a odcina wszystkich. Przepięcie
 * administracji na taką rolę ("odznacz Administrator, zaznacz Inspektor,
 * Zapisz") to dwa kliknięcia w UI i całkowity lockout modułu. Ten sam warunek
 * zamyka drugi kierunek: odebranie SOBIE ostatniej roli z dostępem.
 *
 * Operacja, która niczego nie pogarsza (moduł był nieosiągalny już przed nią),
 * przechodzi — blokada ma zapobiegać utracie dostępu, nie utrudniać wychodzenie
 * z awarii ręcznym SQL-em.
 *
 * Sprawdzenie jest POPRAWNE TYLKO POD BLOKADĄ WIERSZA. Bez `.for("update")`
 * niżej niezmiennik był prawdziwy sekwencyjnie i nieszczelny współbieżnie:
 * dwie transakcje w READ COMMITTED czytały stan sprzed zmiany tej drugiej,
 * każda uznawała ją za "tego, kto zostaje", a zapisy szły w rozłączne wiersze
 * `user_roles`/`permissions_matrix` — więc nie było konfliktu zapisu, obie się
 * commitowały i razem zostawiały moduł bez ani jednego aktywnego człowieka.
 */
async function assertModuleStaysReachable(
  tx: Transaction,
  change: ModuleAccessChange,
): Promise<void> {
  // Ta blokada nie broni samego wiersza (jego pól pilnuje
  // assertKeepsModuleReachable) — jest MUTEKSEM NA NIEZMIENNIKU. Każda mutacja
  // osiągalności modułu bierze ją na tym jednym wierszu, więc druga transakcja
  // czeka na commit pierwszej, a jej dalsze SELECT-y (READ COMMITTED = nowy
  // snapshot na każdą instrukcję) widzą już zapisany stan i poprawnie odmawiają.
  // Bierzemy ją PRZED każdym innym zapisem i zawsze na tym samym wierszu, więc
  // nie ma cyklu i nie ma ryzyka deadlocka.
  const [moduleRow] = await tx
    .select({ id: applications.id })
    .from(applications)
    .where(eq(applications.code, SYSTEM_CONFIG_APP_CODE))
    .for("update")
  if (!moduleRow) return

  if (change.direction === "application-roles" && change.applicationId !== moduleRow.id) return

  const grantsNow = (
    await tx
      .select({ roleId: permissionsMatrix.roleId })
      .from(permissionsMatrix)
      .where(eq(permissionsMatrix.applicationId, moduleRow.id))
  ).map((row) => row.roleId)

  const holderOverride = toHolderOverride(change)
  const grantsAfter = moduleGrantsAfter(change, grantsNow, moduleRow.id)

  if (await hasActiveHolder(tx, grantsAfter, holderOverride)) return
  if (!(await hasActiveHolder(tx, grantsNow, null))) return

  throw new SelfLockoutError(lockoutMessage(change))
}

/** Role z dostępem do modułu PO zapisie — każdy kierunek rusza inną oś. */
function moduleGrantsAfter(
  change: ModuleAccessChange,
  grantsNow: string[],
  moduleId: string,
): string[] {
  switch (change.direction) {
    case "application-roles":
      return change.roleIds
    case "role-applications": {
      // Zapis kasuje WSZYSTKIE granty tej roli i wstawia nowy zestaw, więc
      // grant do modułu przeżywa dokładnie wtedy, gdy moduł jest na liście.
      const withoutRole = grantsNow.filter((granted) => granted !== change.roleId)
      return change.applicationIds.includes(moduleId) ? [...withoutRole, change.roleId] : withoutRole
    }
    case "user-roles":
    case "user-active":
      // Zestaw RÓL z dostępem do modułu się nie zmienia — zmienia się to, czy
      // konkretny użytkownik się w ogóle liczy (patrz toHolderOverride niżej).
      return grantsNow
    case "role-deleted":
      // ON DELETE CASCADE kasuje wszystkie granty tej roli razem z nią —
      // grant do modułu (jeśli istniał) znika bezwarunkowo.
      return grantsNow.filter((granted) => granted !== change.roleId)
  }
}

function lockoutMessage(change: ModuleAccessChange): string {
  switch (change.direction) {
    case "user-roles":
      return "Nie można odebrać tych ról — to ostatni aktywny użytkownik z dostępem do Konfiguracji Systemu, więc po zapisie nikt nie wszedłby już do tego modułu."
    case "application-roles":
      return "Co najmniej jeden aktywny użytkownik musi zachować dostęp do Konfiguracji Systemu — wskazane role nie mają ani jednego aktywnego użytkownika, więc po zapisie nikt nie wszedłby już do tego modułu."
    case "role-applications":
      return "Nie można odebrać tej roli dostępu do Konfiguracji Systemu — to ostatnia rola z aktywnym użytkownikiem, więc po zapisie nikt nie wszedłby już do tego modułu."
    case "user-active":
      return "Nie można dezaktywować tego użytkownika — to ostatni aktywny użytkownik z dostępem do Konfiguracji Systemu, więc po zapisie nikt nie wszedłby już do tego modułu."
    case "role-deleted":
      return "Nie można usunąć tej roli — to ostatnia rola z aktywnym użytkownikiem mającym dostęp do Konfiguracji Systemu, więc po usunięciu nikt nie wszedłby już do tego modułu."
  }
}

/** Opisuje użytkownika, którego stan (role ALBO isActive) właśnie się zmienia
 *  — jego liczymy wg NOWEGO, jeszcze nie zapisanego stanu, resztę wg bazy.
 *  Tylko dwa kierunki dotyczą pojedynczego, konkretnego użytkownika. */
type ActiveHolderOverride =
  | { userId: string; kind: "roles"; roleIds: string[] }
  | { userId: string; kind: "active"; isActive: boolean }

function toHolderOverride(change: ModuleAccessChange): ActiveHolderOverride | null {
  switch (change.direction) {
    case "user-roles":
      return { userId: change.userId, kind: "roles", roleIds: change.roleIds }
    case "user-active":
      return { userId: change.userId, kind: "active", isActive: change.isActive }
    default:
      return null
  }
}

/**
 * Czy któryś AKTYWNY użytkownik ma choć jedną z tych ról. `override` opisuje
 * użytkownika, którego stan właśnie się zmienia: jego liczymy wg NOWEGO stanu
 * (jeszcze nie zapisanego — inny zestaw ról, albo inne isActive), resztę wg
 * stanu w bazie.
 */
async function hasActiveHolder(
  tx: Transaction,
  roleIds: string[],
  override: ActiveHolderOverride | null,
): Promise<boolean> {
  if (roleIds.length === 0) return false

  if (override) {
    const overrideCounts =
      override.kind === "roles"
        ? override.roleIds.some((roleId) => roleIds.includes(roleId)) &&
          (await isCurrentlyActive(tx, override.userId))
        : override.isActive && (await holdsAnyRole(tx, override.userId, roleIds))
    if (overrideCounts) return true
  }

  const holders = await tx
    .select({ id: users.id })
    .from(users)
    .innerJoin(userRoles, eq(userRoles.userId, users.id))
    .where(
      and(
        eq(users.isActive, true),
        inArray(userRoles.roleId, roleIds),
        ...(override ? [ne(users.id, override.userId)] : []),
      ),
    )
    .limit(1)

  return holders.length > 0
}

/** Stan `isActive` W BAZIE (jeszcze nie zapisany nowy stan) — używane, gdy
 *  override zmienia ROLE użytkownika, ale nie jego isActive. */
async function isCurrentlyActive(tx: Transaction, userId: string): Promise<boolean> {
  const [self] = await tx.select({ isActive: users.isActive }).from(users).where(eq(users.id, userId))
  return self?.isActive ?? false
}

/** Role użytkownika W BAZIE (jeszcze nie zapisany nowy stan) — używane, gdy
 *  override zmienia isActive użytkownika, ale nie jego role. */
async function holdsAnyRole(tx: Transaction, userId: string, roleIds: string[]): Promise<boolean> {
  const [self] = await tx
    .select({ id: users.id })
    .from(users)
    .innerJoin(userRoles, eq(userRoles.userId, users.id))
    .where(and(eq(users.id, userId), inArray(userRoles.roleId, roleIds)))
    .limit(1)
  return Boolean(self)
}

function unique(values: string[]): string[] {
  return [...new Set(values)]
}

type Transaction = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0]

async function assertRolesExist(tx: Transaction, roleIds: string[]): Promise<void> {
  if (roleIds.length === 0) return
  const existing = await tx.select({ id: roles.id }).from(roles).where(inArray(roles.id, roleIds))
  if (existing.length !== roleIds.length) throw new UnknownRoleError()
}

/** Scala PATCH z wierszem w bazie. `"pole" in patch` (a nie `??`) rozróżnia
 *  "nie podano" od "podano null" — wyczyszczenie opisu ma zadziałać. */
function mergeApplicationInput(existing: ApplicationRow, patch: ApplicationPatch) {
  const kind = patch.kind ?? existing.kind
  // Zmiana typu unieważnia adres poprzedniego typu — inaczej scalony wiersz
  // miałby naraz `route` i `url` i odbiłby się od niezmiennika kształtu.
  const kindChanged = kind !== existing.kind

  return {
    code: patch.code ?? existing.code,
    name: patch.name ?? existing.name,
    description: "description" in patch ? patch.description : existing.description,
    icon: "icon" in patch ? patch.icon : existing.icon,
    kind,
    route: "route" in patch ? patch.route : kindChanged ? null : existing.route,
    url: "url" in patch ? patch.url : kindChanged ? null : existing.url,
    target: "target" in patch ? patch.target : existing.target,
    isActive: patch.isActive ?? existing.isActive,
    sortOrder: patch.sortOrder ?? existing.sortOrder,
    showOnHub: patch.showOnHub ?? existing.showOnHub,
    color: "color" in patch ? patch.color : existing.color,
    categoryFunctional: "categoryFunctional" in patch ? patch.categoryFunctional : existing.categoryFunctional,
    categoryDepartment: "categoryDepartment" in patch ? patch.categoryDepartment : existing.categoryDepartment,
  }
}

function toApplicationValues(input: ApplicationInput) {
  const isNative = input.kind === "native"
  return {
    code: input.code,
    name: input.name,
    description: input.description ?? null,
    icon: input.icon ?? null,
    kind: input.kind,
    route: isNative ? (input.route ?? null) : null,
    url: isNative ? null : (input.url ?? null),
    target: input.target ?? null,
    isActive: input.isActive ?? true,
    sortOrder: input.sortOrder ?? 0,
    showOnHub: input.showOnHub ?? true,
    color: input.color ?? null,
    categoryFunctional: input.categoryFunctional ?? null,
    categoryDepartment: input.categoryDepartment ?? null,
  }
}
