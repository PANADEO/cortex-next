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
  listAllUsers: vi.fn(),
  getTokenOwnerEmail: vi.fn(),
  createUser: vi.fn(),
  updateUserRole: vi.fn(),
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
  findGroupMappingOwner: vi.fn(),
  listMappedRoleIds: vi.fn(),
  loadActiveRoleMemberEmails: vi.fn(),
  listRoleIdsForUser: vi.fn(),
  upsertRoleGroupMapping: vi.fn(),
  deleteRoleGroupMapping: vi.fn(),
  recordSyncResult: vi.fn(),
  loadOpenwebuiTargetUsers: vi.fn(),
  loadAllKnownEmails: vi.fn(),
  loadAdminEmails: vi.fn(),
  listAllRoles: vi.fn(),
}))

vi.mock("./openwebui-client", () => ({ ...clientMock, OpenwebuiClientError: FakeOpenwebuiClientError }))
vi.mock("./openwebui-sync-store", () => storeMock)

const {
  OpenwebuiGroupAlreadyMappedError,
  attachRoleGroup,
  detachRoleGroup,
  groupNameForRoleCode,
  openwebuiConfig,
  reconcileAllMappedGroups,
  reconcileEverything,
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
  storeMock.findGroupMappingOwner.mockResolvedValue(null)
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

  // ── Jedna grupa = najwyżej jedna rola. GWARANCJĄ jest UNIQUE(group_id)
  //    (dowód na żywym Postgresie: openwebui-sync.integration.test.ts) — te
  //    testy pilnują wyłącznie KOMUNIKATU, czyli tego, po co pre-check istnieje.
  it("kind:existing na grupie trzymanej przez INNĄ rolę -> wyjątek nazywający tamtą rolę, ZERO wywołań HTTP", async () => {
    storeMock.getRole.mockResolvedValue({ id: ROLE_ID, code: "hr" })
    storeMock.findGroupMappingOwner.mockResolvedValue({ roleId: "role-2", roleCode: "konsultanci" })

    const error = await attachRoleGroup({ roleId: ROLE_ID, action: { kind: "existing", groupId: GROUP_ID } }).catch(
      (caught: unknown) => caught,
    )

    expect(error).toBeInstanceOf(OpenwebuiGroupAlreadyMappedError)
    expect((error as InstanceType<typeof OpenwebuiGroupAlreadyMappedError>).conflictingRoleCode).toBe("konsultanci")
    // Sedno komunikatu: admin ma wiedzieć, KTÓRĄ rolę odpiąć.
    expect((error as Error).message).toContain("konsultanci")
    expect(storeMock.upsertRoleGroupMapping).not.toHaveBeenCalled()
    // Odmowa PRZED dotknięciem OpenWebUI — sprawdzenie jest darmowe, żądanie nie.
    expect(clientMock.getGroup).not.toHaveBeenCalled()
  })

  it("ponowne podpięcie TEJ SAMEJ grupy pod TĘ SAMĄ rolę to odświeżenie, nie konflikt", async () => {
    storeMock.getRole.mockResolvedValue({ id: ROLE_ID, code: "hr" })
    storeMock.findGroupMappingOwner.mockResolvedValue({ roleId: ROLE_ID, roleCode: "hr" })
    clientMock.getGroup.mockResolvedValue({ id: GROUP_ID, name: "cortex:hr", description: "", userIds: [] })
    storeMock.upsertRoleGroupMapping.mockResolvedValue(MAPPING)

    const result = await attachRoleGroup({ roleId: ROLE_ID, action: { kind: "existing", groupId: GROUP_ID } })

    expect("mapping" in result).toBe(true)
    expect(storeMock.upsertRoleGroupMapping).toHaveBeenCalledWith(ROLE_ID, GROUP_ID, "cortex:hr")
  })

  it("kind:create w ogóle nie pyta o właściciela — świeże id nie ma z czym kolidować", async () => {
    storeMock.getRole.mockResolvedValue({ id: ROLE_ID, code: "hr" })
    clientMock.createGroup.mockResolvedValue({ id: "nowa-grupa", name: "cortex:hr" })
    storeMock.upsertRoleGroupMapping.mockResolvedValue({ ...MAPPING, groupId: "nowa-grupa" })

    await attachRoleGroup({ roleId: ROLE_ID, action: { kind: "create" } })

    expect(storeMock.findGroupMappingOwner).not.toHaveBeenCalled()
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

/**
 * Pełne uzgodnienie kont — „Synchronizuj wszystko".
 *
 * Klient jest zamockowany i to NIE jest wygoda testowa: `OPENWEBUI_URL` na tej
 * maszynie wskazuje na realnie działający kontener `chat`, więc test
 * uderzający w prawdziwego klienta zakładałby i odcinał konta ludziom.
 */
describe("reconcileEverything — pełne uzgodnienie kont", () => {
  beforeEach(() => {
    vi.stubEnv("OPENWEBUI_URL", "https://chat.example.com")
    vi.stubEnv("OPENWEBUI_ADMIN_TOKEN", "token")
    vi.stubEnv("OPENWEBUI_SYNC_PROTECTED_EMAILS", "")
    storeMock.loadAllKnownEmails.mockResolvedValue([])
    storeMock.loadAdminEmails.mockResolvedValue([])
    storeMock.listAllRoles.mockResolvedValue([])
    clientMock.listAllUsers.mockResolvedValue([])
    clientMock.getTokenOwnerEmail.mockResolvedValue("wlasciciel@firma.pl")
    clientMock.listGroups.mockResolvedValue([])
    storeMock.loadOpenwebuiTargetUsers.mockResolvedValue([])
    storeMock.listMappedRoleIds.mockResolvedValue([])
  })

  it("TRYB DOMYŚLNY TO PODGLĄD — nie wykonuje ANI JEDNEGO zapisu", async () => {
    storeMock.loadOpenwebuiTargetUsers.mockResolvedValue([
      { email: "nowy@firma.pl", fullName: "Nowy Ktoś", isAdmin: false },
    ])

    const result = await reconcileEverything()

    expect(result.dryRun).toBe(true)
    expect(result.plan).toEqual([
      { email: "nowy@firma.pl", action: "create", detail: "załóż konto (user)" },
    ])
    expect(clientMock.createUser).not.toHaveBeenCalled()
    expect(clientMock.updateUserRole).not.toHaveBeenCalled()
  })

  it("zakłada konto dopiero przy jawnym dryRun:false", async () => {
    storeMock.loadOpenwebuiTargetUsers.mockResolvedValue([
      { email: "nowy@firma.pl", fullName: "Nowy Ktoś", isAdmin: false },
    ])

    const result = await reconcileEverything({ dryRun: false })

    expect(clientMock.createUser).toHaveBeenCalledWith(expect.anything(), {
      email: "nowy@firma.pl",
      name: "Nowy Ktoś",
      role: "user",
    })
    expect(result.applied).toBe(1)
  })

  it("rola admina bierze się z KODU roli, nie z nazwy", async () => {
    storeMock.loadOpenwebuiTargetUsers.mockResolvedValue([
      { email: "szef@firma.pl", fullName: "Szef", isAdmin: true },
    ])
    clientMock.listAllUsers.mockResolvedValue([
      { id: "u1", email: "szef@firma.pl", name: "Szef", role: "user" },
    ])

    const result = await reconcileEverything({ dryRun: false })

    expect(result.plan[0]).toMatchObject({ action: "promote-admin", detail: "user → admin" })
    expect(clientMock.updateUserRole).toHaveBeenCalledWith(expect.anything(), "u1", "admin")
  })

  it("kto stracił dostęp, dostaje pending — konto NIE jest kasowane", async () => {
    // Cel MUSI być niepusty, inaczej zadziała blokada masowego odcięcia
    // (osobny opis niżej) — a tu sprawdzamy samą ścieżkę odebrania dostępu.
    storeMock.loadOpenwebuiTargetUsers.mockResolvedValue([
      { email: "zostaje@firma.pl", fullName: "Zostaje", isAdmin: false },
    ])
    storeMock.loadAllKnownEmails.mockResolvedValue(["byly@firma.pl"])
    clientMock.listAllUsers.mockResolvedValue([
      { id: "u9", email: "zostaje@firma.pl", name: "Zostaje", role: "user" },
      { id: "u2", email: "byly@firma.pl", name: "Były", role: "user" },
    ])

    const result = await reconcileEverything({ dryRun: false })

    expect(result.plan).toContainEqual({
      email: "byly@firma.pl",
      action: "revoke",
      detail: "user → pending",
    })
    expect(clientMock.updateUserRole).toHaveBeenCalledWith(expect.anything(), "u2", "pending")
  })

  it("konto nieznane Cortexowi jest odróżniane od odebrania roli", async () => {
    clientMock.listAllUsers.mockResolvedValue([
      { id: "u3", email: "obcy@inna.pl", name: "Obcy", role: "user" },
    ])

    const result = await reconcileEverything()

    expect(result.plan[0]).toMatchObject({ action: "orphan-revoke" })
  })

  /** Bez tego pierwszy przebieg potrafi odciąć od instancji konto, którym
   *  właśnie się synchronizuje. Przeniesione z cortex-admina. */
  it("adres z listy chronionej jest pomijany w OBU kierunkach", async () => {
    vi.stubEnv("OPENWEBUI_SYNC_PROTECTED_EMAILS", "wlasciciel@firma.pl, inny@firma.pl")
    storeMock.loadOpenwebuiTargetUsers.mockResolvedValue([
      { email: "inny@firma.pl", fullName: null, isAdmin: true },
    ])
    clientMock.listAllUsers.mockResolvedValue([
      { id: "u4", email: "wlasciciel@firma.pl", name: "Właściciel", role: "admin" },
    ])

    const result = await reconcileEverything({ dryRun: false })

    expect(result.plan).toEqual([])
    expect(clientMock.updateUserRole).not.toHaveBeenCalled()
    expect(clientMock.createUser).not.toHaveBeenCalled()
  })

  it("już ustawiony pending nie generuje pozycji planu", async () => {
    clientMock.listAllUsers.mockResolvedValue([
      { id: "u5", email: "spiacy@firma.pl", name: "Śpiący", role: "pending" },
    ])

    expect((await reconcileEverything()).plan).toEqual([])
  })

  it("awaria jednej pozycji nie przerywa pozostałych", async () => {
    storeMock.loadOpenwebuiTargetUsers.mockResolvedValue([
      { email: "a@firma.pl", fullName: "A", isAdmin: false },
      { email: "b@firma.pl", fullName: "B", isAdmin: false },
    ])
    clientMock.createUser
      .mockRejectedValueOnce(new Error("sieć padła"))
      .mockResolvedValueOnce(undefined)

    const result = await reconcileEverything({ dryRun: false })

    expect(result.applied).toBe(1)
    expect(result.failures).toHaveLength(1)
    expect(result.status).toBe("failed")
  })

  it("bez konfiguracji zwraca skipped i nie woła klienta", async () => {
    vi.stubEnv("OPENWEBUI_URL", "")
    vi.stubEnv("OPENWEBUI_ADMIN_TOKEN", "")

    const result = await reconcileEverything({ dryRun: false })

    expect(result.status).toBe("skipped")
    expect(clientMock.listAllUsers).not.toHaveBeenCalled()
  })
})

/**
 * Dwa zabezpieczenia dopisane PO teście na żywej instancji (11.08.2026).
 * Stan zastany był taki: Cortex nie miał ani jednego mapowania rola→grupa,
 * OpenWebUI miało cztery konta, a właścicielem tokenu był jedyny admin.
 * Uzgodnienie w tamtym kształcie ustawiłoby `pending` wszystkim, łącznie
 * z kontem, którym się synchronizuje.
 */
describe("reconcileEverything — zabezpieczenia przed odcięciem", () => {
  beforeEach(() => {
    vi.stubEnv("OPENWEBUI_URL", "https://chat.example.com")
    vi.stubEnv("OPENWEBUI_ADMIN_TOKEN", "token")
    vi.stubEnv("OPENWEBUI_SYNC_PROTECTED_EMAILS", "")
    storeMock.loadAllKnownEmails.mockResolvedValue([])
    storeMock.loadAdminEmails.mockResolvedValue([])
    storeMock.listAllRoles.mockResolvedValue([])
    storeMock.loadOpenwebuiTargetUsers.mockResolvedValue([])
    storeMock.listMappedRoleIds.mockResolvedValue([])
    clientMock.listAllUsers.mockResolvedValue([])
    clientMock.getTokenOwnerEmail.mockResolvedValue("wlasciciel@firma.pl")
    clientMock.listGroups.mockResolvedValue([])
  })

  it("właściciel tokenu jest chroniony ZAWSZE, nawet przy pustej liście z konfiguracji", async () => {
    clientMock.getTokenOwnerEmail.mockResolvedValue("wlasciciel@firma.pl")
    clientMock.listGroups.mockResolvedValue([])
    storeMock.loadOpenwebuiTargetUsers.mockResolvedValue([
      { email: "ktos@firma.pl", fullName: "Ktoś", isAdmin: false },
    ])
    clientMock.listAllUsers.mockResolvedValue([
      { id: "u1", email: "wlasciciel@firma.pl", name: "Właściciel", role: "admin" },
      { id: "u2", email: "ktos@firma.pl", name: "Ktoś", role: "user" },
    ])

    const result = await reconcileEverything({ dryRun: false })

    expect(result.plan.map((e) => e.email)).not.toContain("wlasciciel@firma.pl")
    expect(clientMock.updateUserRole).not.toHaveBeenCalled()
  })

  it("puste źródło prawdy NIE znaczy odciecia wszystkich — zapis odmowiony", async () => {
    clientMock.listAllUsers.mockResolvedValue([
      { id: "u1", email: "anna@firma.pl", name: "Anna", role: "user" },
      { id: "u2", email: "bartek@firma.pl", name: "Bartek", role: "user" },
    ])

    const result = await reconcileEverything({ dryRun: false })

    expect(result.blocked).toMatch(/ani jednego uprawnionego/)
    expect(result.status).toBe("failed")
    expect(result.applied).toBe(0)
    expect(clientMock.updateUserRole).not.toHaveBeenCalled()
    // Plan MA być widoczny — admin musi zobaczyć, co by się stało.
    expect(result.plan).toHaveLength(2)
  })

  it("gdy jest choć jeden uprawniony, odcięcie pozostałych przechodzi normalnie", async () => {
    storeMock.loadOpenwebuiTargetUsers.mockResolvedValue([
      { email: "anna@firma.pl", fullName: "Anna", isAdmin: false },
    ])
    clientMock.listAllUsers.mockResolvedValue([
      { id: "u1", email: "anna@firma.pl", name: "Anna", role: "user" },
      { id: "u2", email: "bartek@firma.pl", name: "Bartek", role: "user" },
    ])

    const result = await reconcileEverything({ dryRun: false })

    expect(result.blocked).toBeUndefined()
    expect(clientMock.updateUserRole).toHaveBeenCalledWith(expect.anything(), "u2", "pending")
  })
})

describe("reconcileEverything — poprawki po przeglądzie", () => {
  beforeEach(() => {
    vi.stubEnv("OPENWEBUI_URL", "https://chat.example.com")
    vi.stubEnv("OPENWEBUI_ADMIN_TOKEN", "token")
    vi.stubEnv("OPENWEBUI_SYNC_PROTECTED_EMAILS", "")
    storeMock.loadAllKnownEmails.mockResolvedValue([])
    storeMock.loadAdminEmails.mockResolvedValue([])
    storeMock.listAllRoles.mockResolvedValue([])
    storeMock.loadOpenwebuiTargetUsers.mockResolvedValue([])
    storeMock.listMappedRoleIds.mockResolvedValue([])
    clientMock.listAllUsers.mockResolvedValue([])
    clientMock.getTokenOwnerEmail.mockResolvedValue("wlasciciel@firma.pl")
    clientMock.listGroups.mockResolvedValue([])
  })

  /** Fail-closed: nieznany właściciel tokenu to jedyna sytuacja, w której to
   *  zabezpieczenie ma znaczenie, więc nie wolno jej przejść dalej. */
  it("nieustalony właściciel tokenu WSTRZYMUJE uzgodnienie", async () => {
    clientMock.getTokenOwnerEmail.mockResolvedValue(null)
    storeMock.loadOpenwebuiTargetUsers.mockResolvedValue([
      { email: "ktos@firma.pl", fullName: "Ktoś", isAdmin: false },
    ])

    const result = await reconcileEverything({ dryRun: false })

    expect(result.status).toBe("failed")
    expect(result.message).toMatch(/właściciela tokenu/)
    expect(clientMock.createUser).not.toHaveBeenCalled()
  })

  /** `pending → user` to przywrócenie dostępu. Ekran potwierdzenia jest
   *  jedynym miejscem, gdzie admin decyduje, więc nie może tam stać
   *  „Odbierz admina" przy człowieku, któremu dostęp wraca. */
  it("wyjście z pending jest oznaczone jako przywrócenie, nie degradacja", async () => {
    storeMock.loadOpenwebuiTargetUsers.mockResolvedValue([
      { email: "wraca@firma.pl", fullName: "Wraca", isAdmin: false },
    ])
    clientMock.listAllUsers.mockResolvedValue([
      { id: "u1", email: "wraca@firma.pl", name: "Wraca", role: "pending" },
    ])

    const result = await reconcileEverything({ dryRun: false })

    expect(result.plan[0]).toMatchObject({ action: "restore", detail: "pending → user" })
    expect(clientMock.updateUserRole).toHaveBeenCalledWith(expect.anything(), "u1", "user")
  })

  it("awaria synchronizacji grup nie może zniknąć z komunikatu", async () => {
    storeMock.loadOpenwebuiTargetUsers.mockResolvedValue([
      { email: "a@firma.pl", fullName: "A", isAdmin: false },
    ])
    storeMock.listMappedRoleIds.mockResolvedValue(["r1"])
    storeMock.getRoleGroupMapping.mockResolvedValue({
      roleId: "r1",
      groupId: "g1",
      groupName: "cortex:x",
    })
    clientMock.getGroup.mockRejectedValue(new Error("OpenWebUI leży"))

    const result = await reconcileEverything({ dryRun: false })

    expect(result.status).toBe("failed")
    expect(result.message).toMatch(/synchronizacja grup/)
  })
})

describe("reconcileEverything — administratorzy Cortexa", () => {
  beforeEach(() => {
    vi.stubEnv("OPENWEBUI_URL", "https://chat.example.com")
    vi.stubEnv("OPENWEBUI_ADMIN_TOKEN", "token")
    vi.stubEnv("OPENWEBUI_SYNC_PROTECTED_EMAILS", "")
    storeMock.loadAllKnownEmails.mockResolvedValue([])
    storeMock.loadAdminEmails.mockResolvedValue([])
    storeMock.listAllRoles.mockResolvedValue([])
    storeMock.loadOpenwebuiTargetUsers.mockResolvedValue([])
    storeMock.listMappedRoleIds.mockResolvedValue([])
    clientMock.listAllUsers.mockResolvedValue([])
    clientMock.getTokenOwnerEmail.mockResolvedValue("wlasciciel@firma.pl")
    clientMock.listGroups.mockResolvedValue([])
  })

  /**
   * NAJGROŹNIEJSZY STAN CAŁEGO MECHANIZMU: konfiguracja CZĘŚCIOWA. Ktoś mapuje
   * grupę dla jednej roli, więc zbiór docelowy przestaje być pusty i blokada
   * masowego odcięcia się NIE odpala — a administratorzy do tego zbioru nie
   * należą i lecieliby w `pending`. Właściciel tokenu jest chroniony osobno,
   * każdy inny administrator NIE.
   */
  it("administrator Cortexa NIE jest odcinany przy częściowej konfiguracji", async () => {
    storeMock.loadOpenwebuiTargetUsers.mockResolvedValue([
      { email: "konsultant@firma.pl", fullName: "Konsultant", isAdmin: false },
    ])
    storeMock.loadAdminEmails.mockResolvedValue(["szef@firma.pl"])
    storeMock.loadAllKnownEmails.mockResolvedValue(["szef@firma.pl", "konsultant@firma.pl"])
    clientMock.listAllUsers.mockResolvedValue([
      { id: "u1", email: "konsultant@firma.pl", name: "Konsultant", role: "user" },
      { id: "u2", email: "szef@firma.pl", name: "Szef", role: "admin" },
    ])

    const result = await reconcileEverything({ dryRun: false })

    expect(result.plan.map((e) => e.email)).not.toContain("szef@firma.pl")
    expect(clientMock.updateUserRole).not.toHaveBeenCalled()
  })

  /** Zabezpieczenie jest JEDNOSTRONNE: chroni przed odebraniem, nie nadaje
   *  uprawnienia. Admin bez zmapowanej roli nadal nie dostaje konta —
   *  inaczej byłaby to druga, niezależna reguła uprawnień (odrzucona w D1a). */
  it("ochrona admina nie zakłada mu konta, gdy nie jest uprawniony", async () => {
    storeMock.loadAdminEmails.mockResolvedValue(["szef@firma.pl"])
    storeMock.loadOpenwebuiTargetUsers.mockResolvedValue([
      { email: "konsultant@firma.pl", fullName: "Konsultant", isAdmin: false },
    ])
    clientMock.listAllUsers.mockResolvedValue([])

    const result = await reconcileEverything({ dryRun: false })

    expect(result.plan.map((e) => e.email)).toEqual(["konsultant@firma.pl"])
    expect(clientMock.createUser).toHaveBeenCalledTimes(1)
  })
})

describe("reconcileEverything — działa z pudełka", () => {
  beforeEach(() => {
    vi.stubEnv("OPENWEBUI_URL", "https://chat.example.com")
    vi.stubEnv("OPENWEBUI_ADMIN_TOKEN", "token")
    vi.stubEnv("OPENWEBUI_SYNC_PROTECTED_EMAILS", "")
    storeMock.loadAllKnownEmails.mockResolvedValue([])
    storeMock.loadAdminEmails.mockResolvedValue([])
    storeMock.loadOpenwebuiTargetUsers.mockResolvedValue([])
    storeMock.listAllRoles.mockResolvedValue([])
    storeMock.listMappedRoleIds.mockResolvedValue([])
    storeMock.getRoleGroupMapping.mockResolvedValue(null)
    clientMock.listAllUsers.mockResolvedValue([])
    clientMock.getTokenOwnerEmail.mockResolvedValue("wlasciciel@firma.pl")
    clientMock.listGroups.mockResolvedValue([])
  })

  /**
   * ŚWIEŻA INSTANCJA, ZERO KONFIGURACJI. Jedno kliknięcie ma założyć grupy dla
   * ról i konta dla ludzi. Poprzednia wersja wymagała, żeby ktoś najpierw
   * ręcznie zmapował grupy — do tego czasu „Synchronizuj" nie robił nic.
   */
  it("zakłada grupę dla KAŻDEJ roli, która jej nie ma", async () => {
    storeMock.listAllRoles.mockResolvedValue([
      { id: "r1", code: "admin" },
      { id: "r2", code: "konsultanci" },
    ])
    storeMock.loadOpenwebuiTargetUsers.mockResolvedValue([
      { email: "szef@firma.pl", fullName: "Szef", isAdmin: true },
    ])

    const result = await reconcileEverything()

    expect(result.plan.filter((e) => e.action === "create-group").map((e) => e.detail)).toEqual([
      "załóż grupę cortex:admin",
      "załóż grupę cortex:konsultanci",
    ])
    expect(result.plan.some((e) => e.action === "create" && e.email === "szef@firma.pl")).toBe(true)
  })

  it("rola, która grupę już ma, nie jest zakładana drugi raz", async () => {
    storeMock.listAllRoles.mockResolvedValue([{ id: "r1", code: "admin" }])
    storeMock.getRoleGroupMapping.mockResolvedValue({
      roleId: "r1",
      groupId: "g1",
      groupName: "cortex:admin",
    })

    const result = await reconcileEverything()

    expect(result.plan.filter((e) => e.action === "create-group")).toEqual([])
  })

  /** Uprawnienie wynika z POSIADANIA ROLI, nie z istnienia mapowania —
   *  inaczej na świeżej instancji nie byłoby uprawnionych i blokada masowego
   *  odcięcia zatrzymywałaby wszystko. */
  it("administrator świeżej instancji jest uprawniony bez żadnej konfiguracji", async () => {
    storeMock.listAllRoles.mockResolvedValue([{ id: "r1", code: "admin" }])
    storeMock.loadOpenwebuiTargetUsers.mockResolvedValue([
      { email: "szef@firma.pl", fullName: "Szef", isAdmin: true },
    ])
    clientMock.listAllUsers.mockResolvedValue([])

    const result = await reconcileEverything({ dryRun: false })

    expect(result.blocked).toBeUndefined()
    expect(clientMock.createUser).toHaveBeenCalledWith(expect.anything(), {
      email: "szef@firma.pl",
      name: "Szef",
      role: "admin",
    })
  })
})

describe("reconcileEverything — grupa po nazwie, nie duplikat", () => {
  beforeEach(() => {
    vi.stubEnv("OPENWEBUI_URL", "https://chat.example.com")
    vi.stubEnv("OPENWEBUI_ADMIN_TOKEN", "token")
    vi.stubEnv("OPENWEBUI_SYNC_PROTECTED_EMAILS", "")
    storeMock.loadAllKnownEmails.mockResolvedValue([])
    storeMock.loadAdminEmails.mockResolvedValue([])
    storeMock.loadOpenwebuiTargetUsers.mockResolvedValue([])
    storeMock.listMappedRoleIds.mockResolvedValue([])
    storeMock.getRoleGroupMapping.mockResolvedValue(null)
    storeMock.listAllRoles.mockResolvedValue([{ id: "r1", code: "admin" }])
    clientMock.listAllUsers.mockResolvedValue([])
    clientMock.getTokenOwnerEmail.mockResolvedValue("wlasciciel@firma.pl")
    clientMock.listGroups.mockResolvedValue([])
  })

  /**
   * Grupa w OpenWebUI przeżywa skasowanie mapowania po naszej stronie, więc
   * bezwarunkowe tworzenie produkuje DUPLIKATY o tej samej nazwie. Zmierzone
   * na żywej instancji: dwie grupy `cortex:admin` po wyczyszczeniu mapowań
   * i ponownym uzgodnieniu.
   */
  it("istniejącą grupę o tej nazwie PODPINA, zamiast tworzyć drugą", async () => {
    clientMock.listGroups.mockResolvedValue([{ id: "g-stare", name: "cortex:admin" }])

    const result = await reconcileEverything({ dryRun: false })

    expect(result.plan[0]).toMatchObject({
      action: "create-group",
      detail: "podepnij istniejącą grupę cortex:admin",
    })
    expect(clientMock.createGroup).not.toHaveBeenCalled()
  })

  it("gdy grupy o tej nazwie nie ma, tworzy nową", async () => {
    const result = await reconcileEverything({ dryRun: false })

    expect(result.plan[0]).toMatchObject({ detail: "załóż grupę cortex:admin" })
  })
})
