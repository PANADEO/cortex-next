// Warstwa GRANULARNA na prawdziwym Postgresie. Ilustromat jest jej pierwszym
// konsumentem — tabele application_scopes/role_application_scopes istniały
// w schemacie od początku, ale do tej pory nic ich nie czytało, więc nie było
// dowodu, że ten łańcuch w ogóle działa. Ten plik jest tym dowodem.
//
// Najważniejsza asercja: dostęp do KAFELKA nie nadaje scope'u. Gdyby te dwie
// warstwy się zlewały, "wpuść kogoś do Ilustromatu" znaczyłoby po cichu
// "pozwól mu przemalować markę firmy".
//
// Domyślnie POMIJANY — bez DATABASE_URL `pnpm test` zostaje zielony:
//   DATABASE_URL=postgres://... pnpm vitest run \
//     packages/@cortex/service/src/rbac-scope.integration.test.ts

import {
  applicationScopes,
  applications,
  closeDb,
  getDb,
  permissionsMatrix,
  roleApplicationScopes,
  roles,
  userRoles,
  users,
} from "@cortex/db"
import { eq } from "drizzle-orm"
import { afterAll, beforeEach, describe, expect, it } from "vitest"
import { clearTileAccessCache, requireTileAccess, requireTileScope } from "./rbac"

const hasDatabase = Boolean(process.env.DATABASE_URL)

const SUFFIX = `scope-itest-${Date.now()}`
const APP_CODE = `kafelek-${SUFFIX}`
const ROLE_CODE = `rola-${SUFFIX}`
const EMAIL = `tester-${SUFFIX}@firma.pl`
const SCOPE_CODE = "manage-templates"

function makeRequest(email: string): Request {
  return new Request("http://localhost/api/ilustromat/templates", {
    headers: { "x-auth-request-email": email },
  })
}

async function hasScope(): Promise<boolean> {
  clearTileAccessCache()
  const result = await requireTileScope(makeRequest(EMAIL), APP_CODE, SCOPE_CODE)
  return result.allowed
}

async function cleanup(): Promise<void> {
  const db = getDb()
  await db.delete(users).where(eq(users.email, EMAIL))
  await db.delete(applications).where(eq(applications.code, APP_CODE))
  await db.delete(roles).where(eq(roles.code, ROLE_CODE))
}

describe.skipIf(!hasDatabase)("requireTileScope — prawdziwy Postgres", () => {
  beforeEach(async () => {
    await cleanup()
    const db = getDb()

    const [user] = await db.insert(users).values({ email: EMAIL }).returning()
    const [role] = await db
      .insert(roles)
      .values({ code: ROLE_CODE, name: "Rola testowa" })
      .returning()
    const [application] = await db
      .insert(applications)
      .values({ code: APP_CODE, name: "Kafelek testowy", kind: "native", route: `/${APP_CODE}` })
      .returning()
    const [scope] = await db
      .insert(applicationScopes)
      .values({ applicationId: application!.id, code: SCOPE_CODE, name: "Zarządzanie szablonami" })
      .returning()

    await db.insert(userRoles).values({ userId: user!.id, roleId: role!.id })
    await db.insert(permissionsMatrix).values({ roleId: role!.id, applicationId: application!.id })
    await db
      .insert(roleApplicationScopes)
      .values({ roleId: role!.id, applicationScopeId: scope!.id })
  })

  afterAll(async () => {
    await cleanup()
    await closeDb()
  })

  it("przepuszcza przy komplecie: dostęp do kafelka + grant scope'u", async () => {
    expect(await hasScope()).toBe(true)
  })

  it("KLUCZOWE: sam dostęp do kafelka NIE nadaje scope'u", async () => {
    const db = getDb()
    const [role] = await db.select().from(roles).where(eq(roles.code, ROLE_CODE))
    await db.delete(roleApplicationScopes).where(eq(roleApplicationScopes.roleId, role!.id))

    clearTileAccessCache()
    // Kafelek nadal dostępny...
    expect((await requireTileAccess(makeRequest(EMAIL), APP_CODE)).allowed).toBe(true)
    // ...ale akcja administracyjna już nie.
    expect(await hasScope()).toBe(false)
  })

  it("odmawia, gdy scope jest nadany, ale kafelek zabrany", async () => {
    const db = getDb()
    const [role] = await db.select().from(roles).where(eq(roles.code, ROLE_CODE))
    await db.delete(permissionsMatrix).where(eq(permissionsMatrix.roleId, role!.id))
    expect(await hasScope()).toBe(false)
  })

  it("odmawia dla innego kodu scope'u", async () => {
    clearTileAccessCache()
    const result = await requireTileScope(makeRequest(EMAIL), APP_CODE, "jakis-inny-scope")
    expect(result.allowed).toBe(false)
  })

  it("odcina po dezaktywacji użytkownika", async () => {
    await getDb().update(users).set({ isActive: false }).where(eq(users.email, EMAIL))
    expect(await hasScope()).toBe(false)
  })

  it("odcina po dezaktywacji aplikacji", async () => {
    await getDb()
      .update(applications)
      .set({ isActive: false })
      .where(eq(applications.code, APP_CODE))
    expect(await hasScope()).toBe(false)
  })

  it("odmawia bez nagłówka tożsamości", async () => {
    clearTileAccessCache()
    const result = await requireTileScope(
      new Request("http://localhost/api/ilustromat/templates"),
      APP_CODE,
      SCOPE_CODE,
    )
    expect(result.allowed).toBe(false)
    expect(result.email).toBeNull()
  })
})
