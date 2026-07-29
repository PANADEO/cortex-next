// Zachowanie kontrolera PATCH/DELETE /api/system-config/applications/[id]:
// walidacja identyfikatora ze ścieżki i mapowanie odmowy samo-zablokowania na
// 409. Bramkę na tych handlerach pokrywa ../../guard-coverage.test.ts.

import { beforeEach, describe, expect, it, vi } from "vitest"

const loadGrantedApplicationCodes = vi.hoisted(() => vi.fn<(email: string) => Promise<string[]>>())
const updateApplication = vi.hoisted(() => vi.fn())
const deleteApplication = vi.hoisted(() => vi.fn())

vi.mock("@cortex/service/rbac-store", () => ({ loadGrantedApplicationCodes }))

vi.mock("@cortex/service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@cortex/service")>()
  return { ...actual, updateApplication, deleteApplication }
})

const { SelfLockoutError, clearTileAccessCache } = await import("@cortex/service")
const { DELETE, PATCH } = await import("./route")

const APPLICATION_ID = "9f1d3c62-1f4a-4a6b-9f3c-2b7d5e8a1c40"

const VALID_BODY = {
  code: "raportowanie-tokenow",
  name: "Raportowanie Tokenów",
  kind: "native",
  route: "/raportowanie-tokenow",
}

function makeRequest(method: string, body?: unknown): Request {
  const headers = new Headers({
    "Content-Type": "application/json",
    "x-auth-request-email": "admin@firma.pl",
  })
  return new Request("http://localhost/api/system-config/applications/x", {
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
  updateApplication.mockReset()
  deleteApplication.mockReset()
  vi.unstubAllEnvs()
  vi.stubEnv("NODE_ENV", "production")
})

describe("walidacja identyfikatora ze ścieżki", () => {
  const notUuids = ["nie-uuid", "1", "'; drop table applications; --", "00000000-0000-0000-0000"]

  it.each(notUuids)("PATCH z id [%s] daje 400, nie 500", async (id) => {
    const response = await PATCH(makeRequest("PATCH", VALID_BODY) as never, contextFor(id))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: "invalid-id" })
    expect(updateApplication).not.toHaveBeenCalled()
  })

  it.each(notUuids)("DELETE z id [%s] daje 400, nie 500", async (id) => {
    const response = await DELETE(makeRequest("DELETE") as never, contextFor(id))

    expect(response.status).toBe(400)
    expect(deleteApplication).not.toHaveBeenCalled()
  })
})

describe("ochrona przed samo-zablokowaniem", () => {
  it("PATCH odrzucony przez serwis wraca jako 409 z komunikatem", async () => {
    updateApplication.mockRejectedValue(
      new SelfLockoutError("Nie można dezaktywować aplikacji Konfiguracja Systemu"),
    )

    const response = await PATCH(
      makeRequest("PATCH", { ...VALID_BODY, isActive: false }) as never,
      contextFor(APPLICATION_ID),
    )
    const body = (await response.json()) as { error: string; message: string }

    expect(response.status).toBe(409)
    expect(body.error).toBe("self-lockout")
    expect(body.message).toContain("Konfiguracja Systemu")
  })

  it("DELETE odrzucony przez serwis wraca jako 409", async () => {
    deleteApplication.mockRejectedValue(new SelfLockoutError("Nie można usunąć"))

    const response = await DELETE(makeRequest("DELETE") as never, contextFor(APPLICATION_ID))

    expect(response.status).toBe(409)
    expect((await response.json()).error).toBe("self-lockout")
  })
})

describe("ścieżki podstawowe", () => {
  it("PATCH nieistniejącej aplikacji daje 404", async () => {
    updateApplication.mockResolvedValue(null)

    const response = await PATCH(
      makeRequest("PATCH", VALID_BODY) as never,
      contextFor(APPLICATION_ID),
    )

    expect(response.status).toBe(404)
  })

  it("PATCH z niepoprawnym ciałem daje 400 przed dotknięciem serwisu", async () => {
    const response = await PATCH(
      makeRequest("PATCH", { code: "ZŁY KOD", name: "x", kind: "native" }) as never,
      contextFor(APPLICATION_ID),
    )

    expect(response.status).toBe(400)
    expect(updateApplication).not.toHaveBeenCalled()
  })

  it("DELETE nieistniejącej aplikacji daje 404", async () => {
    deleteApplication.mockResolvedValue(false)

    const response = await DELETE(makeRequest("DELETE") as never, contextFor(APPLICATION_ID))

    expect(response.status).toBe(404)
  })
})
