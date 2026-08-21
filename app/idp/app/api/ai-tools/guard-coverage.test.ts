// Pokrycie bramki RBAC dla CAŁEGO rejestru AI Tools, na ścieżce ŻĄDANIA.
//
// Po co osobny plik obok route.test.ts: tamte testy sprawdzają 401/403 dla
// JEDNEGO narzędzia (text-highlighter). Ten iteruje po AI_TOOL_APP_CODES, więc
// dopisanie nowego narzędzia do rejestru bez podpięcia go pod canAccessAiTool()
// zapala się tutaj, a nie dopiero na produkcji. Klasa błędu, którą to łapie:
// RBAC sprawdzany wyłącznie w UI (AiToolGate) i nigdy na ścieżce żądania.
//
// Najmocniejsza asercja to nie sam kod 403, tylko `proxyCalls` — odmowa MUSI
// nastąpić ZANIM cokolwiek poleci do cortex-proxy. 403, który po drodze spalił
// tokeny, jest nadal błędem bezpieczeństwa i kosztu.

import { AI_TOOL_APP_CODES, AI_TOOLS_TILE_ID, type AiToolId } from "@/lib/ai-tools/app-codes"
import { getAiToolDefinition } from "@/lib/ai-tools/registry"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Uprawnienia idą z własnego Postgresa (@cortex/service), nie po HTTP do
// cortex-admina — podmieniamy więc wyłącznie odczyt z bazy. Bramka
// (getGrantedApplicationCodes + canAccessAiTool w handlerze) zostaje PRAWDZIWA,
// inaczej test przechodziłby z niewłaściwego powodu.
const loadGrantedApplicationCodes = vi.hoisted(() => vi.fn<(email: string) => Promise<string[]>>())

vi.mock("@cortex/service/rbac-store", () => ({
  loadGrantedApplicationCodes,
  loadGrantedScopes: vi.fn(async () => []),
}))

const PROXY_URL = "http://cortex-proxy"
const PROXY_ENDPOINT = `${PROXY_URL}/v1/chat/completions`

interface GenerateRoute {
  POST: (request: Request) => Promise<Response>
}

interface HistoryRoute {
  GET: (request: Request & { nextUrl: URL }) => Promise<Response>
}

interface ProxyCall {
  headers: Record<string, string>
  body: Record<string, unknown>
}

let historyDir: string | null = null

/** Zwraca listę żądań, które faktycznie doszły do cortex-proxy. Pusta lista na
 *  ścieżce odmowy to główna asercja tego pliku. */
function stubUpstreams(apps: readonly string[]): ProxyCall[] {
  const proxyCalls: ProxyCall[] = []

  loadGrantedApplicationCodes.mockResolvedValue([...apps])

  vi.stubGlobal(
    "fetch",
    vi.fn((input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
      const url = String(input)

      if (url === PROXY_ENDPOINT) {
        proxyCalls.push({
          headers: (init?.headers ?? {}) as Record<string, string>,
          body: JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>,
        })
        return Promise.resolve(
          new Response(
            JSON.stringify({
              choices: [{ message: { content: "wynik" } }],
              usage: { total_tokens: 7 },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
        )
      }

      return Promise.resolve(new Response("not found", { status: 404 }))
    }),
  )

  return proxyCalls
}

async function loadGenerate(): Promise<GenerateRoute> {
  vi.resetModules()
  return (await import("./generate/route")) as unknown as GenerateRoute
}

async function loadHistory(): Promise<HistoryRoute> {
  vi.resetModules()
  return (await import("./history/route")) as unknown as HistoryRoute
}

function generateRequest(toolId: string, email: string | null): Request {
  const headers = new Headers({ "Content-Type": "application/json" })
  if (email) headers.set("x-auth-request-email", email)
  return new Request("http://localhost/api/ai-tools/generate", {
    method: "POST",
    headers,
    body: JSON.stringify({
      toolId,
      scope: getAiToolDefinition(toolId)?.scope ?? toolId,
      systemPrompt: "system",
      userPrompt: "user",
    }),
  })
}

function historyRequest(toolId: string, email: string | null): Request & { nextUrl: URL } {
  const nextUrl = new URL(`http://localhost/api/ai-tools/history?toolId=${toolId}`)
  const headers = new Headers()
  if (email) headers.set("x-auth-request-email", email)
  const request = new Request(nextUrl, { headers }) as Request & { nextUrl: URL }
  request.nextUrl = nextUrl
  return request
}

/** Grant dla INNEGO narzędzia z rejestru — dowodzi, że uprawnienie do jednego
 *  narzędzia nie przecieka na pozostałe. */
function foreignGrant(toolId: AiToolId): AiToolId {
  const index = AI_TOOL_APP_CODES.indexOf(toolId)
  return AI_TOOL_APP_CODES[(index + 1) % AI_TOOL_APP_CODES.length] as AiToolId
}

beforeEach(() => {
  vi.unstubAllEnvs()
  historyDir = mkdtempSync(path.join(tmpdir(), "cortex-ai-tools-guard-"))
  // getRequestEmail() nie odczytuje NODE_ENV (rbac.ts) — fallback bramkowany
  // wyłącznie obecnością DEV_USER_EMAIL. Gasimy ją tu jawnie: bez tego "brak
  // nagłówka" nie znaczyłoby "brak tożsamości".
  vi.stubEnv("DEV_USER_EMAIL", "")
  loadGrantedApplicationCodes.mockReset()
  loadGrantedApplicationCodes.mockResolvedValue([])
  vi.stubEnv("CORTEX_PROXY_URL", PROXY_URL)
  vi.stubEnv("CORTEX_PROXY_API_KEY", "proxy-key")
  vi.stubEnv("LLM_DEFAULT_MODEL", "anthropic/claude-sonnet-4.6")
  vi.stubEnv("AI_TOOLS_HISTORY_DIR", historyDir)
})

afterEach(async () => {
  const { closeAiToolHistoryDatabasesForTests } = await import("../_lib/ai-tools-history")
  closeAiToolHistoryDatabasesForTests()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  if (historyDir) rmSync(historyDir, { force: true, recursive: true })
  historyDir = null
})

describe("AI Tools — bramka dostępu na ścieżce żądania", () => {
  // Sanity check samego testu: gdyby rejestr się wyczyścił, pętle niżej
  // przestałyby cokolwiek sprawdzać, a plik nadal byłby zielony.
  it("rejestr narzędzi nie jest pusty", () => {
    expect(AI_TOOL_APP_CODES.length).toBeGreaterThanOrEqual(8)
  })

  it("POST /generate bez tożsamości zwraca 401 i nie woła cortex-proxy", async () => {
    const proxyCalls = stubUpstreams([AI_TOOLS_TILE_ID])
    const { POST } = await loadGenerate()

    const response = await POST(generateRequest("text-highlighter", null))

    expect(response.status).toBe(401)
    expect(proxyCalls).toHaveLength(0)
  })

  it("GET /history bez tożsamości zwraca 401", async () => {
    stubUpstreams([AI_TOOLS_TILE_ID])
    const { GET } = await loadHistory()

    const response = await GET(historyRequest("text-highlighter", null))

    expect(response.status).toBe(401)
  })

  it("POST /generate dla toolId spoza rejestru zwraca 404 i nie woła cortex-proxy", async () => {
    const proxyCalls = stubUpstreams([AI_TOOLS_TILE_ID])
    const { POST } = await loadGenerate()

    const response = await POST(generateRequest("nie-istnieje", "nieznane@example.com"))

    expect(response.status).toBe(404)
    expect(proxyCalls).toHaveLength(0)
  })

  it("GET /history dla toolId spoza rejestru zwraca 404", async () => {
    stubUpstreams([AI_TOOLS_TILE_ID])
    const { GET } = await loadHistory()

    const response = await GET(historyRequest("nie-istnieje", "nieznane@example.com"))

    expect(response.status).toBe(404)
  })

  for (const toolId of AI_TOOL_APP_CODES) {
    const scope = getAiToolDefinition(toolId)?.scope

    describe(toolId, () => {
      it("ma wpis w rejestrze narzędzi (id ↔ definicja)", () => {
        expect(getAiToolDefinition(toolId)).toBeDefined()
      })

      it("odmawia 403 użytkownikowi z grantem na inne narzędzie i nie woła cortex-proxy", async () => {
        const proxyCalls = stubUpstreams([foreignGrant(toolId)])
        const { POST } = await loadGenerate()

        const response = await POST(generateRequest(toolId, `obcy-${toolId}@example.com`))

        expect(response.status).toBe(403)
        expect(proxyCalls).toHaveLength(0)
      })

      it("odmawia 403 na historii użytkownikowi z grantem na inne narzędzie", async () => {
        stubUpstreams([foreignGrant(toolId)])
        const { GET } = await loadHistory()

        const response = await GET(historyRequest(toolId, `obcy-hist-${toolId}@example.com`))

        expect(response.status).toBe(403)
      })

      it("przepuszcza grant na sam kod narzędzia i wysyła jego scope do cortex-proxy", async () => {
        const email = `wlasny-${toolId}@example.com`
        const proxyCalls = stubUpstreams([toolId])
        const { POST } = await loadGenerate()

        const response = await POST(generateRequest(toolId, email))

        expect(response.status).toBe(200)
        expect(proxyCalls).toHaveLength(1)
        expect(proxyCalls[0]?.headers).toMatchObject({
          "X-Scope": scope,
          "X-User-ID": email,
        })
      })

      it("przepuszcza grant na cały kafelek ai-tools", async () => {
        const proxyCalls = stubUpstreams([AI_TOOLS_TILE_ID])
        const { POST } = await loadGenerate()

        const response = await POST(generateRequest(toolId, `kafelek-${toolId}@example.com`))

        expect(response.status).toBe(200)
        expect(proxyCalls).toHaveLength(1)
      })
    })
  }
})
