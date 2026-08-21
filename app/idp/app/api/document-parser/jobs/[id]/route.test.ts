// Testy kontraktu GET /api/document-parser/jobs/:id — D4 krok 5-6: przy
// queued/processing route odpytuje backend i mirroruje stan do Postgresa
// PRZED odpowiedzią. Bramka pokryta osobno (guard-coverage.test.ts).

import type * as CortexService from "@cortex/service"
import { beforeEach, describe, expect, it, vi } from "vitest"

const EMAIL = "uzytkownik@firma.pl"

vi.mock("@cortex/service/rbac-store", () => ({
  loadGrantedApplicationCodes: vi.fn(async () => ["document-parser"]),
  loadGrantedScopes: vi.fn(async () => []),
}))

type FixtureRow = Record<string, unknown>

function baseRow(overrides: Record<string, unknown> = {}): FixtureRow {
  return {
    id: "job-1",
    backendJobId: "backend-1",
    userEmail: EMAIL,
    status: "processing",
    fileName: "dokument.pdf",
    fileSizeBytes: 1024,
    mimeType: "application/pdf",
    model: null,
    markdown: null,
    errorMessage: null,
    errorCode: null,
    pageCount: 0,
    imageCount: 0,
    truncated: false,
    elapsedSeconds: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    startedAt: new Date(),
    completedAt: null,
    ...overrides,
  }
}

const service = vi.hoisted(() => ({
  getMyJob: vi.fn<(userEmail: string, id: string) => Promise<FixtureRow | undefined>>(),
  markJobDone:
    vi.fn<(userEmail: string, id: string, input: unknown) => Promise<FixtureRow | undefined>>(),
  markJobError:
    vi.fn<(userEmail: string, id: string, input: unknown) => Promise<FixtureRow | undefined>>(),
}))
vi.mock("@cortex/service", async (importOriginal) => ({
  ...(await importOriginal<typeof CortexService>()),
  ...service,
}))

const backendClient = vi.hoisted(() => ({
  getBackendJob: vi.fn<(backendJobId: string) => Promise<Record<string, unknown> | null>>(),
  mapBackendErrorToCode: vi.fn<(message: string) => "conversion-failed" | "vision-call-failed">(
    () => "conversion-failed",
  ),
  DocumentParserBackendError: class DocumentParserBackendError extends Error {},
}))
vi.mock("@/lib/document-parser/backend-client", () => backendClient)

const { clearTileAccessCache } = await import("@cortex/service")
const { GET } = await import("./route")

function request(): Request {
  return new Request("http://localhost/api/document-parser/jobs/job-1", {
    headers: { "x-auth-request-email": EMAIL },
  })
}

const context = { params: Promise.resolve({ id: "job-1" }) }

beforeEach(() => {
  vi.clearAllMocks()
  clearTileAccessCache()
})

describe("GET /api/document-parser/jobs/[id]", () => {
  it("404 gdy zadanie nie istnieje ani nie należy do usera", async () => {
    service.getMyJob.mockResolvedValueOnce(undefined)

    const response = await GET(request() as never, context)

    expect(response.status).toBe(404)
    expect(backendClient.getBackendJob).not.toHaveBeenCalled()
  })

  it("status done/error: zwraca wiersz bez dotykania backendu", async () => {
    service.getMyJob.mockResolvedValueOnce(baseRow({ status: "done", markdown: "# X" }))

    const response = await GET(request() as never, context)

    expect(response.status).toBe(200)
    expect(backendClient.getBackendJob).not.toHaveBeenCalled()
  })

  it("processing + backend zwraca done: mirroruje do Postgresa przez markJobDone", async () => {
    service.getMyJob.mockResolvedValueOnce(baseRow({ status: "processing" }))
    backendClient.getBackendJob.mockResolvedValueOnce({
      jobId: "backend-1",
      status: "done",
      fileName: "dokument.pdf",
      model: "openai/gpt-4o-mini",
      markdown: "# Wynik",
      errorMessage: null,
      pageCount: 2,
      imageCount: 2,
      truncated: false,
      elapsedSeconds: 3.4,
      createdAt: "2026-08-03T10:00:00Z",
      startedAt: "2026-08-03T10:00:01Z",
      completedAt: "2026-08-03T10:00:04Z",
    })
    service.markJobDone.mockResolvedValueOnce(baseRow({ status: "done", markdown: "# Wynik" }))

    const response = await GET(request() as never, context)

    expect(response.status).toBe(200)
    expect(service.markJobDone).toHaveBeenCalledWith(
      EMAIL,
      "job-1",
      expect.objectContaining({ markdown: "# Wynik", pageCount: 2 }),
    )
    await expect(response.json()).resolves.toMatchObject({ status: "done" })
  })

  it("processing + backend zwraca error: mapuje errorCode i wywołuje markJobError", async () => {
    service.getMyJob.mockResolvedValueOnce(baseRow({ status: "processing" }))
    backendClient.getBackendJob.mockResolvedValueOnce({
      jobId: "backend-1",
      status: "error",
      fileName: "dokument.pdf",
      model: null,
      markdown: null,
      errorMessage: "OpenAI request failed: 401",
      pageCount: 2,
      imageCount: 2,
      truncated: false,
      elapsedSeconds: 1.1,
      createdAt: "2026-08-03T10:00:00Z",
      startedAt: "2026-08-03T10:00:01Z",
      completedAt: "2026-08-03T10:00:02Z",
    })
    backendClient.mapBackendErrorToCode.mockReturnValueOnce("vision-call-failed")
    service.markJobError.mockResolvedValueOnce(
      baseRow({ status: "error", errorCode: "vision-call-failed" }),
    )

    const response = await GET(request() as never, context)

    expect(service.markJobError).toHaveBeenCalledWith(
      EMAIL,
      "job-1",
      expect.objectContaining({
        errorCode: "vision-call-failed",
        errorMessage: "OpenAI request failed: 401",
      }),
    )
    await expect(response.json()).resolves.toMatchObject({ status: "error" })
  })

  it("processing + backend nie zna już zadania (404/TTL): oznacza jako error", async () => {
    service.getMyJob.mockResolvedValueOnce(baseRow({ status: "processing" }))
    backendClient.getBackendJob.mockResolvedValueOnce(null)
    service.markJobError.mockResolvedValueOnce(
      baseRow({ status: "error", errorCode: "conversion-failed" }),
    )

    const response = await GET(request() as never, context)

    expect(service.markJobError).toHaveBeenCalledWith(
      EMAIL,
      "job-1",
      expect.objectContaining({ errorCode: "conversion-failed" }),
    )
    expect(response.status).toBe(200)
  })

  it("processing + błąd sieci do backendu jest PRZEJŚCIOWY: nie psuje stanu, zwraca ostatni znany", async () => {
    const row = baseRow({ status: "processing" })
    service.getMyJob.mockResolvedValueOnce(row)
    backendClient.getBackendJob.mockRejectedValueOnce(
      new backendClient.DocumentParserBackendError("timeout"),
    )

    const response = await GET(request() as never, context)

    expect(response.status).toBe(200)
    expect(service.markJobError).not.toHaveBeenCalled()
    expect(service.markJobDone).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toMatchObject({ status: "processing" })
  })
})
