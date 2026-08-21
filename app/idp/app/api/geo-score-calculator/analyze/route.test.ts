// Testy kontraktu route'a + próba ominięcia bramki NA REALNEJ ŚCIEŻCE
// ŻĄDANIA (code-service/SKILL.md pkt 3) — wzorem
// app/api/ai-tools/generate/route.test.ts. Bramka (requireTileAccess)
// zostaje PRAWDZIWA, podmieniany jest tylko odczyt grantów z bazy
// (rbac-store) i warstwy dotykające sieci/Postgresa (adapter mikroserwisu,
// getGeoScoreConfig/saveGeoScoreCalculation z @cortex/service).

import type * as CortexService from "@cortex/service"
import { beforeEach, describe, expect, it, vi } from "vitest"

const loadGrantedApplicationCodes = vi.hoisted(() => vi.fn<(email: string) => Promise<string[]>>())

vi.mock("@cortex/service/rbac-store", () => ({
  loadGrantedApplicationCodes,
  loadGrantedScopes: vi.fn(async () => []),
}))

const GEO_SCORE_CALCULATOR_APP_CODE_FOR_TEST = "geo-score-calculator"

const CONFIG_ROW = {
  id: true,
  weightStatistics: 0.3,
  weightActionVerbs: 0.25,
  weightStructure: 0.2,
  weightObjectivity: 0.25,
  benchmarkStats: 4,
  benchmarkVerbs: 0.15,
  benchmarkStructure: 3,
  benchmarkObjectivity: 0.05,
  gradeAMin: 90,
  gradeBMin: 75,
  gradeCMin: 60,
  gradeDMin: 40,
  actionVerbs: ["wdrożył"],
  subjectiveWords: ["najlepszy"],
  falsePositives: [],
  bulletPatterns: ["^[\\s]*-\\s+"],
  updatedAt: new Date(),
  updatedBy: "system",
}

const ANALYSIS_RESPONSE = {
  totalScore: 82.4,
  grade: "B",
  wordCount: 3,
  statistics: { score: 91, count: 1, per100Words: 4.2, examples: [] },
  actionVerbs: {
    score: 76,
    actionVerbCount: 1,
    totalVerbCount: 1,
    ratio: 1,
    foundVerbs: ["wdrożyć"],
    method: "spacy",
  },
  structure: { score: 88, bulletCount: 0, per500Words: 0, hasHeaders: false, paragraphCount: 1 },
  objectivity: { score: 100, subjectiveCount: 0, subjectiveRatio: 0, foundWords: [] },
  recommendations: [],
}

const service = vi.hoisted(() => ({
  getGeoScoreConfig: vi.fn(),
  saveGeoScoreCalculation: vi.fn(),
}))

vi.mock("@cortex/service", async (importOriginal) => {
  const actual = await importOriginal<typeof CortexService>()
  return { ...actual, ...service }
})

// requireTileAccess() cache'uje granty per e-mail przez 30s (accessLayer w
// rbac.ts) — bez czyszczenia tego cache'a między testami jeden request z
// email "u@example.com" ustawiłby wynik dla WSZYSTKICH kolejnych testów tego
// samego e-maila, niezależnie od nowego mocka. Wzorem
// app/api/ilustromat/guard-coverage.test.ts.
const { clearTileAccessCache } = await import("@cortex/service")

const analyzeGeoScore = vi.hoisted(() => vi.fn())

class FakeGeoScoreServiceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "GeoScoreServiceError"
  }
}

vi.mock("@/lib/geo-score-calculator/integration-client", () => ({
  analyzeGeoScore,
  GeoScoreServiceError: FakeGeoScoreServiceError,
}))

interface AnalyzeRoute {
  POST: (request: Request) => Promise<Response>
}

async function loadHandler(): Promise<AnalyzeRoute> {
  vi.resetModules()
  return (await import("./route")) as unknown as AnalyzeRoute
}

function makeRequest(body: unknown, email: string | null = "u@example.com"): Request {
  const headers = new Headers({ "Content-Type": "application/json" })
  if (email) headers.set("x-auth-request-email", email)
  return new Request("http://localhost/api/geo-score-calculator/analyze", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  })
}

function expectNoServiceCall(): void {
  expect(service.getGeoScoreConfig).not.toHaveBeenCalled()
  expect(service.saveGeoScoreCalculation).not.toHaveBeenCalled()
  expect(analyzeGeoScore).not.toHaveBeenCalled()
}

beforeEach(() => {
  clearTileAccessCache()
  vi.unstubAllEnvs()
  vi.stubEnv("NODE_ENV", "production")
  loadGrantedApplicationCodes.mockReset()
  loadGrantedApplicationCodes.mockResolvedValue([])
  service.getGeoScoreConfig.mockReset()
  service.getGeoScoreConfig.mockResolvedValue(CONFIG_ROW)
  service.saveGeoScoreCalculation.mockReset()
  service.saveGeoScoreCalculation.mockResolvedValue({ id: "calc-1" })
  analyzeGeoScore.mockReset()
  analyzeGeoScore.mockResolvedValue(ANALYSIS_RESPONSE)
})

describe("POST /api/geo-score-calculator/analyze", () => {
  it("odmawia: brak nagłówka tożsamości (401)", async () => {
    const { POST } = await loadHandler()

    const response = await POST(makeRequest({ text: "Tekst" }, null))

    expect(response.status).toBe(401)
    expectNoServiceCall()
  })

  it("odmawia: użytkownik bez grantu kafelka (403) — próba ominięcia bramki", async () => {
    loadGrantedApplicationCodes.mockResolvedValue(["idp", "invoice-supervisor"])
    const { POST } = await loadHandler()

    const response = await POST(makeRequest({ text: "Tekst" }))

    expect(response.status).toBe(403)
    expectNoServiceCall()
  })

  it("odmawia: grant do łudząco podobnego kodu", async () => {
    loadGrantedApplicationCodes.mockResolvedValue(["geo-score-calculator-legacy"])
    const { POST } = await loadHandler()

    const response = await POST(makeRequest({ text: "Tekst" }))

    expect(response.status).toBe(403)
    expectNoServiceCall()
  })

  it("odmawia gdy odczyt uprawnień pada (fail-closed)", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    loadGrantedApplicationCodes.mockRejectedValue(new Error("connection refused"))
    const { POST } = await loadHandler()

    const response = await POST(makeRequest({ text: "Tekst" }))

    expect(response.status).toBe(403)
    expectNoServiceCall()
    consoleError.mockRestore()
  })

  it("400 na pusty tekst (posiadacz kompletu uprawnień)", async () => {
    loadGrantedApplicationCodes.mockResolvedValue([GEO_SCORE_CALCULATOR_APP_CODE_FOR_TEST])
    const { POST } = await loadHandler()

    const response = await POST(makeRequest({ text: "   " }))

    expect(response.status).toBe(400)
    expectNoServiceCall()
  })

  it("400 na tekst za długi", async () => {
    loadGrantedApplicationCodes.mockResolvedValue([GEO_SCORE_CALCULATOR_APP_CODE_FOR_TEST])
    const { POST } = await loadHandler()

    const response = await POST(makeRequest({ text: "a".repeat(40_001) }))

    expect(response.status).toBe(400)
    expectNoServiceCall()
  })

  it("502 gdy mikroserwis pada", async () => {
    loadGrantedApplicationCodes.mockResolvedValue([GEO_SCORE_CALCULATOR_APP_CODE_FOR_TEST])
    analyzeGeoScore.mockRejectedValue(new FakeGeoScoreServiceError("timeout"))
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    const { POST } = await loadHandler()

    const response = await POST(makeRequest({ text: "Firma wdrożyła system." }))

    expect(response.status).toBe(502)
    expect(service.saveGeoScoreCalculation).not.toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it("500 gdy config nie istnieje (seed nie uruchomiony)", async () => {
    loadGrantedApplicationCodes.mockResolvedValue([GEO_SCORE_CALCULATOR_APP_CODE_FOR_TEST])
    const { GeoScoreConfigMissingError } = await import("@cortex/service")
    service.getGeoScoreConfig.mockRejectedValue(new GeoScoreConfigMissingError())
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    const { POST } = await loadHandler()

    const response = await POST(makeRequest({ text: "Firma wdrożyła system." }))

    expect(response.status).toBe(500)
    expect(analyzeGeoScore).not.toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it("200: posiadacz kompletu uprawnień — mapuje config na kontrakt mikroserwisu, zapisuje historię z access.email, zwraca analizę", async () => {
    loadGrantedApplicationCodes.mockResolvedValue([GEO_SCORE_CALCULATOR_APP_CODE_FOR_TEST])
    const { POST } = await loadHandler()

    const response = await POST(
      makeRequest({ text: "Firma wdrożyła system." }, "analityk@firma.pl"),
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual(ANALYSIS_RESPONSE)

    expect(analyzeGeoScore).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "Firma wdrożyła system.",
        weights: { statistics: 0.3, actionVerbs: 0.25, structure: 0.2, objectivity: 0.25 },
        benchmarks: {
          statsPer100Words: 4,
          actionVerbRatio: 0.15,
          bulletsPer500Words: 3,
          maxSubjectiveRatio: 0.05,
        },
        grades: { aMin: 90, bMin: 75, cMin: 60, dMin: 40 },
        actionVerbs: ["wdrożył"],
        subjectiveWords: ["najlepszy"],
        falsePositives: [],
        bulletPatterns: ["^[\\s]*-\\s+"],
      }),
    )

    expect(service.saveGeoScoreCalculation).toHaveBeenCalledWith(
      "analityk@firma.pl",
      expect.objectContaining({
        textContent: "Firma wdrożyła system.",
        wordCount: 3,
        totalScore: 82.4,
        grade: "B",
        statsScore: 91,
        verbsScore: 76,
        structureScore: 88,
        objectivityScore: 100,
        result: ANALYSIS_RESPONSE,
        configSnapshot: CONFIG_ROW,
      }),
    )
  })

  it("200 mimo awarii zapisu historii — wynik jest już policzony, nie może przepaść", async () => {
    loadGrantedApplicationCodes.mockResolvedValue([GEO_SCORE_CALCULATOR_APP_CODE_FOR_TEST])
    service.saveGeoScoreCalculation.mockRejectedValue(new Error("db down"))
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    const { POST } = await loadHandler()

    const response = await POST(makeRequest({ text: "Firma wdrożyła system." }))

    expect(response.status).toBe(200)
    consoleError.mockRestore()
  })
})
