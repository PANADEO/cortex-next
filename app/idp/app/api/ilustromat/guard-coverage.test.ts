// Próby ominięcia bramki NA REALNEJ ŚCIEŻCE ŻĄDANIA — code-service/SKILL.md
// pkt 3. Test jednostkowy samego requireTileAccess() tego nie pokrywa: nie
// wykryje handlera, w którym ktoś usunął albo przestawił wywołanie bramki.
//
// Kluczowa własność: ten plik NIE MA listy endpointów. `import.meta.glob`
// wciąga każdy route.ts z tego katalogu, więc nowy endpoint dodany bez bramki
// wywala ten test od razu — nikt nie musi pamiętać o dopisaniu go tutaj.
//
// Ilustromat ma DWIE warstwy bramek i test sprawdza obie:
//   - kafelek (requireTileAccess) — każdy endpoint,
//   - scope "manage-templates" (requireTileScope) — endpointy zmieniające markę.
// Dlatego wśród prób obejścia jest przypadek "ma dostęp do kafelka, ale nie ma
// scope'u": endpoint administracyjny MUSI go odrzucić, a end-userowy przepuścić.

import type * as CortexService from "@cortex/service"
import { beforeEach, describe, expect, it, vi } from "vitest"

const loadGrantedApplicationCodes = vi.hoisted(() => vi.fn<(email: string) => Promise<string[]>>())
const loadGrantedScopes = vi.hoisted(() => vi.fn<(email: string) => Promise<string[]>>())

vi.mock("@cortex/service/rbac-store", () => ({ loadGrantedApplicationCodes, loadGrantedScopes }))

// Bramki (requireTileAccess/requireTileScope) zostają PRAWDZIWE — podmieniane
// są tylko funkcje sięgające do bazy, żeby handler po ominiętej bramce oddał
// coś innego niż 500 na braku DATABASE_URL. Inaczej test przechodziłby
// z niewłaściwego powodu.
const service = vi.hoisted(() => {
  const template = {
    id: "crido-violet",
    name: "Crido — fioletowa",
    colorBg: "#5B3DA8",
    colorText: "#FFFFFF",
    colorAccent: "#FF8C42",
    fontSource: "library",
    fontLibraryId: "noto-sans",
    logoPosition: "bottom-right",
    cornerRadius: 28,
    minImageAreaRatio: 0.45,
    websiteText: "crido.pl",
    layout: "image-top",
    textAlign: "left",
    isActive: true,
    createdBy: "system",
  }
  return {
    listFrameTemplates: vi.fn(async () => [template]),
    getFrameTemplate: vi.fn(async () => template),
    createFrameTemplate: vi.fn(async () => template),
    updateFrameTemplate: vi.fn(async () => template),
    setFrameTemplateActive: vi.fn(async () => template),
    duplicateFrameTemplate: vi.fn(async () => template),
    deleteFrameTemplate: vi.fn(async () => true),
    getTemplateAsset: vi.fn(async () => null),
    listTemplateAssets: vi.fn(async () => []),
    saveTemplateAsset: vi.fn(async () => undefined),
  }
})

vi.mock("@cortex/service", async (importOriginal) => {
  const actual = await importOriginal<typeof CortexService>()
  return { ...actual, ...service }
})

// Adapter cortex-proxy zamockowany, żeby odmowa nie była mylona z brakiem
// sieci, a przepuszczenie nie wołało realnego modelu.
vi.mock("@cortex/api/cortex-proxy-client", () => ({
  callCortexProxy: vi.fn(async () => ({ content: "prompt", model: "test", tokensUsed: 1 })),
  callCortexProxyImage: vi.fn(async () => ({
    dataUrl: "data:image/png;base64,iVBORw0KGgo=",
    model: "test",
    tokensUsed: 1,
  })),
  decodeDataUrl: vi.fn(() => Buffer.from([0x89, 0x50, 0x4e, 0x47])),
}))

/**
 * Bramka ma stać PRZED jakąkolwiek pracą, nie tylko decydować o statusie.
 * Route, który najpierw kasuje szablon, a dopiero potem pyta o uprawnienia,
 * oddaje poprawne 403 i przechodziłby sam status — dlatego przy każdej odmowie
 * sprawdzamy też, że warstwa serwisowa milczała.
 */
function expectNoServiceCall(): void {
  for (const [name, fn] of Object.entries(service)) {
    expect(fn, `${name} zostało zawołane mimo odmowy dostępu`).not.toHaveBeenCalled()
  }
}

const { clearTileAccessCache } = await import("@cortex/service")

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const
const ENTITLEMENT = "ilustromat"
const SCOPE = "ilustromat:manage-templates"

type Handler = (request: Request, context: unknown) => Promise<Response>

declare global {
  interface ImportMeta {
    glob: <T>(pattern: string) => Record<string, () => Promise<T>>
  }
}

const routeModules = import.meta.glob<Record<string, unknown>>("./**/route.ts")

/** Ciało akceptowane przez każdy handler zapisujący — gdyby bramka wypadła,
 *  żądanie ma szansę dojść do 200, a nie utknąć na 400. */
const BODY = {
  action: "set-active",
  isActive: true,
  templateId: "crido-violet",
  formatKey: "square",
  styleKey: "photorealistic",
  title: "Tytuł testowy",
  subtitle: "Podtytuł testowy",
  idea: "",
  variants: 2,
  field: "title",
  text: "Tekst do poprawy",
  background: "iVBORw0KGgo=",
  template: {
    name: "Szablon testowy",
    colorBg: "#5B3DA8",
    colorText: "#FFFFFF",
    colorAccent: "#FF8C42",
    fontSource: "library",
    fontLibraryId: "noto-sans",
    logoPosition: "bottom-right",
    cornerRadius: 28,
    minImageAreaRatio: 0.45,
    websiteText: "crido.pl",
    layout: "image-top",
    textAlign: "left",
  },
}

function makeRequest(method: string, email: string | null): Request {
  const headers = new Headers({ "Content-Type": "application/json" })
  if (email !== null) headers.set("x-auth-request-email", email)
  const hasBody = method !== "GET" && method !== "DELETE"
  return new Request("http://localhost/api/ilustromat/probe", {
    method,
    headers,
    ...(hasBody ? { body: JSON.stringify(BODY) } : {}),
  })
}

const context = { params: Promise.resolve({ id: "crido-violet" }) }

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

/** Endpointy zmieniające markę — wymagają scope'u, nie tylko dostępu do
 *  kafelka: wszystko pod /templates/[id]/** oraz zapis na liście szablonów.
 *  Jedyny wyjątek to GET listy — end-user musi ją widzieć, żeby wybrać szablon. */
function requiresScope(name: string, method: string): boolean {
  if (name.includes("/templates/[id]")) return true
  return name === "./templates/route.ts" && method !== "GET"
}

const BYPASS_ATTEMPTS = [
  { label: "brak nagłówka tożsamości", email: null, granted: [] as string[], scopes: [] as string[] },
  { label: "obcy e-mail spoza bazy", email: "intruz@obca-firma.pl", granted: [], scopes: [] },
  { label: "znany e-mail bez żadnej roli", email: "bez-roli@firma.pl", granted: [], scopes: [] },
  {
    label: "rola z grantem do innego kafelka",
    email: "ktos@firma.pl",
    granted: ["intrastat", "idp"],
    scopes: [],
  },
  {
    label: "grant do łudząco podobnego kodu",
    email: "ktos@firma.pl",
    granted: ["ilustromat-templates"],
    scopes: [],
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
  vi.stubEnv("CORTEX_PROXY_URL", "http://cortex-proxy")
})

describe("bramka /api/ilustromat/** — odkrywanie endpointów", () => {
  it("znajduje wszystkie route'y modułu (inaczej reszta testów byłaby pusta)", () => {
    expect(Object.keys(routeModules).length).toBeGreaterThanOrEqual(6)
    expect(handlers.length).toBeGreaterThanOrEqual(7)
  })
})

describe.each(handlers)("$method $name", ({ method, handler }) => {
  it.each(BYPASS_ATTEMPTS)("odmawia: $label", async ({ email, granted, scopes }) => {
    loadGrantedApplicationCodes.mockResolvedValue(granted)
    loadGrantedScopes.mockResolvedValue(scopes)

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
  it("przepuszcza posiadacza kompletu uprawnień", async () => {
    loadGrantedApplicationCodes.mockResolvedValue([ENTITLEMENT])
    loadGrantedScopes.mockResolvedValue([SCOPE])

    const response = await handler(makeRequest(method, "admin@firma.pl"), context)

    expect([401, 403]).not.toContain(response.status)
  })
})

describe("warstwa granularna — sam dostęp do kafelka nie wystarcza", () => {
  const administrative = handlers.filter(({ name, method }) => requiresScope(name, method))

  it("test obejmuje realne endpointy administracyjne", () => {
    expect(administrative.length).toBeGreaterThanOrEqual(3)
  })

  it.each(administrative)(
    "$method $name odmawia posiadaczowi kafelka bez scope'u",
    async ({ method, handler }) => {
      loadGrantedApplicationCodes.mockResolvedValue([ENTITLEMENT])
      loadGrantedScopes.mockResolvedValue([])

      const response = await handler(makeRequest(method, "ktos@firma.pl"), context)

      expect(response.status).toBe(403)
      expectNoServiceCall()
    },
  )

  it("odczyt listy szablonów NIE wymaga scope'u (end-user musi wybrać szablon)", async () => {
    loadGrantedApplicationCodes.mockResolvedValue([ENTITLEMENT])
    loadGrantedScopes.mockResolvedValue([])

    const { GET } = await import("./templates/route")
    const response = await GET(makeRequest("GET", "ktos@firma.pl") as never)

    expect(response.status).toBe(200)
  })
})
