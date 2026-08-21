// Zachowanie kontrolera GET/PUT/POST /api/system-config/roles/[id]/openwebui-group.
// Bramkę na tych handlerach pokrywa ../../../../guard-coverage.test.ts.

import { beforeEach, describe, expect, it, vi } from "vitest"

const loadGrantedApplicationCodes = vi.hoisted(() => vi.fn<(email: string) => Promise<string[]>>())
const getOpenwebuiRoleGroupMapping = vi.hoisted(() => vi.fn())
const listOpenwebuiGroups = vi.hoisted(() => vi.fn())
const openwebuiConfig = vi.hoisted(() => vi.fn())
const previewRoleGroupSync = vi.hoisted(() => vi.fn())
const attachRoleGroup = vi.hoisted(() => vi.fn())
const detachRoleGroup = vi.hoisted(() => vi.fn())
const reconcileRoleGroup = vi.hoisted(() => vi.fn())

vi.mock("@cortex/service/rbac-store", () => ({ loadGrantedApplicationCodes }))

vi.mock("@cortex/service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@cortex/service")>()
  return {
    ...actual,
    getOpenwebuiRoleGroupMapping,
    listOpenwebuiGroups,
    openwebuiConfig,
    previewRoleGroupSync,
    attachRoleGroup,
    detachRoleGroup,
    reconcileRoleGroup,
  }
})

const { OpenwebuiClientError, OpenwebuiGroupAlreadyMappedError, clearTileAccessCache } =
  await import("@cortex/service")
const { GET, PUT, POST } = await import("./route")

const ROLE_ID = "9f1d3c62-1f4a-4a6b-9f3c-2b7d5e8a1c40"
const MAPPING = {
  roleId: ROLE_ID,
  groupId: "g1",
  groupName: "cortex:hr",
  lastSyncedAt: new Date("2026-08-01T10:00:00Z"),
  lastSyncError: null,
  createdAt: new Date("2026-08-01T09:00:00Z"),
  updatedAt: new Date("2026-08-01T10:00:00Z"),
}

function makeRequest(method: string, body?: unknown): Request {
  const headers = new Headers({
    "Content-Type": "application/json",
    "x-auth-request-email": "admin@firma.pl",
  })
  return new Request("http://localhost/api/system-config/roles/x/openwebui-group", {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
}

function contextFor(id: string) {
  return { params: Promise.resolve({ id }) }
}

beforeEach(() => {
  clearTileAccessCache()
  loadGrantedApplicationCodes.mockReset()
  loadGrantedApplicationCodes.mockResolvedValue(["system-config"])
  for (const fn of [
    getOpenwebuiRoleGroupMapping,
    listOpenwebuiGroups,
    openwebuiConfig,
    previewRoleGroupSync,
    attachRoleGroup,
    detachRoleGroup,
    reconcileRoleGroup,
  ]) {
    fn.mockReset()
  }
  openwebuiConfig.mockReturnValue(null)
  getOpenwebuiRoleGroupMapping.mockResolvedValue(null)
})

describe("GET — stan mapowania", () => {
  it("brak mapowania i brak konfiguracji -> mapping: null, configured: false, availableGroups: null", async () => {
    const response = await GET(makeRequest("GET") as never, contextFor(ROLE_ID))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      mapping: null,
      configured: false,
      availableGroups: null,
    })
    expect(listOpenwebuiGroups).not.toHaveBeenCalled()
  })

  it("skonfigurowane, bez mapowania -> dociąga listę dostępnych grup", async () => {
    openwebuiConfig.mockReturnValue({ baseUrl: "http://chat", adminToken: "t" })
    listOpenwebuiGroups.mockResolvedValue([{ id: "g1", name: "cortex:hr" }])

    const response = await GET(makeRequest("GET") as never, contextFor(ROLE_ID))

    expect(await response.json()).toEqual({
      mapping: null,
      configured: true,
      availableGroups: [{ id: "g1", name: "cortex:hr" }],
    })
  })

  it("z mapowaniem -> serializuje daty do ISO i dołącza podgląd (previewRoleGroupSync)", async () => {
    getOpenwebuiRoleGroupMapping.mockResolvedValue(MAPPING)
    previewRoleGroupSync.mockResolvedValue({
      status: "ok",
      groupName: "cortex:hr",
      targetCount: 3,
      toAdd: 1,
      toRemove: 0,
    })

    const response = await GET(makeRequest("GET") as never, contextFor(ROLE_ID))
    const body = (await response.json()) as { mapping: { lastSyncedAt: string } }

    expect(body.mapping).toEqual({
      groupId: "g1",
      groupName: "cortex:hr",
      lastSyncedAt: "2026-08-01T10:00:00.000Z",
      lastSyncError: null,
    })
    expect(previewRoleGroupSync).toHaveBeenCalledWith(ROLE_ID)
  })

  it("odrzuca identyfikator, który nie jest UUID", async () => {
    const response = await GET(makeRequest("GET") as never, contextFor("nie-uuid"))

    expect(response.status).toBe(400)
    expect(getOpenwebuiRoleGroupMapping).not.toHaveBeenCalled()
  })
})

describe("PUT — podepnij/odepnij", () => {
  it("action:create -> 200 z zapisanym mapowaniem", async () => {
    attachRoleGroup.mockResolvedValue({ mapping: MAPPING })

    const response = await PUT(
      makeRequest("PUT", { action: "create" }) as never,
      contextFor(ROLE_ID),
    )

    expect(response.status).toBe(200)
    expect(attachRoleGroup).toHaveBeenCalledWith({ roleId: ROLE_ID, action: { kind: "create" } })
  })

  it("action:existing przekazuje groupId adapterowi", async () => {
    attachRoleGroup.mockResolvedValue({ mapping: MAPPING })

    await PUT(
      makeRequest("PUT", { action: "existing", groupId: "g9" }) as never,
      contextFor(ROLE_ID),
    )

    expect(attachRoleGroup).toHaveBeenCalledWith({
      roleId: ROLE_ID,
      action: { kind: "existing", groupId: "g9" },
    })
  })

  it("action:detach -> woła detachRoleGroup, nie attachRoleGroup", async () => {
    detachRoleGroup.mockResolvedValue(true)

    const response = await PUT(
      makeRequest("PUT", { action: "detach" }) as never,
      contextFor(ROLE_ID),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, detached: true })
    expect(attachRoleGroup).not.toHaveBeenCalled()
  })

  it("not-configured -> 503", async () => {
    attachRoleGroup.mockResolvedValue({ error: "not-configured" })

    const response = await PUT(
      makeRequest("PUT", { action: "create" }) as never,
      contextFor(ROLE_ID),
    )

    expect(response.status).toBe(503)
  })

  it("unknown-role -> 404", async () => {
    attachRoleGroup.mockResolvedValue({ error: "unknown-role" })

    const response = await PUT(
      makeRequest("PUT", { action: "create" }) as never,
      contextFor(ROLE_ID),
    )

    expect(response.status).toBe(404)
  })

  it("group-not-found -> 404", async () => {
    attachRoleGroup.mockResolvedValue({ error: "group-not-found" })

    const response = await PUT(
      makeRequest("PUT", { action: "existing", groupId: "brak" }) as never,
      contextFor(ROLE_ID),
    )

    expect(response.status).toBe(404)
  })

  // Kod kolidującej roli jedzie PARAMETREM klucza, nie w gotowym zdaniu —
  // `toEqual` na pełnym ciele dowodzi, że `message` już z niego nie wychodzi.
  it("grupa trzymana przez inną rolę -> 409 z kluczem nazywającym tamtą rolę, NIE 500", async () => {
    attachRoleGroup.mockRejectedValue(new OpenwebuiGroupAlreadyMappedError("konsultanci"))

    const response = await PUT(
      makeRequest("PUT", { action: "existing", groupId: "g9" }) as never,
      contextFor(ROLE_ID),
    )

    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({
      error: "openwebui-group-already-mapped",
      messageKey: "errors.openwebuiGroupAlreadyMapped",
      messageParams: { role: "konsultanci" },
    })
  })

  it("awaria HTTP OpenWebUI (OpenwebuiClientError) -> 502, bez rzucenia dalej", async () => {
    attachRoleGroup.mockRejectedValue(
      new OpenwebuiClientError("upstream-error", "OpenWebUI zwrócił 500"),
    )

    const response = await PUT(
      makeRequest("PUT", { action: "create" }) as never,
      contextFor(ROLE_ID),
    )

    expect(response.status).toBe(502)
  })

  it.each([
    { label: "brak action", body: {} },
    { label: "action nieznany", body: { action: "wipe-everything" } },
    { label: "existing bez groupId", body: { action: "existing" } },
  ])("odrzuca niepoprawne ciało: $label", async ({ body }) => {
    const response = await PUT(makeRequest("PUT", body) as never, contextFor(ROLE_ID))

    expect(response.status).toBe(400)
    expect(attachRoleGroup).not.toHaveBeenCalled()
    expect(detachRoleGroup).not.toHaveBeenCalled()
  })

  it("odrzuca identyfikator, który nie jest UUID", async () => {
    const response = await PUT(
      makeRequest("PUT", { action: "detach" }) as never,
      contextFor("../../etc"),
    )

    expect(response.status).toBe(400)
    expect(detachRoleGroup).not.toHaveBeenCalled()
  })
})

describe("POST — Synchronizuj teraz", () => {
  it("woła reconcileRoleGroup dla TEJ jednej roli i zwraca jej wynik", async () => {
    reconcileRoleGroup.mockResolvedValue({ status: "ok" })

    const response = await POST(makeRequest("POST") as never, contextFor(ROLE_ID))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ openwebuiSync: { status: "ok" } })
    expect(reconcileRoleGroup).toHaveBeenCalledWith(ROLE_ID)
  })

  it("nieskonfigurowane -> nadal 200 (skipped, nie błąd)", async () => {
    reconcileRoleGroup.mockResolvedValue({ status: "skipped" })

    const response = await POST(makeRequest("POST") as never, contextFor(ROLE_ID))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ openwebuiSync: { status: "skipped" } })
  })

  it("odrzuca identyfikator, który nie jest UUID", async () => {
    const response = await POST(makeRequest("POST") as never, contextFor("nie-uuid"))

    expect(response.status).toBe(400)
    expect(reconcileRoleGroup).not.toHaveBeenCalled()
  })
})
