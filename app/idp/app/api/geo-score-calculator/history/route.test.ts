// Testy kontraktu GET /api/geo-score-calculator/history — bramka pokryta
// osobno (guard-coverage.test.ts obok); tu sprawdzamy, że route woła
// listMyCalculations() z access.email (nigdy z query/body) i trymuje
// odpowiedź do DTO listy (bez textContent/result/configSnapshot).

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
  textContent: "Tekst bardzo długi, którego lista nie powinna nigdy zwracać.",
  textPreview: "Tekst bardzo długi…",
  wordCount: 9,
  totalScore: 82.4,
  grade: "B",
  statsScore: 91,
  verbsScore: 76,
  structureScore: 88,
  objectivityScore: 79,
  result: { totalScore: 82.4 },
  configSnapshot: { weightStatistics: 0.3 },
  createdAt: new Date("2026-08-03T10:00:00Z"),
}

const service = vi.hoisted(() => ({
  listMyCalculations: vi.fn<(userEmail: string) => Promise<Record<string, unknown>[]>>(),
}))
vi.mock("@cortex/service", async (importOriginal) => ({
  ...(await importOriginal<typeof CortexService>()),
  ...service,
}))

const { clearTileAccessCache } = await import("@cortex/service")
const { GET } = await import("./route")

function request(email: string | null = EMAIL): Request {
  const headers = new Headers()
  if (email) headers.set("x-auth-request-email", email)
  return new Request("http://localhost/api/geo-score-calculator/history", { headers })
}

beforeEach(() => {
  vi.clearAllMocks()
  clearTileAccessCache()
  service.listMyCalculations.mockResolvedValue([ROW])
})

describe("GET /api/geo-score-calculator/history", () => {
  it("woła listMyCalculations z access.email, nigdy inaczej", async () => {
    const response = await GET(request() as never)

    expect(response.status).toBe(200)
    expect(service.listMyCalculations).toHaveBeenCalledWith(EMAIL)
    expect(service.listMyCalculations).toHaveBeenCalledTimes(1)
  })

  it("trymuje odpowiedź do DTO listy — bez textContent/result/configSnapshot", async () => {
    const response = await GET(request() as never)
    const body = await response.json()

    expect(body).toEqual([
      {
        id: "calc-1",
        textPreview: "Tekst bardzo długi…",
        wordCount: 9,
        totalScore: 82.4,
        grade: "B",
        createdAt: "2026-08-03T10:00:00.000Z",
      },
    ])
    expect(body[0]).not.toHaveProperty("textContent")
    expect(body[0]).not.toHaveProperty("result")
    expect(body[0]).not.toHaveProperty("configSnapshot")
    expect(body[0]).not.toHaveProperty("userEmail")
  })

  it("pusta historia zwraca pustą tablicę, nie błąd", async () => {
    service.listMyCalculations.mockResolvedValueOnce([])

    const response = await GET(request() as never)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual([])
  })
})
