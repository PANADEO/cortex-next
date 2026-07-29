// Odczyt uprawnień z bazy (code-db). Wydzielony z rbac.ts, żeby samą bramkę
// dało się testować bez stojącego Postgresa — testy podmieniają ten moduł.

import { applications, getDb, permissionsMatrix, userRoles, users } from "@cortex/db"
import { and, eq } from "drizzle-orm"

/**
 * Kody aplikacji (kafelków), do których użytkownik ma dostęp gruboziarnisty.
 * Warstwa granularna (application_scopes) nie wchodzi tutaj — to osobne pytanie
 * "co wolno W ŚRODKU kafelka", nie "czy kafelek w ogóle".
 */
export async function loadGrantedApplicationCodes(email: string): Promise<string[]> {
  const rows = await getDb()
    .select({ code: applications.code })
    .from(users)
    .innerJoin(userRoles, eq(userRoles.userId, users.id))
    .innerJoin(permissionsMatrix, eq(permissionsMatrix.roleId, userRoles.roleId))
    .innerJoin(applications, eq(applications.id, permissionsMatrix.applicationId))
    .where(
      and(eq(users.email, email), eq(users.isActive, true), eq(applications.isActive, true)),
    )

  return rows.map((row) => row.code)
}
