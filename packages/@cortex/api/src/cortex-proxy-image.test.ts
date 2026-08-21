// Kontrakt ścieżki OBRAZKOWEJ. Najważniejszy test w tym pliku to ten
// o messages[] — bo dokładnie tam czai się pułapka opisana w projekcie:
// isOpenRouterModel() jest prawdziwe dla "google/gemini-3.1-flash-lite-image"
// (ma ukośnik), więc gdyby ścieżka obrazkowa szła przez buildCortexPayload(),
// upstream dostałby `prompt`-string zamiast messages[] i przestałby zwracać
// obrazy. PoC w Pythonie ZAWSZE wysyła messages[] i działa produkcyjnie.

import { afterEach, describe, expect, it, vi } from "vitest"
import {
  CortexProxyImageError,
  callCortexProxyImage,
  decodeDataUrl,
  isOpenRouterModel,
} from "./cortex-proxy-client"

const IMAGE_MODEL = "google/gemini-3.1-flash-lite-image"
const PNG_DATA_URL = "data:image/png;base64,iVBORw0KGgo="

function mockFetch(body: unknown, ok = true, status = 200) {
  const fetchMock = vi.fn(async () => ({
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  }))
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

function imageResponse(url: string = PNG_DATA_URL) {
  return {
    choices: [{ message: { images: [{ image_url: { url } }] } }],
    usage: { total_tokens: 42 },
  }
}

const baseRequest = {
  baseUrl: "http://cortex-proxy",
  email: "kto@firma.pl",
  model: IMAGE_MODEL,
  scope: "ilustromat-generation",
  messages: [{ role: "user" as const, content: "editorial illustration of a bridge" }],
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("callCortexProxyImage", () => {
  it("model obrazkowy JEST modelem OpenRoutera — pułapka, którą ten kod omija", () => {
    // Gdyby ktoś kiedyś przepiął ścieżkę obrazkową na buildCortexPayload(),
    // ta asercja tłumaczy, dlaczego to natychmiast zepsuje generację.
    expect(isOpenRouterModel(IMAGE_MODEL)).toBe(true)
  })

  it("ZAWSZE wysyła messages[], nigdy prompt-stringa", async () => {
    const fetchMock = mockFetch(imageResponse())
    await callCortexProxyImage(baseRequest)

    const [, init] = fetchMock.mock.calls[0]! as unknown as [string, RequestInit]
    const payload = JSON.parse(init.body as string)

    expect(payload.messages).toEqual(baseRequest.messages)
    expect(payload).not.toHaveProperty("prompt")
  })

  it("wysyła modalities: [image, text]", async () => {
    const fetchMock = mockFetch(imageResponse())
    await callCortexProxyImage(baseRequest)

    const [, init] = fetchMock.mock.calls[0]! as unknown as [string, RequestInit]
    expect(JSON.parse(init.body as string).modalities).toEqual(["image", "text"])
  })

  it("uderza w /v1/chat/completions i wysyła nagłówki atrybucji", async () => {
    const fetchMock = mockFetch(imageResponse())
    await callCortexProxyImage({
      ...baseRequest,
      appLabel: "Ilustromat",
      sourceApp: "Cortex360 Ilustromat",
    })

    const [url, init] = fetchMock.mock.calls[0]! as unknown as [string, RequestInit]
    expect(url).toBe("http://cortex-proxy/v1/chat/completions")

    const headers = init.headers as Record<string, string>
    expect(headers["X-User-ID"]).toBe("kto@firma.pl")
    expect(headers["X-Scope"]).toBe("ilustromat-generation")
    expect(headers["X-App"]).toBe("Ilustromat")
    expect(headers["X-Source-App"]).toBe("Cortex360 Ilustromat")
  })

  it("czyta obraz z choices[0].message.images[0].image_url.url", async () => {
    mockFetch(imageResponse())
    const result = await callCortexProxyImage(baseRequest)

    expect(result.dataUrl).toBe(PNG_DATA_URL)
    expect(result.model).toBe(IMAGE_MODEL)
    expect(result.tokensUsed).toBe(42)
  })

  it("rzuca czytelnie, gdy model nie zwrócił obrazu (odrzucony prompt)", async () => {
    mockFetch({ choices: [{ message: { images: [] } }] })
    await expect(callCortexProxyImage(baseRequest)).rejects.toThrow(CortexProxyImageError)
  })

  it("rzuca, gdy obraz nie jest data URI", async () => {
    mockFetch(imageResponse("https://example.com/obrazek.png"))
    await expect(callCortexProxyImage(baseRequest)).rejects.toThrow(/data URI/)
  })

  it("mapuje błąd upstreamu na wyjątek, nie na pusty wynik", async () => {
    mockFetch({ error: "rate limited" }, false, 429)
    await expect(callCortexProxyImage(baseRequest)).rejects.toThrow(CortexProxyImageError)
  })
})

describe("decodeDataUrl", () => {
  it("dekoduje base64 z data URI", () => {
    const decoded = decodeDataUrl(PNG_DATA_URL)
    expect(decoded.subarray(0, 4)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]))
  })

  it("rzuca przy braku separatora", () => {
    expect(() => decodeDataUrl("data:image/png;base64")).toThrow(CortexProxyImageError)
  })
})
