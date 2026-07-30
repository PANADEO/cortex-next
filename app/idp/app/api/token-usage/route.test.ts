// Test route'a z podmienionym `fetch` — wzorem ai-tools/generate/route.test.ts.
// Bramka (requireTileAccess) zostaje PRAWDZIWA; podmieniana jest tylko funkcja
// sięgająca do bazy po granty, żeby test nie potrzebował Postgresa.

import { beforeEach, describe, expect, it, vi } from "vitest"

const loadGrantedApplicationCodes = vi.hoisted(() => vi.fn<(email: string) => Promise<string[]>>())

vi.mock("@cortex/service/rbac-store", () => ({
  loadGrantedApplicationCodes,
  loadGrantedScopes: vi.fn(async () => []),
}))

const { clearTileAccessCache } = await import("@cortex/service")
const { GET } = await import("./route")

const ADMIN = "admin@firma.pl"
const ADMIN_KEY = "sekret-administracyjny"

const ROW = {
  user_id: "jan.kowalski@firma.pl",
  source_app: "Cortex360 AI Tools",
  scope: "linkedin-generator",
  model: "anthropic/claude-sonnet-4.6",
  request_tokens: 12,
  response_tokens: 8,
  reasoning_tokens: 1,
  cached_tokens: 1,
  total_tokens: 21,
  request_count: 2,
}

function request(query = "start=2026-07-01&end=2026-07-30", email: string | null = ADMIN): Request {
  const headers = new Headers()
  if (email) headers.set("x-auth-request-email", email)
  return new Request(`http://localhost/api/token-usage?${query}`, { headers })
}

type FetchMock = ReturnType<typeof makeFetchMock>

function makeFetchMock(response: Response | (() => Response)) {
  // Sygnatura deklarowana w generyku, nie w argumentach implementacji: dzięki
  // temu `mock.calls[0]` ma typ krotki (odczyt URL-a i nagłówków bez rzutowania),
  // a implementacja nie musi przyjmować argumentów, których nie używa.
  return vi.fn<(url: string, init: RequestInit) => Promise<Response>>(async () =>
    typeof response === "function" ? response() : response,
  )
}

function stubFetch(response: Response | (() => Response)): FetchMock {
  const fetchMock = makeFetchMock(response)
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

function readCall(fetchMock: FetchMock): [string, RequestInit] {
  const call = fetchMock.mock.calls[0]
  if (!call) throw new Error("cortex-proxy nie został zawołany")
  return call
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

beforeEach(() => {
  clearTileAccessCache()
  loadGrantedApplicationCodes.mockReset()
  loadGrantedApplicationCodes.mockResolvedValue(["token-usage"])
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.stubEnv("NODE_ENV", "production")
  vi.stubEnv("CORTEX_PROXY_URL", "http://cortex-proxy")
  vi.stubEnv("CORTEX_PROXY_ADMIN_API_KEY", ADMIN_KEY)
})

describe("GET /api/token-usage — droga szczęśliwa", () => {
  it("zwraca zagregowany model widoku, nie surową odpowiedź proxy", async () => {
    stubFetch(jsonResponse([ROW]))

    const response = await GET(request() as never)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.range).toEqual({ start: "2026-07-01", end: "2026-07-30" })
    expect(body.totals.totalTokens).toBe(21)
    expect(body.totals.reasoningTokens).toBe(1)
    expect(body.byUser[0]).toMatchObject({ key: "jan.kowalski@firma.pl", share: 100 })
    expect(body.byModel[0]?.key).toBe("anthropic/claude-sonnet-4.6")
    expect(body.rows).toHaveLength(1)
  })

  it("przekazuje zakres dat do proxy BEZ konwersji stref", async () => {
    const fetchMock = stubFetch(jsonResponse([]))

    await GET(request("start=2026-01-15&end=2026-02-15") as never)

    const url = new URL(readCall(fetchMock)[0])
    expect(url.searchParams.get("start")).toBe("2026-01-15")
    expect(url.searchParams.get("end")).toBe("2026-02-15")
  })

  it("odpowiedź z PII nie ma prawa wylądować w cache pośrednika", async () => {
    stubFetch(jsonResponse([ROW]))

    const response = await GET(request() as never)

    expect(response.headers.get("Cache-Control")).toContain("no-store")
  })

  it("pusty zakres to 200 z pustym raportem, nie błąd", async () => {
    stubFetch(jsonResponse([]))

    const response = await GET(request() as never)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.totals.totalTokens).toBe(0)
    expect(body.byUser).toEqual([])
  })
})

describe("GET /api/token-usage — sekret nie opuszcza serwera", () => {
  // Najważniejsza własność bezpieczeństwa modułu.
  it("klucz administracyjny nie pojawia się w ciele odpowiedzi", async () => {
    stubFetch(jsonResponse([ROW]))

    const response = await GET(request() as never)
    const text = await response.text()

    expect(text).not.toContain(ADMIN_KEY)
  })

  it.each([
    ["401 z proxy", () => new Response("unauthorized", { status: 401 })],
    ["500 z proxy", () => new Response("error reading usage", { status: 500 })],
  ])("klucz nie wycieka w odpowiedzi błędu (%s)", async (_label, make) => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    stubFetch(make)

    const response = await GET(request() as never)
    const text = await response.text()

    expect(text).not.toContain(ADMIN_KEY)
    consoleError.mockRestore()
  })

  it("klucz nie trafia do logu serwera", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    stubFetch(() => new Response("unauthorized", { status: 401 }))

    await GET(request() as never)

    const logged = consoleError.mock.calls.flat().map(String).join(" ")
    expect(logged).not.toContain(ADMIN_KEY)
    consoleError.mockRestore()
  })

  it("klucz idzie nagłówkiem, nigdy w query stringu", async () => {
    const fetchMock = stubFetch(jsonResponse([]))

    await GET(request() as never)

    const [url, init] = readCall(fetchMock)
    expect(url).not.toContain(ADMIN_KEY)
    expect((init.headers as Record<string, string>)["X-Admin-API-Key"]).toBe(ADMIN_KEY)
  })
})

describe("GET /api/token-usage — walidacja zakresu dat", () => {
  it("odrzuca brak parametrów zanim dotknie proxy", async () => {
    const fetchMock = stubFetch(jsonResponse([]))

    const response = await GET(request("") as never)

    expect(response.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each([
    ["zły format", "start=01.07.2026&end=2026-07-30", "invalid-format"],
    ["nieistniejąca data", "start=2026-02-30&end=2026-03-01", "invalid-date"],
    ["odwrócony zakres", "start=2026-07-30&end=2026-07-01", "reversed-range"],
    ["zakres ponad limit", "start=2020-01-01&end=2026-07-30", "range-too-long"],
  ])("odrzuca %s czytelnym 400", async (_label, query, code) => {
    const fetchMock = stubFetch(jsonResponse([]))

    const response = await GET(request(query) as never)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBe(code)
    expect(body.message).toBeTruthy()
    // Ochrona CUDZEGO serwisu produkcyjnego: odrzucone żądanie nigdy go nie dotyka.
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe("GET /api/token-usage — brak konfiguracji i awarie upstreamu", () => {
  it("brak sekretu daje 503 z jawnym kodem, nie 500", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    vi.stubEnv("CORTEX_PROXY_ADMIN_API_KEY", "")
    const fetchMock = stubFetch(jsonResponse([]))

    const response = await GET(request() as never)
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body.error).toBe("cortex-proxy-not-configured")
    expect(body.missing).toEqual(["CORTEX_PROXY_ADMIN_API_KEY"])
    expect(fetchMock).not.toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it.each([
    [401, "cortex-proxy-unauthorized"],
    [500, "cortex-proxy-error"],
    [400, "cortex-proxy-error"],
  ])("status %i z proxy mapuje na 502 %s", async (status, code) => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    stubFetch(() => new Response("blad", { status }))

    const response = await GET(request() as never)
    const body = await response.json()

    expect(response.status).toBe(502)
    expect(body.error).toBe(code)
    consoleError.mockRestore()
  })

  it("niedostępne proxy daje 502 z własnym kodem", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    stubFetch(() => {
      throw new TypeError("fetch failed")
    })

    const response = await GET(request() as never)
    const body = await response.json()

    expect(response.status).toBe(502)
    expect(body.error).toBe("cortex-proxy-unreachable")
    consoleError.mockRestore()
  })

  it("odpowiedź łamiąca kontrakt daje 502, nie zepsuty raport", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    stubFetch(jsonResponse([{ user_id: "u1" }]))

    const response = await GET(request() as never)

    expect(response.status).toBe(502)
    expect((await response.json()).error).toBe("cortex-proxy-error")
    consoleError.mockRestore()
  })
})

describe("GET /api/token-usage — bramka stoi przed pracą", () => {
  it("brak tożsamości daje 401 i nie dotyka proxy", async () => {
    const fetchMock = stubFetch(jsonResponse([]))
    loadGrantedApplicationCodes.mockResolvedValue([])

    const response = await GET(request("start=2026-07-01&end=2026-07-30", null) as never)

    expect(response.status).toBe(401)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("brak grantu daje 403 i nie dotyka proxy", async () => {
    const fetchMock = stubFetch(jsonResponse([]))
    loadGrantedApplicationCodes.mockResolvedValue(["intrastat"])

    const response = await GET(request() as never)

    expect(response.status).toBe(403)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  // Bramka jest PIERWSZA — przed walidacją zakresu. Inaczej ktoś bez uprawnień
  // dostawałby 400/503 i mógł po nich wnioskować o stanie konfiguracji.
  it("odmowa wyprzedza walidację zakresu i odczyt konfiguracji", async () => {
    vi.stubEnv("CORTEX_PROXY_ADMIN_API_KEY", "")
    loadGrantedApplicationCodes.mockResolvedValue([])

    const response = await GET(request("start=bzdura&end=bzdura", "obcy@firma.pl") as never)

    expect(response.status).toBe(403)
  })
})
