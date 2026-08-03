// Próby ominięcia bramki NA REALNEJ ŚCIEŻCE ŻĄDANIA — code-service/SKILL.md
// pkt 3. Test jednostkowy samej requireTileAccess()/requireTileScope() tego
// nie pokrywa: nie wykryje handlera, w którym ktoś usunął albo przestawił
// wywołanie bramki.
//
// Kluczowa własność: ten plik NIE MA listy endpointów. `import.meta.glob`
// wciąga każdy route.ts z tego katalogu, więc nowy endpoint dodany bez
// bramki wywala ten test od razu — nikt nie musi pamiętać o dopisaniu go
// tutaj.
//
// Od Round B DWIE warstwy bramek, wzorem Ilustromatu:
//   - kafelek (requireTileAccess / requireContentGuruAccess) — każdy endpoint,
//   - scope "manage-templates" (requireTileScope / requireContentGuruManage-
//     Templates) — endpointy zmieniające szablony (zasób WSPÓLNY, D6/D9).
// Dlatego wśród prób obejścia jest przypadek "ma dostęp do kafelka, ale nie ma
// scope'u": endpoint administracyjny MUSI go odrzucić, a end-userowy (np. GET
// listy szablonów, do wyboru w generowaniu) przepuścić.

import type * as CortexService from "@cortex/service"
import { beforeEach, describe, expect, it, vi } from "vitest"

const loadGrantedApplicationCodes = vi.hoisted(() => vi.fn<(email: string) => Promise<string[]>>())
const loadGrantedScopes = vi.hoisted(() => vi.fn<(email: string) => Promise<string[]>>())
vi.mock("@cortex/service/rbac-store", () => ({ loadGrantedApplicationCodes, loadGrantedScopes }))

// Bramki (requireTileAccess/requireTileScope) zostają PRAWDZIWE — podmieniane
// są tylko funkcje sięgające do bazy, żeby handler po ominiętej bramce oddał
// coś innego niż 500 na braku DATABASE_URL. Inaczej test przechodziłby z
// niewłaściwego powodu.
const service = vi.hoisted(() => {
  const template = {
    id: "00000000-0000-0000-0000-000000000001",
    name: "Szablon testowy",
    category: "Główne",
    content: "Treść szablonu",
    createdBy: "system",
    createdAt: new Date(),
    updatedAt: new Date(),
  }
  const clientProfile = {
    id: "00000000-0000-0000-0000-000000000002",
    userEmail: "admin@firma.pl",
    profileName: "Profil klienta testowy",
    history: null,
    description: null,
    products: null,
    offer: null,
    useCases: null,
    experience: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
  const marketProfile = {
    id: "00000000-0000-0000-0000-000000000003",
    userEmail: "admin@firma.pl",
    profileName: "Profil rynku testowy",
    description: null,
    sizeTrends: null,
    personas: null,
    problems: null,
    needs: null,
    plans: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
  // Round C — D4, generation_jobs. `createGenerationJob` NIE musi być tu
  // mockowane, żeby POST /jobs działało (route.ts wrapuje całość w
  // try/catch -> 500 na realnym błędzie DB, co i tak nie jest [401,403]),
  // ale mockujemy oba dla czystości i spójności z resztą tej listy — każda
  // funkcja serwisowa, którą route może zawołać, ma tu reprezentację.
  const generationJob = {
    id: "00000000-0000-0000-0000-000000000004",
    userEmail: "admin@firma.pl",
    mode: "batch" as const,
    status: "queued" as const,
    items: [] as unknown[],
    createdAt: new Date(),
    completedAt: null,
  }
  return {
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
    listTemplates: vi.fn(async () => [template]),
    getTemplate: vi.fn(async () => template),
    createTemplate: vi.fn(async () => template),
    updateTemplate: vi.fn(async () => template),
    deleteTemplate: vi.fn(async () => true),
    duplicateTemplate: vi.fn(async () => template),
    listMyClientProfiles: vi.fn(async () => [clientProfile]),
    getMyClientProfile: vi.fn(async () => clientProfile),
    createClientProfile: vi.fn(async () => clientProfile),
    updateMyClientProfile: vi.fn(async () => clientProfile),
    deleteMyClientProfile: vi.fn(async () => true),
    listMyMarketProfiles: vi.fn(async () => [marketProfile]),
    getMyMarketProfile: vi.fn(async () => marketProfile),
    createMarketProfile: vi.fn(async () => marketProfile),
    updateMyMarketProfile: vi.fn(async () => marketProfile),
    deleteMyMarketProfile: vi.fn(async () => true),
    createGenerationJob: vi.fn(async () => generationJob),
    getMyGenerationJob: vi.fn(async () => generationJob),
  }
})
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

const HTTP_METHODS = ["GET", "POST", "PUT", "DELETE"] as const
const ENTITLEMENT = "content-guru"
const SCOPE = "content-guru:manage-templates"

type Handler = (request: Request, context: unknown) => Promise<Response>

declare global {
  interface ImportMeta {
    glob: <T>(pattern: string) => Record<string, () => Promise<T>>
  }
}

const routeModules = import.meta.glob<Record<string, unknown>>("./**/route.ts")

/** Ciało akceptowane przez każdy handler zapisujący — superset pól ze
 *  WSZYSTKICH schematów tego modułu (generate/templates/client-profiles/
 *  market-profiles/test-generation/jobs). Gdyby bramka wypadła, żądanie ma
 *  szansę dojść do 2xx, a nie utknąć wcześniej na 400 z niepowiązanego
 *  powodu. `mode: "batch"` + jeden `templateId` w `templateIds` satysfakcjonuje
 *  ZARÓWNO POST /jobs (batch wymaga dokładnie jednego szablonu), jak i
 *  wszystkie pozostałe handlery, które po prostu ignorują nieznane klucze. */
const BODY = {
  contentType: "Post na LinkedIn",
  topic: "Nowości produktowe",
  targetAudience: "Dyrektorzy finansowi",
  additionalInfo: "",
  model: "anthropic/claude-sonnet-4.6",
  mode: "batch",
  topics: ["Nowości produktowe"],
  templateIds: ["00000000-0000-0000-0000-000000000001"],
  name: "Szablon testowy",
  category: "Główne",
  content: "Treść szablonu testowego",
  profileName: "Profil testowy",
  history: "",
  description: "",
  products: "",
  offer: "",
  useCases: "",
  experience: "",
  sizeTrends: "",
  personas: "",
  problems: "",
  needs: "",
  plans: "",
}

function makeRequest(method: string, email: string | null): Request {
  const headers = new Headers({ "Content-Type": "application/json" })
  if (email !== null) headers.set("x-auth-request-email", email)
  const hasBody = method !== "GET" && method !== "DELETE"
  return new Request("http://localhost/api/content-guru/probe", {
    method,
    headers,
    ...(hasBody ? { body: JSON.stringify(BODY) } : {}),
  })
}

const context = { params: Promise.resolve({ id: "00000000-0000-0000-0000-000000000099" }) }

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

/** Endpointy zmieniające szablony — wymagają scope'u, nie tylko dostępu do
 *  kafelka. GET pozostaje za samą pierwszą warstwą wszędzie (end-user musi
 *  widzieć/wybrać szablon), stąd wyjątek na metodę w obu gałęziach `/templates`. */
function requiresScope(name: string, method: string): boolean {
  if (name.includes("/templates/[id]/duplicate")) return true
  if (name.includes("/templates/test-generation")) return true
  if (name.includes("/templates/[id]")) return method !== "GET"
  if (name === "./templates/route.ts") return method !== "GET"
  return false
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
    granted: ["content-guru-templates"],
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
  vi.stubEnv("CONTENT_GURU_MODELS", "anthropic/claude-sonnet-4.6,openai/gpt-4o-mini")
})

describe("bramka /api/content-guru/** — odkrywanie endpointów", () => {
  it("znajduje wszystkie route'y modułu (inaczej reszta testów byłaby pusta)", () => {
    expect(Object.keys(routeModules).length).toBeGreaterThanOrEqual(11)
    expect(handlers.length).toBeGreaterThanOrEqual(19)
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
  // także wtedy, gdy handler odmawia ZAWSZE (np. przez zepsuty mock). Grant
  // OBU warstw naraz — endpointy end-userowe nie zwracają scope'u w
  // `loadGrantedScopes`, więc to jest "co najmniej wystarczające uprawnienia"
  // dla każdego handlera, niezależnie od tego, której warstwy realnie wymaga.
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
    expect(administrative.length).toBeGreaterThanOrEqual(5)
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

  it("odczyt pojedynczego szablonu NIE wymaga scope'u", async () => {
    loadGrantedApplicationCodes.mockResolvedValue([ENTITLEMENT])
    loadGrantedScopes.mockResolvedValue([])

    const { GET } = await import("./templates/[id]/route")
    const response = await GET(makeRequest("GET", "ktos@firma.pl") as never, context)

    expect(response.status).toBe(200)
  })
})
