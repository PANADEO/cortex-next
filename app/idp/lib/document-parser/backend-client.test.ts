import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  createBackendJob,
  DocumentParserBackendError,
  getBackendJob,
  mapBackendErrorToCode,
} from "./backend-client"

describe("document-parser backend-client", () => {
  beforeEach(() => {
    vi.stubEnv("DOCUMENT_PARSER_BACKEND_URL", "http://document-parser-backend:8000")
    vi.stubGlobal("fetch", vi.fn())
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  describe("createBackendJob", () => {
    it("wysyła multipart POST /jobs z plikiem i user_email, mapuje odpowiedź", async () => {
      const fetchMock = vi.mocked(fetch)
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ job_id: "abc123", status: "processing" }), { status: 202 }),
      )

      const file = new File(["hello"], "doc.pdf", { type: "application/pdf" })
      const result = await createBackendJob(file, "user@example.com")

      expect(result).toEqual({ jobId: "abc123", status: "processing" })
      const [url, init] = fetchMock.mock.calls[0]!
      expect(url).toBe("http://document-parser-backend:8000/jobs")
      expect(init?.method).toBe("POST")
      const body = init?.body as FormData
      expect(body.get("file")).toBeInstanceOf(File)
      expect(body.get("user_email")).toBe("user@example.com")
    })

    it("mapuje odpowiedź != 2xx na DocumentParserBackendError", async () => {
      const fetchMock = vi.mocked(fetch)
      fetchMock.mockResolvedValueOnce(new Response("boom", { status: 500 }))

      const file = new File(["hello"], "doc.pdf", { type: "application/pdf" })
      await expect(createBackendJob(file, "user@example.com")).rejects.toBeInstanceOf(
        DocumentParserBackendError,
      )
    })

    it("mapuje błąd sieci/timeout na DocumentParserBackendError", async () => {
      const fetchMock = vi.mocked(fetch)
      fetchMock.mockRejectedValueOnce(new Error("network down"))

      const file = new File(["hello"], "doc.pdf", { type: "application/pdf" })
      await expect(createBackendJob(file, "user@example.com")).rejects.toBeInstanceOf(
        DocumentParserBackendError,
      )
    })
  })

  describe("getBackendJob", () => {
    it("mapuje pola snake_case na camelCase", async () => {
      const fetchMock = vi.mocked(fetch)
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            job_id: "abc123",
            status: "done",
            file_name: "doc.pdf",
            model: "openai/gpt-4o-mini",
            markdown: "# Wynik",
            error_message: null,
            page_count: 3,
            image_count: 3,
            truncated: false,
            elapsed_seconds: 4.2,
            created_at: "2026-08-03T10:00:00Z",
            started_at: "2026-08-03T10:00:01Z",
            completed_at: "2026-08-03T10:00:05Z",
          }),
          { status: 200 },
        ),
      )

      const result = await getBackendJob("abc123")

      expect(result).toEqual({
        jobId: "abc123",
        status: "done",
        fileName: "doc.pdf",
        model: "openai/gpt-4o-mini",
        markdown: "# Wynik",
        errorMessage: null,
        pageCount: 3,
        imageCount: 3,
        truncated: false,
        elapsedSeconds: 4.2,
        createdAt: "2026-08-03T10:00:00Z",
        startedAt: "2026-08-03T10:00:01Z",
        completedAt: "2026-08-03T10:00:05Z",
      })
    })

    it("zwraca null na 404 (backend utracił stan zadania — TTL/restart, D4)", async () => {
      const fetchMock = vi.mocked(fetch)
      fetchMock.mockResolvedValueOnce(new Response("not found", { status: 404 }))

      await expect(getBackendJob("gone")).resolves.toBeNull()
    })

    it("mapuje inne błędy (5xx, sieć) na DocumentParserBackendError", async () => {
      const fetchMock = vi.mocked(fetch)
      fetchMock.mockResolvedValueOnce(new Response("boom", { status: 500 }))

      await expect(getBackendJob("abc123")).rejects.toBeInstanceOf(DocumentParserBackendError)
    })
  })

  describe("mapBackendErrorToCode", () => {
    it("mapuje błędy etapu konwersji/renderu na conversion-failed", () => {
      expect(mapBackendErrorToCode("Uploaded file is empty.")).toBe("conversion-failed")
      expect(
        mapBackendErrorToCode("unoconvert failed (exit 1): some libreoffice error"),
      ).toBe("conversion-failed")
      expect(mapBackendErrorToCode("Unable to render PDF pages: bad xref")).toBe("conversion-failed")
    })

    it("mapuje błędy etapu modelu wizyjnego na vision-call-failed", () => {
      expect(mapBackendErrorToCode("OpenAI request failed: 401")).toBe("vision-call-failed")
      expect(mapBackendErrorToCode("Model returned an empty response.")).toBe("vision-call-failed")
      expect(
        mapBackendErrorToCode("CORTEX_PROXY_API_KEY is required to process documents with AI."),
      ).toBe("vision-call-failed")
    })
  })
})
