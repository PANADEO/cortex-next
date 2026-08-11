// Odczyt/zapis stanu synchronizacji z bazy (code-db). Wydzielony z
// openwebui-sync.ts, żeby SAMĄ logikę uzgodnienia dało się testować bez
// stojącego Postgresa — dokładnie ten sam powód, dla którego rbac.ts jest
// wydzielony od rbac-store.ts (patrz nagłówek rbac-store.ts).

import {
  getDb,
  openwebuiGroupMappings,
  roles,
  userRoles,
  users,
  type OpenwebuiGroupMappingRow,
} from "@cortex/db"
import { and, eq } from "drizzle-orm"

export async function getRole(roleId: string): Promise<{ id: string; code: string } | null> {
  const [row] = await getDb().select({ id: roles.id, code: roles.code }).from(roles).where(eq(roles.id, roleId))
  return row ?? null
}

export function getRoleGroupMapping(roleId: string): Promise<OpenwebuiGroupMappingRow | null> {
  return getDb()
    .select()
    .from(openwebuiGroupMappings)
    .where(eq(openwebuiGroupMappings.roleId, roleId))
    .then((rows) => rows[0] ?? null)
}

/**
 * Która ROLA trzyma dziś mapowanie tej grupy. Istnieje wyłącznie po to, żeby
 * odmowa podpięcia mogła nazwać kolidującą rolę po kodzie — samo
 * niedopuszczenie duplikatu załatwia UNIQUE(group_id) w bazie (patrz
 * attachRoleGroup). Stąd join do `roles`: bez kodu roli komunikat brzmiałby
 * "grupa jest już zajęta", co nie mówi adminowi, gdzie ma kliknąć.
 */
export async function findGroupMappingOwner(
  groupId: string,
): Promise<{ roleId: string; roleCode: string } | null> {
  const [row] = await getDb()
    .select({ roleId: openwebuiGroupMappings.roleId, roleCode: roles.code })
    .from(openwebuiGroupMappings)
    .innerJoin(roles, eq(roles.id, openwebuiGroupMappings.roleId))
    .where(eq(openwebuiGroupMappings.groupId, groupId))

  return row ?? null
}

export async function listMappedRoleIds(): Promise<string[]> {
  const rows = await getDb().select({ roleId: openwebuiGroupMappings.roleId }).from(openwebuiGroupMappings)
  return rows.map((row) => row.roleId)
}

/**
 * E-maile AKTYWNYCH użytkowników, którzy dziś mają tę rolę — zbiór docelowy
 * członkostwa grupy (D7). Odpowiednik `loadGrantedApplicationCodes` z
 * rbac-store.ts, tylko odwrócony: tam "kody dla usera", tutaj "e-maile dla
 * roli". `users.isActive` filtrowane tu samo — dezaktywacja konta wypycha z
 * grupy przy najbliższym uzgodnieniu.
 */
export async function loadActiveRoleMemberEmails(roleId: string): Promise<string[]> {
  const rows = await getDb()
    .selectDistinct({ email: users.email })
    .from(userRoles)
    .innerJoin(users, eq(users.id, userRoles.userId))
    .where(and(eq(userRoles.roleId, roleId), eq(users.isActive, true)))

  return rows.map((row) => row.email)
}

/** Role, które AKTYWNY użytkownik trzyma dziś — używane przez updateUser()
 *  (przełącznik isActive) do ustalenia, które grupy trzeba uzgodnić: zmiana
 *  aktywności rusza WSZYSTKIE grupy ról tego użytkownika naraz. */
export async function listRoleIdsForUser(userId: string): Promise<string[]> {
  const rows = await getDb().select({ roleId: userRoles.roleId }).from(userRoles).where(eq(userRoles.userId, userId))
  return rows.map((row) => row.roleId)
}

export async function upsertRoleGroupMapping(
  roleId: string,
  groupId: string,
  groupName: string,
): Promise<OpenwebuiGroupMappingRow> {
  const [row] = await getDb()
    .insert(openwebuiGroupMappings)
    .values({ roleId, groupId, groupName })
    .onConflictDoUpdate({
      target: openwebuiGroupMappings.roleId,
      set: { groupId, groupName, updatedAt: new Date(), lastSyncError: null, lastSyncedAt: null },
    })
    .returning()

  return row as OpenwebuiGroupMappingRow
}

/** `false` gdy nie było mapowania — wołający (route) odróżnia to od 404. */
export async function deleteRoleGroupMapping(roleId: string): Promise<boolean> {
  const deleted = await getDb()
    .delete(openwebuiGroupMappings)
    .where(eq(openwebuiGroupMappings.roleId, roleId))
    .returning({ roleId: openwebuiGroupMappings.roleId })

  return deleted.length > 0
}

/**
 * Zapisuje wynik uzgodnienia. `error: null` = ostatni push się powiódł.
 * Świadomie osobna od upsertRoleGroupMapping — to zapis WYNIKU (D3: reconciler
 * nigdy nie cofa mutacji, tylko notuje, jak poszedł push), nie zmiana mapowania.
 * Cichy no-op, gdy mapowanie już nie istnieje (rola skasowana w międzyczasie) —
 * `ON DELETE CASCADE` już posprzątał wiersz, nie ma czego aktualizować.
 */
export async function recordSyncResult(roleId: string, error: string | null): Promise<void> {
  await getDb()
    .update(openwebuiGroupMappings)
    .set({ lastSyncedAt: new Date(), lastSyncError: error, updatedAt: new Date() })
    .where(eq(openwebuiGroupMappings.roleId, roleId))
}

/**
 * Stan docelowy KONT w OpenWebUI, policzony wyłącznie z Cortexa.
 *
 * KTO MA MIEĆ KONTO: aktywny użytkownik, który trzyma co najmniej jedną rolę
 * ze zmapowaną grupą. Rozważone i odrzucone: warunek „ma grant do kafelka
 * czatu". Kafelek OpenWebUI jest wierszem `external-link` zakładanym przez
 * admina, więc jego kod jest RÓŻNY w każdej instancji — na tej nie ma go
 * wcale (27 aplikacji, wszystkie `native`). Wymagałby nowej zmiennej
 * konfiguracyjnej i wprowadzał drugi, niezależny warunek, który może się
 * rozjechać z mapowaniem. Mapowanie rola→grupa JEST już świadomą deklaracją
 * „ta rola korzysta z OpenWebUI" i wystarcza.
 *
 * `isAdmin` po KODZIE roli (`admin`), nie po nazwie — dokładnie ten sam
 * warunek, którego używał cortex-admin (`role.get("code") == "admin"`).
 * W tej bazie `code='admin'` niesie `name='Administrator'`, więc reguła
 * przenosi się bez tłumaczenia.
 */
export interface OpenwebuiTargetUser {
  email: string
  fullName: string | null
  isAdmin: boolean
}

export async function loadOpenwebuiTargetUsers(): Promise<OpenwebuiTargetUser[]> {
  const db = getDb()

  // Aktywni członkowie ról, które mają zmapowaną grupę.
  const eligible = await db
    .selectDistinct({ id: users.id, email: users.email, fullName: users.fullName })
    .from(users)
    .innerJoin(userRoles, eq(userRoles.userId, users.id))
    .innerJoin(openwebuiGroupMappings, eq(openwebuiGroupMappings.roleId, userRoles.roleId))
    .where(eq(users.isActive, true))

  if (eligible.length === 0) return []

  // Osobne zapytanie o adminów zamiast drugiego JOIN-a w tym samym: rola
  // `admin` NIE musi mieć zmapowanej grupy, a przy jednym zapytaniu
  // administrator bez takiej roli wypadłby z wyniku razem z flagą.
  const adminRows = await db
    .selectDistinct({ userId: userRoles.userId })
    .from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .where(eq(roles.code, "admin"))

  const admins = new Set(adminRows.map((row) => row.userId))

  return eligible.map((row) => ({
    email: row.email,
    fullName: row.fullName,
    isAdmin: admins.has(row.id),
  }))
}

/** Wszystkie adresy z Cortexa, niezależnie od aktywności i ról — do rozpoznania
 *  SIEROT, czyli kont istniejących w OpenWebUI, a nieznanych Cortexowi. */
export async function loadAllKnownEmails(): Promise<string[]> {
  const rows = await getDb().select({ email: users.email }).from(users)
  return rows.map((row) => row.email)
}
