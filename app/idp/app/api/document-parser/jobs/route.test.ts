// Testy kontraktu route'a POST/GET /api/document-parser/jobs — bramka jest
// pokryta osobno (guard-coverage.test.ts); tu sprawdzamy właściwą logikę:
// walidację pliku (400/413), szybką odpowiedź 202 przy udanym dispatchu, i
// mapowanie porażki dispatchu na 502 + oznaczenie wiersza jako błąd (D4).

import type * as CortexService from "@cortex/service"
import { beforeEach, describe, expect, it, vi } from "vitest"

const EMAIL = "uzytkownik@firma.pl"

vi.mock("@cortex/service/rbac-store", () => ({
  loadGrantedApplicationCodes: vi.fn(async () => ["document-parser"]),
  loadGrantedScopes: vi.fn(async () => []),
}))

const service = vi.hoisted(() => ({
  listMyJobs: vi.fn<() => Promise<Record<string, unknown>[]>>(async () => []),
  createQueuedJob: vi.fn(async (email: string, input: unknown) => ({ id: "job-1", ...(input as object) })),
  markJobProcessing: vi.fn<(...args: unknown[]) => Promise<Record<string, unknown> | undefined>>(
    async () => undefined,
  ),
  markJobError: vi.fn<(...args: unknown[]) => Promise<Record<string, unknown> | undefined>>(
    async () => undefined,
  ),
}))
vi.mock("@cortex/service", async (importOriginal) => ({
  ...(await importOriginal<typeof CortexService>()),
  ...service,
}))

const backendClient = vi.hoisted(() => ({
  createBackendJob: vi.fn(async () => ({ jobId: "backend-1", status: "processing" as const })),
  DocumentParserBackendError: class DocumentParserBackendError extends Error {},
}))
vi.mock("@/lib/document-parser/backend-client", () => backendClient)

const { clearTileAccessCache } = await import("@cortex/service")
const { GET, POST } = await import("./route")

function pdfFile(name = "dokument.pdf", size = 1024): File {
  return new File([new Uint8Array(size)], name, { type: "application/pdf" })
}

function uploadRequest(file: File | null): Request {
  const form = new FormData()
  if (file) form.set("file", file)
  return new Request("http://localhost/api/document-parser/jobs", {
    method: "POST",
    body: form,
    headers: { "x-auth-request-email": EMAIL },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  clearTileAccessCache()
  service.listMyJobs.mockResolvedValue([])
  service.markJobProcessing.mockResolvedValue(undefined)
  service.markJobError.mockResolvedValue(undefined)
  backendClient.createBackendJob.mockResolvedValue({ jobId: "backend-1", status: "processing" })
})

describe("POST /api/document-parser/jobs", () => {
  it("odrzuca nieobsługiwany format PRZED wywołaniem backendu (400)", async () => {
    const response = await POST(
      uploadRequest(new File(["x"], "zloczynca.exe", { type: "application/octet-stream" })) as never,
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ error: "unsupported-format" })
    expect(service.createQueuedJob).not.toHaveBeenCalled()
    expect(backendClient.createBackendJob).not.toHaveBeenCalled()
  })

  it("odrzuca za duży plik (413)", async () => {
    const response = await POST(uploadRequest(pdfFile("wielki.pdf", 200 * 1024 * 1024)) as never)

    expect(response.status).toBe(413)
    await expect(response.json()).resolves.toMatchObject({ error: "file-too-large" })
    expect(service.createQueuedJob).not.toHaveBeenCalled()
  })

  it("odrzuca żądanie bez pliku (400)", async () => {
    const response = await POST(uploadRequest(null) as never)

    expect(response.status).toBe(400)
    expect(service.createQueuedJob).not.toHaveBeenCalled()
  })

  it("dla poprawnego pliku: INSERT queued, dispatch do backendu, 202 {jobId} — SZYBKO", async () => {
    const started = performance.now()
    const response = await POST(uploadRequest(pdfFile()) as never)
    const elapsedMs = performance.now() - started

    expect(response.status).toBe(202)
    await expect(response.json()).resolves.toMatchObject({ status: "processing" })
    expect(service.createQueuedJob).toHaveBeenCalledWith(
      EMAIL,
      expect.objectContaining({ fileName: "dokument.pdf", mimeType: "application/pdf" }),
    )
    expect(backendClient.createBackendJob).toHaveBeenCalledTimes(1)
    expect(service.markJobProcessing).toHaveBeenCalledWith(EMAIL, expect.any(String), "backend-1")
    // Handler samego route'a (bez sieci — adapter jest zamockowany) musi być
    // rzędu milisekund, nie sekund — dowód, że nie ma tu czekania na
    // przetwarzanie, zgodnie z D4.
    expect(elapsedMs).toBeLessThan(500)
  })

  it("gdy dispatch do backendu pada: oznacza wiersz jako error i zwraca 502", async () => {
    backendClient.createBackendJob.mockRejectedValueOnce(
      new backendClient.DocumentParserBackendError("backend nieosiągalny"),
    )

    const response = await POST(uploadRequest(pdfFile()) as never)

    expect(response.status).toBe(502)
    expect(service.markJobError).toHaveBeenCalledWith(
      EMAIL,
      expect.any(String),
      expect.objectContaining({ errorCode: "conversion-failed" }),
    )
  })
})

describe("GET /api/document-parser/jobs", () => {
  it("zwraca listę zadań usera z listMyJobs", async () => {
    service.listMyJobs.mockResolvedValueOnce([{ id: "job-1" }])
    const request = new Request("http://localhost/api/document-parser/jobs", {
      headers: { "x-auth-request-email": EMAIL },
    })

    const response = await GET(request as never)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual([{ id: "job-1" }])
    expect(service.listMyJobs).toHaveBeenCalledWith(EMAIL)
  })
})
