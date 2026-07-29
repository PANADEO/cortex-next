// Zachowanie kontrolera PUT /api/system-config/users/[id]/roles.
// Bramkę na tym handlerze pokrywa ../../../guard-coverage.test.ts.

import { beforeEach, describe, expect, it, vi } from "vitest"

const loadGrantedApplicationCodes = vi.hoisted(() => vi.fn<(email: string) => Promise<string[]>>())
const setUserRoles = vi.hoisted(() => vi.fn())

vi.mock("@cortex/service/rbac-store", () => ({ loadGrantedApplicationCodes }))

vi.mock("@cortex/service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@cortex/service")>()
  return { ...actual, setUserRoles }
})

const { UnknownRoleError, UnknownUserError, clearTileAccessCache } = await import("@cortex/service")
const { PUT } = await import("./route")

const USER_ID = "9f1d3c62-1f4a-4a6b-9f3c-2b7d5e8a1c40"
const ROLE_ID = "3a2b1c40-5d6e-4f70-8a9b-0c1d2e3f4a5b"

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/system-config/users/x/roles", {
    method: "PUT",
    headers: new Headers({
      "Content-Type": "application/json",
      "x-auth-request-email": "admin@firma.pl",
    }),
    body: JSON.stringify(body),
  })
}

function contextFor(id: string) {
  return { params: Promise.resolve({ id }) }
}

beforeEach(() => {
  clearTileAccessCache()
  loadGrantedApplicationCodes.mockReset()
  loadGrantedApplicationCodes.mockResolvedValue(["system-config"])
  setUserRoles.mockReset()
  vi.unstubAllEnvs()
  vi.stubEnv("NODE_ENV", "production")
})

describe("PUT /users/[id]/roles", () => {
  it("zapisuje role użytkownika", async () => {
    setUserRoles.mockResolvedValue(undefined)

    const response = await PUT(makeRequest({ roleIds: [ROLE_ID] }) as never, contextFor(USER_ID))

    expect(response.status).toBe(200)
    expect(setUserRoles).toHaveBeenCalledWith(USER_ID, [ROLE_ID])
  })

  it.each(["nie-uuid", "1 OR 1=1", "%2e%2e%2f"])(
    "odrzuca id [%s] jako 400, nie oddaje go bazie",
    async (id) => {
      const response = await PUT(makeRequest({ roleIds: [] }) as never, contextFor(id))

      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({ error: "invalid-id" })
      expect(setUserRoles).not.toHaveBeenCalled()
    },
  )

  it("nieznany użytkownik daje 404", async () => {
    setUserRoles.mockRejectedValue(new UnknownUserError(USER_ID))

    const response = await PUT(makeRequest({ roleIds: [] }) as never, contextFor(USER_ID))

    expect(response.status).toBe(404)
  })

  it("nieznana rola daje 400", async () => {
    setUserRoles.mockRejectedValue(new UnknownRoleError())

    const response = await PUT(makeRequest({ roleIds: [ROLE_ID] }) as never, contextFor(USER_ID))

    expect(response.status).toBe(400)
  })
})
