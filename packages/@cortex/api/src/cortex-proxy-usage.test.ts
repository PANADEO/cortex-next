// Kontrakt GET /usage odczytany z kodu Go (pkg/proxy/proxy.go UsageHandler,
// pkg/config/database.go UsageSummary) i potwierdzony jego testem
// pkg/proxy/usage_handler_test.go — nie zgadnięty z dokumentacji.

import { afterEach, describe, expect, it, vi } from "vitest"
import {
  CortexProxyUsageError,
  fetchProxyUsage,
  type CortexProxyUsageRequest,
} from "./cortex-proxy-client"

const ADMIN_KEY = "sekret-administracyjny-nie-do-logow"

function input(overrides: Partial<CortexProxyUsageRequest> = {}): CortexProxyUsageRequest {
  return {
    baseUrl: "http://localhost:8240",
    adminApiKey: ADMIN_KEY,
    start: "2026-07-01",
    end: "2026-07-30",
    ...overrides,
  }
}

/** Wiersz dokładnie w kształcie z usage_handler_test.go. */
const CONTRACT_ROW = {
  user_id: "u1",
  source_app: "app",
  scope: "scope",
  model: "gpt-4o",
  request_tokens: 12,
  response_tokens: 8,
  reasoning_tokens: 1,
  cached_tokens: 1,
  total_tokens: 21,
  request_count: 2,
}

type FetchMock = ReturnType<typeof makeFetchMock>

function makeFetchMock(response: Response | (() => Response | Promise<Response>)) {
  // Sygnatura deklarowana w generyku, nie w argumentach implementacji: dzięki
  // temu `mock.calls[0]` ma typ krotki (odczyt URL-a i nagłówków bez rzutowania),
  // a implementacja nie musi przyjmować argumentów, których nie używa.
  return vi.fn<(url: string, init: RequestInit) => Promise<Response>>(async () =>
    typeof response === "function" ? response() : response,
  )
}

function stubFetch(response: Response | (() => Response | Promise<Response>)): FetchMock {
  const fetchMock = makeFetchMock(response)
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

function readCall(fetchMock: FetchMock): [string, RequestInit] {
  const call = fetchMock.mock.calls[0]
  if (!call) throw new Error("fetch nie został zawołany")
  return call
}

function readUrl(fetchMock: FetchMock): string {
  return readCall(fetchMock)[0]
}

function readHeaders(fetchMock: FetchMock): Record<string, string> {
  return readCall(fetchMock)[1].headers as Record<string, string>
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("fetchProxyUsage — kształt żądania", () => {
  it("woła GET /usage z zakresem dat w query", async () => {
    const fetchMock = stubFetch(jsonResponse([CONTRACT_ROW]))

    await fetchProxyUsage(input())

    const url = new URL(readUrl(fetchMock))
    expect(url.pathname).toBe("/usage")
    expect(url.searchParams.get("start")).toBe("2026-07-01")
    expect(url.searchParams.get("end")).toBe("2026-07-30")
    expect(readCall(fetchMock)[1].method).toBe("GET")
  })

  it("uwierzytelnia się nagłówkiem X-Admin-API-Key", async () => {
    const fetchMock = stubFetch(jsonResponse([]))

    await fetchProxyUsage(input())

    expect(readHeaders(fetchMock)["X-Admin-API-Key"]).toBe(ADMIN_KEY)
  })

  // NAJWAŻNIEJSZA WŁASNOŚĆ BEZPIECZEŃSTWA TEGO MODUŁU. cortex-proxy akceptuje
  // też ?api_key=..., ale query string ląduje w logach dostępu każdego
  // pośrednika po drodze. Ta ścieżka ma pozostać niedostępna.
  it("NIGDY nie umieszcza klucza w query stringu", async () => {
    const fetchMock = stubFetch(jsonResponse([]))

    await fetchProxyUsage(input())

    const url = readUrl(fetchMock)
    expect(url).not.toContain(ADMIN_KEY)
    expect(url).not.toContain("api_key")
    expect(new URL(url).searchParams.get("api_key")).toBeNull()
  })

  it("nie dubluje ukośnika, gdy baseUrl kończy się slashem", async () => {
    const fetchMock = stubFetch(jsonResponse([]))

    await fetchProxyUsage(input({ baseUrl: "http://localhost:8240/" }))

    expect(new URL(readUrl(fetchMock)).pathname).toBe("/usage")
  })

  it("nie pozwala odpowiedzi trafić do cache", async () => {
    const fetchMock = stubFetch(jsonResponse([]))

    await fetchProxyUsage(input())

    expect(readCall(fetchMock)[1].cache).toBe("no-store")
  })

  it("przerywa żądanie po przekroczeniu timeoutu", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener("abort", () => reject(new Error("aborted")))
          }),
      ),
    )

    const error = await fetchProxyUsage(input({ timeoutMs: 5 })).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(CortexProxyUsageError)
    expect((error as CortexProxyUsageError).failure).toBe("unreachable")
  })
})

describe("fetchProxyUsage — walidacja odpowiedzi", () => {
  it("zwraca komplet dziesięciu pól kontraktu", async () => {
    stubFetch(jsonResponse([CONTRACT_ROW]))

    const rows = await fetchProxyUsage(input())

    expect(rows).toEqual([CONTRACT_ROW])
  })

  // Handler robi make([]UsageSummary, len(results)), więc null nigdy nie
  // wychodzi na zewnątrz — pusty zakres to 200 z [].
  it("pusty zakres to poprawna, pusta lista", async () => {
    stubFetch(jsonResponse([]))

    await expect(fetchProxyUsage(input())).resolves.toEqual([])
  })

  it("odrzuca odpowiedź bez wymaganego pola", async () => {
    const incomplete: Record<string, unknown> = { ...CONTRACT_ROW }
    delete incomplete.reasoning_tokens
    stubFetch(jsonResponse([incomplete]))

    const error = await fetchProxyUsage(input()).catch((e: unknown) => e)

    expect((error as CortexProxyUsageError).failure).toBe("malformed-response")
  })

  it("odrzuca liczniki przysłane jako tekst", async () => {
    stubFetch(jsonResponse([{ ...CONTRACT_ROW, total_tokens: "21" }]))

    const error = await fetchProxyUsage(input()).catch((e: unknown) => e)

    expect((error as CortexProxyUsageError).failure).toBe("malformed-response")
  })

  it("odrzuca odpowiedź, która nie jest tablicą", async () => {
    stubFetch(jsonResponse({ rows: [CONTRACT_ROW] }))

    const error = await fetchProxyUsage(input()).catch((e: unknown) => e)

    expect((error as CortexProxyUsageError).failure).toBe("malformed-response")
  })

  it("odrzuca ciało, które nie jest JSON-em", async () => {
    stubFetch(new Response("<html>502 Bad Gateway</html>", { status: 200 }))

    const error = await fetchProxyUsage(input()).catch((e: unknown) => e)

    expect((error as CortexProxyUsageError).failure).toBe("malformed-response")
  })
})

describe("fetchProxyUsage — mapowanie błędów upstreamu", () => {
  it.each([
    [401, "unauthorized"],
    [400, "invalid-range"],
    [500, "upstream-error"],
    [503, "upstream-error"],
  ])("status %i mapuje na %s", async (status, failure) => {
    stubFetch(new Response("unauthorized", { status }))

    const error = await fetchProxyUsage(input()).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(CortexProxyUsageError)
    expect((error as CortexProxyUsageError).failure).toBe(failure)
    expect((error as CortexProxyUsageError).status).toBe(status)
  })

  it("awaria sieci mapuje na unreachable", async () => {
    stubFetch(() => {
      throw new TypeError("fetch failed")
    })

    const error = await fetchProxyUsage(input()).catch((e: unknown) => e)

    expect((error as CortexProxyUsageError).failure).toBe("unreachable")
  })

  // Komunikat błędu bywa logowany i pokazywany — nie ma prawa nieść sekretu
  // ani URL-a z parametrami.
  it.each([401, 500])("komunikat błędu (status %i) nie zawiera klucza", async (status) => {
    stubFetch(new Response(`odrzucono klucz ${ADMIN_KEY}`, { status }))

    const error = (await fetchProxyUsage(input()).catch((e: unknown) => e)) as CortexProxyUsageError

    expect(error.message).not.toContain(ADMIN_KEY)
    expect(String(error.stack ?? "")).not.toContain(ADMIN_KEY)
  })

  it("komunikat awarii sieciowej nie zawiera klucza ani URL-a", async () => {
    stubFetch(() => {
      throw new TypeError(`connect ECONNREFUSED http://localhost:8240/usage?key=${ADMIN_KEY}`)
    })

    const error = (await fetchProxyUsage(input()).catch((e: unknown) => e)) as CortexProxyUsageError

    expect(error.message).not.toContain(ADMIN_KEY)
  })
})
