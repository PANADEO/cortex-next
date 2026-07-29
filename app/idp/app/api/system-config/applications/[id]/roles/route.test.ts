// Endpoint nadawania rolom dostępu do aplikacji — brakujące ogniwo z findingu
// #4 (setRoleApplications istniało, ale nie dało się go wywołać z UI).
// Bramkę na tych handlerach pokrywa ../../../guard-coverage.test.ts.

import { beforeEach, describe, expect, it, vi } from "vitest"

const loadGrantedApplicationCodes = vi.hoisted(() => vi.fn<(email: string) => Promise<string[]>>())
const listApplicationRoleIds = vi.hoisted(() => vi.fn())
const setApplicationRoles = vi.hoisted(() => vi.fn())

vi.mock("@cortex/service/rbac-store", () => ({ loadGrantedApplicationCodes }))

vi.mock("@cortex/service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@cortex/service")>()
  return { ...actual, listApplicationRoleIds, setApplicationRoles }
})

const { UnknownApplicationError, UnknownRoleError, clearTileAccessCache } =
  await import("@cortex/service")
const { GET, PUT } = await import("./route")

const APPLICATION_ID = "9f1d3c62-1f4a-4a6b-9f3c-2b7d5e8a1c40"
const ROLE_ID = "3a2b1c40-5d6e-4f70-8a9b-0c1d2e3f4a5b"

function makeRequest(method: string, body?: unknown): Request {
  const headers = new Headers({
    "Content-Type": "application/json",
    "x-auth-request-email": "admin@firma.pl",
  })
  return new Request("http://localhost/api/system-config/applications/x/roles", {
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
  listApplicationRoleIds.mockReset()
  listApplicationRoleIds.mockResolvedValue([])
  setApplicationRoles.mockReset()
  vi.unstubAllEnvs()
  vi.stubEnv("NODE_ENV", "production")
})

describe("GET — role z dostępem do aplikacji", () => {
  it("zwraca listę identyfikatorów ról", async () => {
    listApplicationRoleIds.mockResolvedValue([ROLE_ID])

    const response = await GET(makeRequest("GET") as never, contextFor(APPLICATION_ID))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ roleIds: [ROLE_ID] })
  })

  it("odrzuca identyfikator, który nie jest UUID", async () => {
    const response = await GET(makeRequest("GET") as never, contextFor("nie-uuid"))

    expect(response.status).toBe(400)
    expect(listApplicationRoleIds).not.toHaveBeenCalled()
  })
})

describe("PUT — zapis grantów", () => {
  it("zapisuje wskazane role", async () => {
    setApplicationRoles.mockResolvedValue(undefined)

    const response = await PUT(
      makeRequest("PUT", { roleIds: [ROLE_ID] }) as never,
      contextFor(APPLICATION_ID),
    )

    expect(response.status).toBe(200)
    expect(setApplicationRoles).toHaveBeenCalledWith(APPLICATION_ID, [ROLE_ID])
  })

  it("pusta lista ról odbiera dostęp wszystkim", async () => {
    setApplicationRoles.mockResolvedValue(undefined)

    const response = await PUT(makeRequest("PUT", { roleIds: [] }) as never, contextFor(APPLICATION_ID))

    expect(response.status).toBe(200)
    expect(setApplicationRoles).toHaveBeenCalledWith(APPLICATION_ID, [])
  })

  it.each([
    { label: "brak pola roleIds", body: {} },
    { label: "roleIds nie jest tablicą", body: { roleIds: "admin" } },
    { label: "element nie jest UUID", body: { roleIds: ["admin"] } },
  ])("odrzuca niepoprawne ciało: $label", async ({ body }) => {
    const response = await PUT(makeRequest("PUT", body) as never, contextFor(APPLICATION_ID))

    expect(response.status).toBe(400)
    expect(setApplicationRoles).not.toHaveBeenCalled()
  })

  it("odrzuca identyfikator, który nie jest UUID", async () => {
    const response = await PUT(makeRequest("PUT", { roleIds: [] }) as never, contextFor("../../etc"))

    expect(response.status).toBe(400)
    expect(setApplicationRoles).not.toHaveBeenCalled()
  })

  it("nieznana aplikacja daje 404", async () => {
    setApplicationRoles.mockRejectedValue(new UnknownApplicationError())

    const response = await PUT(makeRequest("PUT", { roleIds: [] }) as never, contextFor(APPLICATION_ID))

    expect(response.status).toBe(404)
  })

  it("nieznana rola daje 400", async () => {
    setApplicationRoles.mockRejectedValue(new UnknownRoleError())

    const response = await PUT(
      makeRequest("PUT", { roleIds: [ROLE_ID] }) as never,
      contextFor(APPLICATION_ID),
    )

    expect(response.status).toBe(400)
  })
})
