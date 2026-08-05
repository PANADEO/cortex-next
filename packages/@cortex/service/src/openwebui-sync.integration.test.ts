// Uzgodnienie ról -> grup OpenWebUI na PRAWDZIWYM Postgresie, z podmienioną
// GRANICĄ HTTP (./openwebui-client jest mockiem — patrz vi.mock niżej). Dowód
// na to, czego nie da się sprawdzić testem czysto jednostkowym (openwebui-
// sync.test.ts, mockuje TEŻ store): że zbiór docelowy faktycznie liczy się z
// żywej bazy (join users/user_roles/isActive), że setUserRoles()/updateUser()/
// deleteRole() naprawdę wołają reconciler we właściwym miejscu, i że
// ON DELETE CASCADE kasuje wiersz mapowania dokładnie tak, jak zakłada D7.
//
// Domyślnie POMIJANY — bez DATABASE_URL `pnpm test` zostaje zielony (patrz
// system-config.integration.test.ts):
//   DATABASE_URL=postgresql://cortex:cortex@localhost:5432/cortex pnpm vitest run \
//     packages/@cortex/service/src/openwebui-sync.integration.test.ts

import { closeDb, getDb, openwebuiGroupMappings, roles, userRoles, users } from "@cortex/db"
import { randomUUID } from "node:crypto"
import { eq } from "drizzle-orm"
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const clientMock = vi.hoisted(() => ({
  listGroups: vi.fn(),
  createGroup: vi.fn(),
  getGroup: vi.fn(),
  updateGroupMeta: vi.fn(),
  addUsersToGroup: vi.fn(),
  removeUsersFromGroup: vi.fn(),
  listAllUserEmailIds: vi.fn(),
}))

class FakeOpenwebuiClientError extends Error {
  readonly failure: string
  constructor(failure: string, message: string) {
    super(message)
    this.name = "OpenwebuiClientError"
    this.failure = failure
  }
}

vi.mock("./openwebui-client", () => ({ ...clientMock, OpenwebuiClientError: FakeOpenwebuiClientError }))

const { deleteRole, setUserRoles, updateUser } = await import("./system-config")
const { OpenwebuiGroupAlreadyMappedError, attachRoleGroup, detachRoleGroup, getRoleGroupMapping, reconcileRoleGroup } =
  await import("./openwebui-sync")

const hasDatabase = Boolean(process.env.DATABASE_URL)

const SUFFIX = `owui-itest-${process.pid}-${randomUUID().slice(0, 8)}`
const ROLE_CODE = `rola-${SUFFIX}`
const SECOND_ROLE_CODE = `rola2-${SUFFIX}`
const EMAIL = `czlonek-${SUFFIX}@firma.pl`
const INACTIVE_EMAIL = `nieaktywny-${SUFFIX}@firma.pl`
const NO_ACCOUNT_EMAIL = `brak-konta-owui-${SUFFIX}@firma.pl`
const GROUP_ID = `owui-group-${SUFFIX}`
const OWUI_USER_ID = `owui-user-${SUFFIX}`
const OWUI_INACTIVE_USER_ID = `owui-user-inactive-${SUFFIX}`

let roleId = ""
let userId = ""
let inactiveUserId = ""

async function cleanup(): Promise<void> {
  const db = getDb()
  for (const email of [EMAIL, INACTIVE_EMAIL, NO_ACCOUNT_EMAIL]) {
    await db.delete(users).where(eq(users.email, email))
  }
  for (const code of [ROLE_CODE, SECOND_ROLE_CODE]) {
    await db.delete(roles).where(eq(roles.code, code))
  }
}

function stubConfig(): void {
  vi.stubEnv("OPENWEBUI_URL", "http://chat.internal.test")
  vi.stubEnv("OPENWEBUI_ADMIN_TOKEN", "test-admin-token")
}

describe.skipIf(!hasDatabase)("uzgodnienie rola -> grupa OpenWebUI — prawdziwy Postgres, HTTP zmockowane", () => {
  beforeEach(async () => {
    const db = getDb()
    await cleanup()

    const [role] = await db.insert(roles).values({ code: ROLE_CODE, name: "Rola testowa OWUI" }).returning()
    roleId = role!.id

    const [user] = await db.insert(users).values({ email: EMAIL }).returning()
    userId = user!.id
    await db.insert(userRoles).values({ userId, roleId })

    const [inactive] = await db.insert(users).values({ email: INACTIVE_EMAIL, isActive: false }).returning()
    inactiveUserId = inactive!.id
    await db.insert(userRoles).values({ userId: inactiveUserId, roleId })

    stubConfig()
    for (const fn of Object.values(clientMock)) fn.mockReset()
    clientMock.listAllUserEmailIds.mockResolvedValue(
      new Map([
        [EMAIL, OWUI_USER_ID],
        [INACTIVE_EMAIL, OWUI_INACTIVE_USER_ID],
      ]),
    )
    clientMock.getGroup.mockResolvedValue({
      id: GROUP_ID,
      name: `cortex:${ROLE_CODE}`,
      description: "",
      userIds: [],
    })
    clientMock.addUsersToGroup.mockResolvedValue(undefined)
    clientMock.removeUsersFromGroup.mockResolvedValue(undefined)
    clientMock.updateGroupMeta.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  afterAll(async () => {
    await cleanup()
    await closeDb()
  })

  async function mapRole(): Promise<void> {
    await getDb()
      .insert(openwebuiGroupMappings)
      .values({ roleId, groupId: GROUP_ID, groupName: `cortex:${ROLE_CODE}` })
  }

  async function createSecondRole(): Promise<string> {
    const [role] = await getDb().insert(roles).values({ code: SECOND_ROLE_CODE, name: "Druga rola OWUI" }).returning()
    return role!.id
  }

  // ── Migotająca eksmisja ma być NIEMOŻLIWA DO STWORZENIA, nie "obsłużona".
  //    Dwie role wpięte w jedną grupę wyliczają z niej dwa różne zbiory
  //    docelowe, więc każde uzgodnienie wyrzuca członków tej drugiej — dostęp
  //    znika i wraca zależnie od kolejności synchronizacji, przy
  //    `last_sync_error` = NULL. Testy niżej pokazują, że stanu, z którego to
  //    wynika, nie da się zapisać ŻADNĄ z dwóch dróg do tej tabeli.
  describe("jedna grupa = najwyżej jedna rola", () => {
    it("BAZA odrzuca drugie mapowanie tej samej grupy — z pominięciem CAŁEJ warstwy serwisowej", async () => {
      await mapRole()
      const secondRoleId = await createSecondRole()

      // Celowo prosto do Drizzle, nie przez attachRoleGroup: dowodzimy, że
      // gwarancją jest UNIQUE(group_id), a nie sprawdzenie w kodzie, które
      // jako sprawdź-potem-wstaw i tak nie wytrzymałoby dwóch równoległych
      // podpięć.
      const error = await getDb()
        .insert(openwebuiGroupMappings)
        .values({ roleId: secondRoleId, groupId: GROUP_ID, groupName: `cortex:${SECOND_ROLE_CODE}` })
        .catch((caught: unknown) => caught)

      expect(error).toBeInstanceOf(Error)
      expect(error).toMatchObject({ code: "23505" })

      // I tu jest sedno: po odrzuceniu tabela dalej ma DOKŁADNIE JEDNO
      // mapowanie tej grupy, więc reconcileAllMappedGroups() nie ma jak
      // pushnąć do niej dwóch różnych zbiorów docelowych.
      const rows = await getDb()
        .select()
        .from(openwebuiGroupMappings)
        .where(eq(openwebuiGroupMappings.groupId, GROUP_ID))
      expect(rows).toHaveLength(1)
      expect(rows[0]!.roleId).toBe(roleId)
    })

    it("attachRoleGroup odmawia 'po ludzku', nazywając kolidującą rolę i nie dotykając OpenWebUI", async () => {
      await mapRole()
      const secondRoleId = await createSecondRole()

      const error = await attachRoleGroup({
        roleId: secondRoleId,
        action: { kind: "existing", groupId: GROUP_ID },
      }).catch((caught: unknown) => caught)

      expect(error).toBeInstanceOf(OpenwebuiGroupAlreadyMappedError)
      expect((error as Error).message).toContain(ROLE_CODE)
      expect(clientMock.getGroup).not.toHaveBeenCalled()
      expect(await getRoleGroupMapping(secondRoleId)).toBeNull()
    })

    it("odpięcie pierwszej roli zwalnia grupę — ograniczenie blokuje WSPÓŁdzielenie, nie przeniesienie", async () => {
      await mapRole()
      const secondRoleId = await createSecondRole()
      await detachRoleGroup(roleId)
      clientMock.getGroup.mockResolvedValue({ id: GROUP_ID, name: `cortex:${ROLE_CODE}`, description: "", userIds: [] })

      const result = await attachRoleGroup({ roleId: secondRoleId, action: { kind: "existing", groupId: GROUP_ID } })

      expect("mapping" in result).toBe(true)
      expect((await getRoleGroupMapping(secondRoleId))?.groupId).toBe(GROUP_ID)
    })
  })

  describe("reconcileRoleGroup — zbiór docelowy z żywej bazy", () => {
    it("dodaje AKTYWNEGO członka roli, POMIJA nieaktywnego — bez ANI JEDNEGO wywołania groups/update z user_ids", async () => {
      await mapRole()

      const result = await reconcileRoleGroup(roleId)

      expect(result.status).toBe("ok")
      expect(clientMock.addUsersToGroup).toHaveBeenCalledWith(expect.anything(), GROUP_ID, [OWUI_USER_ID])
      expect(clientMock.removeUsersFromGroup).toHaveBeenCalledWith(expect.anything(), GROUP_ID, [])
      // D4: aktualizacja METADANYCH nigdy nie niesie user_ids — ten adapter w
      // ogóle nie eksponuje takiego parametru (patrz jego sygnaturę), ale
      // sprawdzamy też, że wywołanie w ogóle poszło z samą nazwą/opisem.
      expect(clientMock.updateGroupMeta).toHaveBeenCalledWith(
        expect.anything(),
        GROUP_ID,
        `cortex:${ROLE_CODE}`,
        expect.any(String),
      )

      const [mapping] = await getDb().select().from(openwebuiGroupMappings).where(eq(openwebuiGroupMappings.roleId, roleId))
      expect(mapping!.lastSyncError).toBeNull()
      expect(mapping!.lastSyncedAt).not.toBeNull()
    })

    it("IDEMPOTENTNIE: drugie uzgodnienie z rzędu, bez zmian w bazie, nie dodaje/nie usuwa nikogo", async () => {
      await mapRole()
      await reconcileRoleGroup(roleId)
      clientMock.getGroup.mockResolvedValue({
        id: GROUP_ID,
        name: `cortex:${ROLE_CODE}`,
        description: "",
        userIds: [OWUI_USER_ID],
      })
      clientMock.addUsersToGroup.mockClear()
      clientMock.removeUsersFromGroup.mockClear()

      const result = await reconcileRoleGroup(roleId)

      expect(result.status).toBe("ok")
      expect(clientMock.addUsersToGroup).toHaveBeenCalledWith(expect.anything(), GROUP_ID, [])
      expect(clientMock.removeUsersFromGroup).toHaveBeenCalledWith(expect.anything(), GROUP_ID, [])
    })

    it("użytkownik bez konta w OpenWebUI (nigdy się nie zalogował) jest pomijany BEZ błędu (D6)", async () => {
      const db = getDb()
      const [noAccountUser] = await db.insert(users).values({ email: NO_ACCOUNT_EMAIL }).returning()
      await db.insert(userRoles).values({ userId: noAccountUser!.id, roleId })
      await mapRole()
      // listAllUserEmailIds NIE zwraca NO_ACCOUNT_EMAIL — symuluje brak konta.

      const result = await reconcileRoleGroup(roleId)

      expect(result.status).toBe("ok")
      expect(clientMock.addUsersToGroup).toHaveBeenCalledWith(expect.anything(), GROUP_ID, [OWUI_USER_ID])
    })

    it("IZOLACJA AWARII: OpenWebUI zwraca błąd -> status failed, last_sync_error zapisany, RBAC w Postgresie nietknięty", async () => {
      await mapRole()
      clientMock.getGroup.mockRejectedValue(new Error("connection refused"))

      const result = await reconcileRoleGroup(roleId)

      expect(result.status).toBe("failed")
      expect(result.message).toBeTruthy()
      expect(clientMock.addUsersToGroup).not.toHaveBeenCalled()

      const [mapping] = await getDb().select().from(openwebuiGroupMappings).where(eq(openwebuiGroupMappings.roleId, roleId))
      expect(mapping!.lastSyncError).toBeTruthy()

      // Dowód izolacji: user_roles w Postgresie jest DOKŁADNIE takie, jak
      // przed nieudanym uzgodnieniem — awaria OpenWebUI nie cofnęła/nie
      // uszkodziła RBAC.
      const [row] = await getDb().select().from(userRoles).where(eq(userRoles.userId, userId))
      expect(row?.roleId).toBe(roleId)
    })

    it("brak mapowania -> skipped, ZERO wywołań HTTP", async () => {
      const result = await reconcileRoleGroup(roleId)

      expect(result).toEqual({ status: "skipped" })
      expect(clientMock.getGroup).not.toHaveBeenCalled()
    })

    it("brak konfiguracji (OPENWEBUI_URL/OPENWEBUI_ADMIN_TOKEN nieustawione) -> skipped, ZERO wywołań HTTP", async () => {
      await mapRole()
      vi.unstubAllEnvs()

      const result = await reconcileRoleGroup(roleId)

      expect(result).toEqual({ status: "skipped" })
      expect(clientMock.getGroup).not.toHaveBeenCalled()
    })
  })

  describe("wpięcie w mutacje RBAC (D3 — dokładnie tam, gdzie clearTileAccessCache())", () => {
    it("setUserRoles — odebranie roli usuwa użytkownika z JEJ zmapowanej grupy", async () => {
      await mapRole()
      clientMock.getGroup.mockResolvedValue({
        id: GROUP_ID,
        name: `cortex:${ROLE_CODE}`,
        description: "",
        userIds: [OWUI_USER_ID],
      })

      const openwebuiSync = await setUserRoles(userId, [])

      expect(openwebuiSync.status).toBe("ok")
      expect(clientMock.removeUsersFromGroup).toHaveBeenCalledWith(expect.anything(), GROUP_ID, [OWUI_USER_ID])
    })

    it("setUserRoles — rola BEZ mapowania nie woła ani jednego endpointu OpenWebUI", async () => {
      const openwebuiSync = await setUserRoles(userId, [])

      expect(openwebuiSync).toEqual({ status: "skipped" })
      expect(clientMock.getGroup).not.toHaveBeenCalled()
    })

    it("updateUser — dezaktywacja użytkownika wypycha go ze WSZYSTKICH jego zmapowanych grup", async () => {
      await mapRole()
      clientMock.getGroup.mockResolvedValue({
        id: GROUP_ID,
        name: `cortex:${ROLE_CODE}`,
        description: "",
        userIds: [OWUI_USER_ID],
      })

      const result = await updateUser(userId, { isActive: false })

      expect(result?.openwebuiSync.status).toBe("ok")
      expect(clientMock.removeUsersFromGroup).toHaveBeenCalledWith(expect.anything(), GROUP_ID, [OWUI_USER_ID])
    })

    it("updateUser — edycja samego fullName NIE dotyka OpenWebUI (skipped)", async () => {
      const result = await updateUser(userId, { fullName: "Jan Testowy" })

      expect(result?.openwebuiSync).toEqual({ status: "skipped" })
      expect(clientMock.getGroup).not.toHaveBeenCalled()
    })

    it("deleteRole — D7: opróżnia grupę PRZED tym, jak kaskada skasuje wiersz mapowania", async () => {
      await mapRole()
      clientMock.getGroup.mockResolvedValue({
        id: GROUP_ID,
        name: `cortex:${ROLE_CODE}`,
        description: "",
        userIds: [OWUI_USER_ID, OWUI_INACTIVE_USER_ID],
      })

      const { removed, openwebuiSync } = await deleteRole(roleId)

      expect(removed).toBe(true)
      expect(openwebuiSync.status).toBe("ok")
      expect(clientMock.removeUsersFromGroup).toHaveBeenCalledWith(
        expect.anything(),
        GROUP_ID,
        expect.arrayContaining([OWUI_USER_ID, OWUI_INACTIVE_USER_ID]),
      )
      // Grupa w OpenWebUI NIE jest kasowana — tylko opróżniona (D7).
      expect(clientMock.createGroup).not.toHaveBeenCalled()

      // Kaskada: wiersz mapowania zniknął RAZEM z rolą.
      const mapping = await getRoleGroupMapping(roleId)
      expect(mapping).toBeNull()
    })

    it("deleteRole — rola bez mapowania: skipped, zero wywołań HTTP", async () => {
      const { removed, openwebuiSync } = await deleteRole(roleId)

      expect(removed).toBe(true)
      expect(openwebuiSync).toEqual({ status: "skipped" })
      expect(clientMock.getGroup).not.toHaveBeenCalled()
    })
  })

  describe("podpięcie/odpięcie (route openwebui-group, PUT)", () => {
    it("attachRoleGroup({kind:'create'}) tworzy grupę cortex:<code roli> i zapisuje mapowanie, BEZ pushu członkostwa", async () => {
      clientMock.createGroup.mockResolvedValue({ id: GROUP_ID, name: `cortex:${ROLE_CODE}` })

      const result = await attachRoleGroup({ roleId, action: { kind: "create" } })

      expect("mapping" in result).toBe(true)
      if ("mapping" in result) {
        expect(result.mapping.groupId).toBe(GROUP_ID)
        expect(result.mapping.groupName).toBe(`cortex:${ROLE_CODE}`)
      }
      expect(clientMock.createGroup).toHaveBeenCalledWith(expect.anything(), `cortex:${ROLE_CODE}`, expect.any(String))
      // D7: podpięcie samo w sobie nie pushuje członkostwa.
      expect(clientMock.addUsersToGroup).not.toHaveBeenCalled()
    })

    it("attachRoleGroup({kind:'existing'}) na nieistniejącej grupie zwraca group-not-found", async () => {
      clientMock.getGroup.mockResolvedValue(null)

      const result = await attachRoleGroup({ roleId, action: { kind: "existing", groupId: "brak-takiej" } })

      expect(result).toEqual({ error: "group-not-found" })
    })

    it("detachRoleGroup usuwa WYŁĄCZNIE mapowanie — nie dotyka członkostwa grupy w OpenWebUI", async () => {
      await mapRole()

      const detached = await detachRoleGroup(roleId)

      expect(detached).toBe(true)
      expect(clientMock.removeUsersFromGroup).not.toHaveBeenCalled()
      expect(await getRoleGroupMapping(roleId)).toBeNull()
    })
  })
})
