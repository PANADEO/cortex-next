// Testy funkcjonalne GET /api/content-guru/jobs/:id — polling dla trybów
// batch/pakiet (D4 krok 4). Bramka autoryzacji (bypass attempts) jest osobno
// w guard-coverage.test.ts.

import type * as CortexService from "@cortex/service"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@cortex/service/rbac-store", () => ({
  loadGrantedApplicationCodes: vi.fn(async () => ["content-guru"]),
  loadGrantedScopes: vi.fn(async () => []),
}))

const service = vi.hoisted(() => ({
  getMyGenerationJob: vi.fn(async () => undefined as CortexServiceJobRow | undefined),
}))
vi.mock("@cortex/service", async (importOriginal) => ({
  ...(await importOriginal<typeof CortexService>()),
  ...service,
}))

type CortexServiceJobRow = {
  id: string
  userEmail: string
  mode: "batch" | "package"
  status: "queued" | "running" | "done" | "done-with-errors"
  items: unknown[]
  createdAt: Date
  completedAt: Date | null
}

const { clearTileAccessCache } = await import("@cortex/service")
const { GET } = await import("./route")

const EMAIL = "tworca@firma.pl"
const JOB_ID = "00000000-0000-0000-0000-000000000123"

function makeRequest(email: string | null = EMAIL): Request {
  const headers = new Headers()
  if (email) headers.set("x-auth-request-email", email)
  return new Request(`http://localhost/api/content-guru/jobs/${JOB_ID}`, { headers })
}

const context = { params: Promise.resolve({ id: JOB_ID }) }

beforeEach(() => {
  clearTileAccessCache()
  service.getMyGenerationJob.mockReset()
  vi.unstubAllEnvs()
  vi.stubEnv("NODE_ENV", "production")
})

describe("GET /api/content-guru/jobs/:id", () => {
  it("200 + wiersz joba, gdy istnieje i należy do wołającego", async () => {
    const row: CortexServiceJobRow = {
      id: JOB_ID,
      userEmail: EMAIL,
      mode: "batch",
      status: "running",
      items: [
        { templateId: "t1", templateLabel: "Kategoria — Nazwa", topic: "Temat", status: "running" },
      ],
      createdAt: new Date("2026-08-03T00:00:00Z"),
      completedAt: null,
    }
    service.getMyGenerationJob.mockResolvedValueOnce(row)

    const response = await GET(makeRequest() as never, context)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(service.getMyGenerationJob).toHaveBeenCalledWith(EMAIL, JOB_ID)
    expect(json.id).toBe(JOB_ID)
    expect(json.status).toBe("running")
    expect(json.items).toHaveLength(1)
  })

  it("404 dla nieistniejącego joba", async () => {
    service.getMyGenerationJob.mockResolvedValueOnce(undefined)

    const response = await GET(makeRequest() as never, context)

    expect(response.status).toBe(404)
  })

  it("404 dla CUDZEGO joba — getMyGenerationJob zwraca undefined, route NIGDY nie zdradza 403 (code-service 'Rekordy per-user' pkt 2)", async () => {
    // getMyGenerationJob() samo filtruje po userEmail w WHERE — dla cudzego
    // id zwraca undefined identycznie jak dla nieistniejącego, więc z
    // perspektywy tego route'a oba przypadki są nierozróżnialne (poprawnie).
    service.getMyGenerationJob.mockResolvedValueOnce(undefined)

    const response = await GET(makeRequest() as never, context)

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: "not-found" })
  })
})
