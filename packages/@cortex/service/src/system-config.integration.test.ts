// Mutacje uprawnień na PRAWDZIWYM Postgresie — dowód na dwa krytyczne
// znaleziska z review:
//
//  1. Odebranie/nadanie dostępu działa NATYCHMIAST. Testy NIE wołają
//     clearTileAccessCache() ręcznie — o to właśnie chodzi: jeżeli mutacja
//     przestanie czyścić cache, te testy zaczną padać.
//  2. Aplikacji `system-config` nie da się zmienić w sposób odcinający dostęp
//     do modułu administracyjnego (blokada w SERWISIE, nie w formularzu).
//
// Domyślnie POMIJANY — bez DATABASE_URL `pnpm test` zostaje zielony.
//   DATABASE_URL=postgresql://cortex:cortex@localhost:5432/cortex pnpm vitest run \
//     packages/@cortex/service/src/system-config.integration.test.ts

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
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest"
import { clearTileAccessCache, requireTileAccess } from "./rbac"
import {
  SYSTEM_CONFIG_APP_CODE,
  SelfLockoutError,
  deleteApplication,
  setApplicationRoles,
  setUserRoles,
  updateApplication,
} from "./system-config"

const hasDatabase = Boolean(process.env.DATABASE_URL)

const SUFFIX = `itest-${Date.now()}`
const APP_CODE = `kafelek-${SUFFIX}`
const ROLE_CODE = `rola-${SUFFIX}`
const EMAIL = `tester-${SUFFIX}@firma.pl`

let userId = ""
let roleId = ""
let applicationId = ""

function makeRequest(email: string): Request {
  return new Request("http://localhost/api/system-config/users", {
    headers: { "x-auth-request-email": email },
  })
}

/** UWAGA: bez clearTileAccessCache() — sprawdzamy, czy zrobiła to mutacja. */
async function canAccess(): Promise<boolean> {
  const result = await requireTileAccess(makeRequest(EMAIL), APP_CODE)
  return result.allowed
}

const NATIVE_INPUT = {
  code: APP_CODE,
  name: "Kafelek testowy",
  kind: "native" as const,
  route: `/${APP_CODE}`,
}

async function cleanup(): Promise<void> {
  const db = getDb()
  await db.delete(users).where(eq(users.email, EMAIL))
  await db.delete(applications).where(eq(applications.code, APP_CODE))
  await db.delete(roles).where(eq(roles.code, ROLE_CODE))
}

describe.skipIf(!hasDatabase)("mutacje uprawnień — prawdziwy Postgres", () => {
  beforeEach(async () => {
    const db = getDb()
    await cleanup()

    const [user] = await db.insert(users).values({ email: EMAIL }).returning()
    const [role] = await db
      .insert(roles)
      .values({ code: ROLE_CODE, name: "Rola testowa" })
      .returning()
    const [application] = await db.insert(applications).values(NATIVE_INPUT).returning()

    userId = user!.id
    roleId = role!.id
    applicationId = application!.id

    await db.insert(userRoles).values({ userId, roleId })
    await db.insert(permissionsMatrix).values({ roleId, applicationId })

    clearTileAccessCache()
  })

  afterAll(async () => {
    await cleanup()
    await closeDb()
  })

  describe("natychmiastowa inwalidacja cache", () => {
    it("setUserRoles — odebranie roli odcina OD RAZU, nie po TTL", async () => {
      expect(await canAccess()).toBe(true)

      await setUserRoles(userId, [])

      expect(await canAccess()).toBe(false)
    })

    it("setUserRoles — nadanie roli wpuszcza OD RAZU", async () => {
      await setUserRoles(userId, [])
      expect(await canAccess()).toBe(false)

      await setUserRoles(userId, [roleId])

      expect(await canAccess()).toBe(true)
    })

    it("setApplicationRoles — odebranie grantu roli odcina OD RAZU", async () => {
      expect(await canAccess()).toBe(true)

      await setApplicationRoles(applicationId, [])

      expect(await canAccess()).toBe(false)
    })

    it("setApplicationRoles — nadanie grantu wpuszcza OD RAZU", async () => {
      await setApplicationRoles(applicationId, [])
      expect(await canAccess()).toBe(false)

      await setApplicationRoles(applicationId, [roleId])

      expect(await canAccess()).toBe(true)
    })

    it("updateApplication — dezaktywacja aplikacji odcina OD RAZU", async () => {
      expect(await canAccess()).toBe(true)

      await updateApplication(applicationId, { ...NATIVE_INPUT, isActive: false })

      expect(await canAccess()).toBe(false)
    })

    it("deleteApplication — usunięcie aplikacji odcina OD RAZU", async () => {
      expect(await canAccess()).toBe(true)

      await deleteApplication(applicationId)

      expect(await canAccess()).toBe(false)
    })
  })

  // Ten blok operuje na PRAWDZIWYM wierszu `system-config` (nie da się inaczej
  // sprawdzić blokady, która jest po nim rozpoznawana). Dlatego przed każdym
  // testem robi snapshot wiersza i jego grantów, a po teście je przywraca —
  // inaczej suita odbierałaby dostęp do modułu w bazie, na której ją puszczono.
  describe("ochrona przed samo-zablokowaniem", () => {
    let systemConfigId = ""
    let snapshotRow: typeof applications.$inferSelect | undefined
    let snapshotRoleIds: string[] = []

    beforeEach(async () => {
      const db = getDb()
      const [existing] = await db
        .select()
        .from(applications)
        .where(eq(applications.code, SYSTEM_CONFIG_APP_CODE))

      snapshotRow = existing
      systemConfigId =
        existing?.id ??
        (
          await db
            .insert(applications)
            .values({
              code: SYSTEM_CONFIG_APP_CODE,
              name: "Konfiguracja Systemu",
              kind: "native",
              route: "/system-config",
            })
            .returning()
        )[0]!.id

      snapshotRoleIds = (
        await db
          .select({ roleId: permissionsMatrix.roleId })
          .from(permissionsMatrix)
          .where(eq(permissionsMatrix.applicationId, systemConfigId))
      ).map((row) => row.roleId)
    })

    afterEach(async () => {
      const db = getDb()

      if (snapshotRow) {
        await db
          .update(applications)
          .set(snapshotRow)
          .where(eq(applications.id, systemConfigId))
      }

      await db.delete(permissionsMatrix).where(eq(permissionsMatrix.applicationId, systemConfigId))
      if (snapshotRoleIds.length > 0) {
        await db
          .insert(permissionsMatrix)
          .values(snapshotRoleIds.map((roleId) => ({ roleId, applicationId: systemConfigId })))
      }
    })

    const baseInput = {
      code: SYSTEM_CONFIG_APP_CODE,
      name: "Konfiguracja Systemu",
      kind: "native" as const,
      route: "/system-config",
    }

    it("odrzuca dezaktywację", async () => {
      await expect(
        updateApplication(systemConfigId, { ...baseInput, isActive: false }),
      ).rejects.toBeInstanceOf(SelfLockoutError)
    })

    it("odrzuca zmianę kodu", async () => {
      await expect(
        updateApplication(systemConfigId, { ...baseInput, code: "cos-innego" }),
      ).rejects.toBeInstanceOf(SelfLockoutError)
    })

    it("odrzuca usunięcie", async () => {
      await expect(deleteApplication(systemConfigId)).rejects.toBeInstanceOf(SelfLockoutError)
    })

    it("wiersz przeżywa odrzucone próby w nienaruszonym stanie", async () => {
      await updateApplication(systemConfigId, { ...baseInput, isActive: false }).catch(() => {})
      await deleteApplication(systemConfigId).catch(() => {})

      const [row] = await getDb()
        .select()
        .from(applications)
        .where(eq(applications.code, SYSTEM_CONFIG_APP_CODE))

      expect(row).toBeDefined()
      expect(row!.isActive).toBe(true)
      expect(row!.code).toBe(SYSTEM_CONFIG_APP_CODE)
    })

    it("przepuszcza nieszkodliwą edycję tej samej aplikacji", async () => {
      const updated = await updateApplication(systemConfigId, {
        ...baseInput,
        description: "Użytkownicy, role, uprawnienia i aplikacje instancji",
      })

      expect(updated?.isActive).toBe(true)
      expect(updated?.description).toContain("uprawnienia")
    })

    it("odrzuca odebranie dostępu OSTATNIEJ roli (nikt nie wszedłby do modułu)", async () => {
      await expect(setApplicationRoles(systemConfigId, [])).rejects.toBeInstanceOf(SelfLockoutError)
    })

    it("pozwala przepiąć dostęp na inną rolę, dopóki ktoś go zachowuje", async () => {
      await setApplicationRoles(systemConfigId, [roleId])

      const granted = await getDb()
        .select({ roleId: permissionsMatrix.roleId })
        .from(permissionsMatrix)
        .where(eq(permissionsMatrix.applicationId, systemConfigId))

      expect(granted.map((row) => row.roleId)).toEqual([roleId])
    })

    it("zwykła aplikacja może zostać bez żadnej uprawnionej roli", async () => {
      await setApplicationRoles(applicationId, [])
      expect(await canAccess()).toBe(false)
    })

    it("NIE blokuje dezaktywacji ani usunięcia zwykłej aplikacji", async () => {
      const deactivated = await updateApplication(applicationId, {
        ...NATIVE_INPUT,
        isActive: false,
      })
      expect(deactivated?.isActive).toBe(false)

      expect(await deleteApplication(applicationId)).toBe(true)
    })
  })
})
