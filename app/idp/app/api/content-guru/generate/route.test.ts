// Testy funkcjonalne POST /api/content-guru/generate — happy path + D5
// (walidacja zakazanych fraz: retry, done-with-warnings, treść ZAWSZE
// zapisana) + mapowanie błędów integration-client na kody HTTP. Bramka
// autoryzacji (bypass attempts) jest osobno w guard-coverage.test.ts —
// tutaj RBAC jest zawsze przepuszczające, testujemy logikę ZA bramką.

import type * as CortexService from "@cortex/service"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@cortex/service/rbac-store", () => ({
  loadGrantedApplicationCodes: vi.fn(async () => ["content-guru"]),
  loadGrantedScopes: vi.fn(async () => []),
}))

const service = vi.hoisted(() => ({
  listMyForbiddenPhrases: vi.fn(async () => [] as { id: string; userEmail: string; phrase: string; description: string | null; createdAt: Date }[]),
  saveArchiveEntry: vi.fn(
    async (
      userEmail: string,
      input: {
        contentType: string
        topic: string | null
        generatedContent: string
        status: "done" | "done-with-warnings"
        matchedForbiddenPhrases: readonly string[]
        targetAudience: string | null
        additionalInfo: string | null
        keywordPhrase: string | null
        metaDescription: string | null
        modelUsed: string
        metadata?: Record<string, unknown>
      },
    ) => ({
      id: "archive-1",
      userEmail,
      contentType: input.contentType,
      topic: input.topic,
      generatedContent: input.generatedContent,
      status: input.status,
      matchedForbiddenPhrases:
        input.matchedForbiddenPhrases.length > 0 ? [...input.matchedForbiddenPhrases] : null,
      targetAudience: input.targetAudience,
      additionalInfo: input.additionalInfo,
      keywordPhrase: input.keywordPhrase,
      metaDescription: input.metaDescription,
      modelUsed: input.modelUsed,
      clientProfileId: null,
      marketProfileId: null,
      metadata: input.metadata ?? {},
      createdAt: new Date("2026-08-03T00:00:00Z"),
    }),
  ),
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
  contentType: "Post na LinkedIn",
  topic: "Premiera nowego modułu",
  targetAudience: "Dyrektorzy IT",
  additionalInfo: "Podkreśl automatyzację.",
  model: "anthropic/claude-sonnet-4.6",
}

function makeRequest(body: unknown, email: string | null = EMAIL): Request {
  const headers = new Headers({ "Content-Type": "application/json" })
  if (email) headers.set("x-auth-request-email", email)
  return new Request("http://localhost/api/content-guru/generate", {
    method: "POST",
    headers,
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

describe("POST /api/content-guru/generate", () => {
  it("400 na zły request (brak tematu)", async () => {
    const response = await POST(makeRequest({ ...VALID_BODY, topic: "" }) as never)
    expect(response.status).toBe(400)
    expect(generateContent).not.toHaveBeenCalled()
    expect(service.saveArchiveEntry).not.toHaveBeenCalled()
  })

  it("400 na zły request (brak typu treści)", async () => {
    const response = await POST(makeRequest({ ...VALID_BODY, contentType: "" }) as never)
    expect(response.status).toBe(400)
    expect(generateContent).not.toHaveBeenCalled()
  })

  it("happy path: brak zakazanych fraz -> status done, jedno wywołanie LLM, zapis do archiwum", async () => {
    service.listMyForbiddenPhrases.mockResolvedValueOnce([])
    generateContent.mockResolvedValueOnce({
      content: "Świetny post o automatyzacji.",
      tokensUsed: 200,
      model: VALID_BODY.model,
    })

    const response = await POST(makeRequest(VALID_BODY) as never)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.status).toBe("done")
    expect(json.matchedForbiddenPhrases).toEqual([])
    expect(json.content).toBe("Świetny post o automatyzacji.")
    expect(generateContent).toHaveBeenCalledTimes(1)
    expect(service.saveArchiveEntry).toHaveBeenCalledWith(
      EMAIL,
      expect.objectContaining({
        status: "done",
        generatedContent: "Świetny post o automatyzacji.",
        contentType: VALID_BODY.contentType,
        topic: VALID_BODY.topic,
        metadata: { generationMode: "single" },
      }),
    )
  })

  it("D5: zakazana fraza w 1. próbie, retry NADAL ją zawiera -> done-with-warnings, treść i tak zapisana", async () => {
    service.listMyForbiddenPhrases.mockResolvedValueOnce([
      { id: "1", userEmail: EMAIL, phrase: "najlepszy na rynku", description: null, createdAt: new Date() },
    ])
    generateContent
      .mockResolvedValueOnce({
        content: "Jesteśmy Najlepszy na rynku rozwiązaniem.",
        tokensUsed: 150,
        model: VALID_BODY.model,
      })
      .mockResolvedValueOnce({
        content: "Wciąż Najlepszy na rynku produkt.",
        tokensUsed: 160,
        model: VALID_BODY.model,
      })

    const response = await POST(makeRequest(VALID_BODY) as never)
    const json = await response.json()

    expect(generateContent).toHaveBeenCalledTimes(2)
    expect(response.status).toBe(200)
    expect(json.status).toBe("done-with-warnings")
    expect(json.matchedForbiddenPhrases).toEqual(["najlepszy na rynku"])
    expect(json.content).toBe("Wciąż Najlepszy na rynku produkt.")
    expect(service.saveArchiveEntry).toHaveBeenCalledWith(
      EMAIL,
      expect.objectContaining({
        status: "done-with-warnings",
        generatedContent: "Wciąż Najlepszy na rynku produkt.",
        matchedForbiddenPhrases: ["najlepszy na rynku"],
      }),
    )

    // Druga próba dostaje eskalowaną instrukcję cytującą złapaną frazę.
    const secondCallArgs = generateContent.mock.calls[1]?.[0]
    expect(secondCallArgs.systemPrompt).toContain("najlepszy na rynku")
    expect(secondCallArgs.systemPrompt).toContain("złamała zakaz")
  })

  it("D5: zakazana fraza w 1. próbie, retry jej NIE zawiera -> done, treść z retry", async () => {
    service.listMyForbiddenPhrases.mockResolvedValueOnce([
      { id: "1", userEmail: EMAIL, phrase: "najlepszy na rynku", description: null, createdAt: new Date() },
    ])
    generateContent
      .mockResolvedValueOnce({
        content: "Jesteśmy najlepszy na rynku.",
        tokensUsed: 150,
        model: VALID_BODY.model,
      })
      .mockResolvedValueOnce({ content: "Jesteśmy liderem branży.", tokensUsed: 160, model: VALID_BODY.model })

    const response = await POST(makeRequest(VALID_BODY) as never)
    const json = await response.json()

    expect(generateContent).toHaveBeenCalledTimes(2)
    expect(json.status).toBe("done")
    expect(json.matchedForbiddenPhrases).toEqual([])
    expect(json.content).toBe("Jesteśmy liderem branży.")
    expect(service.saveArchiveEntry).toHaveBeenCalledWith(
      EMAIL,
      expect.objectContaining({ status: "done", matchedForbiddenPhrases: [] }),
    )
  })

  it("nie woła LLM wcale gdy user nie ma zakazanych fraz (brak sekcji, brak retry)", async () => {
    service.listMyForbiddenPhrases.mockResolvedValueOnce([])
    generateContent.mockResolvedValueOnce({ content: "Treść bez żadnych ograniczeń.", tokensUsed: 90, model: VALID_BODY.model })

    await POST(makeRequest(VALID_BODY) as never)

    expect(generateContent).toHaveBeenCalledTimes(1)
    const firstCallArgs = generateContent.mock.calls[0]?.[0]
    expect(firstCallArgs.systemPrompt).not.toContain("Zakazane frazy")
  })

  it("mapuje model spoza dozwolonej listy na 400, nie 502, i nie zapisuje archiwum", async () => {
    service.listMyForbiddenPhrases.mockResolvedValueOnce([])
    generateContent.mockRejectedValueOnce(
      new ContentGuruServiceError("zły model", "model-not-allowed"),
    )

    const response = await POST(makeRequest({ ...VALID_BODY, model: "nieznany/model" }) as never)

    expect(response.status).toBe(400)
    expect(service.saveArchiveEntry).not.toHaveBeenCalled()
  })

  it("mapuje błąd upstreamu cortex-proxy na 502", async () => {
    service.listMyForbiddenPhrases.mockResolvedValueOnce([])
    generateContent.mockRejectedValueOnce(new ContentGuruServiceError("boom", "upstream-error"))

    const response = await POST(makeRequest(VALID_BODY) as never)

    expect(response.status).toBe(502)
    expect(service.saveArchiveEntry).not.toHaveBeenCalled()
  })

  it("mapuje nieoczekiwany błąd na 500", async () => {
    service.listMyForbiddenPhrases.mockResolvedValueOnce([])
    generateContent.mockRejectedValueOnce(new Error("coś nieoczekiwanego"))

    const response = await POST(makeRequest(VALID_BODY) as never)

    expect(response.status).toBe(500)
  })
})
