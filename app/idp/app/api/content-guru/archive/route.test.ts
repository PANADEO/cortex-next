// Test funkcjonalny GET /api/content-guru/archive — bramka jest osobno w
// ../guard-coverage.test.ts. Tu: scoping do access.email (nigdy z body/
// query), przekazanie realnego wyniku listMyArchive() bez modyfikacji.

import type * as CortexService from "@cortex/service"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@cortex/service/rbac-store", () => ({
  loadGrantedApplicationCodes: vi.fn(async () => ["content-guru"]),
  loadGrantedScopes: vi.fn(async () => []),
}))

const ENTRY = {
  id: "archive-1",
  userEmail: "user@firma.pl",
  contentType: "Rekrutacja — Post na LinkedIn",
  topic: "Nowa rekrutacja",
  generatedContent: "Treść wygenerowana.",
  status: "done" as const,
  matchedForbiddenPhrases: null,
  targetAudience: null,
  additionalInfo: null,
  keywordPhrase: null,
  metaDescription: null,
  modelUsed: "anthropic/claude-sonnet-4.6",
  clientProfileId: null,
  marketProfileId: null,
  metadata: { generationMode: "single" },
  createdAt: new Date("2026-08-03T00:00:00Z"),
}

const service = vi.hoisted(() => ({
  listMyArchive: vi.fn(async () => [] as unknown[]),
}))
vi.mock("@cortex/service", async (importOriginal) => ({
  ...(await importOriginal<typeof CortexService>()),
  ...service,
}))

const { clearTileAccessCache } = await import("@cortex/service")
const { GET } = await import("./route")

const EMAIL = "user@firma.pl"

function makeRequest(): Request {
  return new Request("http://localhost/api/content-guru/archive", {
    method: "GET",
    headers: { "x-auth-request-email": EMAIL },
  })
}

beforeEach(() => {
  clearTileAccessCache()
  service.listMyArchive.mockClear()
  vi.unstubAllEnvs()
  vi.stubEnv("NODE_ENV", "production")
})

describe("GET /api/content-guru/archive", () => {
  it("woła listMyArchive z access.email, nigdy z body/query", async () => {
    await GET(makeRequest() as never)
    expect(service.listMyArchive).toHaveBeenCalledWith(EMAIL)
  })

  it("zwraca dokładnie to, co odda listMyArchive (kontrolerski przekaz bez transformacji)", async () => {
    service.listMyArchive.mockResolvedValueOnce([ENTRY])

    const response = await GET(makeRequest() as never)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toHaveLength(1)
    expect(json[0]).toMatchObject({ id: "archive-1", contentType: "Rekrutacja — Post na LinkedIn" })
  })
})
