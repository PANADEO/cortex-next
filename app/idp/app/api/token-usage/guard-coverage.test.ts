// Próby ominięcia bramki NA REALNEJ ŚCIEŻCE ŻĄDANIA — code-service/SKILL.md
// pkt 3. Test jednostkowy samego requireTileAccess() tego nie pokrywa: nie
// wykryje handlera, w którym ktoś usunął albo przestawił wywołanie bramki.
//
// Kluczowa własność: ten plik NIE MA listy endpointów. `import.meta.glob`
// wciąga każdy route.ts z tego katalogu, więc nowy endpoint dodany bez bramki
// wywala ten test od razu — nikt nie musi pamiętać o dopisaniu go tutaj.
//
// WAGA JEST TU WYŻSZA NIŻ PRZY ZWYKŁYM KAFELKU. Za tą bramką leży odpowiedź
// GET /usage: lista e-maili WSZYSTKICH użytkowników instancji razem z ich
// aktywnością — kto, kiedy, jakim modelem i w jakim narzędziu pracował.
// Wyciek tego jednego endpointu jest jakościowo inny niż wyciek listy szablonów.
//
// Kafelek ma JEDNĄ warstwę bramek (requireTileAccess), świadomie bez
// requireTileScope() — patrz _lib/guard.ts. Dlatego, inaczej niż w Ilustromacie,
// nie ma tu przypadku "ma kafelek, nie ma scope'u".

import { beforeEach, describe, expect, it, vi } from "vitest"

const loadGrantedApplicationCodes = vi.hoisted(() => vi.fn<(email: string) => Promise<string[]>>())

vi.mock("@cortex/service/rbac-store", () => ({
  loadGrantedApplicationCodes,
  loadGrantedScopes: vi.fn(async () => []),
}))

// Bramka (requireTileAccess) zostaje PRAWDZIWA — podmieniana jest tylko funkcja
// sięgająca do bazy, żeby handler po ominiętej bramce oddał 200, a nie 500 na
// braku DATABASE_URL. Inaczej test przechodziłby z niewłaściwego powodu.
const { clearTileAccessCache } = await import("@cortex/service")

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const
const ENTITLEMENT = "token-usage"
const ADMIN_KEY = "sekret-administracyjny"

type Handler = (request: Request, context: unknown) => Promise<Response>

declare global {
  interface ImportMeta {
    glob: <T>(pattern: string) => Record<string, () => Promise<T>>
  }
}

const routeModules = import.meta.glob<Record<string, unknown>>("./**/route.ts")

/**
 * Ten moduł nie ma własnej warstwy serwisowej ani bazy — jedynym skutkiem
 * ubocznym, jaki może wywołać, jest ODPYTANIE CUDZEGO SERWISU. Dlatego rolę
 * `expectNoServiceCall()` z system-config/ilustromat pełni tu sprawdzenie, że
 * `fetch` w ogóle nie został zawołany.
 *
 * To nie jest słabsza asercja, tylko właściwa dla tej warstwy: handler, który
 * najpierw pobiera raport z cortex-proxy, a dopiero potem pyta o uprawnienia,
 * oddaje poprawne 403 i przeszedłby sam status — mimo że dane z PII zdążyły
 * już opuścić proxy i znaleźć się w pamięci naszego procesu.
 */
const fetchMock = vi.fn(
  async () =>
    new Response(JSON.stringify([]), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
)

function expectProxyUntouched(): void {
  expect(fetchMock, "cortex-proxy został odpytany mimo odmowy dostępu").not.toHaveBeenCalled()
}

function makeRequest(method: string, email: string | null): Request {
  const headers = new Headers({ "Content-Type": "application/json" })
  if (email !== null) headers.set("x-auth-request-email", email)
  const hasBody = method !== "GET" && method !== "DELETE"
  // Zakres dat jest POPRAWNY celowo: gdyby bramka wypadła, żądanie ma szansę
  // dojść do 200, a nie utknąć na 400 i przejść test z niewłaściwego powodu.
  return new Request("http://localhost/api/token-usage?start=2026-07-01&end=2026-07-30", {
    method,
    headers,
    ...(hasBody ? { body: JSON.stringify({}) } : {}),
  })
}

const context = { params: Promise.resolve({}) }

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
  { label: "obcy e-mail spoza bazy", email: "intruz@obca-firma.pl", granted: [] as string[] },
  { label: "znany e-mail bez żadnej roli", email: "bez-roli@firma.pl", granted: [] as string[] },
  {
    label: "rola z grantem do innego kafelka",
    email: "ktos@firma.pl",
    granted: ["intrastat", "idp", "ilustromat"],
  },
  {
    label: "grant do łudząco podobnego kodu",
    email: "ktos@firma.pl",
    granted: ["token-usage-readonly"],
  },
  {
    label: "grant zapisany po staremu, ze scope'u cortex-admin",
    email: "ktos@firma.pl",
    granted: ["token_usage"],
  },
]

beforeEach(() => {
  clearTileAccessCache()
  loadGrantedApplicationCodes.mockReset()
  fetchMock.mockClear()
  vi.stubGlobal("fetch", fetchMock)
  vi.unstubAllEnvs()
  vi.stubEnv("NODE_ENV", "production")
  vi.stubEnv("CORTEX_PROXY_URL", "http://cortex-proxy")
  vi.stubEnv("CORTEX_PROXY_ADMIN_API_KEY", ADMIN_KEY)
})

describe("bramka /api/token-usage/** — odkrywanie endpointów", () => {
  it("znajduje wszystkie route'y modułu (inaczej reszta testów byłaby pusta)", () => {
    expect(Object.keys(routeModules).length).toBeGreaterThanOrEqual(1)
    expect(handlers.length).toBeGreaterThanOrEqual(1)
  })
})

describe.each(handlers)("$method $name", ({ method, handler }) => {
  it.each(BYPASS_ATTEMPTS)("odmawia: $label", async ({ email, granted }) => {
    loadGrantedApplicationCodes.mockResolvedValue(granted)

    const response = await handler(makeRequest(method, email), context)

    expect([401, 403]).toContain(response.status)
    expectProxyUntouched()
  })

  it("odmawia gdy odczyt uprawnień pada (fail-closed)", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    loadGrantedApplicationCodes.mockRejectedValue(new Error("connection refused"))

    const response = await handler(makeRequest(method, "admin@firma.pl"), context)

    expect(response.status).toBe(403)
    expectProxyUntouched()
    consoleError.mockRestore()
  })

  // Kontrola pozytywna: bez niej wszystkie powyższe asercje przechodziłyby
  // także wtedy, gdy handler odmawia ZAWSZE (np. przez zepsuty mock).
  it("przepuszcza posiadacza właściwego grantu", async () => {
    loadGrantedApplicationCodes.mockResolvedValue([ENTITLEMENT])

    const response = await handler(makeRequest(method, "admin@firma.pl"), context)

    expect([401, 403]).not.toContain(response.status)
  })

  // Odmowa NIE MA prawa nieść ani grama danych ani sekretu — ciało 401/403
  // jest jedyną rzeczą, którą nieuprawniony wołający zobaczy.
  it("odpowiedź odmowna nie niesie danych ani sekretu", async () => {
    loadGrantedApplicationCodes.mockResolvedValue([])

    const response = await handler(makeRequest(method, "intruz@obca-firma.pl"), context)
    const text = await response.text()

    expect(text).not.toContain(ADMIN_KEY)
    expect(text).not.toContain("user_id")
    expect(text).not.toContain("totals")
    expect(JSON.parse(text)).toEqual({ error: "forbidden" })
  })
})
