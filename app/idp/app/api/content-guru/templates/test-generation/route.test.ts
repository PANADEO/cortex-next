// Test funkcjonalny POST /api/content-guru/templates/test-generation —
// "Testuj generację" (design doc §4.2). Dwie rzeczy do udowodnienia:
//  1. Realnie woła tę samą maszynerię co /generate (prompt z treścią
//     szablonu, D5 skan zakazanych fraz z retry).
//  2. NIGDY nie woła saveArchiveEntry() — to jest odrębne, testowane
//     zachowanie, nie tylko deklaracja w komentarzu.
// Bramka (manage-templates) jest osobno w ../../guard-coverage.test.ts.

import type * as CortexService from "@cortex/service"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@cortex/service/rbac-store", () => ({
  loadGrantedApplicationCodes: vi.fn(async () => ["content-guru"]),
  loadGrantedScopes: vi.fn(async () => ["content-guru:manage-templates"]),
}))

const service = vi.hoisted(() => ({
  listMyForbiddenPhrases: vi.fn(async () => [] as { phrase: string }[]),
  saveArchiveEntry: vi.fn(async () => {
    throw new Error("saveArchiveEntry NIE powinno być wołane przez test-generation")
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
const { POST } = await import("./route")

const EMAIL = "manager@firma.pl"

const VALID_BODY = {
  category: "Rekrutacja",
  name: "Post na LinkedIn",
  content: "INSTRUKCJA: pisz krótko.",
  model: "anthropic/claude-sonnet-4.6",
}

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/content-guru/templates/test-generation", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-auth-request-email": EMAIL },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  clearTileAccessCache()
  service.listMyForbiddenPhrases.mockClear()
  service.saveArchiveEntry.mockClear()
  generateContent.mockReset()
  vi.unstubAllEnvs()
  vi.stubEnv("NODE_ENV", "production")
  vi.stubEnv("CORTEX_PROXY_URL", "http://cortex-proxy")
  vi.stubEnv("CONTENT_GURU_MODELS", "anthropic/claude-sonnet-4.6,openai/gpt-4o-mini")
})

describe("POST /api/content-guru/templates/test-generation", () => {
  it("400 na zły request (brak treści szablonu)", async () => {
    const response = await POST(makeRequest({ ...VALID_BODY, content: "" }) as never)
    expect(response.status).toBe(400)
    expect(generateContent).not.toHaveBeenCalled()
  })

  it("happy path: treść draftu trafia do promptu, wynik NIE zapisuje archiwum", async () => {
    service.listMyForbiddenPhrases.mockResolvedValueOnce([])
    generateContent.mockResolvedValueOnce({
      content: "Wygenerowany podgląd treści.",
      tokensUsed: 90,
      model: VALID_BODY.model,
    })

    const response = await POST(makeRequest(VALID_BODY) as never)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.content).toBe("Wygenerowany podgląd treści.")
    expect(json.status).toBe("done")

    const promptArgs = generateContent.mock.calls[0]?.[0]
    expect(promptArgs.systemPrompt).toContain("INSTRUKCJA: pisz krótko.")
    expect(promptArgs.systemPrompt).toContain("Rekrutacja — Post na LinkedIn")

    // Rdzeń zachowania: NIGDY zapisu do archiwum.
    expect(service.saveArchiveEntry).not.toHaveBeenCalled()
  })

  it("bez podanego topic używa przykładowego tematu domyślnego", async () => {
    service.listMyForbiddenPhrases.mockResolvedValueOnce([])
    generateContent.mockResolvedValueOnce({ content: "Treść.", tokensUsed: 10, model: VALID_BODY.model })

    await POST(makeRequest(VALID_BODY) as never)

    const promptArgs = generateContent.mock.calls[0]
    expect(promptArgs).toBeTruthy()
    expect(service.saveArchiveEntry).not.toHaveBeenCalled()
  })

  it("D5 nadal działa: zakazana fraza -> retry eskalowany, done-with-warnings, ale bez zapisu archiwum", async () => {
    service.listMyForbiddenPhrases.mockResolvedValueOnce([{ phrase: "najlepszy na rynku" }])
    generateContent
      .mockResolvedValueOnce({ content: "Jesteśmy najlepszy na rynku.", tokensUsed: 50, model: VALID_BODY.model })
      .mockResolvedValueOnce({ content: "Wciąż najlepszy na rynku.", tokensUsed: 55, model: VALID_BODY.model })

    const response = await POST(makeRequest(VALID_BODY) as never)
    const json = await response.json()

    expect(generateContent).toHaveBeenCalledTimes(2)
    expect(json.status).toBe("done-with-warnings")
    expect(json.matchedForbiddenPhrases).toEqual(["najlepszy na rynku"])
    expect(service.saveArchiveEntry).not.toHaveBeenCalled()
  })

  it("mapuje błąd upstreamu cortex-proxy na 502, bez zapisu archiwum", async () => {
    const { ContentGuruServiceError } = await import("@/lib/content-guru/integration-client")
    service.listMyForbiddenPhrases.mockResolvedValueOnce([])
    generateContent.mockRejectedValueOnce(new ContentGuruServiceError("boom", "upstream-error"))

    const response = await POST(makeRequest(VALID_BODY) as never)

    expect(response.status).toBe(502)
    expect(service.saveArchiveEntry).not.toHaveBeenCalled()
  })
})
