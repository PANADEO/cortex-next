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

interface GenerateRoute {
  POST: (request: Request) => Promise<Response>
}

const validBody = {
  scope: "text-highlighter",
  systemPrompt: "system",
  toolId: "text-highlighter",
  userPrompt: "user",
}

async function loadHandler(): Promise<GenerateRoute> {
  vi.resetModules()
  return (await import("./route")) as unknown as GenerateRoute
}

function makeRequest(body: unknown, email: string | null = "u@example.com"): Request {
  const headers = new Headers({ "Content-Type": "application/json" })
  if (email) headers.set("x-auth-request-email", email)
  return new Request("http://localhost/api/ai-tools/generate", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.unstubAllEnvs()
  loadGrantedApplicationCodes.mockReset()
  loadGrantedApplicationCodes.mockResolvedValue([])
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe("/api/ai-tools/generate route handler", () => {
  it("returns 401 when no email is available", async () => {
    vi.stubEnv("NODE_ENV", "production")
    const { POST } = await loadHandler()

    const response = await POST(makeRequest(validBody, null))

    expect(response.status).toBe(401)
  })

  it("returns 403 when user lacks the requested mini-app", async () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("CORTEX_PROXY_URL", "http://cortex-proxy")
    loadGrantedApplicationCodes.mockResolvedValue(["idp"])
    const proxyFetch = vi.fn(() => Promise.resolve(new Response("{}", { status: 200 })))
    vi.stubGlobal("fetch", proxyFetch)
    const { POST } = await loadHandler()

    const response = await POST(makeRequest(validBody))

    expect(response.status).toBe(403)
    // Odmowa musi wyprzedzić skutek uboczny — żaden token nie może zostać spalony.
    expect(proxyFetch).not.toHaveBeenCalled()
  })

  it("forwards authorized requests to Cortex Proxy with scope headers", async () => {
    const historyDir = mkdtempSync(path.join(tmpdir(), "cortex-ai-tools-history-test-"))
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("CORTEX_PROXY_URL", "http://cortex-proxy")
    vi.stubEnv("CORTEX_PROXY_API_KEY", "proxy-key")
    vi.stubEnv("LLM_DEFAULT_MODEL", "anthropic/claude-sonnet-4.6")
    vi.stubEnv("AI_TOOLS_HISTORY_DIR", historyDir)
    loadGrantedApplicationCodes.mockResolvedValue(["text-highlighter"])

    const fetchSpy = vi.fn(
      (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
        const url = String(input)
        if (url === "http://cortex-proxy/v1/chat/completions") {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                choices: [{ message: { content: "ok" } }],
                usage: { total_tokens: 42 },
              }),
              {
                status: 200,
                headers: { "Content-Type": "application/json" },
              },
            ),
          )
        }
        void init
        return Promise.resolve(new Response("not found", { status: 404 }))
      },
    )
    vi.stubGlobal("fetch", fetchSpy)
    const { POST } = await loadHandler()

    const response = await POST(makeRequest(validBody))
    const body = (await response.json()) as { content: string; model: string; tokensUsed: number }
    const proxyCall = fetchSpy.mock.calls.find(
      ([input]) => String(input) === "http://cortex-proxy/v1/chat/completions",
    )

    expect(response.status).toBe(200)
    expect(body).toEqual({
      content: "ok",
      model: "anthropic/claude-sonnet-4.6",
      tokensUsed: 42,
    })
    expect(proxyCall).toBeDefined()
    expect(proxyCall?.[1]?.headers).toMatchObject({
      Authorization: "Bearer proxy-key",
      "X-Scope": "text-highlighter",
      "X-User-ID": "u@example.com",
    })
    expect(JSON.parse(String(proxyCall?.[1]?.body))).toMatchObject({
      model: "anthropic/claude-sonnet-4.6",
      prompt: expect.stringContaining("system"),
    })

    const { closeAiToolHistoryDatabasesForTests, listAiToolHistory } =
      await import("../../_lib/ai-tools-history")
    const history = listAiToolHistory("text-highlighter", "u@example.com", 5)
    closeAiToolHistoryDatabasesForTests()
    rmSync(historyDir, { force: true, recursive: true })
    expect(history).toHaveLength(1)
    expect(history[0]).toMatchObject({
      content: "ok",
      model: "anthropic/claude-sonnet-4.6",
      tokensUsed: 42,
      userPrompt: "user",
    })
  })
})
