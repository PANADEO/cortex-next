// Próby ominięcia bramki NA REALNEJ ŚCIEŻCE ŻĄDANIA — code-service/SKILL.md
// pkt 3. Test jednostkowy samej requireTileAccess() tego nie pokrywa: nie
// wykryje handlera, w którym ktoś usunął albo przestawił wywołanie bramki.
//
// Kluczowa własność: ten plik NIE MA listy endpointów. `import.meta.glob`
// wciąga każdy route.ts z tego katalogu, więc nowy endpoint dodany bez
// bramki (Round B: templates/client-profiles/market-profiles/forbidden-
// phrases/archive) wywala ten test od razu — nikt nie musi pamiętać o
// dopisaniu go tutaj.
//
// Tylko JEDNA warstwa bramki w tej rundzie (requireTileAccess) — druga,
// granularna "manage-templates" (wzorem Ilustromatu) dochodzi w Round B razem
// z CRUD szablonów, patrz app/idp/app/api/content-guru/_lib/guard.ts.

import type * as CortexService from "@cortex/service"
import { beforeEach, describe, expect, it, vi } from "vitest"

const loadGrantedApplicationCodes = vi.hoisted(() => vi.fn<(email: string) => Promise<string[]>>())
vi.mock("@cortex/service/rbac-store", () => ({
  loadGrantedApplicationCodes,
  loadGrantedScopes: vi.fn(async () => []),
}))

// Bramka (requireTileAccess) zostaje PRAWDZIWA — podmieniane są tylko
// funkcje sięgające do bazy, żeby handler po ominiętej bramce oddał coś
// innego niż 500 na braku DATABASE_URL. Inaczej test przechodziłby z
// niewłaściwego powodu.
const service = vi.hoisted(() => ({
  listMyForbiddenPhrases: vi.fn(async () => [] as unknown[]),
  saveArchiveEntry: vi.fn(async () => ({
    id: "archive-1",
    userEmail: "admin@firma.pl",
    contentType: "post",
    topic: "temat",
    generatedContent: "treść",
    status: "done",
    matchedForbiddenPhrases: null,
    targetAudience: null,
    additionalInfo: null,
    keywordPhrase: null,
    metaDescription: null,
    modelUsed: "anthropic/claude-sonnet-4.6",
    clientProfileId: null,
    marketProfileId: null,
    metadata: {},
    createdAt: new Date(),
  })),
}))
vi.mock("@cortex/service", async (importOriginal) => ({
  ...(await importOriginal<typeof CortexService>()),
  ...service,
}))

// Adapter cortex-proxy zamockowany, żeby odmowa nie była mylona z brakiem
// sieci, a przepuszczenie nie wołało realnego modelu.
vi.mock("@/lib/content-guru/integration-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/content-guru/integration-client")>()),
  generateContent: vi.fn(async () => ({
    content: "wygenerowana treść",
    tokensUsed: 100,
    model: "anthropic/claude-sonnet-4.6",
  })),
}))

const { clearTileAccessCache } = await import("@cortex/service")

const HTTP_METHODS = ["GET", "POST"] as const
const ENTITLEMENT = "content-guru"

type Handler = (request: Request) => Promise<Response>

declare global {
  interface ImportMeta {
    glob: <T>(pattern: string) => Record<string, () => Promise<T>>
  }
}

const routeModules = import.meta.glob<Record<string, unknown>>("./**/route.ts")

/** Ciało akceptowane przez każdy handler zapisujący — gdyby bramka wypadła,
 *  żądanie ma szansę dojść do 200, a nie utknąć na 400. */
const BODY = {
  contentType: "Post na LinkedIn",
  topic: "Nowości produktowe",
  targetAudience: "Dyrektorzy finansowi",
  additionalInfo: "",
  model: "anthropic/claude-sonnet-4.6",
}

function makeRequest(method: string, email: string | null): Request {
  const headers = new Headers({ "Content-Type": "application/json" })
  if (email !== null) headers.set("x-auth-request-email", email)
  const hasBody = method === "POST"
  return new Request("http://localhost/api/content-guru/probe", {
    method,
    headers,
    ...(hasBody ? { body: JSON.stringify(BODY) } : {}),
  })
}

function expectNoServiceCall(): void {
  for (const [name, fn] of Object.entries(service)) {
    expect(fn, `${name} zostało zawołane mimo odmowy dostępu`).not.toHaveBeenCalled()
  }
}

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
  { label: "rola z grantem do innego kafelka", email: "ktos@firma.pl", granted: ["intrastat", "idp"] },
  {
    label: "grant do łudząco podobnego kodu",
    email: "ktos@firma.pl",
    granted: ["content-guru-templates"],
  },
]

beforeEach(() => {
  clearTileAccessCache()
  loadGrantedApplicationCodes.mockReset()
  for (const fn of Object.values(service)) fn.mockClear()
  vi.unstubAllEnvs()
  vi.stubEnv("NODE_ENV", "production")
  vi.stubEnv("CORTEX_PROXY_URL", "http://cortex-proxy")
  vi.stubEnv("CONTENT_GURU_MODELS", "anthropic/claude-sonnet-4.6,openai/gpt-4o-mini")
})

describe("bramka /api/content-guru/** — odkrywanie endpointów", () => {
  it("znajduje wszystkie route'y modułu (inaczej reszta testów byłaby pusta)", () => {
    expect(Object.keys(routeModules).length).toBeGreaterThanOrEqual(2)
    expect(handlers.length).toBeGreaterThanOrEqual(2)
  })
})

describe.each(handlers)("$method $name", ({ method, handler }) => {
  it.each(BYPASS_ATTEMPTS)("odmawia: $label", async ({ email, granted }) => {
    loadGrantedApplicationCodes.mockResolvedValue(granted)

    const response = await handler(makeRequest(method, email))

    expect([401, 403]).toContain(response.status)
    expectNoServiceCall()
  })

  it("odmawia gdy odczyt uprawnień pada (fail-closed)", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    loadGrantedApplicationCodes.mockRejectedValue(new Error("connection refused"))

    const response = await handler(makeRequest(method, "admin@firma.pl"))

    expect(response.status).toBe(403)
    expectNoServiceCall()
    consoleError.mockRestore()
  })

  // Kontrola pozytywna: bez niej wszystkie powyższe asercje przechodziłyby
  // także wtedy, gdy handler odmawia ZAWSZE (np. przez zepsuty mock).
  it("przepuszcza posiadacza dostępu do kafelka", async () => {
    loadGrantedApplicationCodes.mockResolvedValue([ENTITLEMENT])

    const response = await handler(makeRequest(method, "admin@firma.pl"))

    expect([401, 403]).not.toContain(response.status)
  })
})
