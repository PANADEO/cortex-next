import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  analyzeGeoScore,
  GeoScoreServiceError,
  type AnalyzeGeoScoreRequest,
} from "./integration-client"

const REQUEST: AnalyzeGeoScoreRequest = {
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
}

const RESPONSE_BODY = {
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

describe("analyzeGeoScore", () => {
  beforeEach(() => {
    vi.stubEnv("GEO_SCORE_SERVICE_URL", "http://geo-score-calculator:8000")
    vi.stubGlobal("fetch", vi.fn())
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("woła POST /analyze pod skonfigurowanym adresem z pełną migawką configu", async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(RESPONSE_BODY), { status: 200 }))

    const result = await analyzeGeoScore(REQUEST)

    expect(fetchMock).toHaveBeenCalledWith(
      "http://geo-score-calculator:8000/analyze",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "Content-Type": "application/json" }),
        body: JSON.stringify(REQUEST),
      }),
    )
    expect(result).toEqual(RESPONSE_BODY)
  })

  it("mapuje odpowiedź != 2xx na GeoScoreServiceError", async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValueOnce(new Response("boom", { status: 500 }))

    await expect(analyzeGeoScore(REQUEST)).rejects.toBeInstanceOf(GeoScoreServiceError)
  })

  it("mapuje błąd sieci/timeout na GeoScoreServiceError", async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockRejectedValueOnce(new Error("network down"))

    await expect(analyzeGeoScore(REQUEST)).rejects.toBeInstanceOf(GeoScoreServiceError)
  })
})
