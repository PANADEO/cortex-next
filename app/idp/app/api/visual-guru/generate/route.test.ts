// Próba ominięcia bramki NA REALNEJ ŚCIEŻCE ŻĄDANIA (code-service/SKILL.md
// pkt 3) + kontrakt request/response + krawędzie walidacji Zod. requireTileAccess()
// zostaje PRAWDZIWE — podmieniany jest tylko odczyt z bazy (rbac-store), wzorem
// app/idp/app/api/ai-tools/generate-hardening.test.ts i
// app/idp/app/api/ilustromat/guard-coverage.test.ts.

import type * as CortexService from "@cortex/service"
import type * as CortexProxyClient from "@cortex/api/cortex-proxy-client"
import type { CortexProxyImageRequest, CortexProxyImageResult } from "@cortex/api/cortex-proxy-client"
import { beforeEach, describe, expect, it, vi } from "vitest"

const loadGrantedApplicationCodes = vi.hoisted(() => vi.fn<(email: string) => Promise<string[]>>())

vi.mock("@cortex/service/rbac-store", () => ({
  loadGrantedApplicationCodes,
  loadGrantedScopes: vi.fn(async () => []),
}))

const GENERATION_ID = "11111111-1111-1111-1111-111111111111"

function buildGenerationRow(overrides: Partial<CortexService.GenerationWithVariants> = {}) {
  return {
    id: GENERATION_ID,
    userEmail: "user@firma.pl",
    prompt: "kot na parapecie",
    additionalContext: null,
    hadReferenceImage: false,
    referenceImageFileName: null,
    model: "google/gemini-3.1-flash-lite-image",
    variantCount: 2,
    createdAt: new Date("2026-08-03T10:00:00Z"),
    variants: [
      { id: "v0", generationId: GENERATION_ID, variantIndex: 0, image: Buffer.from("aaa"), contentType: "image/png" },
      { id: "v1", generationId: GENERATION_ID, variantIndex: 1, image: Buffer.from("bbb"), contentType: "image/png" },
    ],
    ...overrides,
  } as CortexService.GenerationWithVariants
}

// createGeneration jest jedyną funkcją serwisową dotykaną przez ten route —
// podmieniona, żeby test nie wymagał realnego Postgresa (ten jest pokryty
// osobno w packages/@cortex/service/src/visual-guru.integration.test.ts).
const createGeneration = vi.hoisted(() =>
  vi.fn<
    (
      userEmail: string,
      input: CortexService.CreateGenerationInput,
    ) => Promise<CortexService.GenerationWithVariants>
  >(async () => buildGenerationRow()),
)

vi.mock("@cortex/service", async (importOriginal) => {
  const actual = await importOriginal<typeof CortexService>()
  return { ...actual, createGeneration }
})

const callCortexProxyImage = vi.hoisted(() =>
  vi.fn<(input: CortexProxyImageRequest) => Promise<CortexProxyImageResult>>(async () => ({
    dataUrl: "data:image/png;base64,iVBORw0KGgo=",
    model: "google/gemini-3.1-flash-lite-image",
    tokensUsed: 10,
  })),
)

vi.mock("@cortex/api/cortex-proxy-client", async (importOriginal) => {
  const actual = await importOriginal<typeof CortexProxyClient>()
  return { ...actual, callCortexProxyImage }
})

const { clearTileAccessCache } = await import("@cortex/service")

interface GenerateRoute {
  POST: (request: Request) => Promise<Response>
}

async function loadHandler(): Promise<GenerateRoute> {
  return (await import("./route")) as unknown as GenerateRoute
}

const VALID_BODY = {
  prompt: "kot na parapecie, styl akwareli",
  variantCount: 2,
}

function makeRequest(body: unknown, email: string | null = "user@firma.pl"): Request {
  const headers = new Headers({ "Content-Type": "application/json" })
  if (email !== null) headers.set("x-auth-request-email", email)
  return new Request("http://localhost/api/visual-guru/generate", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  clearTileAccessCache()
  vi.unstubAllEnvs()
  vi.stubEnv("NODE_ENV", "production")
  vi.stubEnv("CORTEX_PROXY_URL", "http://cortex-proxy")
  loadGrantedApplicationCodes.mockReset()
  loadGrantedApplicationCodes.mockResolvedValue([])
  createGeneration.mockClear()
  callCortexProxyImage.mockClear()
})

describe("POST /api/visual-guru/generate — bramka dostępu", () => {
  it("odmawia: brak nagłówka tożsamości (401)", async () => {
    const { POST } = await loadHandler()
    const response = await POST(makeRequest(VALID_BODY, null))

    expect(response.status).toBe(401)
    expect(callCortexProxyImage).not.toHaveBeenCalled()
    expect(createGeneration).not.toHaveBeenCalled()
  })

  it("odmawia: e-mail bez grantu do kafelka (403)", async () => {
    loadGrantedApplicationCodes.mockResolvedValue(["idp", "ilustromat"])
    const { POST } = await loadHandler()
    const response = await POST(makeRequest(VALID_BODY))

    expect(response.status).toBe(403)
    expect(callCortexProxyImage).not.toHaveBeenCalled()
    expect(createGeneration).not.toHaveBeenCalled()
  })

  it("odmawia: grant do łudząco podobnego kodu (403)", async () => {
    loadGrantedApplicationCodes.mockResolvedValue(["visual-guru-legacy"])
    const { POST } = await loadHandler()
    const response = await POST(makeRequest(VALID_BODY))

    expect(response.status).toBe(403)
    expect(callCortexProxyImage).not.toHaveBeenCalled()
  })

  it("odmawia gdy odczyt uprawnień pada (fail-closed)", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    loadGrantedApplicationCodes.mockRejectedValue(new Error("connection refused"))
    const { POST } = await loadHandler()

    const response = await POST(makeRequest(VALID_BODY))

    expect(response.status).toBe(403)
    expect(createGeneration).not.toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it("kontrola pozytywna: przepuszcza posiadacza grantu", async () => {
    loadGrantedApplicationCodes.mockResolvedValue(["visual-guru"])
    const { POST } = await loadHandler()

    const response = await POST(makeRequest(VALID_BODY))

    expect(response.status).toBe(200)
  })
})

describe("POST /api/visual-guru/generate — walidacja Zod", () => {
  beforeEach(() => {
    loadGrantedApplicationCodes.mockResolvedValue(["visual-guru"])
  })

  it("400: pusty prompt", async () => {
    const { POST } = await loadHandler()
    const response = await POST(makeRequest({ ...VALID_BODY, prompt: "" }))
    expect(response.status).toBe(400)
  })

  it("400: za dużo obrazów referencyjnych (>3)", async () => {
    const referenceImages = Array.from({ length: 4 }, (_, i) => ({
      dataUrl: "data:image/png;base64,iVBORw0KGgo=",
      fileName: `ref-${i}.png`,
    }))
    const { POST } = await loadHandler()
    const response = await POST(makeRequest({ ...VALID_BODY, referenceImages }))
    expect(response.status).toBe(400)
    expect(callCortexProxyImage).not.toHaveBeenCalled()
  })

  it("400: nieprawidłowa liczba wariantów (3 zamiast 2/4)", async () => {
    const { POST } = await loadHandler()
    const response = await POST(makeRequest({ ...VALID_BODY, variantCount: 3 }))
    expect(response.status).toBe(400)
  })

  it("400: obraz referencyjny bez poprawnego data URI", async () => {
    const { POST } = await loadHandler()
    const response = await POST(
      makeRequest({ ...VALID_BODY, referenceImages: [{ dataUrl: "https://example.com/x.png" }] }),
    )
    expect(response.status).toBe(400)
  })

  it("akceptuje request bez pola referenceImages (domyślnie puste)", async () => {
    const { POST } = await loadHandler()
    const response = await POST(makeRequest({ prompt: "sam prompt" }))
    expect(response.status).toBe(200)
  })
})

describe("POST /api/visual-guru/generate — happy path bez obrazu referencyjnego", () => {
  beforeEach(() => {
    loadGrantedApplicationCodes.mockResolvedValue(["visual-guru"])
  })

  it("woła model N razy równolegle, content jako zwykły string", async () => {
    const { POST } = await loadHandler()
    const response = await POST(makeRequest({ ...VALID_BODY, variantCount: 4 }))

    expect(response.status).toBe(200)
    expect(callCortexProxyImage).toHaveBeenCalledTimes(4)
    const [firstCall] = callCortexProxyImage.mock.calls
    const messages = (firstCall![0] as { messages: { content: unknown }[] }).messages
    expect(typeof messages[0]!.content).toBe("string")
  })

  it("zapisuje generację z hadReferenceImage=false i surowym promptem (bez dopisków)", async () => {
    const { POST } = await loadHandler()
    await POST(makeRequest({ prompt: "kot na parapecie, styl akwareli", variantCount: 2 }))

    expect(createGeneration).toHaveBeenCalledWith(
      "user@firma.pl",
      expect.objectContaining({
        prompt: "kot na parapecie, styl akwareli",
        hadReferenceImage: false,
        referenceImageFileName: null,
      }),
    )
  })

  it("odpowiedź niesie warianty jako gotowe data URI", async () => {
    const { POST } = await loadHandler()
    const response = await POST(makeRequest(VALID_BODY))
    const body = (await response.json()) as { variants: { dataUrl: string }[] }

    expect(body.variants).toHaveLength(2)
    expect(body.variants[0]!.dataUrl).toMatch(/^data:image\/png;base64,/)
  })
})

describe("POST /api/visual-guru/generate — happy path Z obrazem referencyjnym", () => {
  beforeEach(() => {
    loadGrantedApplicationCodes.mockResolvedValue(["visual-guru"])
  })

  it("buduje content jako tablicę multi-part (text + image_url)", async () => {
    const { POST } = await loadHandler()
    await POST(
      makeRequest({
        prompt: "przerób to zdjęcie na akwarelę",
        referenceImages: [{ dataUrl: "data:image/png;base64,iVBORw0KGgo=", fileName: "zdjecie.png" }],
        fidelity: "high",
        variantCount: 2,
      }),
    )

    const [firstCall] = callCortexProxyImage.mock.calls
    const messages = (firstCall![0] as { messages: { content: unknown }[] }).messages
    const content = messages[0]!.content as { type: string; text?: string; image_url?: { url: string } }[]

    expect(Array.isArray(content)).toBe(true)
    expect(content[0]).toMatchObject({ type: "text" })
    expect(content[0]!.text).toContain("przerób to zdjęcie")
    // Dopisek o wierności trafia do promptu WYSYŁANEGO do modelu...
    expect(content[0]!.text).toContain("wysoką wierność")
    expect(content[1]).toMatchObject({ type: "image_url", image_url: { url: "data:image/png;base64,iVBORw0KGgo=" } })
  })

  it("zapisuje generację z hadReferenceImage=true, nazwą pliku i BEZ dopisku o wierności w kolumnie prompt", async () => {
    const { POST } = await loadHandler()
    await POST(
      makeRequest({
        prompt: "przerób to zdjęcie na akwarelę",
        referenceImages: [{ dataUrl: "data:image/png;base64,iVBORw0KGgo=", fileName: "zdjecie.png" }],
        fidelity: "high",
        variantCount: 2,
      }),
    )

    expect(createGeneration).toHaveBeenCalledWith(
      "user@firma.pl",
      expect.objectContaining({
        prompt: "przerób to zdjęcie na akwarelę",
        hadReferenceImage: true,
        referenceImageFileName: "zdjecie.png",
      }),
    )
  })

  it("łączy nazwy wielu obrazów referencyjnych przecinkiem", async () => {
    const { POST } = await loadHandler()
    await POST(
      makeRequest({
        prompt: "przerób te zdjęcia",
        referenceImages: [
          { dataUrl: "data:image/png;base64,iVBORw0KGgo=", fileName: "a.png" },
          { dataUrl: "data:image/png;base64,iVBORw0KGgo=", fileName: "b.png" },
        ],
        variantCount: 2,
      }),
    )

    expect(createGeneration).toHaveBeenCalledWith(
      "user@firma.pl",
      expect.objectContaining({ referenceImageFileName: "a.png, b.png" }),
    )
  })
})

describe("POST /api/visual-guru/generate — błędy upstreamu", () => {
  beforeEach(() => {
    loadGrantedApplicationCodes.mockResolvedValue(["visual-guru"])
  })

  it("502 gdy cortex-proxy odrzuca wywołanie obrazkowe", async () => {
    const { CortexProxyImageError } = await import("@cortex/api/cortex-proxy-client")
    callCortexProxyImage.mockRejectedValueOnce(new CortexProxyImageError("model odrzucił prompt"))
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})

    const { POST } = await loadHandler()
    const response = await POST(makeRequest(VALID_BODY))

    expect(response.status).toBe(502)
    expect(createGeneration).not.toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it("502 gdy CORTEX_PROXY_URL nie jest ustawione", async () => {
    vi.stubEnv("CORTEX_PROXY_URL", "")
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})

    const { POST } = await loadHandler()
    const response = await POST(makeRequest(VALID_BODY))

    expect(response.status).toBe(502)
    expect(callCortexProxyImage).not.toHaveBeenCalled()
    consoleError.mockRestore()
  })
})
