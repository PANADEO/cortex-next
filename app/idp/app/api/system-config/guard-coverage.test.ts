// Próby ominięcia bramki NA REALNEJ ŚCIEŻCE ŻĄDANIA — code-service/SKILL.md
// pkt 3. Test jednostkowy samego requireTileAccess() tego nie pokrywa: nie
// wykryje handlera, w którym ktoś usunął albo przestawił wywołanie bramki.
//
// Kluczowa własność: ten plik NIE MA listy endpointów. `import.meta.glob`
// wciąga każdy route.ts z tego katalogu, więc nowy endpoint dodany bez bramki
// wywala ten test od razu — nikt nie musi pamiętać o dopisaniu go tutaj.
// To jest odpowiedź na zarzut "nic nie pilnuje, żeby bramka została wpięta jutro".

import { beforeEach, describe, expect, it, vi } from "vitest"

const loadGrantedApplicationCodes = vi.hoisted(() => vi.fn<(email: string) => Promise<string[]>>())

vi.mock("@cortex/service/rbac-store", () => ({ loadGrantedApplicationCodes }))

// Bramka (requireTileAccess) zostaje PRAWDZIWA — podmieniane są tylko funkcje
// sięgające do bazy, żeby handler po ominiętej bramce oddał 200, a nie 500 na
// braku DATABASE_URL. Inaczej test przechodziłby z niewłaściwego powodu.
//
// Mocki trzymamy w nazwanym obiekcie, bo służą do DWÓCH rzeczy naraz: dają
// handlerowi działającą warstwę serwisową i pozwalają sprawdzić, że przy
// odmowie NIE zostały w ogóle zawołane (patrz asercja "bez skutku ubocznego").
const service = vi.hoisted(() => {
  const application = {
    id: "11111111-1111-4111-8111-111111111111",
    code: "przykladowy-kafelek",
    name: "Przykładowy kafelek",
  }
  return {
    listUsers: vi.fn(async () => []),
    listRoles: vi.fn(async () => []),
    listApplications: vi.fn(async () => []),
    listApplicationRoleIds: vi.fn(async () => []),
    createApplication: vi.fn(async () => application),
    updateApplication: vi.fn(async () => application),
    deleteApplication: vi.fn(async () => true),
    setUserRoles: vi.fn(async () => undefined),
    setApplicationRoles: vi.fn(async () => undefined),
    setRoleApplications: vi.fn(async () => undefined),
  }
})

vi.mock("@cortex/service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@cortex/service")>()
  return { ...actual, ...service }
})

/**
 * Bramka ma stać PRZED jakąkolwiek pracą (`_lib/guard.ts`), nie tylko decydować
 * o statusie odpowiedzi. Route, który najpierw kasuje aplikację, a dopiero
 * potem pyta o uprawnienia, oddaje poprawne 403 i przechodziłby sam status —
 * dlatego przy każdej odmowie sprawdzamy też, że warstwa serwisowa milczała.
 */
function expectNoServiceCall(): void {
  for (const [name, fn] of Object.entries(service)) {
    expect(fn, `${name} zostało zawołane mimo odmowy dostępu`).not.toHaveBeenCalled()
  }
}

const { clearTileAccessCache } = await import("@cortex/service")

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const
const SOME_UUID = "9f1d3c62-1f4a-4a6b-9f3c-2b7d5e8a1c40"
const ENTITLEMENT = "system-config"

type Handler = (request: Request, context: unknown) => Promise<Response>

// `import.meta.glob` daje Vite (a więc i vitest), nie standardowy TypeScript.
// Typy `vite/client` nie są w tym repo rozwiązywalne (vite jest zależnością
// przechodnią vitest), więc deklarujemy minimalny kontrakt, z którego
// korzysta ten plik. Wywołanie zostaje w formie statycznie rozpoznawalnej
// przez Vite — inaczej glob nie zostałby rozwinięty w czasie transformacji.
declare global {
  interface ImportMeta {
    glob: <T>(pattern: string) => Record<string, () => Promise<T>>
  }
}

const routeModules = import.meta.glob<Record<string, unknown>>("./**/route.ts")

/** Ciało akceptowane przez każdy handler zapisujący — gdyby bramka wypadła,
 *  żądanie ma szansę dojść do 200, a nie utknąć na 400. */
const BODY = {
  code: "przykladowy-kafelek",
  name: "Przykładowy kafelek",
  kind: "native",
  route: "/przykladowy-kafelek",
  roleIds: [],
}

function makeRequest(method: string, email: string | null): Request {
  const headers = new Headers({ "Content-Type": "application/json" })
  if (email !== null) headers.set("x-auth-request-email", email)
  const hasBody = method !== "GET" && method !== "DELETE"
  return new Request(`http://localhost/api/system-config/probe`, {
    method,
    headers,
    ...(hasBody ? { body: JSON.stringify(BODY) } : {}),
  })
}

const context = { params: Promise.resolve({ id: SOME_UUID }) }

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
    granted: ["intrastat", "idp"],
  },
  {
    label: "grant do łudząco podobnego kodu",
    email: "ktos@firma.pl",
    granted: ["system-config-readonly"],
  },
]

beforeEach(() => {
  clearTileAccessCache()
  loadGrantedApplicationCodes.mockReset()
  for (const fn of Object.values(service)) fn.mockClear()
  vi.unstubAllEnvs()
  vi.stubEnv("NODE_ENV", "production")
})

describe("bramka /api/system-config/** — odkrywanie endpointów", () => {
  it("znajduje wszystkie route'y modułu (inaczej reszta testów byłaby pusta)", () => {
    expect(Object.keys(routeModules).length).toBeGreaterThanOrEqual(6)
    expect(handlers.length).toBeGreaterThanOrEqual(8)
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
  it("przepuszcza posiadacza właściwego grantu", async () => {
    loadGrantedApplicationCodes.mockResolvedValue([ENTITLEMENT])

    const response = await handler(makeRequest(method, "admin@firma.pl"), context)

    expect([401, 403]).not.toContain(response.status)
  })
})
