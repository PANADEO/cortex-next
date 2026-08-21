// Próby ominięcia bramki NA REALNEJ ŚCIEŻCE ŻĄDANIA — code-service/SKILL.md
// pkt 3. Test jednostkowy samego requireTileAccess() tego nie pokrywa: nie
// wykryje handlera, w którym ktoś usunął albo przestawił wywołanie bramki.
//
// Kluczowa własność: ten plik NIE MA listy endpointów. `import.meta.glob`
// wciąga każdy route.ts z tego katalogu (rekursywnie: generate, history,
// history/[id]), więc nowy endpoint dodany bez bramki wywala ten test od
// razu. Wzorem app/idp/app/api/document-parser/guard-coverage.test.ts —
// Visual Guru ma tylko JEDNĄ warstwę bramek (requireTileAccess, D7: brak
// zasobu współdzielonego do zarządzania, więc brak granularnych scope'ów),
// więc tu nie ma sekcji "warstwa granularna".

import type * as CortexProxyClient from "@cortex/api/cortex-proxy-client"
import type {
  CortexProxyImageRequest,
  CortexProxyImageResult,
} from "@cortex/api/cortex-proxy-client"
import type * as CortexService from "@cortex/service"
import { beforeEach, describe, expect, it, vi } from "vitest"

const loadGrantedApplicationCodes = vi.hoisted(() => vi.fn<(email: string) => Promise<string[]>>())
const loadGrantedScopes = vi.hoisted(() => vi.fn<(email: string) => Promise<string[]>>())

vi.mock("@cortex/service/rbac-store", () => ({ loadGrantedApplicationCodes, loadGrantedScopes }))

const GENERATION_ID = "11111111-1111-1111-1111-111111111111"

function buildGenerationRow(): CortexService.GenerationWithVariants {
  return {
    id: GENERATION_ID,
    userEmail: "admin@firma.pl",
    prompt: "kot na parapecie",
    additionalContext: null,
    hadReferenceImage: false,
    referenceImageFileName: null,
    model: "google/gemini-3.1-flash-lite-image",
    variantCount: 1,
    createdAt: new Date(),
    variants: [
      {
        id: "v0",
        generationId: GENERATION_ID,
        variantIndex: 0,
        image: Buffer.from("aaa"),
        contentType: "image/png",
      },
    ],
  }
}

// Bramka (requireTileAccess) zostaje PRAWDZIWA — podmieniane są tylko
// funkcje serwisowe modułu, żeby handler po ominiętej bramce oddał coś
// innego niż 500 na braku Postgresa. Inaczej test przechodziłby z
// niewłaściwego powodu.
const service = vi.hoisted(() => ({
  listMyGenerationsWithFirstVariant: vi.fn(async () => []),
  getMyGeneration: vi.fn(async () => buildGenerationRow()),
  createGeneration: vi.fn(async () => buildGenerationRow()),
  deleteGeneration: vi.fn(async () => true),
}))

vi.mock("@cortex/service", async (importOriginal) => {
  const actual = await importOriginal<typeof CortexService>()
  return { ...actual, ...service }
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

function expectNoServiceCall(): void {
  for (const [name, fn] of Object.entries(service)) {
    expect(fn, `${name} zostało zawołane mimo odmowy dostępu`).not.toHaveBeenCalled()
  }
}

const { clearTileAccessCache } = await import("@cortex/service")

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const
const ENTITLEMENT = "visual-guru"

type Handler = (request: Request, context: unknown) => Promise<Response>

declare global {
  interface ImportMeta {
    glob: <T>(pattern: string) => Record<string, () => Promise<T>>
  }
}

const routeModules = import.meta.glob<Record<string, unknown>>("./**/route.ts")

function makeRequest(method: string, email: string | null): Request {
  const headers = new Headers({ "Content-Type": "application/json" })
  if (email !== null) headers.set("x-auth-request-email", email)
  const hasBody = method === "POST"
  return new Request("http://localhost/api/visual-guru/probe", {
    method,
    headers,
    // generate/route.ts's Zod schema wymaga { prompt }, żeby DOJŚĆ do bramki
    // pozytywnej kontroli (200), nie 400 — dla asercji ODMOWY kształt ciała
    // jest bez znaczenia, bramka odcina wcześniej.
    ...(hasBody ? { body: JSON.stringify({ prompt: "kot na parapecie" }) } : {}),
  })
}

const context = { params: Promise.resolve({ id: GENERATION_ID }) }

async function collectHandlers(): Promise<{ name: string; method: string; handler: Handler }[]> {
  const found: { name: string; method: string; handler: Handler }[] = []

  for (const [file, load] of Object.entries(routeModules)) {
    const routeModule = await load()
    for (const method of HTTP_METHODS) {
      const handler = routeModule[method]
      if (typeof handler === "function") {
        found.push({ name: file, method, handler: handler as Handler })
      }
    }
  }

  return found
}

const handlers = await collectHandlers()

const BYPASS_ATTEMPTS = [
  { label: "brak nagłówka tożsamości", email: null, granted: [] as string[] },
  { label: "obcy e-mail spoza bazy", email: "intruz@obca-firma.pl", granted: [] },
  { label: "znany e-mail bez żadnej roli", email: "bez-roli@firma.pl", granted: [] },
  {
    label: "rola z grantem do innego kafelka",
    email: "ktos@firma.pl",
    granted: ["intrastat", "idp"],
  },
  {
    label: "grant do łudząco podobnego kodu",
    email: "ktos@firma.pl",
    granted: ["visual-guru-legacy"],
  },
]

beforeEach(() => {
  clearTileAccessCache()
  loadGrantedApplicationCodes.mockReset()
  loadGrantedScopes.mockReset()
  loadGrantedScopes.mockResolvedValue([])
  for (const fn of Object.values(service)) fn.mockClear()
  callCortexProxyImage.mockClear()
  vi.unstubAllEnvs()
  vi.stubEnv("NODE_ENV", "production")
  vi.stubEnv("CORTEX_PROXY_URL", "http://cortex-proxy")
})

describe("bramka /api/visual-guru/** — odkrywanie endpointów", () => {
  it("znajduje wszystkie route'y modułu (inaczej reszta testów byłaby pusta)", () => {
    expect(Object.keys(routeModules).length).toBeGreaterThanOrEqual(3)
    expect(handlers.length).toBeGreaterThanOrEqual(4)
  })
})

describe.each(handlers)("$method $name", ({ method, handler }) => {
  it.each(BYPASS_ATTEMPTS)("odmawia: $label", async ({ email, granted }) => {
    loadGrantedApplicationCodes.mockResolvedValue(granted)

    const response = await handler(makeRequest(method, email), context)

    expect([401, 403]).toContain(response.status)
    expectNoServiceCall()
  })

  it("odmawia gdy odczyt uprawnień pada (fail-closed)", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    loadGrantedApplicationCodes.mockRejectedValue(new Error("connection refused"))

    const response = await handler(makeRequest(method, "admin@firma.pl"), context)

    expect(response.status).toBe(403)
    expectNoServiceCall()
    consoleError.mockRestore()
  })

  // Kontrola pozytywna: bez niej wszystkie powyższe asercje przechodziłyby
  // także wtedy, gdy handler odmawia ZAWSZE (np. przez zepsuty mock).
  it("przepuszcza posiadacza uprawnienia do kafelka", async () => {
    loadGrantedApplicationCodes.mockResolvedValue([ENTITLEMENT])

    const response = await handler(makeRequest(method, "admin@firma.pl"), context)

    expect([401, 403]).not.toContain(response.status)
  })
})
