// Logika modułu Konfiguracja Systemu (code-service). Kontrolery w
// app/idp/app/api/system-config/** tylko walidują wejście i wołają to.
// Zero surowego SQL poza tym plikiem i rbac-store.ts — dostęp przez Drizzle.

import {
  applications,
  getDb,
  permissionsMatrix,
  roles,
  userRoles,
  users,
  type ApplicationRow,
} from "@cortex/db"
import { TileKind } from "@cortex/tile-sdk"
import { and, asc, eq, inArray, ne } from "drizzle-orm"
import { z } from "zod"
import { clearTileAccessCache } from "./rbac"

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

/** Adres zewnętrzny musi być realnym linkiem HTTP(S). `z.string().url()` tego
 *  NIE pilnuje — przepuszcza `javascript:`/`data:`/`file:`, czyli uśpiony stored
 *  XSS na moment, w którym rejestr zacznie zasilać nawigację. */
function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value)
    return protocol === "http:" || protocol === "https:"
  } catch {
    return false
  }
}

/** Ścieżka natywna musi być ścieżką W TEJ aplikacji: jeden wiodący ukośnik,
 *  bez `//evil.com` (protocol-relative), bez `/\evil.com` (część przeglądarek
 *  traktuje backslash jak ukośnik) i bez pełnych URL-i — inaczej rejestr staje
 *  się open redirectem. */
function isInternalRoute(value: string): boolean {
  return /^\/(?![/\\])\S*$/.test(value)
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
  category: z.string().max(64).nullish(),
  kind: TileKind,
  route: z.string().max(200).nullish(),
  url: z.string().url().max(500).nullish(),
  target: z.enum(["_self", "_blank"]).nullish(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
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

/**
 * Ustawia komplet ról użytkownika (zastępuje, nie dokłada).
 * W transakcji — inaczej nieudany insert zostawiłby użytkownika bez ról.
 */
export async function setUserRoles(userId: string, roleIds: string[]): Promise<void> {
  const db = getDb()
  const wanted = unique(roleIds)

  await db.transaction(async (tx) => {
    const [user] = await tx.select({ id: users.id }).from(users).where(eq(users.id, userId))
    if (!user) throw new UnknownUserError(userId)

    await assertRolesExist(tx, wanted)
    await assertModuleStaysReachable(tx, { direction: "user-roles", userId, roleIds: wanted })

    await tx.delete(userRoles).where(eq(userRoles.userId, userId))
    if (wanted.length > 0) {
      await tx.insert(userRoles).values(wanted.map((roleId) => ({ userId, roleId })))
    }
  })

  clearTileAccessCache()
}

export async function listApplications(): Promise<ApplicationRow[]> {
  return getDb()
    .select()
    .from(applications)
    .orderBy(asc(applications.sortOrder), asc(applications.code))
}

export async function createApplication(input: ApplicationInput): Promise<ApplicationRow> {
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
 * kasowała `target`, `description`, `icon`, `category` i zerowała `sortOrder`.
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

/** Próba odcięcia sobie dostępu do modułu, z którego właśnie się korzysta. */
export class SelfLockoutError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "SelfLockoutError"
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
 * Zmiana, która może odciąć ludzi od modułu administracyjnego. Dwa kierunki,
 * jeden niezmiennik — dlatego jeden typ, nie dwie osobne ścieżki.
 */
type ModuleAccessChange =
  | { direction: "application-roles"; applicationId: string; roleIds: string[] }
  | { direction: "user-roles"; userId: string; roleIds: string[] }
  | { direction: "role-applications"; roleId: string; applicationIds: string[] }

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

  const userChange = change.direction === "user-roles" ? change : null
  const grantsAfter = moduleGrantsAfter(change, grantsNow, moduleRow.id)

  if (await hasActiveHolder(tx, grantsAfter, userChange)) return
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
      return grantsNow
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
  }
}

/**
 * Czy któryś AKTYWNY użytkownik ma choć jedną z tych ról. `override` opisuje
 * użytkownika, którego role właśnie się zmieniają: jego liczymy wg nowego
 * zestawu (jeszcze nie zapisanego), resztę wg stanu w bazie.
 */
async function hasActiveHolder(
  tx: Transaction,
  roleIds: string[],
  override: { userId: string; roleIds: string[] } | null,
): Promise<boolean> {
  if (roleIds.length === 0) return false

  if (override && override.roleIds.some((roleId) => roleIds.includes(roleId))) {
    const [self] = await tx
      .select({ isActive: users.isActive })
      .from(users)
      .where(eq(users.id, override.userId))
    if (self?.isActive) return true
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
    category: "category" in patch ? patch.category : existing.category,
    kind,
    route: "route" in patch ? patch.route : kindChanged ? null : existing.route,
    url: "url" in patch ? patch.url : kindChanged ? null : existing.url,
    target: "target" in patch ? patch.target : existing.target,
    isActive: patch.isActive ?? existing.isActive,
    sortOrder: patch.sortOrder ?? existing.sortOrder,
  }
}

function toApplicationValues(input: ApplicationInput) {
  const isNative = input.kind === "native"
  return {
    code: input.code,
    name: input.name,
    description: input.description ?? null,
    icon: input.icon ?? null,
    category: input.category ?? null,
    kind: input.kind,
    route: isNative ? (input.route ?? null) : null,
    url: isNative ? null : (input.url ?? null),
    target: input.target ?? null,
    isActive: input.isActive ?? true,
    sortOrder: input.sortOrder ?? 0,
  }
}
