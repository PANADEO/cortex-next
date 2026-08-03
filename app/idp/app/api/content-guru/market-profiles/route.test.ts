// Test funkcjonalny GET/POST /api/content-guru/market-profiles — mirror
// client-profiles/route.test.ts. Bramka osobno w ../guard-coverage.test.ts.

import type * as CortexService from "@cortex/service"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@cortex/service/rbac-store", () => ({
  loadGrantedApplicationCodes: vi.fn(async () => ["content-guru"]),
  loadGrantedScopes: vi.fn(async () => []),
}))

const service = vi.hoisted(() => ({
  listMyMarketProfiles: vi.fn(async () => [] as unknown[]),
  createMarketProfile: vi.fn(async (userEmail: string, input: { profileName: string }) => ({
    id: "profile-1",
    userEmail,
    ...input,
  })),
}))
vi.mock("@cortex/service", async (importOriginal) => ({
  ...(await importOriginal<typeof CortexService>()),
  ...service,
}))

const { clearTileAccessCache } = await import("@cortex/service")
const { GET, POST } = await import("./route")

const EMAIL = "user@firma.pl"

function makeRequest(method: string, body?: unknown): Request {
  const headers = new Headers({ "Content-Type": "application/json", "x-auth-request-email": EMAIL })
  return new Request("http://localhost/api/content-guru/market-profiles", {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
}

beforeEach(() => {
  clearTileAccessCache()
  service.listMyMarketProfiles.mockClear()
  service.createMarketProfile.mockClear()
  vi.unstubAllEnvs()
  vi.stubEnv("NODE_ENV", "production")
})

describe("GET /api/content-guru/market-profiles", () => {
  it("woła listMyMarketProfiles z access.email, nigdy z body/query", async () => {
    await GET(makeRequest("GET") as never)
    expect(service.listMyMarketProfiles).toHaveBeenCalledWith(EMAIL)
  })
})

describe("POST /api/content-guru/market-profiles", () => {
  it("400 na zły request (brak profileName)", async () => {
    const response = await POST(makeRequest("POST", { description: "x" }) as never)
    expect(response.status).toBe(400)
    expect(service.createMarketProfile).not.toHaveBeenCalled()
  })

  it("201 happy path, userEmail wyłącznie z gate", async () => {
    const response = await POST(
      makeRequest("POST", {
        profileName: "Rynek IT",
        sizeTrends: "Rośnie",
        userEmail: "intruz@obca-firma.pl",
      }) as never,
    )
    const json = await response.json()

    expect(response.status).toBe(201)
    expect(service.createMarketProfile).toHaveBeenCalledWith(
      EMAIL,
      expect.objectContaining({ profileName: "Rynek IT", sizeTrends: "Rośnie" }),
    )
    expect(json.userEmail).toBe(EMAIL)
  })

  it("409 na naruszenie unikalności profileName per user", async () => {
    service.createMarketProfile.mockRejectedValueOnce(
      Object.assign(new Error("duplicate key"), { code: "23505" }),
    )
    const response = await POST(makeRequest("POST", { profileName: "Rynek IT" }) as never)
    expect(response.status).toBe(409)
  })
})
