import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  callCortexProxy,
  callCortexProxyImage,
  CortexProxyImageError,
  isOpenRouterModel,
  type CortexProxyImageRequest,
  type CortexProxyRequest,
} from "./cortex-proxy-client"

const OPENROUTER_MODEL = "anthropic/claude-sonnet-4.6"
const OPENAI_MODEL = "gpt-4.1"

function baseInput(overrides: Partial<CortexProxyRequest> = {}): CortexProxyRequest {
  return {
    baseUrl: "http://localhost:8240",
    email: "user@example.com",
    image: undefined,
    maxTokens: 8000,
    model: OPENAI_MODEL,
    scope: "summarizer",
    systemPrompt: "system",
    temperature: 1,
    userPrompt: "user",
    ...overrides,
  }
}

function okResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })
}

const validBody = {
  choices: [{ message: { content: "wynik" } }],
  usage: { total_tokens: 123 },
}

function stubFetch(response: Response | (() => Response)): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async () => (typeof response === "function" ? response() : response))
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

function readPayload(fetchMock: ReturnType<typeof vi.fn>): Record<string, unknown> {
  const init = fetchMock.mock.calls[0]?.[1] as RequestInit
  return JSON.parse(init.body as string) as Record<string, unknown>
}

function readHeaders(fetchMock: ReturnType<typeof vi.fn>): Record<string, string> {
  const init = fetchMock.mock.calls[0]?.[1] as RequestInit
  return init.headers as Record<string, string>
}

beforeEach(() => {
  vi.unstubAllEnvs()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe("isOpenRouterModel", () => {
  it("rozpoznaje modele OpenRouter po ukośniku w id", () => {
    expect(isOpenRouterModel(OPENROUTER_MODEL)).toBe(true)
    expect(isOpenRouterModel(OPENAI_MODEL)).toBe(false)
  })
})

describe("callCortexProxy — kształt payloadu", () => {
  it("OpenRouter: sklejony prompt, max_tokens, zawsze temperatura", async () => {
    const fetchMock = stubFetch(okResponse(validBody))
    await callCortexProxy(baseInput({ model: OPENROUTER_MODEL, temperature: 0.5 }))

    const payload = readPayload(fetchMock)
    expect(payload.prompt).toBe("system\n\nUser: user\n\nAssistant:")
    expect(payload.max_tokens).toBe(8000)
    expect(payload.temperature).toBe(0.5)
    expect(payload.messages).toBeUndefined()
    expect(payload.max_completion_tokens).toBeUndefined()
  })

  it("OpenAI: messages[] i max_completion_tokens", async () => {
    const fetchMock = stubFetch(okResponse(validBody))
    await callCortexProxy(baseInput())

    const payload = readPayload(fetchMock)
    expect(payload.messages).toEqual([
      { role: "system", content: "system" },
      { role: "user", content: "user" },
    ])
    expect(payload.max_completion_tokens).toBe(8000)
    expect(payload.prompt).toBeUndefined()
  })

  it("OpenAI: pomija temperaturę równą 1", async () => {
    const fetchMock = stubFetch(okResponse(validBody))
    await callCortexProxy(baseInput({ temperature: 1 }))
    expect(readPayload(fetchMock).temperature).toBeUndefined()
  })

  it("OpenAI: dopisuje temperaturę różną od 1", async () => {
    const fetchMock = stubFetch(okResponse(validBody))
    await callCortexProxy(baseInput({ temperature: 0.2 }))
    expect(readPayload(fetchMock).temperature).toBe(0.2)
  })

  it("pomija temperaturę dla modeli o3 i gpt-5 mimo wartości różnej od 1", async () => {
    for (const model of ["o3-mini", "gpt-5-turbo"]) {
      vi.unstubAllGlobals()
      const fetchMock = stubFetch(okResponse(validBody))
      await callCortexProxy(baseInput({ model, temperature: 0.2 }))
      expect(readPayload(fetchMock).temperature, `model ${model}`).toBeUndefined()
    }
  })
})

describe("callCortexProxy — obraz (vision)", () => {
  const image = { dataUrl: "data:image/png;base64,AAA", mimeType: "image/png" }

  it("OpenRouter: obraz jako płaskie pole image", async () => {
    const fetchMock = stubFetch(okResponse(validBody))
    await callCortexProxy(baseInput({ model: OPENROUTER_MODEL, image }))
    expect(readPayload(fetchMock).image).toBe(image.dataUrl)
  })

  it("OpenAI: obraz jako część content typu image_url z detail high", async () => {
    const fetchMock = stubFetch(okResponse(validBody))
    await callCortexProxy(baseInput({ image }))

    const messages = readPayload(fetchMock).messages as Array<{ content: unknown }>
    expect(messages[1]?.content).toEqual([
      { type: "text", text: "user" },
      { type: "image_url", image_url: { url: image.dataUrl, detail: "high" } },
    ])
  })
})

describe("callCortexProxy — nagłówki i URL", () => {
  it("wysyła nagłówki identyfikujące użytkownika i moduł", async () => {
    const fetchMock = stubFetch(okResponse(validBody))
    await callCortexProxy(baseInput())

    const headers = readHeaders(fetchMock)
    expect(headers["X-User-ID"]).toBe("user@example.com")
    expect(headers["X-Scope"]).toBe("summarizer")
    expect(headers["X-App"]).toBe("AI Tools")
    expect(headers["X-Source-App"]).toBe("Cortex360 AI Tools")
  })

  it("pozwala nadpisać X-App i X-Source-App przez wołającego", async () => {
    const fetchMock = stubFetch(okResponse(validBody))
    await callCortexProxy(baseInput({ appLabel: "Summarizer", sourceApp: "Konfiguracja Systemu" }))

    const headers = readHeaders(fetchMock)
    expect(headers["X-App"]).toBe("Summarizer")
    expect(headers["X-Source-App"]).toBe("Konfiguracja Systemu")
  })

  it("dokłada Authorization gdy klucz jest w env", async () => {
    vi.stubEnv("CORTEX_PROXY_API_KEY", "sekret")
    const fetchMock = stubFetch(okResponse(validBody))
    await callCortexProxy(baseInput())
    expect(readHeaders(fetchMock).Authorization).toBe("Bearer sekret")
  })

  it("pomija Authorization gdy klucza nie ma", async () => {
    const fetchMock = stubFetch(okResponse(validBody))
    await callCortexProxy(baseInput())
    expect(readHeaders(fetchMock).Authorization).toBeUndefined()
  })

  it("obcina końcowy ukośnik z baseUrl", async () => {
    const fetchMock = stubFetch(okResponse(validBody))
    await callCortexProxy(baseInput({ baseUrl: "http://localhost:8240/" }))
    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://localhost:8240/v1/chat/completions")
  })
})

describe("callCortexProxy — odpowiedzi i błędy", () => {
  it("zwraca treść i zużyte tokeny", async () => {
    stubFetch(okResponse(validBody))
    const result = await callCortexProxy(baseInput())
    expect(result).toEqual({ content: "wynik", model: OPENAI_MODEL, tokensUsed: 123 })
  })

  it("czyta fallback choices[0].text", async () => {
    stubFetch(okResponse({ choices: [{ text: "z fallbacku" }] }))
    const result = await callCortexProxy(baseInput())
    expect(result.content).toBe("z fallbacku")
  })

  it("zwraca tokensUsed null gdy upstream nie podał usage", async () => {
    stubFetch(okResponse({ choices: [{ message: { content: "wynik" } }] }))
    const result = await callCortexProxy(baseInput())
    expect(result.tokensUsed).toBeNull()
  })

  it("rzuca treścią błędu upstreamu przy odpowiedzi nie-ok", async () => {
    stubFetch(new Response("model niedostępny", { status: 400 }))
    await expect(callCortexProxy(baseInput())).rejects.toThrow("model niedostępny")
  })

  it("rzuca statusem gdy upstream nie podał treści błędu", async () => {
    stubFetch(new Response("", { status: 503 }))
    await expect(callCortexProxy(baseInput())).rejects.toThrow("Cortex Proxy returned 503")
  })

  it("rzuca przy odpowiedzi bez użytecznej treści", async () => {
    stubFetch(okResponse({ choices: [{ message: { content: "   " } }] }))
    await expect(callCortexProxy(baseInput())).rejects.toThrow("Unexpected Cortex Proxy response")
  })
})

// ---------------------------------------------------------------------------
// callCortexProxyImage() — Faza 0 Visual Guru: rozszerzenie CortexProxyImageMessage.content
// (PROJECT/cortex-frontend-visual-guru-tile-projekt.md sekcja 3). Dwa cele:
//  1. Dowieść, że Ilustromatu jedyne dzisiejsze wywołanie (content: string)
//     zachowuje się identycznie po zmianie typu — zero regresji.
//  2. Dowieść, że nowy kształt (content: część[]) jest poprawnie budowany i
//     wysyłany — bez inspekcji kształtu, verbatim, jak deklaruje sekcja 3.
// ---------------------------------------------------------------------------

const imageValidBody = {
  choices: [{ message: { images: [{ image_url: { url: "data:image/png;base64,AAA" } }] } }],
  usage: { total_tokens: 456 },
}

function baseImageInput(overrides: Partial<CortexProxyImageRequest> = {}): CortexProxyImageRequest {
  return {
    baseUrl: "http://localhost:8240",
    email: "user@example.com",
    model: "google/gemini-3.1-flash-lite-image",
    scope: "visual-guru-generation",
    messages: [{ role: "user", content: "wygeneruj obraz" }],
    ...overrides,
  }
}

describe("callCortexProxyImage — content: string (Ilustromat, wsteczna kompatybilność)", () => {
  it("przekazuje messages z content: string verbatim, bez zmiany kształtu", async () => {
    const fetchMock = stubFetch(okResponse(imageValidBody))
    await callCortexProxyImage(
      baseImageInput({ messages: [{ role: "user", content: "ilustracja teł do posta LinkedIn" }] }),
    )

    const payload = readPayload(fetchMock)
    expect(payload.messages).toEqual([
      { role: "user", content: "ilustracja teł do posta LinkedIn" },
    ])
  })

  it("wysyła modalities:[image,text] i domyślną temperaturę 0.7", async () => {
    const fetchMock = stubFetch(okResponse(imageValidBody))
    await callCortexProxyImage(baseImageInput())

    const payload = readPayload(fetchMock)
    expect(payload.modalities).toEqual(["image", "text"])
    expect(payload.temperature).toBe(0.7)
  })

  it("zwraca dataUrl, model i tokensUsed z odpowiedzi", async () => {
    stubFetch(okResponse(imageValidBody))
    const result = await callCortexProxyImage(baseImageInput())
    expect(result).toEqual({
      dataUrl: "data:image/png;base64,AAA",
      model: "google/gemini-3.1-flash-lite-image",
      tokensUsed: 456,
    })
  })
})

describe("callCortexProxyImage — content: część[] (Visual Guru, nowy kształt)", () => {
  it("przekazuje multi-part content (tekst + image_url) verbatim", async () => {
    const fetchMock = stubFetch(okResponse(imageValidBody))
    const referenceDataUrl = "data:image/png;base64,cmVmZXJlbmNl"

    await callCortexProxyImage(
      baseImageInput({
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "bazuj ściśle na załączonym obrazie referencyjnym" },
              { type: "image_url", image_url: { url: referenceDataUrl, detail: "high" } },
            ],
          },
        ],
      }),
    )

    const payload = readPayload(fetchMock)
    expect(payload.messages).toEqual([
      {
        role: "user",
        content: [
          { type: "text", text: "bazuj ściśle na załączonym obrazie referencyjnym" },
          { type: "image_url", image_url: { url: referenceDataUrl, detail: "high" } },
        ],
      },
    ])
  })

  it("obsługuje wiele obrazów referencyjnych w jednej wiadomości", async () => {
    const fetchMock = stubFetch(okResponse(imageValidBody))
    await callCortexProxyImage(
      baseImageInput({
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "prompt" },
              { type: "image_url", image_url: { url: "data:image/png;base64,AAA" } },
              { type: "image_url", image_url: { url: "data:image/png;base64,BBB" } },
            ],
          },
        ],
      }),
    )

    const payload = readPayload(fetchMock)
    const content = (payload.messages as Array<{ content: unknown }>)[0]?.content as unknown[]
    expect(content).toHaveLength(3)
  })
})

describe("callCortexProxyImage — nagłówki, timeout, błędy", () => {
  it("wysyła te same nagłówki identyfikujące co callCortexProxy", async () => {
    const fetchMock = stubFetch(okResponse(imageValidBody))
    await callCortexProxyImage(
      baseImageInput({ appLabel: "Visual Guru", sourceApp: "Cortex360 Visual Guru" }),
    )

    const headers = readHeaders(fetchMock)
    expect(headers["X-User-ID"]).toBe("user@example.com")
    expect(headers["X-Scope"]).toBe("visual-guru-generation")
    expect(headers["X-App"]).toBe("Visual Guru")
    expect(headers["X-Source-App"]).toBe("Cortex360 Visual Guru")
  })

  it("rzuca CortexProxyImageError gdy brak obrazu w odpowiedzi", async () => {
    stubFetch(okResponse({ choices: [{ message: {} }] }))
    await expect(callCortexProxyImage(baseImageInput())).rejects.toBeInstanceOf(
      CortexProxyImageError,
    )
  })

  it("rzuca CortexProxyImageError gdy url nie jest data URI", async () => {
    stubFetch(
      okResponse({
        choices: [{ message: { images: [{ image_url: { url: "https://example.com/x.png" } }] } }],
      }),
    )
    await expect(callCortexProxyImage(baseImageInput())).rejects.toThrow(
      "Nieoczekiwany format obrazu",
    )
  })

  it("rzuca CortexProxyImageError na odpowiedź nie-ok", async () => {
    stubFetch(new Response("model niedostępny", { status: 400 }))
    await expect(callCortexProxyImage(baseImageInput())).rejects.toBeInstanceOf(
      CortexProxyImageError,
    )
  })
})
