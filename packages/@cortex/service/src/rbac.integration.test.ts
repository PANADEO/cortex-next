// Bramka RBAC na PRAWDZIWYM Postgresie — dowód, że warunki egzekwowane w SQL
// (użytkownik nieaktywny, aplikacja nieaktywna, brak wiersza w permissions_matrix)
// faktycznie odcinają dostęp. Testy z mockiem tego nie pokażą.
//
// Domyślnie POMIJANY — bez DATABASE_URL `pnpm test` zostaje zielony.
// Uruchomienie:
//   docker compose up -d postgres
//   pnpm --filter @cortex/db db:migrate
//   DATABASE_URL=postgres://cortex:cortex@localhost:5432/cortex pnpm vitest run \
//     packages/@cortex/service/src/rbac.integration.test.ts

import {
  applications,
  closeDb,
  getDb,
  permissionsMatrix,
  roles,
  userRoles,
  users,
} from "@cortex/db"
import { eq } from "drizzle-orm"
import { afterAll, beforeEach, describe, expect, it } from "vitest"
import { clearTileAccessCache, requireTileAccess } from "./rbac"

const hasDatabase = Boolean(process.env.DATABASE_URL)

const SUFFIX = `itest-${Date.now()}`
const APP_CODE = `kafelek-${SUFFIX}`
const ROLE_CODE = `rola-${SUFFIX}`
const EMAIL = `tester-${SUFFIX}@firma.pl`

function makeRequest(email: string): Request {
  return new Request("http://localhost/api/konfiguracja-systemu/users", {
    headers: { "x-auth-request-email": email },
  })
}

async function check(): Promise<boolean> {
  clearTileAccessCache()
  const result = await requireTileAccess(makeRequest(EMAIL), APP_CODE)
  return result.allowed
}

describe.skipIf(!hasDatabase)("requireTileAccess — prawdziwy Postgres", () => {
  beforeEach(async () => {
    const db = getDb()
    await db.delete(users).where(eq(users.email, EMAIL))
    await db.delete(applications).where(eq(applications.code, APP_CODE))
    await db.delete(roles).where(eq(roles.code, ROLE_CODE))

    const [user] = await db.insert(users).values({ email: EMAIL }).returning()
    const [role] = await db.insert(roles).values({ code: ROLE_CODE, name: "Rola testowa" }).returning()
    const [application] = await db
      .insert(applications)
      .values({ code: APP_CODE, name: "Kafelek testowy", kind: "native", route: `/${APP_CODE}` })
      .returning()

    await db.insert(userRoles).values({ userId: user!.id, roleId: role!.id })
    await db
      .insert(permissionsMatrix)
      .values({ roleId: role!.id, applicationId: application!.id })
  })

  afterAll(async () => {
    const db = getDb()
    await db.delete(users).where(eq(users.email, EMAIL))
    await db.delete(applications).where(eq(applications.code, APP_CODE))
    await db.delete(roles).where(eq(roles.code, ROLE_CODE))
    await closeDb()
  })

  it("przepuszcza przy kompletnym łańcuchu user -> rola -> grant -> aplikacja", async () => {
    expect(await check()).toBe(true)
  })

  it("odcina gdy użytkownik zostanie dezaktywowany", async () => {
    await getDb().update(users).set({ isActive: false }).where(eq(users.email, EMAIL))
    expect(await check()).toBe(false)
  })

  it("odcina gdy aplikacja zostanie dezaktywowana", async () => {
    await getDb()
      .update(applications)
      .set({ isActive: false })
      .where(eq(applications.code, APP_CODE))
    expect(await check()).toBe(false)
  })

  it("odcina po odebraniu grantu roli", async () => {
    const db = getDb()
    const [role] = await db.select().from(roles).where(eq(roles.code, ROLE_CODE))
    await db.delete(permissionsMatrix).where(eq(permissionsMatrix.roleId, role!.id))
    expect(await check()).toBe(false)
  })

  it("odcina po odebraniu roli użytkownikowi", async () => {
    const db = getDb()
    const [user] = await db.select().from(users).where(eq(users.email, EMAIL))
    await db.delete(userRoles).where(eq(userRoles.userId, user!.id))
    expect(await check()).toBe(false)
  })

  it("odcina nieznanego użytkownika", async () => {
    clearTileAccessCache()
    const result = await requireTileAccess(makeRequest(`nikt-${SUFFIX}@firma.pl`), APP_CODE)
    expect(result.allowed).toBe(false)
  })
})
