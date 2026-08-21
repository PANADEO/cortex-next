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
  listMyForbiddenPhrases: vi.fn(
    async () =>
      [] as {
        id: string
        userEmail: string
        phrase: string
        description: string | null
        createdAt: Date
      }[],
  ),
  getTemplate: vi.fn(
    async () =>
      undefined as { id: string; category: string; name: string; content: string } | undefined,
  ),
  getMyClientProfile: vi.fn(
    async () =>
      undefined as
        | {
            id: string
            profileName: string
            history: string | null
            description: string | null
            products: string | null
            offer: string | null
            useCases: string | null
            experience: string | null
          }
        | undefined,
  ),
  getMyMarketProfile: vi.fn(
    async () =>
      undefined as
        | {
            id: string
            profileName: string
            description: string | null
            sizeTrends: string | null
            personas: string | null
            problems: string | null
            needs: string | null
            plans: string | null
          }
        | undefined,
  ),
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
  service.getTemplate.mockReset()
  service.getTemplate.mockResolvedValue(undefined)
  service.getMyClientProfile.mockReset()
  service.getMyClientProfile.mockResolvedValue(undefined)
  service.getMyMarketProfile.mockReset()
  service.getMyMarketProfile.mockResolvedValue(undefined)
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
      {
        id: "1",
        userEmail: EMAIL,
        phrase: "najlepszy na rynku",
        description: null,
        createdAt: new Date(),
      },
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
      {
        id: "1",
        userEmail: EMAIL,
        phrase: "najlepszy na rynku",
        description: null,
        createdAt: new Date(),
      },
    ])
    generateContent
      .mockResolvedValueOnce({
        content: "Jesteśmy najlepszy na rynku.",
        tokensUsed: 150,
        model: VALID_BODY.model,
      })
      .mockResolvedValueOnce({
        content: "Jesteśmy liderem branży.",
        tokensUsed: 160,
        model: VALID_BODY.model,
      })

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
    generateContent.mockResolvedValueOnce({
      content: "Treść bez żadnych ograniczeń.",
      tokensUsed: 90,
      model: VALID_BODY.model,
    })

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

  // Round B — D6/D7: wybór szablonu/profilu MUSI realnie zmienić to, co
  // trafia do promptu (system prompt wołany na cortex-proxy), nie tylko
  // odkładać się bez efektu. Te testy dowodzą wiązania, nie tylko że route
  // przyjmuje dodatkowe pola. Schema wymaga UUID dla templateId/{client,market}
  // ProfileId — literały muszą wyglądać jak realne uuid, inaczej 400 pada na
  // walidacji Zod, zanim dotrze do warstwy, którą test ma sprawdzić.
  describe("Round B — wiązanie szablonu/profilu klienta/rynku", () => {
    const TEMPLATE_ID = "11111111-1111-1111-1111-111111111111"
    const MISSING_TEMPLATE_ID = "99999999-9999-9999-9999-999999999991"
    const CLIENT_PROFILE_ID = "22222222-2222-2222-2222-222222222222"
    const FOREIGN_CLIENT_PROFILE_ID = "99999999-9999-9999-9999-999999999992"
    const MARKET_PROFILE_ID = "33333333-3333-3333-3333-333333333333"

    it("templateId: treść szablonu trafia do system promptu, a contentType w archiwum to kategoria — nazwa szablonu (nadpisuje wolny tekst z requestu)", async () => {
      service.listMyForbiddenPhrases.mockResolvedValueOnce([])
      service.getTemplate.mockResolvedValueOnce({
        id: TEMPLATE_ID,
        category: "Rekrutacja",
        name: "Post na LinkedIn",
        content: "INSTRUKCJA SZABLONU: pisz krótko, max 3 akapity.",
      })
      generateContent.mockResolvedValueOnce({
        content: "Treść wygenerowana z szablonu.",
        tokensUsed: 120,
        model: VALID_BODY.model,
      })

      const response = await POST(
        makeRequest({
          ...VALID_BODY,
          contentType: "będzie nadpisane",
          templateId: TEMPLATE_ID,
        }) as never,
      )
      const json = await response.json()

      expect(response.status).toBe(200)
      expect(service.getTemplate).toHaveBeenCalledWith(TEMPLATE_ID)
      const promptArgs = generateContent.mock.calls[0]?.[0]
      expect(promptArgs.systemPrompt).toContain("INSTRUKCJA SZABLONU: pisz krótko, max 3 akapity.")
      expect(service.saveArchiveEntry).toHaveBeenCalledWith(
        EMAIL,
        expect.objectContaining({ contentType: "Rekrutacja — Post na LinkedIn" }),
      )
      expect(json.content).toBe("Treść wygenerowana z szablonu.")
    })

    it("templateId nieznany -> 400, zero wywołania LLM/zapisu archiwum", async () => {
      service.getTemplate.mockResolvedValueOnce(undefined)

      const response = await POST(
        makeRequest({ ...VALID_BODY, templateId: MISSING_TEMPLATE_ID }) as never,
      )

      expect(response.status).toBe(400)
      expect(generateContent).not.toHaveBeenCalled()
      expect(service.saveArchiveEntry).not.toHaveBeenCalled()
    })

    it("clientProfileId: markdown profilu trafia do system promptu i id zapisuje się w archiwum", async () => {
      service.listMyForbiddenPhrases.mockResolvedValueOnce([])
      service.getMyClientProfile.mockResolvedValueOnce({
        id: CLIENT_PROFILE_ID,
        profileName: "Acme Sp. z o.o.",
        history: "Firma na rynku od 2010.",
        description: null,
        products: null,
        offer: null,
        useCases: null,
        experience: null,
      })
      generateContent.mockResolvedValueOnce({
        content: "Treść z kontekstem klienta.",
        tokensUsed: 100,
        model: VALID_BODY.model,
      })

      const response = await POST(
        makeRequest({ ...VALID_BODY, clientProfileId: CLIENT_PROFILE_ID }) as never,
      )

      expect(response.status).toBe(200)
      expect(service.getMyClientProfile).toHaveBeenCalledWith(EMAIL, CLIENT_PROFILE_ID)
      const promptArgs = generateContent.mock.calls[0]?.[0]
      expect(promptArgs.systemPrompt).toContain("Acme Sp. z o.o.")
      expect(promptArgs.systemPrompt).toContain("Firma na rynku od 2010.")
      expect(service.saveArchiveEntry).toHaveBeenCalledWith(
        EMAIL,
        expect.objectContaining({ clientProfileId: CLIENT_PROFILE_ID }),
      )
    })

    it("marketProfileId: markdown profilu rynku trafia do system promptu i id zapisuje się w archiwum", async () => {
      service.listMyForbiddenPhrases.mockResolvedValueOnce([])
      service.getMyMarketProfile.mockResolvedValueOnce({
        id: MARKET_PROFILE_ID,
        profileName: "Rynek IT B2B",
        description: null,
        sizeTrends: "Rośnie o 12% rocznie.",
        personas: null,
        problems: null,
        needs: null,
        plans: null,
      })
      generateContent.mockResolvedValueOnce({
        content: "Treść z kontekstem rynku.",
        tokensUsed: 100,
        model: VALID_BODY.model,
      })

      const response = await POST(
        makeRequest({ ...VALID_BODY, marketProfileId: MARKET_PROFILE_ID }) as never,
      )

      expect(response.status).toBe(200)
      expect(service.getMyMarketProfile).toHaveBeenCalledWith(EMAIL, MARKET_PROFILE_ID)
      const promptArgs = generateContent.mock.calls[0]?.[0]
      expect(promptArgs.systemPrompt).toContain("Rynek IT B2B")
      expect(promptArgs.systemPrompt).toContain("Rośnie o 12% rocznie.")
      expect(service.saveArchiveEntry).toHaveBeenCalledWith(
        EMAIL,
        expect.objectContaining({ marketProfileId: MARKET_PROFILE_ID }),
      )
    })

    it("clientProfileId cudzy/nieznajomy (getMyClientProfile zwraca undefined) -> 400, nigdy 404 (nie zdradza istnienia)", async () => {
      service.getMyClientProfile.mockResolvedValueOnce(undefined)

      const response = await POST(
        makeRequest({ ...VALID_BODY, clientProfileId: FOREIGN_CLIENT_PROFILE_ID }) as never,
      )

      expect(response.status).toBe(400)
      expect(generateContent).not.toHaveBeenCalled()
    })

    it("bez templateId/profili: kontrakt Round A bez zmian (kontekst pozostaje null)", async () => {
      service.listMyForbiddenPhrases.mockResolvedValueOnce([])
      generateContent.mockResolvedValueOnce({
        content: "Treść bez kontekstu.",
        tokensUsed: 80,
        model: VALID_BODY.model,
      })

      await POST(makeRequest(VALID_BODY) as never)

      expect(service.getTemplate).not.toHaveBeenCalled()
      expect(service.getMyClientProfile).not.toHaveBeenCalled()
      expect(service.getMyMarketProfile).not.toHaveBeenCalled()
      expect(service.saveArchiveEntry).toHaveBeenCalledWith(
        EMAIL,
        expect.objectContaining({ clientProfileId: null, marketProfileId: null }),
      )
    })
  })

  // Round D — D8: fraza kluczowa/meta description są teraz opcjonalnie
  // wysyłane z panelu "SEO i metadane" (wcześniej zawsze null, patrz komentarz
  // nagłówkowy route.ts).
  describe("Round D — fraza kluczowa/meta description", () => {
    it("keywordPhrase/metaDescription podane -> trafiają do promptu i do archiwum", async () => {
      service.listMyForbiddenPhrases.mockResolvedValueOnce([])
      generateContent.mockResolvedValueOnce({
        content: "Treść z SEO.",
        tokensUsed: 90,
        model: VALID_BODY.model,
      })

      await POST(
        makeRequest({
          ...VALID_BODY,
          keywordPhrase: "automatyzacja procesów",
          metaDescription: "Poznaj automatyzację procesów finansowych.",
        }) as never,
      )

      const promptArgs = generateContent.mock.calls[0]?.[0]
      expect(promptArgs.systemPrompt).toContain("automatyzacja procesów")
      expect(promptArgs.systemPrompt).toContain("Poznaj automatyzację procesów finansowych.")
      expect(service.saveArchiveEntry).toHaveBeenCalledWith(
        EMAIL,
        expect.objectContaining({
          keywordPhrase: "automatyzacja procesów",
          metaDescription: "Poznaj automatyzację procesów finansowych.",
        }),
      )
    })

    it("bez keywordPhrase/metaDescription -> oba zostają null (kontrakt Round A/B/C bez zmian)", async () => {
      service.listMyForbiddenPhrases.mockResolvedValueOnce([])
      generateContent.mockResolvedValueOnce({
        content: "Treść bez SEO.",
        tokensUsed: 70,
        model: VALID_BODY.model,
      })

      await POST(makeRequest(VALID_BODY) as never)

      expect(service.saveArchiveEntry).toHaveBeenCalledWith(
        EMAIL,
        expect.objectContaining({ keywordPhrase: null, metaDescription: null }),
      )
    })

    it("400 gdy metaDescription przekracza 160 znaków", async () => {
      const response = await POST(
        makeRequest({ ...VALID_BODY, metaDescription: "A".repeat(161) }) as never,
      )
      expect(response.status).toBe(400)
      expect(generateContent).not.toHaveBeenCalled()
    })
  })
})
