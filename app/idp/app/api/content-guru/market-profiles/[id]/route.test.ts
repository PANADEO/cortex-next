// Test funkcjonalny GET/PUT/DELETE /api/content-guru/market-profiles/:id —
// mirror client-profiles/[id]/route.test.ts. Bramka osobno w
// ../../guard-coverage.test.ts.

import type * as CortexService from "@cortex/service"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@cortex/service/rbac-store", () => ({
  loadGrantedApplicationCodes: vi.fn(async () => ["content-guru"]),
  loadGrantedScopes: vi.fn(async () => []),
}))

const service = vi.hoisted(() => ({
  getMyMarketProfile: vi.fn(async (userEmail: string, id: string) =>
    id === "foreign-or-missing" ? undefined : { id, userEmail, profileName: "Rynek IT" },
  ),
  updateMyMarketProfile: vi.fn(
    async (userEmail: string, id: string, input: { profileName: string }) =>
      id === "foreign-or-missing" ? undefined : { id, userEmail, ...input },
  ),
  deleteMyMarketProfile: vi.fn(
    async (_userEmail: string, id: string) => id !== "foreign-or-missing",
  ),
}))
vi.mock("@cortex/service", async (importOriginal) => ({
  ...(await importOriginal<typeof CortexService>()),
  ...service,
}))

const { clearTileAccessCache } = await import("@cortex/service")
const { GET, PUT, DELETE } = await import("./route")

const EMAIL = "user@firma.pl"

function makeRequest(method: string, body?: unknown): Request {
  const headers = new Headers({ "Content-Type": "application/json", "x-auth-request-email": EMAIL })
  return new Request("http://localhost/api/content-guru/market-profiles/probe", {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
}

function ctx(id: string) {
  return { params: Promise.resolve({ id }) }
}

beforeEach(() => {
  clearTileAccessCache()
  for (const fn of Object.values(service)) fn.mockClear()
  vi.unstubAllEnvs()
  vi.stubEnv("NODE_ENV", "production")
})

describe("GET /api/content-guru/market-profiles/:id", () => {
  it("200 dla własnego profilu", async () => {
    const response = await GET(makeRequest("GET") as never, ctx("1"))
    expect(response.status).toBe(200)
    expect(service.getMyMarketProfile).toHaveBeenCalledWith(EMAIL, "1")
  })

  it("404 (nigdy 403) dla cudzego/nieistniejącego", async () => {
    const response = await GET(makeRequest("GET") as never, ctx("foreign-or-missing"))
    expect(response.status).toBe(404)
  })
})

describe("PUT /api/content-guru/market-profiles/:id", () => {
  it("200 happy path", async () => {
    const response = await PUT(makeRequest("PUT", { profileName: "Nowa nazwa" }) as never, ctx("1"))
    expect(response.status).toBe(200)
  })

  it("404 dla cudzego/nieistniejącego", async () => {
    const response = await PUT(
      makeRequest("PUT", { profileName: "X" }) as never,
      ctx("foreign-or-missing"),
    )
    expect(response.status).toBe(404)
  })
})

describe("DELETE /api/content-guru/market-profiles/:id", () => {
  it("200 happy path", async () => {
    const response = await DELETE(makeRequest("DELETE") as never, ctx("1"))
    expect(response.status).toBe(200)
  })

  it("404 dla cudzego/nieistniejącego", async () => {
    const response = await DELETE(makeRequest("DELETE") as never, ctx("foreign-or-missing"))
    expect(response.status).toBe(404)
  })
})
