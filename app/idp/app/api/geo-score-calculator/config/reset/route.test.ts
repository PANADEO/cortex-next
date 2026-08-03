// Testy kontraktu POST /api/geo-score-calculator/config/reset — bramka
// pokryta osobno (guard-coverage.test.ts obok). Tu: woła resetGeoScoreConfig
// z access.email (audyt "kto przywrócił"), zwraca zresetowany config jako
// DTO, mapuje GeoScoreConfigMissingError na 500.

import type * as CortexService from "@cortex/service"
import { beforeEach, describe, expect, it, vi } from "vitest"

const EMAIL = "admin@firma.pl"

vi.mock("@cortex/service/rbac-store", () => ({
  loadGrantedApplicationCodes: vi.fn(async () => ["geo-score-calculator"]),
  loadGrantedScopes: vi.fn(async () => []),
}))

const DEFAULT_ROW = {
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
  updatedAt: new Date("2026-08-03T12:00:00Z"),
  updatedBy: EMAIL,
}

const service = vi.hoisted(() => ({
  resetGeoScoreConfig: vi.fn<(updatedBy: string) => Promise<Record<string, unknown>>>(),
}))
vi.mock("@cortex/service", async (importOriginal) => ({
  ...(await importOriginal<typeof CortexService>()),
  ...service,
}))

const { clearTileAccessCache } = await import("@cortex/service")
const { POST } = await import("./route")

function request(email: string | null = EMAIL): Request {
  const headers = new Headers()
  if (email) headers.set("x-auth-request-email", email)
  return new Request("http://localhost/api/geo-score-calculator/config/reset", { method: "POST", headers })
}

beforeEach(() => {
  vi.clearAllMocks()
  clearTileAccessCache()
  service.resetGeoScoreConfig.mockResolvedValue(DEFAULT_ROW)
})

describe("POST /api/geo-score-calculator/config/reset", () => {
  it("woła resetGeoScoreConfig z access.email, zwraca DTO configu", async () => {
    const response = await POST(request() as never)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(service.resetGeoScoreConfig).toHaveBeenCalledWith(EMAIL)
    expect(body.weightStatistics).toBe(0.3)
    expect(body.updatedBy).toBe(EMAIL)
  })

  it("500 gdy config nie istnieje (seed nie uruchomiony)", async () => {
    const { GeoScoreConfigMissingError } = await import("@cortex/service")
    service.resetGeoScoreConfig.mockRejectedValue(new GeoScoreConfigMissingError())
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})

    const response = await POST(request() as never)

    expect(response.status).toBe(500)
    consoleError.mockRestore()
  })
})
