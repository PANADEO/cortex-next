// Test funkcjonalny GET /api/content-guru/archive/:id — bramka jest osobno
// w ../../guard-coverage.test.ts. Tu: scoping do access.email, i kluczowa
// własność code-service "Rekordy per-user" pkt 2 — undefined (nie istnieje
// ALBO cudze) mapowane na 404, nigdy 403 (nie zdradza istnienia cudzego id).

import type * as CortexService from "@cortex/service"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@cortex/service/rbac-store", () => ({
  loadGrantedApplicationCodes: vi.fn(async () => ["content-guru"]),
  loadGrantedScopes: vi.fn(async () => []),
}))

const service = vi.hoisted(() => ({
  getMyArchiveEntry: vi.fn(async () => undefined as unknown),
}))
vi.mock("@cortex/service", async (importOriginal) => ({
  ...(await importOriginal<typeof CortexService>()),
  ...service,
}))

const { clearTileAccessCache } = await import("@cortex/service")
const { GET } = await import("./route")

const EMAIL = "user@firma.pl"
const ENTRY_ID = "11111111-1111-1111-1111-111111111111"

function makeRequest(): Request {
  return new Request(`http://localhost/api/content-guru/archive/${ENTRY_ID}`, {
    method: "GET",
    headers: { "x-auth-request-email": EMAIL },
  })
}

const context = { params: Promise.resolve({ id: ENTRY_ID }) }

beforeEach(() => {
  clearTileAccessCache()
  service.getMyArchiveEntry.mockReset()
  service.getMyArchiveEntry.mockResolvedValue(undefined)
  vi.unstubAllEnvs()
  vi.stubEnv("NODE_ENV", "production")
})

describe("GET /api/content-guru/archive/:id", () => {
  it("woła getMyArchiveEntry z (access.email, id z URL)", async () => {
    await GET(makeRequest() as never, context)
    expect(service.getMyArchiveEntry).toHaveBeenCalledWith(EMAIL, ENTRY_ID)
  })

  it("404 gdy wpis nie istnieje", async () => {
    const response = await GET(makeRequest() as never, context)
    expect(response.status).toBe(404)
  })

  it("404 (nigdy 403) gdy wpis istnieje, ale należy do kogoś innego — getMyArchiveEntry już filtruje po userEmail, więc zwraca undefined identycznie jak dla nieistniejącego id", async () => {
    service.getMyArchiveEntry.mockResolvedValueOnce(undefined)
    const response = await GET(makeRequest() as never, context)
    expect(response.status).toBe(404)
    expect(response.status).not.toBe(403)
  })

  it("200 z pełnym wpisem, gdy istnieje i należy do usera", async () => {
    service.getMyArchiveEntry.mockResolvedValueOnce({
      id: ENTRY_ID,
      userEmail: EMAIL,
      contentType: "Rekrutacja — Post na LinkedIn",
      topic: "Nowa rekrutacja",
      generatedContent: "Treść wygenerowana.",
      status: "done",
      matchedForbiddenPhrases: null,
      targetAudience: null,
      additionalInfo: null,
      keywordPhrase: null,
      metaDescription: null,
      modelUsed: "anthropic/claude-sonnet-4.6",
      clientProfileId: null,
      marketProfileId: null,
      metadata: {},
      createdAt: new Date("2026-08-03T00:00:00Z"),
    })

    const response = await GET(makeRequest() as never, context)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.id).toBe(ENTRY_ID)
    expect(json.generatedContent).toBe("Treść wygenerowana.")
  })
})
