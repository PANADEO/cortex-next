// Odczyt uprawnień z bazy (code-db). Wydzielony z rbac.ts, żeby samą bramkę
// dało się testować bez stojącego Postgresa — testy podmieniają ten moduł.

import {
  applicationScopes,
  applications,
  getDb,
  permissionsMatrix,
  roleApplicationScopes,
  userRoles,
  users,
} from "@cortex/db"
import { and, eq } from "drizzle-orm"

/**
 * Kody aplikacji (kafelków), do których użytkownik ma dostęp gruboziarnisty.
 * Warstwa granularna (application_scopes) nie wchodzi tutaj — to osobne pytanie
 * "co wolno W ŚRODKU kafelka", nie "czy kafelek w ogóle".
 */
export async function loadGrantedApplicationCodes(email: string): Promise<string[]> {
  // selectDistinct, nie select: użytkownik z dwiema rolami dającymi ten sam
  // grant dostawał ten kod dwa razy. Dla requireTileAccess() (includes())
  // nieszkodliwe, ale ta sama lista jedzie teraz do przeglądarki jako `apps`
  // w /api/me/access — duplikaty wyciekłyby do klienta i do wpisów cache.
  const rows = await getDb()
    .selectDistinct({ code: applications.code })
    .from(users)
    .innerJoin(userRoles, eq(userRoles.userId, users.id))
    .innerJoin(permissionsMatrix, eq(permissionsMatrix.roleId, userRoles.roleId))
    .innerJoin(applications, eq(applications.id, permissionsMatrix.applicationId))
    .where(and(eq(users.email, email), eq(users.isActive, true), eq(applications.isActive, true)))

  return rows.map((row) => row.code)
}

/**
 * Granularne uprawnienia użytkownika jako pary "<kod aplikacji>:<kod scope'u>".
 *
 * To PIERWSZY realny konsument tabel application_scopes/role_application_scopes —
 * istniały w schemacie od początku (obie warstwy uprawnień naraz, wzorem
 * cortex-admin), ale do dziś czytana była wyłącznie warstwa gruboziarnista.
 *
 * Świadomie NIE dziedziczy z permissions_matrix: dostęp do kafelka nie nadaje
 * automatycznie żadnej akcji w środku. Kto ma widzieć "Szablony marki", musi
 * mieć jawny grant scope'u — inaczej "wpuść do Ilustromatu" po cichu znaczyłoby
 * "pozwól przemalować markę".
 */
export async function loadGrantedScopes(email: string): Promise<string[]> {
  const rows = await getDb()
    .select({ application: applications.code, scope: applicationScopes.code })
    .from(users)
    .innerJoin(userRoles, eq(userRoles.userId, users.id))
    .innerJoin(roleApplicationScopes, eq(roleApplicationScopes.roleId, userRoles.roleId))
    .innerJoin(
      applicationScopes,
      eq(applicationScopes.id, roleApplicationScopes.applicationScopeId),
    )
    .innerJoin(applications, eq(applications.id, applicationScopes.applicationId))
    .where(and(eq(users.email, email), eq(users.isActive, true), eq(applications.isActive, true)))

  return rows.map((row) => `${row.application}:${row.scope}`)
}
