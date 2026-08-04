// Logika uzgodnienia CZYSTO jednostkowo — obie granice (HTTP w ./openwebui-
// client, Postgres w ./openwebui-sync-store) zmockowane, zero sieci, zero
// bazy. Uzupełnienie dla openwebui-sync.integration.test.ts (ta sama logika,
// ale z żywym Postgresem) — tutaj chodzi wyłącznie o samą logikę uzgodnienia
// i konfigurację modułu, szybko i bez DATABASE_URL.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

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

const storeMock = vi.hoisted(() => ({
  getRole: vi.fn(),
  getRoleGroupMapping: vi.fn(),
  listMappedRoleIds: vi.fn(),
  loadActiveRoleMemberEmails: vi.fn(),
  listRoleIdsForUser: vi.fn(),
  upsertRoleGroupMapping: vi.fn(),
  deleteRoleGroupMapping: vi.fn(),
  recordSyncResult: vi.fn(),
}))

vi.mock("./openwebui-client", () => ({ ...clientMock, OpenwebuiClientError: FakeOpenwebuiClientError }))
vi.mock("./openwebui-sync-store", () => storeMock)

const {
  attachRoleGroup,
  detachRoleGroup,
  groupNameForRoleCode,
  openwebuiConfig,
  reconcileAllMappedGroups,
  reconcileRoleGroup,
  reconcileRoleGroups,
} = await import("./openwebui-sync")

const ROLE_ID = "role-1"
const GROUP_ID = "group-1"
const MAPPING = { roleId: ROLE_ID, groupId: GROUP_ID, groupName: "cortex:hr", lastSyncedAt: null, lastSyncError: null }

beforeEach(() => {
  for (const fn of Object.values(clientMock)) fn.mockReset()
  for (const fn of Object.values(storeMock)) fn.mockReset()
  vi.unstubAllEnvs()
  vi.stubEnv("OPENWEBUI_URL", "http://chat.internal")
  vi.stubEnv("OPENWEBUI_ADMIN_TOKEN", "sekret")

  storeMock.recordSyncResult.mockResolvedValue(undefined)
  clientMock.getGroup.mockResolvedValue({ id: GROUP_ID, name: "cortex:hr", description: "", userIds: [] })
  clientMock.listAllUserEmailIds.mockResolvedValue(new Map())
  clientMock.updateGroupMeta.mockResolvedValue(undefined)
  clientMock.addUsersToGroup.mockResolvedValue(undefined)
  clientMock.removeUsersFromGroup.mockResolvedValue(undefined)
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("openwebuiConfig — leniwa walidacja (D5)", () => {
  it("brak zmiennych -> null (funkcja WYŁĄCZONA, nie awaria)", () => {
    vi.unstubAllEnvs()
    expect(openwebuiConfig()).toBeNull()
  })

  it("puste stringi (docker-compose VAR:-) liczą się jak brak", () => {
    vi.unstubAllEnvs()
    vi.stubEnv("OPENWEBUI_URL", "")
    vi.stubEnv("OPENWEBUI_ADMIN_TOKEN", "")
    expect(openwebuiConfig()).toBeNull()
  })

  it("URL bez schematu -> null (fail-closed, nie rzuca)", () => {
    vi.unstubAllEnvs()
    vi.stubEnv("OPENWEBUI_URL", "chat-bez-schematu")
    vi.stubEnv("OPENWEBUI_ADMIN_TOKEN", "sekret")
    expect(openwebuiConfig()).toBeNull()
  })

  it("komplet -> baseUrl bez końcowego /", () => {
    vi.unstubAllEnvs()
    vi.stubEnv("OPENWEBUI_URL", "http://chat.internal/")
    vi.stubEnv("OPENWEBUI_ADMIN_TOKEN", "sekret")
    expect(openwebuiConfig()).toEqual({ baseUrl: "http://chat.internal", adminToken: "sekret" })
  })
})

describe("groupNameForRoleCode — D1: prefiks cortex:, klucz to KOD roli", () => {
  it("prefiksuje kod roli", () => {
    expect(groupNameForRoleCode("hr")).toBe("cortex:hr")
  })
})

describe("reconcileRoleGroup — NIGDY nie rzuca, zawsze zwraca SyncResult", () => {
  it("brak configu -> skipped, ZERO odczytów store'a (opt-in, zero kosztu dla nieskonfigurowanej instancji)", async () => {
    vi.unstubAllEnvs()

    const result = await reconcileRoleGroup(ROLE_ID)

    expect(result).toEqual({ status: "skipped" })
    expect(storeMock.getRoleGroupMapping).not.toHaveBeenCalled()
  })

  it("brak mapowania -> skipped, ZERO wywołań HTTP", async () => {
    storeMock.getRoleGroupMapping.mockResolvedValue(null)

    const result = await reconcileRoleGroup(ROLE_ID)

    expect(result).toEqual({ status: "skipped" })
    expect(clientMock.getGroup).not.toHaveBeenCalled()
  })

  it("różnica symetryczna: dodaje brakujących, usuwa nadmiarowych, NIGDY groups/update z user_ids", async () => {
    storeMock.getRoleGroupMapping.mockResolvedValue(MAPPING)
    storeMock.loadActiveRoleMemberEmails.mockResolvedValue(["a@firma.pl", "b@firma.pl"])
    clientMock.listAllUserEmailIds.mockResolvedValue(
      new Map([
        ["a@firma.pl", "owui-a"],
        ["b@firma.pl", "owui-b"],
        ["c@firma.pl", "owui-c"],
      ]),
    )
    clientMock.getGroup.mockResolvedValue({ id: GROUP_ID, name: "cortex:hr", description: "", userIds: ["owui-c"] })

    const result = await reconcileRoleGroup(ROLE_ID)

    expect(result).toEqual({ status: "ok" })
    expect(clientMock.addUsersToGroup).toHaveBeenCalledWith(
      expect.anything(),
      GROUP_ID,
      expect.arrayContaining(["owui-a", "owui-b"]),
    )
    expect(clientMock.removeUsersFromGroup).toHaveBeenCalledWith(expect.anything(), GROUP_ID, ["owui-c"])
    expect(storeMock.recordSyncResult).toHaveBeenCalledWith(ROLE_ID, null)
  })

  it("IDEMPOTENTNIE: zbiór docelowy == stan bieżący -> add/remove wołane z PUSTYMI listami, nie pominięte całkiem", async () => {
    storeMock.getRoleGroupMapping.mockResolvedValue(MAPPING)
    storeMock.loadActiveRoleMemberEmails.mockResolvedValue(["a@firma.pl"])
    clientMock.listAllUserEmailIds.mockResolvedValue(new Map([["a@firma.pl", "owui-a"]]))
    clientMock.getGroup.mockResolvedValue({ id: GROUP_ID, name: "cortex:hr", description: "", userIds: ["owui-a"] })

    await reconcileRoleGroup(ROLE_ID)

    expect(clientMock.addUsersToGroup).toHaveBeenCalledWith(expect.anything(), GROUP_ID, [])
    expect(clientMock.removeUsersFromGroup).toHaveBeenCalledWith(expect.anything(), GROUP_ID, [])
  })

  it("użytkownik bez konta w OpenWebUI jest pomijany, BEZ błędu (D6)", async () => {
    storeMock.getRoleGroupMapping.mockResolvedValue(MAPPING)
    storeMock.loadActiveRoleMemberEmails.mockResolvedValue(["ma-konto@firma.pl", "brak-konta@firma.pl"])
    clientMock.listAllUserEmailIds.mockResolvedValue(new Map([["ma-konto@firma.pl", "owui-1"]]))

    const result = await reconcileRoleGroup(ROLE_ID)

    expect(result.status).toBe("ok")
    expect(clientMock.addUsersToGroup).toHaveBeenCalledWith(expect.anything(), GROUP_ID, ["owui-1"])
  })

  it("grupa skasowana w OpenWebUI (getGroup zwraca null) -> failed, error zapisany, nic nie rzuca dalej", async () => {
    storeMock.getRoleGroupMapping.mockResolvedValue(MAPPING)
    storeMock.loadActiveRoleMemberEmails.mockResolvedValue([])
    clientMock.getGroup.mockResolvedValue(null)

    const result = await reconcileRoleGroup(ROLE_ID)

    expect(result.status).toBe("failed")
    expect(storeMock.recordSyncResult).toHaveBeenCalledWith(ROLE_ID, expect.any(String))
  })

  it("IZOLACJA AWARII: błąd sieci -> failed, NIGDY nie rzuca, add/remove nie były wołane", async () => {
    storeMock.getRoleGroupMapping.mockResolvedValue(MAPPING)
    storeMock.loadActiveRoleMemberEmails.mockResolvedValue(["a@firma.pl"])
    clientMock.getGroup.mockRejectedValue(new FakeOpenwebuiClientError("unreachable", "OpenWebUI nieosiągalny"))

    const result = await reconcileRoleGroup(ROLE_ID)

    expect(result).toEqual({ status: "failed", message: "OpenWebUI nieosiągalny" })
    expect(clientMock.addUsersToGroup).not.toHaveBeenCalled()
    expect(clientMock.removeUsersFromGroup).not.toHaveBeenCalled()
  })

  it("zapis WYNIKU sam pada -> nadal zwraca failed, nie rzuca (drugi błąd nie ma prawa dołożyć się do pierwszego)", async () => {
    storeMock.getRoleGroupMapping.mockResolvedValue(MAPPING)
    storeMock.loadActiveRoleMemberEmails.mockResolvedValue([])
    clientMock.getGroup.mockRejectedValue(new Error("boom"))
    storeMock.recordSyncResult.mockRejectedValue(new Error("db down"))

    await expect(reconcileRoleGroup(ROLE_ID)).resolves.toEqual({ status: "failed", message: "boom" })
  })

  it("budżet czasu: uzgodnienie, które nigdy się nie kończy, wraca jako failed po limicie — nie wisi w nieskończoność", async () => {
    vi.useFakeTimers()
    try {
      storeMock.getRoleGroupMapping.mockResolvedValue(MAPPING)
      storeMock.loadActiveRoleMemberEmails.mockResolvedValue([])
      clientMock.getGroup.mockImplementation(() => new Promise(() => {})) // nigdy się nie rozstrzyga

      const resultPromise = reconcileRoleGroup(ROLE_ID)
      await vi.advanceTimersByTimeAsync(5_000)
      const result = await resultPromise

      expect(result.status).toBe("failed")
    } finally {
      vi.useRealTimers()
    }
  })
})

describe("reconcileRoleGroups — jedna awaria nie blokuje uzgodnienia pozostałych ról", () => {
  it("deduplikuje identyfikatory ról", async () => {
    storeMock.getRoleGroupMapping.mockResolvedValue(null)

    await reconcileRoleGroups(["a", "a", "b"])

    expect(storeMock.getRoleGroupMapping).toHaveBeenCalledTimes(2)
  })

  it("pusta lista -> skipped bez żadnego wywołania", async () => {
    const result = await reconcileRoleGroups([])
    expect(result).toEqual({ status: "skipped" })
    expect(storeMock.getRoleGroupMapping).not.toHaveBeenCalled()
  })

  it("jedna rola failed, druga ok -> zbiorczy wynik failed, ale OBIE zostały uzgodnione", async () => {
    storeMock.getRoleGroupMapping.mockImplementation(async (roleId: string) =>
      roleId === "bad" ? { ...MAPPING, roleId: "bad", groupId: "g-bad" } : { ...MAPPING, roleId: "good" },
    )
    storeMock.loadActiveRoleMemberEmails.mockResolvedValue([])
    clientMock.getGroup.mockImplementation(async (_config: unknown, groupId: string) =>
      groupId === "g-bad" ? null : { id: GROUP_ID, name: "cortex:hr", description: "", userIds: [] },
    )

    const result = await reconcileRoleGroups(["bad", "good"])

    expect(result.status).toBe("failed")
    expect(storeMock.recordSyncResult).toHaveBeenCalledWith("bad", expect.any(String))
    expect(storeMock.recordSyncResult).toHaveBeenCalledWith("good", null)
  })
})

describe("reconcileAllMappedGroups — 'Synchronizuj teraz' dla wszystkich zmapowanych ról", () => {
  it("uzgadnia dokładnie role zwrócone przez listMappedRoleIds", async () => {
    storeMock.listMappedRoleIds.mockResolvedValue(["r1", "r2"])
    storeMock.getRoleGroupMapping.mockResolvedValue(null)

    await reconcileAllMappedGroups()

    expect(storeMock.getRoleGroupMapping).toHaveBeenCalledWith("r1")
    expect(storeMock.getRoleGroupMapping).toHaveBeenCalledWith("r2")
  })
})

describe("attachRoleGroup — podpięcie jest RĘCZNE i nie pushuje członkostwa od razu (D7/R2)", () => {
  it("brak konfiguracji -> not-configured, zero wywołań store'a", async () => {
    vi.unstubAllEnvs()

    const result = await attachRoleGroup({ roleId: ROLE_ID, action: { kind: "create" } })

    expect(result).toEqual({ error: "not-configured" })
    expect(storeMock.getRole).not.toHaveBeenCalled()
  })

  it("nieznana rola -> unknown-role", async () => {
    storeMock.getRole.mockResolvedValue(null)

    const result = await attachRoleGroup({ roleId: ROLE_ID, action: { kind: "create" } })

    expect(result).toEqual({ error: "unknown-role" })
  })

  it("kind:create -> tworzy grupę cortex:<code roli> i zapisuje mapowanie, BEZ pushu członkostwa", async () => {
    storeMock.getRole.mockResolvedValue({ id: ROLE_ID, code: "hr" })
    clientMock.createGroup.mockResolvedValue({ id: "nowa-grupa", name: "cortex:hr" })
    storeMock.upsertRoleGroupMapping.mockResolvedValue({ ...MAPPING, groupId: "nowa-grupa", groupName: "cortex:hr" })

    const result = await attachRoleGroup({ roleId: ROLE_ID, action: { kind: "create" } })

    expect(clientMock.createGroup).toHaveBeenCalledWith(expect.anything(), "cortex:hr", expect.any(String))
    expect(storeMock.upsertRoleGroupMapping).toHaveBeenCalledWith(ROLE_ID, "nowa-grupa", "cortex:hr")
    expect(clientMock.addUsersToGroup).not.toHaveBeenCalled()
    expect("mapping" in result).toBe(true)
  })

  it("kind:existing na nieistniejącej grupie -> group-not-found, mapowanie NIE zapisane", async () => {
    storeMock.getRole.mockResolvedValue({ id: ROLE_ID, code: "hr" })
    clientMock.getGroup.mockResolvedValue(null)

    const result = await attachRoleGroup({ roleId: ROLE_ID, action: { kind: "existing", groupId: "brak" } })

    expect(result).toEqual({ error: "group-not-found" })
    expect(storeMock.upsertRoleGroupMapping).not.toHaveBeenCalled()
  })
})

describe("detachRoleGroup — usuwa WYŁĄCZNIE mapowanie, nie dotyka OpenWebUI", () => {
  it("deleguje do store i nie woła ani jednego endpointu HTTP", async () => {
    storeMock.deleteRoleGroupMapping.mockResolvedValue(true)

    const detached = await detachRoleGroup(ROLE_ID)

    expect(detached).toBe(true)
    expect(clientMock.removeUsersFromGroup).not.toHaveBeenCalled()
    expect(clientMock.getGroup).not.toHaveBeenCalled()
  })
})
