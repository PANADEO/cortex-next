import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const loadGrantedApplicationCodes = vi.hoisted(() => vi.fn<(email: string) => Promise<string[]>>())

// Uprawnienia z własnego Postgresa (@cortex/service) — podmieniamy sam odczyt
// z bazy, bramka w handlerze zostaje prawdziwa.
vi.mock("@cortex/service/rbac-store", () => ({
  loadGrantedApplicationCodes,
  loadGrantedScopes: vi.fn(async () => []),
}))

import type { AiToolId } from "@/lib/ai-tools/app-codes"

interface HistoryRoute {
  GET: (request: Request & { nextUrl: URL }) => Promise<Response>
}

let historyDir: string | null = null

async function loadHandler(): Promise<HistoryRoute> {
  vi.resetModules()
  return (await import("./route")) as unknown as HistoryRoute
}

function makeRequest(
  toolId: string,
  email: string | null = "u@example.com",
): Request & { nextUrl: URL } {
  const nextUrl = new URL(`http://localhost/api/ai-tools/history?toolId=${toolId}`)
  const headers = new Headers()
  if (email) headers.set("x-auth-request-email", email)
  const request = new Request(nextUrl, { headers }) as Request & { nextUrl: URL }
  request.nextUrl = nextUrl
  return request
}

beforeEach(() => {
  vi.unstubAllEnvs()
  historyDir = mkdtempSync(path.join(tmpdir(), "cortex-ai-tools-history-test-"))
  vi.stubEnv("AI_TOOLS_HISTORY_DIR", historyDir)
})

afterEach(async () => {
  const { closeAiToolHistoryDatabasesForTests } = await import("../../_lib/ai-tools-history")
  closeAiToolHistoryDatabasesForTests()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  if (historyDir) rmSync(historyDir, { force: true, recursive: true })
  historyDir = null
})

describe("/api/ai-tools/history route handler", () => {
  it("returns 401 when no email is available", async () => {
    vi.stubEnv("NODE_ENV", "production")
    const { GET } = await loadHandler()

    const response = await GET(makeRequest("text-highlighter", null))

    expect(response.status).toBe(401)
  })

  it("returns 403 when user lacks access to the requested mini-app", async () => {
    vi.stubEnv("NODE_ENV", "production")
    loadGrantedApplicationCodes.mockResolvedValue(["linkedin-generator"])
    const { GET } = await loadHandler()

    const response = await GET(makeRequest("text-highlighter"))

    expect(response.status).toBe(403)
  })

  it("returns history only for the current user and requested tool", async () => {
    vi.stubEnv("NODE_ENV", "production")
    loadGrantedApplicationCodes.mockResolvedValue(["text-highlighter"])
    vi.resetModules()
    const { saveAiToolHistoryRecord } = await import("../../_lib/ai-tools-history")
    saveRecord("text-highlighter", "u@example.com", "visible")
    saveRecord("text-highlighter", "other@example.com", "hidden user")
    saveRecord("linkedin-generator", "u@example.com", "hidden tool")

    function saveRecord(toolId: AiToolId, userEmail: string, content: string): void {
      saveAiToolHistoryRecord({
        content,
        image: undefined,
        model: "test-model",
        scope: toolId,
        systemPrompt: "system",
        tokensUsed: 12,
        toolId,
        userEmail,
        userPrompt: `prompt ${content}`,
      })
    }

    const { GET } = (await import("./route")) as unknown as HistoryRoute
    const response = await GET(makeRequest("text-highlighter"))
    const body = (await response.json()) as {
      items: Array<{ content: string; tokensUsed: number | null; userPrompt: string }>
    }

    expect(response.status).toBe(200)
    expect(body.items).toHaveLength(1)
    expect(body.items[0]).toMatchObject({
      content: "visible",
      tokensUsed: 12,
      userPrompt: "prompt visible",
    })
  })
})
