// Próby ominięcia bramki NA REALNEJ ŚCIEŻCE ŻĄDANIA — code-service/SKILL.md
// pkt 3. Test jednostkowy samego requireTileAccess() tego nie pokrywa: nie
// wykryje handlera, w którym ktoś usunął albo przestawił wywołanie bramki.
//
// Kluczowa własność: ten plik NIE MA listy endpointów. `import.meta.glob`
// wciąga każdy route.ts z tego katalogu (rekursywnie, więc łapie zarówno
// analyze/route.ts z Fazy 1, jak i history/**/route.ts z Fazy 2) — nowy
// endpoint dodany bez bramki wywala ten test od razu. Wzorem
// app/idp/app/api/document-parser/guard-coverage.test.ts. Tylko JEDNA
// warstwa bramek (requireTileAccess, brak granularnych scope'ów w v1, D5
// design doc §2/§7 pkt 3) — nie ma tu sekcji "warstwa granularna".

import type * as CortexService from "@cortex/service"
import { beforeEach, describe, expect, it, vi } from "vitest"

const loadGrantedApplicationCodes = vi.hoisted(() => vi.fn<(email: string) => Promise<string[]>>())
const loadGrantedScopes = vi.hoisted(() => vi.fn<(email: string) => Promise<string[]>>())

vi.mock("@cortex/service/rbac-store", () => ({ loadGrantedApplicationCodes, loadGrantedScopes }))

const FIXTURE_CALCULATION = {
  id: "calc-1",
  userEmail: "admin@firma.pl",
  textContent: "Firma wdrożyła system.",
  textPreview: "Firma wdrożyła system.",
  wordCount: 3,
  totalScore: 82.4,
  grade: "B",
  statsScore: 91,
  verbsScore: 76,
  structureScore: 88,
  objectivityScore: 79,
  result: { totalScore: 82.4, grade: "B" },
  configSnapshot: { weightStatistics: 0.3 },
  createdAt: new Date(),
}

const CONFIG_ROW = {
  id: true,
  weightStatistics: 0.3,
  weightActionVerbs: 0.25,
  weightStructure: 0.2,
  weightObjectivity: 0.25,
  benchmarkStats: 4,
  benchmarkVerbs: 0.15,
  benchmarkStructure: 3,
  benchmarkObjectivity: 0.05,
  gradeAMin: 90,
  gradeBMin: 75,
  gradeCMin: 60,
  gradeDMin: 40,
  actionVerbs: ["wdrożył"],
  subjectiveWords: ["najlepszy"],
  falsePositives: [],
  bulletPatterns: ["^[\\s]*-\\s+"],
  updatedAt: new Date(),
  updatedBy: "system",
}

// Bramka (requireTileAccess) zostaje PRAWDZIWA — podmieniane są tylko
// funkcje serwisowe modułu, żeby handler po ominiętej bramce oddał coś
// innego niż 500 na braku DATABASE_URL. Inaczej test przechodziłby z
// niewłaściwego powodu.
const service = vi.hoisted(() => ({
  getGeoScoreConfig: vi.fn(async () => CONFIG_ROW),
  saveGeoScoreCalculation: vi.fn(async () => FIXTURE_CALCULATION),
  listMyCalculations: vi.fn(async () => [FIXTURE_CALCULATION]),
  getMyCalculation: vi.fn(async () => FIXTURE_CALCULATION),
  deleteMyCalculation: vi.fn(async () => true),
  updateGeoScoreConfig: vi.fn(async () => CONFIG_ROW),
  resetGeoScoreConfig: vi.fn(async () => CONFIG_ROW),
}))

vi.mock("@cortex/service", async (importOriginal) => {
  const actual = await importOriginal<typeof CortexService>()
  return { ...actual, ...service }
})

// Adapter mikroserwisu Python zamockowany — bramka jest to, co testujemy,
// nie dostępność sieci do services/geo-score-calculator.
const analyzeGeoScore = vi.hoisted(() => vi.fn(async () => ({ totalScore: 82.4, grade: "B" })))
vi.mock("@/lib/geo-score-calculator/integration-client", () => ({
  analyzeGeoScore,
  GeoScoreServiceError: class GeoScoreServiceError extends Error {},
}))

const { clearTileAccessCache } = await import("@cortex/service")

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const
const ENTITLEMENT = "geo-score-calculator"

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
  return new Request("http://localhost/api/geo-score-calculator/probe", {
    method,
    headers,
    // Ciało generyczne — analyze/route.ts wymaga { text }, więc z tym ciałem
    // schemat Zod odrzuci je jako 400 ("invalid-request"), NIGDY 401/403 z
    // powodu bramki. Dla asercji pozytywnej (kontrola, że bramka w ogóle
    // przepuszcza) 400 wystarcza — sprawdzamy tylko, że nie jest to 401/403.
    ...(hasBody ? { body: JSON.stringify({ probe: true }) } : {}),
  })
}

function expectNoServiceCall(): void {
  for (const [name, fn] of Object.entries(service)) {
    expect(fn, `${name} zostało zawołane mimo odmowy dostępu`).not.toHaveBeenCalled()
  }
}

const context = { params: Promise.resolve({ id: "calc-1" }) }

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
    granted: ["geo-score-calculator-legacy"],
  },
]

beforeEach(() => {
  clearTileAccessCache()
  loadGrantedApplicationCodes.mockReset()
  loadGrantedScopes.mockReset()
  loadGrantedScopes.mockResolvedValue([])
  for (const fn of Object.values(service)) fn.mockClear()
  analyzeGeoScore.mockClear()
  vi.unstubAllEnvs()
  vi.stubEnv("NODE_ENV", "production")
})

describe("bramka /api/geo-score-calculator/** — odkrywanie endpointów", () => {
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
