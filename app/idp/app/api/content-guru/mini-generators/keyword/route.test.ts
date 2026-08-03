// Test funkcjonalny POST /api/content-guru/mini-generators/keyword — bramka
// osobno w ../../guard-coverage.test.ts. Tu: kontrakt walidacji, sanitacja
// cudzysłowów, i że NIGDY nie woła saveArchiveEntry.

import type * as CortexService from "@cortex/service"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@cortex/service/rbac-store", () => ({
  loadGrantedApplicationCodes: vi.fn(async () => ["content-guru"]),
  loadGrantedScopes: vi.fn(async () => []),
}))

const service = vi.hoisted(() => ({
  saveArchiveEntry: vi.fn(async () => {
    throw new Error("saveArchiveEntry NIE powinno być wołane przez mini-generatory")
  }),
}))
vi.mock("@cortex/service", async (importOriginal) => ({
  ...(await importOriginal<typeof CortexService>()),
  ...service,
}))

const generateContent = vi.hoisted(() => vi.fn())
vi.mock("@/lib/content-guru/integration-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/content-guru/integration-client")>()),
  generateContent,
}))

const { clearTileAccessCache } = await import("@cortex/service")
const { ContentGuruServiceError } = await import("@/lib/content-guru/integration-client")
const { POST } = await import("./route")

const EMAIL = "tworca@firma.pl"

const VALID_BODY = {
  topic: "Automatyzacja procesów finansowych",
  targetAudience: "Dyrektorzy finansowi",
  additionalInfo: "",
  model: "anthropic/claude-sonnet-4.6",
}

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/content-guru/mini-generators/keyword", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-auth-request-email": EMAIL },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  clearTileAccessCache()
  service.saveArchiveEntry.mockClear()
  generateContent.mockReset()
  vi.unstubAllEnvs()
  vi.stubEnv("NODE_ENV", "production")
  vi.stubEnv("CORTEX_PROXY_URL", "http://cortex-proxy")
  vi.stubEnv("CONTENT_GURU_MODELS", "anthropic/claude-sonnet-4.6,openai/gpt-4o-mini")
})

describe("POST /api/content-guru/mini-generators/keyword", () => {
  it("400 na zły request (brak tematu)", async () => {
    const response = await POST(makeRequest({ ...VALID_BODY, topic: "" }) as never)
    expect(response.status).toBe(400)
    expect(generateContent).not.toHaveBeenCalled()
  })

  it("happy path: zwraca frazę kluczową, temperatura 0.3", async () => {
    generateContent.mockResolvedValueOnce({
      content: "automatyzacja procesów finansowych",
      tokensUsed: 15,
      model: VALID_BODY.model,
    })

    const response = await POST(makeRequest(VALID_BODY) as never)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.keywordPhrase).toBe("automatyzacja procesów finansowych")
    expect(service.saveArchiveEntry).not.toHaveBeenCalled()

    const promptArgs = generateContent.mock.calls[0]?.[0]
    expect(promptArgs.temperature).toBe(0.3)
    expect(promptArgs.userPrompt).toContain("Automatyzacja procesów finansowych")
  })

  it("usuwa cudzysłowy otaczające całą odpowiedź modelu", async () => {
    generateContent.mockResolvedValueOnce({
      content: '"automatyzacja procesów finansowych"',
      tokensUsed: 15,
      model: VALID_BODY.model,
    })

    const response = await POST(makeRequest(VALID_BODY) as never)
    const json = await response.json()

    expect(json.keywordPhrase).toBe("automatyzacja procesów finansowych")
  })

  it("502 gdy model zwraca pustą odpowiedź", async () => {
    generateContent.mockResolvedValueOnce({ content: "   ", tokensUsed: 5, model: VALID_BODY.model })

    const response = await POST(makeRequest(VALID_BODY) as never)

    expect(response.status).toBe(502)
  })

  it("mapuje błąd upstreamu cortex-proxy na 502", async () => {
    generateContent.mockRejectedValueOnce(new ContentGuruServiceError("boom", "upstream-error"))

    const response = await POST(makeRequest(VALID_BODY) as never)

    expect(response.status).toBe(502)
  })
})
