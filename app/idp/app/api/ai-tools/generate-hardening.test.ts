// Regresja dla dwóch błędów route'u /api/ai-tools/generate, udowodnionych
// uruchomionym kodem podczas dopisywania testów do modułu AI Tools:
//
//   1. `scope`/`model`/`maxTokens` przychodziły z body i leciały do cortex-proxy
//      bez porównania z `toolId`. RBAC sprawdza `toolId`, więc użytkownik z
//      grantem na jedno (tanie) narzędzie księgował zużycie na CUDZY scope i
//      podnosił limit tokenów. Naprawa: serwer wyprowadza te trzy wartości z
//      rejestru narzędzi, a body ich w ogóle nie przenosi.
//
//   2. `saveAiToolHistoryRecord()` był w tym samym `try`, co `callCortexProxy()`.
//      Błąd SQLite po UDANEJ generacji wpadał w catch zwracający 502
//      "cortex-proxy-error" — użytkownik tracił opłaconą odpowiedź LLM.
//
// Asercje celują w to, co FAKTYCZNIE wychodzi do cortex-proxy (nagłówki i
// payload), bo to one decydują o atrybucji kosztów — nie w kształt body żądania.

import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { AI_TOOLS_TILE_ID } from "@/lib/ai-tools/app-codes"

// Uprawnienia idą z własnego Postgresa (@cortex/service), nie po HTTP do
// cortex-admina — podmieniamy wyłącznie odczyt z bazy, sama bramka w handlerze
// zostaje prawdziwa.
const loadGrantedApplicationCodes = vi.hoisted(() => vi.fn<(email: string) => Promise<string[]>>())

vi.mock("@cortex/service/rbac-store", () => ({
  loadGrantedApplicationCodes,
  loadGrantedScopes: vi.fn(async () => []),
}))

const PROXY_URL = "http://cortex-proxy"
const PROXY_ENDPOINT = `${PROXY_URL}/v1/chat/completions`
const TEXT_MODEL = "anthropic/claude-sonnet-4.6"
const VISION_MODEL = "openai/gpt-4o-mini"
const PNG_DATA_URL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg=="

interface GenerateRoute {
  POST: (request: Request) => Promise<Response>
}

interface ProxyCall {
  headers: Record<string, string>
  body: Record<string, unknown>
}

let historyDir: string | null = null

function stubUpstreams(apps: readonly string[], proxyStatus = 200): ProxyCall[] {
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
        if (proxyStatus !== 200) {
          return Promise.resolve(new Response("upstream down", { status: proxyStatus }))
        }
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

function generateRequest(body: Record<string, unknown>, email: string): Request {
  const headers = new Headers({ "Content-Type": "application/json" })
  headers.set("x-auth-request-email", email)
  return new Request("http://localhost/api/ai-tools/generate", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.unstubAllEnvs()
  historyDir = mkdtempSync(path.join(tmpdir(), "cortex-ai-tools-hardening-"))
  vi.stubEnv("NODE_ENV", "production")
  loadGrantedApplicationCodes.mockReset()
  loadGrantedApplicationCodes.mockResolvedValue([])
  vi.stubEnv("CORTEX_PROXY_URL", PROXY_URL)
  vi.stubEnv("CORTEX_PROXY_API_KEY", "proxy-key")
  vi.stubEnv("LLM_DEFAULT_MODEL", TEXT_MODEL)
  vi.stubEnv("AI_TOOLS_VISION_MODEL", VISION_MODEL)
  vi.stubEnv("AI_TOOLS_HISTORY_DIR", historyDir)
})

afterEach(async () => {
  const { closeAiToolHistoryDatabasesForTests } = await import("../_lib/ai-tools-history")
  closeAiToolHistoryDatabasesForTests()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  if (historyDir) rmSync(historyDir, { force: true, recursive: true })
  historyDir = null
})

describe("AI Tools /generate — scope, model i limit tokenów pochodzą z rejestru", () => {
  // Dosłowne odtworzenie dowodu z audytu: grant WYŁĄCZNIE na ai-summarizer,
  // w body podszyty scope droższego narzędzia. Przed naprawą: 200 z
  // X-Scope: invoice-analyzer (zużycie zaksięgowane na cudzy scope).
  it("ignoruje `scope` z body i wysyła scope przypisany do toolId", async () => {
    const proxyCalls = stubUpstreams(["ai-summarizer"])
    const { POST } = await loadGenerate()

    const response = await POST(
      generateRequest(
        {
          toolId: "ai-summarizer",
          scope: "invoice-analyzer",
          systemPrompt: "system",
          userPrompt: "user",
        },
        "podszywacz@example.com",
      ),
    )

    expect(response.status).toBe(200)
    expect(proxyCalls).toHaveLength(1)
    expect(proxyCalls[0]?.headers["X-Scope"]).toBe("summarizer")
    expect(proxyCalls[0]?.headers["X-App"]).toBe("Summarizer")
  })

  it("ignoruje `model` z body i wybiera model po stronie serwera", async () => {
    const proxyCalls = stubUpstreams(["ai-summarizer"])
    const { POST } = await loadGenerate()

    const response = await POST(
      generateRequest(
        {
          toolId: "ai-summarizer",
          model: "openai/o3-pro-drogi",
          systemPrompt: "system",
          userPrompt: "user",
        },
        "podszywacz-model@example.com",
      ),
    )
    const body = (await response.json()) as { model: string }

    expect(response.status).toBe(200)
    expect(proxyCalls[0]?.body["model"]).toBe(TEXT_MODEL)
    expect(body.model).toBe(TEXT_MODEL)
  })

  it("ignoruje `maxTokens` z body — narzędzie bez limitu dostaje limit domyślny", async () => {
    const proxyCalls = stubUpstreams(["ai-summarizer"])
    const { POST } = await loadGenerate()

    const response = await POST(
      generateRequest(
        {
          toolId: "ai-summarizer",
          maxTokens: 16_000,
          systemPrompt: "system",
          userPrompt: "user",
        },
        "podszywacz-limit@example.com",
      ),
    )

    expect(response.status).toBe(200)
    expect(proxyCalls[0]?.body["max_tokens"]).toBe(8000)
  })

  // Zastępuje asercje E2E (`maxTokens: 12000`, `model: undefined`), które po
  // naprawie sprawdzałyby wyłącznie intencję klienta — tu sprawdzana jest
  // wartość, która realnie dociera do LLM.
  it("fakturomat: limit z rejestru i model wizyjny wybrany po obecności obrazu", async () => {
    const proxyCalls = stubUpstreams(["fakturomat"])
    const { POST } = await loadGenerate()

    const response = await POST(
      generateRequest(
        {
          toolId: "fakturomat",
          maxTokens: 16_000,
          model: "anthropic/claude-opus-4.6",
          systemPrompt: "system",
          userPrompt: "user",
          image: { dataUrl: PNG_DATA_URL, mimeType: "image/png" },
        },
        "faktury@example.com",
      ),
    )

    expect(response.status).toBe(200)
    expect(proxyCalls[0]?.body["max_tokens"]).toBe(12_000)
    expect(proxyCalls[0]?.body["model"]).toBe(VISION_MODEL)
    expect(proxyCalls[0]?.headers["X-Scope"]).toBe("invoice-analyzer")
  })

  // Tabela WPISANA NA SZTYWNO, celowo nie czytana z rejestru: podmiana scope'u
  // albo limitu w registry.ts to zmiana atrybucji kosztów po stronie
  // cortex-proxy i ma zapalić się tutaj na czerwono, a nie przejść cicho.
  // (Rolę tę pełniło wcześniej E2E, które po naprawie widzi już tylko `toolId`.)
  const EXPECTED_PROXY_ATTRIBUTION = [
    { toolId: "text-highlighter", scope: "text-highlighter", app: "Text Highlighter", max: 8000 },
    { toolId: "text-transformer", scope: "text-transformer", app: "Text Transformer", max: 8000 },
    { toolId: "text-analyzer", scope: "text-analyzer", app: "Text Analyzer", max: 8000 },
    { toolId: "ai-summarizer", scope: "summarizer", app: "Summarizer", max: 8000 },
    { toolId: "content-guru", scope: "content-creator", app: "Content Creator", max: 8000 },
    {
      toolId: "linkedin-generator",
      scope: "linkedin-generator",
      app: "LinkedIn Generator",
      max: 8000,
    },
    {
      toolId: "presentation-generator",
      scope: "presentation-generator",
      app: "Presentation Generator",
      max: 12_000,
    },
    { toolId: "fakturomat", scope: "invoice-analyzer", app: "Invoice Analyzer", max: 12_000 },
    { toolId: "ai-daily-assistant", scope: "chatbot", app: "AI Chatbot", max: 8000 },
  ] as const

  for (const expected of EXPECTED_PROXY_ATTRIBUTION) {
    it(`${expected.toolId}: X-Scope=${expected.scope}, X-App=${expected.app}, limit=${expected.max}`, async () => {
      const proxyCalls = stubUpstreams([AI_TOOLS_TILE_ID])
      const { POST } = await loadGenerate()

      const response = await POST(
        generateRequest(
          { toolId: expected.toolId, systemPrompt: "system", userPrompt: "user" },
          `atrybucja-${expected.toolId}@example.com`,
        ),
      )

      expect(response.status).toBe(200)
      expect(proxyCalls).toHaveLength(1)
      expect(proxyCalls[0]?.headers["X-Scope"]).toBe(expected.scope)
      expect(proxyCalls[0]?.headers["X-App"]).toBe(expected.app)
      expect(proxyCalls[0]?.body["max_tokens"]).toBe(expected.max)
    })
  }
})

describe("AI Tools /generate — awaria zapisu historii nie kasuje odpowiedzi LLM", () => {
  // Dosłowne odtworzenie dowodu z audytu: katalog historii pod nieutworzalną
  // ścieżką (mkdir na /dev/null/... → ENOTDIR), cortex-proxy odpowiada poprawnie.
  // Przed naprawą: 502 cortex-proxy-error mimo proxyCalls=1.
  it("zwraca 200 z treścią, gdy zapis do SQLite rzuca po udanej generacji", async () => {
    vi.stubEnv("AI_TOOLS_HISTORY_DIR", path.join("/dev/null", "nie-da-sie"))
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const proxyCalls = stubUpstreams(["ai-summarizer"])
    const { POST } = await loadGenerate()

    const response = await POST(
      generateRequest(
        { toolId: "ai-summarizer", systemPrompt: "system", userPrompt: "user" },
        "historia-pada@example.com",
      ),
    )
    const body = (await response.json()) as { content: string; tokensUsed: number }

    expect(proxyCalls).toHaveLength(1)
    expect(response.status).toBe(200)
    expect(body.content).toBe("wynik")
    expect(body.tokensUsed).toBe(7)
    expect(warn).toHaveBeenCalledTimes(1)
  })

  // Kontrola przeciwna: izolacja zapisu historii nie może wyciszyć PRAWDZIWEJ
  // awarii cortex-proxy.
  it("nadal zwraca 502, gdy to cortex-proxy odpowiada błędem", async () => {
    const proxyCalls = stubUpstreams(["ai-summarizer"], 503)
    const { POST } = await loadGenerate()

    const response = await POST(
      generateRequest(
        { toolId: "ai-summarizer", systemPrompt: "system", userPrompt: "user" },
        "proxy-pada@example.com",
      ),
    )
    const body = (await response.json()) as { error: string }

    expect(proxyCalls).toHaveLength(1)
    expect(response.status).toBe(502)
    expect(body.error).toBe("cortex-proxy-error")
  })
})
