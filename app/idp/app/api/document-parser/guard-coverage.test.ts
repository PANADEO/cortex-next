// Próby ominięcia bramki NA REALNEJ ŚCIEŻCE ŻĄDANIA — code-service/SKILL.md
// pkt 3. Test jednostkowy samego requireTileAccess() tego nie pokrywa: nie
// wykryje handlera, w którym ktoś usunął albo przestawił wywołanie bramki.
//
// Kluczowa własność: ten plik NIE MA listy endpointów. `import.meta.glob`
// wciąga każdy route.ts z tego katalogu (rekursywnie), więc nowy endpoint
// dodany bez bramki wywala ten test od razu. Wzorem
// app/idp/app/api/ilustromat/guard-coverage.test.ts — document-parser ma
// tylko JEDNĄ warstwę bramek (requireTileAccess, brak granularnych scope'ów
// w v1, D8), więc tu nie ma sekcji "warstwa granularna".

import type * as CortexService from "@cortex/service"
import { beforeEach, describe, expect, it, vi } from "vitest"

const loadGrantedApplicationCodes = vi.hoisted(() => vi.fn<(email: string) => Promise<string[]>>())
const loadGrantedScopes = vi.hoisted(() => vi.fn<(email: string) => Promise<string[]>>())

vi.mock("@cortex/service/rbac-store", () => ({ loadGrantedApplicationCodes, loadGrantedScopes }))

const FIXTURE_JOB = {
  id: "job-1",
  backendJobId: "backend-1",
  userEmail: "admin@firma.pl",
  status: "done",
  fileName: "dokument.pdf",
  fileSizeBytes: 1024,
  mimeType: "application/pdf",
  model: "openai/gpt-4o-mini",
  markdown: "# Wynik",
  errorMessage: null,
  errorCode: null,
  pageCount: 1,
  imageCount: 1,
  truncated: false,
  elapsedSeconds: 1.2,
  createdAt: new Date(),
  updatedAt: new Date(),
  startedAt: new Date(),
  completedAt: new Date(),
}

// Bramka (requireTileAccess) zostaje PRAWDZIWA — podmieniane są tylko
// funkcje serwisowe modułu, żeby handler po ominiętej bramce oddał coś
// innego niż 500 na braku DATABASE_URL. Inaczej test przechodziłby z
// niewłaściwego powodu.
const service = vi.hoisted(() => ({
  listMyJobs: vi.fn(async () => [FIXTURE_JOB]),
  getMyJob: vi.fn(async () => FIXTURE_JOB),
  createQueuedJob: vi.fn(async () => FIXTURE_JOB),
  markJobProcessing: vi.fn(async () => FIXTURE_JOB),
  markJobDone: vi.fn(async () => FIXTURE_JOB),
  markJobError: vi.fn(async () => FIXTURE_JOB),
}))

vi.mock("@cortex/service", async (importOriginal) => {
  const actual = await importOriginal<typeof CortexService>()
  return { ...actual, ...service }
})

// Adapter backendu Python zamockowany — bramka jest to, co testujemy, nie
// dostępność sieci do document-parser-backend.
vi.mock("@/lib/document-parser/backend-client", () => ({
  createBackendJob: vi.fn(async () => ({ jobId: "backend-1", status: "processing" })),
  getBackendJob: vi.fn(async () => null),
  mapBackendErrorToCode: vi.fn(() => "conversion-failed"),
  DocumentParserBackendError: class DocumentParserBackendError extends Error {},
}))

function expectNoServiceCall(): void {
  for (const [name, fn] of Object.entries(service)) {
    expect(fn, `${name} zostało zawołane mimo odmowy dostępu`).not.toHaveBeenCalled()
  }
}

const { clearTileAccessCache } = await import("@cortex/service")

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const
const ENTITLEMENT = "document-parser"

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
  const hasBody = method !== "GET" && method !== "DELETE"
  return new Request("http://localhost/api/document-parser/probe", {
    method,
    headers,
    // Ciało JSON, nie multipart — POST /jobs wymaga FormData, więc z tym
    // ciałem `request.formData()` rzuci i handler odpowie 400
    // ("invalid-request"), NIGDY 401/403 z powodu bramki. Dla asercji
    // pozytywnej to wystarcza (sprawdzamy tylko, że bramka nie blokuje).
    ...(hasBody ? { body: JSON.stringify({ probe: true }) } : {}),
  })
}

const context = { params: Promise.resolve({ id: "job-1" }) }

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
    granted: ["document-parser-admin"],
  },
]

beforeEach(() => {
  clearTileAccessCache()
  loadGrantedApplicationCodes.mockReset()
  loadGrantedScopes.mockReset()
  loadGrantedScopes.mockResolvedValue([])
  for (const fn of Object.values(service)) fn.mockClear()
  vi.unstubAllEnvs()
  vi.stubEnv("NODE_ENV", "production")
})

describe("bramka /api/document-parser/** — odkrywanie endpointów", () => {
  it("znajduje wszystkie route'y modułu (inaczej reszta testów byłaby pusta)", () => {
    expect(Object.keys(routeModules).length).toBeGreaterThanOrEqual(2)
    expect(handlers.length).toBeGreaterThanOrEqual(3)
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
