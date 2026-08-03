// Test funkcjonalny GET/POST /api/content-guru/client-profiles — bramka jest
// osobno w ../guard-coverage.test.ts. Tu: scoping do access.email (nigdy z
// ciała żądania) i kontrakt walidacji.

import type * as CortexService from "@cortex/service"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@cortex/service/rbac-store", () => ({
  loadGrantedApplicationCodes: vi.fn(async () => ["content-guru"]),
  loadGrantedScopes: vi.fn(async () => []),
}))

const service = vi.hoisted(() => ({
  listMyClientProfiles: vi.fn(async () => [] as unknown[]),
  createClientProfile: vi.fn(async (userEmail: string, input: { profileName: string }) => ({
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
  return new Request("http://localhost/api/content-guru/client-profiles", {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
}

beforeEach(() => {
  clearTileAccessCache()
  service.listMyClientProfiles.mockClear()
  service.createClientProfile.mockClear()
  vi.unstubAllEnvs()
  vi.stubEnv("NODE_ENV", "production")
})

describe("GET /api/content-guru/client-profiles", () => {
  it("woła listMyClientProfiles z access.email, nigdy z body/query", async () => {
    await GET(makeRequest("GET") as never)
    expect(service.listMyClientProfiles).toHaveBeenCalledWith(EMAIL)
  })
})

describe("POST /api/content-guru/client-profiles", () => {
  it("400 na zły request (brak profileName)", async () => {
    const response = await POST(makeRequest("POST", { history: "x" }) as never)
    expect(response.status).toBe(400)
    expect(service.createClientProfile).not.toHaveBeenCalled()
  })

  it("201 happy path, userEmail wyłącznie z gate (ignoruje userEmail w body, gdyby ktoś je podesłał)", async () => {
    const response = await POST(
      makeRequest("POST", {
        profileName: "Acme",
        history: "Firma od 2010",
        userEmail: "intruz@obca-firma.pl",
      }) as never,
    )
    const json = await response.json()

    expect(response.status).toBe(201)
    expect(service.createClientProfile).toHaveBeenCalledWith(
      EMAIL,
      expect.objectContaining({ profileName: "Acme", history: "Firma od 2010" }),
    )
    expect(json.userEmail).toBe(EMAIL)
  })

  it("puste opcjonalne pola normalizują się do null, nie pustego stringa", async () => {
    await POST(makeRequest("POST", { profileName: "Acme", history: "" }) as never)
    expect(service.createClientProfile).toHaveBeenCalledWith(
      EMAIL,
      expect.objectContaining({ history: null }),
    )
  })

  it("409 na naruszenie unikalności profileName per user", async () => {
    service.createClientProfile.mockRejectedValueOnce(
      Object.assign(new Error("duplicate key"), { code: "23505" }),
    )
    const response = await POST(makeRequest("POST", { profileName: "Acme" }) as never)
    expect(response.status).toBe(409)
  })
})
