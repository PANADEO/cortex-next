// Testy kontraktu GET/DELETE /api/geo-score-calculator/history/:id — bramka
// pokryta osobno (guard-coverage.test.ts obok). Tu: 404 dla cudzego/
// nieistniejącego id (NIGDY 403 — code-service/SKILL.md "Rekordy per-user"
// pkt 2), pełny kształt odpowiedzi GET (result/configSnapshot obecne — w
// odróżnieniu od listy), i że DELETE usuwa dokładnie wskazany wiersz.

import type * as CortexService from "@cortex/service"
import { beforeEach, describe, expect, it, vi } from "vitest"

const EMAIL = "uzytkownik@firma.pl"

vi.mock("@cortex/service/rbac-store", () => ({
  loadGrantedApplicationCodes: vi.fn(async () => ["geo-score-calculator"]),
  loadGrantedScopes: vi.fn(async () => []),
}))

const ROW = {
  id: "calc-1",
  userEmail: EMAIL,
  textContent: "Spółka zainwestowała 5 mln w nowy zakład.",
  textPreview: "Spółka zainwestowała 5 mln w nowy zakład.",
  wordCount: 7,
  totalScore: 82.4,
  grade: "B",
  statsScore: 91,
  verbsScore: 76,
  structureScore: 88,
  objectivityScore: 79,
  result: { totalScore: 82.4, grade: "B", recommendations: [] },
  configSnapshot: { weightStatistics: 0.3, actionVerbs: ["wdrożył"] },
  createdAt: new Date("2026-08-03T10:00:00Z"),
}

const service = vi.hoisted(() => ({
  getMyCalculation: vi.fn<(userEmail: string, id: string) => Promise<Record<string, unknown> | undefined>>(),
  deleteMyCalculation: vi.fn<(userEmail: string, id: string) => Promise<boolean>>(),
}))
vi.mock("@cortex/service", async (importOriginal) => ({
  ...(await importOriginal<typeof CortexService>()),
  ...service,
}))

const { clearTileAccessCache } = await import("@cortex/service")
const { DELETE, GET } = await import("./route")

function request(method: "GET" | "DELETE" = "GET"): Request {
  return new Request("http://localhost/api/geo-score-calculator/history/calc-1", {
    method,
    headers: { "x-auth-request-email": EMAIL },
  })
}

const context = { params: Promise.resolve({ id: "calc-1" }) }

beforeEach(() => {
  vi.clearAllMocks()
  clearTileAccessCache()
})

describe("GET /api/geo-score-calculator/history/[id]", () => {
  it("404 (nigdy 403) gdy kalkulacja nie istnieje ani nie należy do usera", async () => {
    service.getMyCalculation.mockResolvedValueOnce(undefined)

    const response = await GET(request() as never, context)

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: "not-found" })
  })

  it("woła getMyCalculation z access.email i zwraca PEŁNY wiersz — result + configSnapshot obecne", async () => {
    service.getMyCalculation.mockResolvedValueOnce(ROW)

    const response = await GET(request() as never, context)
    const body = await response.json()

    expect(service.getMyCalculation).toHaveBeenCalledWith(EMAIL, "calc-1")
    expect(response.status).toBe(200)
    expect(body.textContent).toBe(ROW.textContent)
    expect(body.result).toEqual(ROW.result)
    expect(body.configSnapshot).toEqual(ROW.configSnapshot)
    expect(body).not.toHaveProperty("userEmail")
  })
})

describe("DELETE /api/geo-score-calculator/history/[id]", () => {
  it("404 (nigdy 403) gdy kalkulacja nie istnieje ani nie należy do userowi", async () => {
    service.deleteMyCalculation.mockResolvedValueOnce(false)

    const response = await DELETE(request("DELETE") as never, context)

    expect(response.status).toBe(404)
  })

  it("usuwa wskazany wiersz właściciela, zwraca {ok:true}", async () => {
    service.deleteMyCalculation.mockResolvedValueOnce(true)

    const response = await DELETE(request("DELETE") as never, context)

    expect(service.deleteMyCalculation).toHaveBeenCalledWith(EMAIL, "calc-1")
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true })
  })
})
