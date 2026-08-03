// Test funkcjonalny POST /api/content-guru/mini-generators/topics — bramka
// osobno w ../../guard-coverage.test.ts. Tu: kontrakt walidacji, parsing
// odpowiedzi modelu (parseJsonStringArray), i że NIGDY nie woła
// saveArchiveEntry (utility call, wzorem test-generation).

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
  transcript: "Dziś rozmawialiśmy o nowej funkcji produktu i planach rekrutacyjnych na 2027 rok.",
  topicCount: 8,
  model: "anthropic/claude-sonnet-4.6",
}

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/content-guru/mini-generators/topics", {
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

describe("POST /api/content-guru/mini-generators/topics", () => {
  it("400 na zły request (pusta transkrypcja)", async () => {
    const response = await POST(makeRequest({ ...VALID_BODY, transcript: "" }) as never)
    expect(response.status).toBe(400)
    expect(generateContent).not.toHaveBeenCalled()
  })

  it("400 na topicCount poza zakresem 5-20", async () => {
    const response = await POST(makeRequest({ ...VALID_BODY, topicCount: 25 }) as never)
    expect(response.status).toBe(400)
    expect(generateContent).not.toHaveBeenCalled()
  })

  it("happy path: parsuje tablicę JSON z odpowiedzi modelu", async () => {
    generateContent.mockResolvedValueOnce({
      content: '["Premiera nowej funkcji", "Rekrutacja na 2027", "Case study klienta"]',
      tokensUsed: 60,
      model: VALID_BODY.model,
    })

    const response = await POST(makeRequest(VALID_BODY) as never)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.topics).toEqual(["Premiera nowej funkcji", "Rekrutacja na 2027", "Case study klienta"])
    expect(service.saveArchiveEntry).not.toHaveBeenCalled()

    const promptArgs = generateContent.mock.calls[0]?.[0]
    expect(promptArgs.temperature).toBe(0.3)
    expect(promptArgs.userPrompt).toContain("planach rekrutacyjnych na 2027")
  })

  it("fallback: parsuje tablicę owiniętą w code fence/tekst", async () => {
    generateContent.mockResolvedValueOnce({
      content: 'Oto tematy:\n```json\n["Temat A", "Temat B"]\n```',
      tokensUsed: 40,
      model: VALID_BODY.model,
    })

    const response = await POST(makeRequest(VALID_BODY) as never)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.topics).toEqual(["Temat A", "Temat B"])
  })

  it("502 gdy model nie zwraca poprawnej tablicy (parseJsonStringArray -> [])", async () => {
    generateContent.mockResolvedValueOnce({
      content: "Przepraszam, nie mogę tego zrobić.",
      tokensUsed: 20,
      model: VALID_BODY.model,
    })

    const response = await POST(makeRequest(VALID_BODY) as never)

    expect(response.status).toBe(502)
    expect(service.saveArchiveEntry).not.toHaveBeenCalled()
  })

  it("mapuje model spoza dozwolonej listy na 400", async () => {
    generateContent.mockRejectedValueOnce(new ContentGuruServiceError("zły model", "model-not-allowed"))

    const response = await POST(makeRequest({ ...VALID_BODY, model: "nieznany/model" }) as never)

    expect(response.status).toBe(400)
  })

  it("mapuje błąd upstreamu cortex-proxy na 502", async () => {
    generateContent.mockRejectedValueOnce(new ContentGuruServiceError("boom", "upstream-error"))

    const response = await POST(makeRequest(VALID_BODY) as never)

    expect(response.status).toBe(502)
  })
})
