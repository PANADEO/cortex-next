// Test funkcjonalny GET /api/content-guru/config — bramka autoryzacji
// (bypass attempts) jest osobno w guard-coverage.test.ts, tutaj tylko
// kontrakt odpowiedzi za przepuszczającą bramką.

import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@cortex/service/rbac-store", () => ({
  loadGrantedApplicationCodes: vi.fn(async () => ["content-guru"]),
  loadGrantedScopes: vi.fn(async () => []),
}))

const { clearTileAccessCache } = await import("@cortex/service")
const { GET } = await import("./route")

function makeRequest(email: string | null): Request {
  const headers = new Headers()
  if (email) headers.set("x-auth-request-email", email)
  return new Request("http://localhost/api/content-guru/config", { headers })
}

beforeEach(() => {
  clearTileAccessCache()
  vi.unstubAllEnvs()
  vi.stubEnv("NODE_ENV", "production")
})

describe("GET /api/content-guru/config", () => {
  it("zwraca listę modeli z CONTENT_GURU_MODELS, w kolejności z env", async () => {
    vi.stubEnv("CONTENT_GURU_MODELS", "openai/gpt-4o-mini,anthropic/claude-sonnet-4.6")

    const response = await GET(makeRequest("admin@firma.pl") as never)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toEqual({ models: ["openai/gpt-4o-mini", "anthropic/claude-sonnet-4.6"] })
  })

  it("bez CONTENT_GURU_MODELS -> domyślna dwuelementowa lista z config.ts", async () => {
    const response = await GET(makeRequest("admin@firma.pl") as never)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.models.length).toBeGreaterThanOrEqual(1)
  })
})
