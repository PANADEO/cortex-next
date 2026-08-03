// Testy kontraktu GET/PUT /api/geo-score-calculator/config — bramka pokryta
// osobno (guard-coverage.test.ts obok). Tu: DTO na GET, walidacja Zod na PUT
// (w tym — kluczowe — odrzucenie kombinacji wag, które NIE sumują się do
// 100%, na serwerze, niezależnie od tego, co przepuściłby klient), i że PUT
// woła updateGeoScoreConfig() z access.email jako `updatedBy` (nigdy z
// ciała żądania).

import type * as CortexService from "@cortex/service"
import { beforeEach, describe, expect, it, vi } from "vitest"

const EMAIL = "admin@firma.pl"

vi.mock("@cortex/service/rbac-store", () => ({
  loadGrantedApplicationCodes: vi.fn(async () => ["geo-score-calculator"]),
  loadGrantedScopes: vi.fn(async () => []),
}))

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
  updatedAt: new Date("2026-08-03T10:00:00Z"),
  updatedBy: "system",
}

// Payload prawidłowy z punktu widzenia Zod — wagi sumują się do 100%.
const VALID_UPDATE_BODY = {
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
}

const service = vi.hoisted(() => ({
  getGeoScoreConfig: vi.fn<() => Promise<Record<string, unknown>>>(),
  updateGeoScoreConfig: vi.fn<(updatedBy: string, input: unknown) => Promise<Record<string, unknown>>>(),
}))
vi.mock("@cortex/service", async (importOriginal) => ({
  ...(await importOriginal<typeof CortexService>()),
  ...service,
}))

const { clearTileAccessCache } = await import("@cortex/service")
const { GET, PUT } = await import("./route")

function request(method: "GET" | "PUT", body?: unknown, email: string | null = EMAIL): Request {
  const headers = new Headers({ "Content-Type": "application/json" })
  if (email) headers.set("x-auth-request-email", email)
  return new Request("http://localhost/api/geo-score-calculator/config", {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  clearTileAccessCache()
  service.getGeoScoreConfig.mockResolvedValue(CONFIG_ROW)
  service.updateGeoScoreConfig.mockResolvedValue(CONFIG_ROW)
})

describe("GET /api/geo-score-calculator/config", () => {
  it("zwraca DTO configu, serializuje updatedAt do ISO string", async () => {
    const response = await GET(request("GET") as never)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.weightStatistics).toBe(0.3)
    expect(body.updatedAt).toBe("2026-08-03T10:00:00.000Z")
  })
})

describe("PUT /api/geo-score-calculator/config", () => {
  it("200: przyjmuje wagi sumujące się do 100%, woła updateGeoScoreConfig z access.email", async () => {
    const response = await PUT(request("PUT", VALID_UPDATE_BODY) as never)

    expect(response.status).toBe(200)
    expect(service.updateGeoScoreConfig).toHaveBeenCalledWith(
      EMAIL,
      expect.objectContaining({ weightStatistics: 0.3, weightActionVerbs: 0.25 }),
    )
  })

  it("400: odrzuca wagi, które NIE sumują się do 100% — walidacja serwerowa, nie tylko UI", async () => {
    const invalid = { ...VALID_UPDATE_BODY, weightStatistics: 0.5 } // suma = 120%
    const response = await PUT(request("PUT", invalid) as never)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBe("invalid-request")
    expect(body.message).toMatch(/100%/)
    expect(service.updateGeoScoreConfig).not.toHaveBeenCalled()
  })

  it("400: odrzuca sumę wag poniżej 100%", async () => {
    const invalid = { ...VALID_UPDATE_BODY, weightObjectivity: 0.05 } // suma = 80%
    const response = await PUT(request("PUT", invalid) as never)

    expect(response.status).toBe(400)
    expect(service.updateGeoScoreConfig).not.toHaveBeenCalled()
  })

  it("400: odrzuca pustą listę czasowników akcji", async () => {
    const invalid = { ...VALID_UPDATE_BODY, actionVerbs: [] }
    const response = await PUT(request("PUT", invalid) as never)

    expect(response.status).toBe(400)
    expect(service.updateGeoScoreConfig).not.toHaveBeenCalled()
  })

  it("400: odrzuca niepoprawny regex we wzorcach bulletów", async () => {
    const invalid = { ...VALID_UPDATE_BODY, bulletPatterns: ["["] }
    const response = await PUT(request("PUT", invalid) as never)

    expect(response.status).toBe(400)
    expect(service.updateGeoScoreConfig).not.toHaveBeenCalled()
  })

  it("dedupuje listy słów po stronie serwera (nie ufa dedupe klienta)", async () => {
    const withDuplicates = {
      ...VALID_UPDATE_BODY,
      actionVerbs: ["wdrożył", "wdrożył", "uruchomił"],
    }
    await PUT(request("PUT", withDuplicates) as never)

    expect(service.updateGeoScoreConfig).toHaveBeenCalledWith(
      EMAIL,
      expect.objectContaining({ actionVerbs: ["wdrożył", "uruchomił"] }),
    )
  })

  it("500 gdy config nie istnieje (seed nie uruchomiony)", async () => {
    const { GeoScoreConfigMissingError } = await import("@cortex/service")
    service.updateGeoScoreConfig.mockRejectedValue(new GeoScoreConfigMissingError())
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})

    const response = await PUT(request("PUT", VALID_UPDATE_BODY) as never)

    expect(response.status).toBe(500)
    consoleError.mockRestore()
  })
})
