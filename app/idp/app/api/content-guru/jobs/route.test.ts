// Testy funkcjonalne POST /api/content-guru/jobs — walidacja Zod (w tym
// MAX_COMBINATIONS, D4 §9 p.3 — próba obejścia limitu bezpośrednim
// wywołaniem API, nie tylko UI), rozwiązywanie szablonów/profili, budowa
// pozycji (batch: 1×N, pakiet: iloczyn kartezjański M×N), i "genuinely nie
// blokuje" (202 wraca ZANIM orkiestracja się skończy). Bramka autoryzacji
// (bypass attempts) jest osobno w guard-coverage.test.ts.

import { MAX_COMBINATIONS } from "@/lib/content-guru/job-limits"
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
    async (id: string) =>
      ({
        id,
        category: "Rekrutacja",
        name: "Post na LinkedIn",
        content: `treść szablonu ${id}`,
        createdBy: "system",
        createdAt: new Date(),
        updatedAt: new Date(),
      }) as { id: string; category: string; name: string; content: string } | undefined,
  ),
  getMyClientProfile: vi.fn(async () => undefined as { id: string } | undefined),
  getMyMarketProfile: vi.fn(async () => undefined as { id: string } | undefined),
  createGenerationJob: vi.fn(
    async (
      _userEmail: string,
      mode: "batch" | "package",
      items: { templateId: string; templateLabel: string; topic: string }[],
    ) => ({
      id: "job-1",
      userEmail: "tworca@firma.pl",
      mode,
      status: "queued" as const,
      items: items.map((item) => ({ ...item, status: "pending" as const })),
      createdAt: new Date("2026-08-03T00:00:00Z"),
      completedAt: null,
    }),
  ),
}))
vi.mock("@cortex/service", async (importOriginal) => ({
  ...(await importOriginal<typeof CortexService>()),
  ...service,
}))

// Deferred controllable — dowodzi, że route NIE czeka na to, zanim odpowie
// (patrz test "202 wraca zanim orkiestracja się skończy").
let releaseOrchestration: (() => void) | null = null
const processGenerationJob = vi.hoisted(() => vi.fn())
vi.mock("@/lib/content-guru/run-batch-generation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/content-guru/run-batch-generation")>()),
  processGenerationJob,
}))

const { clearTileAccessCache } = await import("@cortex/service")
const { POST } = await import("./route")

const EMAIL = "tworca@firma.pl"
const TEMPLATE_A = "11111111-1111-1111-1111-111111111111"
const TEMPLATE_B = "22222222-2222-2222-2222-222222222222"

function makeRequest(body: unknown, email: string | null = EMAIL): Request {
  const headers = new Headers({ "Content-Type": "application/json" })
  if (email) headers.set("x-auth-request-email", email)
  return new Request("http://localhost/api/content-guru/jobs", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  })
}

const VALID_BATCH_BODY = {
  mode: "batch",
  topics: ["Temat 1", "Temat 2", "Temat 3"],
  templateIds: [TEMPLATE_A],
  targetAudience: "",
  additionalInfo: "",
  model: "anthropic/claude-sonnet-4.6",
}

beforeEach(() => {
  clearTileAccessCache()
  service.listMyForbiddenPhrases.mockClear()
  service.getTemplate.mockClear()
  service.getMyClientProfile.mockReset()
  service.getMyClientProfile.mockResolvedValue(undefined)
  service.getMyMarketProfile.mockReset()
  service.getMyMarketProfile.mockResolvedValue(undefined)
  service.createGenerationJob.mockClear()
  processGenerationJob.mockReset()
  releaseOrchestration = null
  processGenerationJob.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        releaseOrchestration = resolve
      }),
  )
  vi.unstubAllEnvs()
  vi.stubEnv("NODE_ENV", "production")
  vi.stubEnv("CORTEX_PROXY_URL", "http://cortex-proxy")
  vi.stubEnv("CONTENT_GURU_MODELS", "anthropic/claude-sonnet-4.6,openai/gpt-4o-mini")
})

describe("POST /api/content-guru/jobs — walidacja", () => {
  it("400 na zły mode", async () => {
    const response = await POST(makeRequest({ ...VALID_BATCH_BODY, mode: "invalid" }) as never)
    expect(response.status).toBe(400)
    expect(service.createGenerationJob).not.toHaveBeenCalled()
  })

  it("400 na pustą listę tematów", async () => {
    const response = await POST(makeRequest({ ...VALID_BATCH_BODY, topics: [] }) as never)
    expect(response.status).toBe(400)
    expect(service.createGenerationJob).not.toHaveBeenCalled()
  })

  it("400 na pustą listę szablonów", async () => {
    const response = await POST(makeRequest({ ...VALID_BATCH_BODY, templateIds: [] }) as never)
    expect(response.status).toBe(400)
  })

  it("400: tryb 'batch' z więcej niż jednym szablonem", async () => {
    const response = await POST(
      makeRequest({ ...VALID_BATCH_BODY, templateIds: [TEMPLATE_A, TEMPLATE_B] }) as never,
    )
    expect(response.status).toBe(400)
    expect(service.createGenerationJob).not.toHaveBeenCalled()
  })

  it("400: model spoza dozwolonej listy, zero utworzonego joba", async () => {
    const response = await POST(
      makeRequest({ ...VALID_BATCH_BODY, model: "nieznany/model" }) as never,
    )
    expect(response.status).toBe(400)
    expect(service.createGenerationJob).not.toHaveBeenCalled()
    expect(processGenerationJob).not.toHaveBeenCalled()
  })

  // KLUCZ komunikatu, nie gotowe zdanie: serwer nie zna wybranego języka
  // (wybór siedzi w localStorage przeglądarki), a ogólny zapas klienta
  // („Nie udało się uruchomić generowania") nie powiedziałby, CZEGO brakuje.
  // Te same trzy klucze oddaje generate/route.ts — asercja tutaj jest po to,
  // żeby literówka w TEJ trasie nie chowała się za poprawnym bliźniakiem.
  it("400: nieznany templateId -> klucz komunikatu, zero utworzonego joba", async () => {
    service.getTemplate.mockResolvedValueOnce(undefined)
    const response = await POST(makeRequest(VALID_BATCH_BODY) as never)
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: "invalid-request",
      messageKey: "generate.errors.templateMissing",
    })
    expect(service.createGenerationJob).not.toHaveBeenCalled()
  })

  it("400: nieznany clientProfileId -> klucz komunikatu, zero utworzonego joba", async () => {
    const response = await POST(
      makeRequest({
        ...VALID_BATCH_BODY,
        clientProfileId: "99999999-9999-9999-9999-999999999999",
      }) as never,
    )
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: "invalid-request",
      messageKey: "generate.errors.clientProfileMissing",
    })
    expect(service.createGenerationJob).not.toHaveBeenCalled()
  })

  it("400: nieznany marketProfileId -> klucz komunikatu, zero utworzonego joba", async () => {
    const response = await POST(
      makeRequest({
        ...VALID_BATCH_BODY,
        marketProfileId: "88888888-8888-8888-8888-888888888888",
      }) as never,
    )
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: "invalid-request",
      messageKey: "generate.errors.marketProfileMissing",
    })
    expect(service.createGenerationJob).not.toHaveBeenCalled()
  })

  // MAX_COMBINATIONS (D4, §9 p.3) — bezpośrednie wywołanie API z ładunkiem,
  // który UI zablokowałoby przez licznik kombinacji, MUSI i tak dostać 400.
  // To jest dokładnie próba "obejścia guardu": nic po stronie klienta nie
  // stoi między tym requestem a serwerem.
  describe(`MAX_COMBINATIONS=${MAX_COMBINATIONS} — egzekwowane server-side, nie tylko podpowiedź UI`, () => {
    it("pakiet: topics.length * templateIds.length > limit -> 400, zero utworzonego joba/orkiestracji", async () => {
      const manyTopics = Array.from({ length: 16 }, (_, i) => `Temat ${i}`)
      const manyTemplates = Array.from(
        { length: 2 },
        (_, i) => `3333333${i}-3333-3333-3333-333333333333`,
      )
      // 16 * 2 = 32 > 30
      const response = await POST(
        makeRequest({
          ...VALID_BATCH_BODY,
          mode: "package",
          topics: manyTopics,
          templateIds: manyTemplates,
        }) as never,
      )

      expect(response.status).toBe(400)
      const json = await response.json()
      expect(json.error).toBe("invalid-request")
      expect(service.createGenerationJob).not.toHaveBeenCalled()
      expect(processGenerationJob).not.toHaveBeenCalled()
    })

    it("batch: topics.length sam w sobie > limit (jeden szablon) -> 400", async () => {
      const tooManyTopics = Array.from({ length: MAX_COMBINATIONS + 1 }, (_, i) => `Temat ${i}`)
      const response = await POST(
        makeRequest({ ...VALID_BATCH_BODY, topics: tooManyTopics }) as never,
      )

      expect(response.status).toBe(400)
      expect(service.createGenerationJob).not.toHaveBeenCalled()
    })

    it("dokładnie na granicy (topics * templateIds === MAX_COMBINATIONS) -> przechodzi walidację", async () => {
      const topics = Array.from({ length: 15 }, (_, i) => `Temat ${i}`)
      const templateIds = [TEMPLATE_A, TEMPLATE_B]
      // 15 * 2 = 30 === MAX_COMBINATIONS
      const response = await POST(
        makeRequest({ ...VALID_BATCH_BODY, mode: "package", topics, templateIds }) as never,
      )

      expect(response.status).toBe(202)
      expect(service.createGenerationJob).toHaveBeenCalledTimes(1)
    })
  })
})

describe("POST /api/content-guru/jobs — budowa pozycji", () => {
  it("batch: 1 szablon × N tematów, templateLabel = 'kategoria — nazwa'", async () => {
    const response = await POST(makeRequest(VALID_BATCH_BODY) as never)
    const json = await response.json()

    expect(response.status).toBe(202)
    expect(json).toEqual({ jobId: "job-1", status: "queued" })
    expect(service.createGenerationJob).toHaveBeenCalledWith(EMAIL, "batch", [
      { templateId: TEMPLATE_A, templateLabel: "Rekrutacja — Post na LinkedIn", topic: "Temat 1" },
      { templateId: TEMPLATE_A, templateLabel: "Rekrutacja — Post na LinkedIn", topic: "Temat 2" },
      { templateId: TEMPLATE_A, templateLabel: "Rekrutacja — Post na LinkedIn", topic: "Temat 3" },
    ])
  })

  it("pakiet: iloczyn kartezjański M szablonów × N tematów (szablon-zewnętrzny, temat-wewnętrzny)", async () => {
    const response = await POST(
      makeRequest({
        ...VALID_BATCH_BODY,
        mode: "package",
        topics: ["T1", "T2"],
        templateIds: [TEMPLATE_A, TEMPLATE_B],
      }) as never,
    )

    expect(response.status).toBe(202)
    const [, , items] = service.createGenerationJob.mock.calls[0]!
    expect(items).toHaveLength(4)
    expect(
      items.map(
        (item: { templateId: string; topic: string }) => `${item.templateId}:${item.topic}`,
      ),
    ).toEqual([`${TEMPLATE_A}:T1`, `${TEMPLATE_A}:T2`, `${TEMPLATE_B}:T1`, `${TEMPLATE_B}:T2`])
  })

  it("deduplikuje templateIds powtórzone w żądaniu (getTemplate wołane raz per unikalny id)", async () => {
    await POST(
      makeRequest({
        ...VALID_BATCH_BODY,
        mode: "package",
        topics: ["T1"],
        templateIds: [TEMPLATE_A, TEMPLATE_A, TEMPLATE_B],
      }) as never,
    )

    expect(service.getTemplate).toHaveBeenCalledTimes(2)
  })
})

describe("POST /api/content-guru/jobs — 202 genuinely nie blokuje (D4)", () => {
  it("odpowiedź 202 wraca ZANIM processGenerationJob się skończy — orkiestracja jest fire-and-forget", async () => {
    const response = await POST(makeRequest(VALID_BATCH_BODY) as never)

    // Route już oddał odpowiedź, mimo że orkiestracja (mockowana jako
    // wiszący Promise) wciąż nie jest rozstrzygnięta.
    expect(response.status).toBe(202)
    expect(processGenerationJob).toHaveBeenCalledTimes(1)
    expect(releaseOrchestration).not.toBeNull()

    // Sprzątanie — odblokuj wiszący mock, żeby nie zostawić dangling promise
    // między testami.
    releaseOrchestration!()
  })

  it("processGenerationJob dostaje pełny kontekst: model/audience/profile/forbiddenPhrases", async () => {
    service.listMyForbiddenPhrases.mockResolvedValueOnce([
      {
        id: "1",
        userEmail: EMAIL,
        phrase: "najlepszy na rynku",
        description: null,
        createdAt: new Date(),
      },
    ])

    await POST(
      makeRequest({
        ...VALID_BATCH_BODY,
        targetAudience: "Dyrektorzy IT",
        additionalInfo: "Podkreśl automatyzację.",
      }) as never,
    )

    expect(processGenerationJob).toHaveBeenCalledWith(
      expect.objectContaining({
        email: EMAIL,
        jobId: "job-1",
        mode: "batch",
        targetAudience: "Dyrektorzy IT",
        additionalInfo: "Podkreśl automatyzację.",
        model: "anthropic/claude-sonnet-4.6",
        forbiddenPhrases: ["najlepszy na rynku"],
      }),
    )
    releaseOrchestration!()
  })

  it("błąd nieoczekiwany PRZED utworzeniem joba -> 500, zero wywołania orkiestracji", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    service.createGenerationJob.mockRejectedValueOnce(new Error("DB nieosiągalna"))

    const response = await POST(makeRequest(VALID_BATCH_BODY) as never)

    expect(response.status).toBe(500)
    expect(processGenerationJob).not.toHaveBeenCalled()
    consoleError.mockRestore()
  })
})
