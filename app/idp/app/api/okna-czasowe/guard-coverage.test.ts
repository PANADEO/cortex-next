// Pokrycie bramki dla CAŁEJ powierzchni /api/okna-czasowe, na ścieżce ŻĄDANIA.
//
// Historia tego pliku: do 30.07.2026 były to testy CHARAKTERYZACYJNE — moduł nie
// miał żadnej autoryzacji (anonimowy POST /films → 201 Created, anonimowy DELETE
// kasował cudzy rekord, anonimowy POST /scan wypuszczał ruch wychodzący do
// JustWatch), a testy utrwalały ten stan jako wykonywalny dowód luki. Bramka
// (_lib/guard.ts, requireTileAccess) domknęła go, więc plik jest dziś normalnym
// testem bramki: te same scenariusze, odwrócone oczekiwania.
//
// Kluczowa własność: NIE MA tu ręcznej listy endpointów. `import.meta.glob`
// wciąga każdy route.ts modułu z dysku, więc nowy endpoint dodany bez bramki
// zapala ten plik od razu, bez edycji testu.
//
// Klasa błędu, którą to łapie: RBAC widoczny wyłącznie w UI. `AppGate` to
// komponent React, który nigdy nie owija Route Handlerów — dokładnie ta sama
// diagnoza, którą project-gate.ts postawił dla sesji Cortex Cowork.

import type { Film } from "@/features/okna-czasowe/types"
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Podmieniany jest WYŁĄCZNIE odczyt uprawnień z bazy — sama bramka
// (requireTileAccess) zostaje prawdziwa. Inaczej test dowodziłby poprawności
// mocka, a nie kodu, który stoi na ścieżce żądania.
const loadGrantedApplicationCodes = vi.hoisted(() => vi.fn<(email: string) => Promise<string[]>>())
const loadGrantedScopes = vi.hoisted(() => vi.fn<(email: string) => Promise<string[]>>())

vi.mock("@cortex/service/rbac-store", () => ({ loadGrantedApplicationCodes, loadGrantedScopes }))

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH"
const HTTP_METHODS: HttpMethod[] = ["GET", "POST", "PUT", "DELETE", "PATCH"]

type Handler = (request: unknown, context?: unknown) => Promise<Response>

const ENTITLEMENT = "okna-czasowe"
const GRANTED_EMAIL = "uprawniony@firma.pl"

// Wszystkie route'y modułu, ze scan/ włącznie: przy odmowie scan NIE MA prawa
// dotknąć sieci, więc iterowanie po nim jest bezpieczne i jest sednem sprawy.
const routeModules = import.meta.glob<Record<string, unknown>>("./**/route.ts")

const ROUTE_SOURCES = [
  "data/route.ts",
  "films/route.ts",
  "films/[id]/route.ts",
  "log/route.ts",
  "scan/route.ts",
]

let dataDir: string
let fetchSpy: ReturnType<typeof vi.fn>

const SEEDED_FILM: Film = {
  id: "film-1",
  title: "Zaseedowany Film",
  year: 2024,
  foreignTitles: [],
  firstSeenAvailable: null,
  createdAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-01T00:00:00.000Z",
}

async function seedFilms(films: Film[]): Promise<void> {
  const { store } = await import("@/lib/okna-czasowe/store")
  await store.saveFilms(films)
}

function readFilmsFromDisk(): Film[] {
  return JSON.parse(readFileSync(path.join(dataDir, "films.json"), "utf8")) as Film[]
}

/** Pełny stan katalogu danych. Sam kod 401/403 nie wystarcza: handler, który
 *  najpierw zapisuje, a dopiero potem odmawia, oddawałby poprawny status i
 *  przechodziłby test statusu. Odmowa musi wyprzedzić KAŻDY zapis. */
function snapshotDataDir(): Record<string, string> {
  const snapshot: Record<string, string> = {}
  for (const entry of readdirSync(dataDir).sort()) {
    snapshot[entry] = readFileSync(path.join(dataDir, entry), "utf8")
  }
  return snapshot
}

/** Ciało CELOWO poprawne — przejdzie walidację Zod. Gdyby bramka wypadła,
 *  żądanie ma szansę dojść do 201/200, a nie odbić się o 400 i przypadkiem
 *  „zaliczyć" test odmowy. */
function buildRequest(method: HttpMethod, email: string | null): unknown {
  const nextUrl = new URL("http://localhost/api/okna-czasowe")
  const headers = new Headers({ "content-type": "application/json" })
  if (email !== null) headers.set("x-auth-request-email", email)
  const init: RequestInit =
    method === "GET" || method === "DELETE"
      ? { method, headers }
      : {
          method,
          headers,
          body: JSON.stringify({ title: "Film z żądania", year: 2026, foreignTitles: [] }),
        }
  const request = new Request(nextUrl, init) as Request & { nextUrl: URL }
  request.nextUrl = nextUrl
  return request
}

const ROUTE_CONTEXT = { params: Promise.resolve({ id: SEEDED_FILM.id }) }

async function handlersOf(
  load: () => Promise<Record<string, unknown>>,
): Promise<{ method: HttpMethod; handler: Handler }[]> {
  const routeModule = await load()
  return HTTP_METHODS.filter((method) => typeof routeModule[method] === "function").map(
    (method) => ({ method, handler: routeModule[method] as Handler }),
  )
}

/** Brak tożsamości to 401, tożsamość bez grantu to 403 — rozróżnienie jest
 *  częścią kontraktu (zaloguj się vs poproś o uprawnienia), więc test sprawdza
 *  konkretny kod, nie „którykolwiek z dwóch". */
const BYPASS_ATTEMPTS = [
  { label: "brak nagłówka tożsamości", email: null, granted: [] as string[], status: 401 },
  { label: "obcy e-mail spoza bazy", email: "intruz@obca-firma.pl", granted: [], status: 403 },
  { label: "znany e-mail bez żadnej roli", email: "bez-roli@firma.pl", granted: [], status: 403 },
  {
    label: "rola z grantem do innego kafelka",
    email: "ktos@firma.pl",
    granted: ["intrastat", "idp"],
    status: 403,
  },
  {
    label: "grant do łudząco podobnego kodu",
    email: "ktos@firma.pl",
    granted: ["okna-czasowe-admin"],
    status: 403,
  },
]

beforeEach(async () => {
  vi.resetModules()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  loadGrantedApplicationCodes.mockReset()
  loadGrantedScopes.mockReset()
  loadGrantedScopes.mockResolvedValue([])
  dataDir = mkdtempSync(path.join(tmpdir(), "okna-czasowe-guard-"))
  // getRequestEmail() nie odczytuje NODE_ENV (rbac.ts) — fallback bramkowany
  // wyłącznie obecnością DEV_USER_EMAIL. Gasimy ją tu jawnie: bez tego „brak
  // nagłówka" nie znaczyłoby „brak tożsamości", tylko „lokalny dev user", i
  // cała gałąź 401 byłaby nietestowana (albo zależna od env maszyny).
  vi.stubEnv("DEV_USER_EMAIL", "")
  vi.stubEnv("OKNA_CZASOWE_DATA_DIR", dataDir)
  // Każde wyjście do sieci przechodzi przez tę atrapę: przy odmowie licznik
  // wywołań ma zostać na zerze (POST /scan woła publiczne API JustWatch).
  fetchSpy = vi.fn(() =>
    Promise.resolve(
      new Response(JSON.stringify({ data: { popularTitles: { edges: [] } } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ),
  )
  vi.stubGlobal("fetch", fetchSpy)
  await seedFilms([SEEDED_FILM])
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  rmSync(dataDir, { force: true, recursive: true })
})

describe("okna-czasowe — bramka na ścieżce żądania", () => {
  it("glob odkrywa wszystkie pliki route.ts modułu", () => {
    // Bez tego wyczyszczony glob dałby zielony plik bez ani jednej realnej asercji.
    expect(Object.keys(routeModules).sort()).toEqual(
      ROUTE_SOURCES.map((source) => `./${source}`).sort(),
    )
  })

  // Tripwire statyczny, niezależny od statusów: żaden route modułu nie może
  // istnieć bez wywołania bramki. Zapala się natychmiast, gdy ktoś ją usunie
  // albo doda nowy plik bez niej — zanim jeszcze dojdzie do asercji zachowania.
  it("każdy route.ts modułu woła bramkę", () => {
    const moduleDir = path.dirname(new URL(import.meta.url).pathname)

    for (const source of ROUTE_SOURCES) {
      const code = readFileSync(path.join(moduleDir, source), "utf8")
      expect(code, `${source} — brak wywołania denyUnlessAllowed()`).toMatch(/denyUnlessAllowed/)
    }
  })
})

for (const [modulePath, load] of Object.entries(routeModules)) {
  describe(modulePath, () => {
    it.each(BYPASS_ATTEMPTS)("odmawia $status: $label", async ({ email, granted, status }) => {
      loadGrantedApplicationCodes.mockResolvedValue(granted)
      const before = snapshotDataDir()
      const handlers = await handlersOf(load)

      expect(handlers.length).toBeGreaterThan(0)

      for (const { method, handler } of handlers) {
        const response = await handler(buildRequest(method, email), ROUTE_CONTEXT)

        expect(response.status, `${modulePath} ${method}`).toBe(status)
      }

      // Odmowa wyprzedza jakąkolwiek pracę: zero zapisów na dysk i zero ruchu
      // wychodzącego z serwera.
      expect(snapshotDataDir()).toEqual(before)
      expect(fetchSpy).not.toHaveBeenCalled()
    })

    it("odmawia 403 gdy odczyt uprawnień pada (fail-closed)", async () => {
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
      loadGrantedApplicationCodes.mockRejectedValue(new Error("connection refused"))
      const before = snapshotDataDir()
      const handlers = await handlersOf(load)

      for (const { method, handler } of handlers) {
        const response = await handler(buildRequest(method, GRANTED_EMAIL), ROUTE_CONTEXT)

        expect(response.status, `${modulePath} ${method}`).toBe(403)
      }

      expect(snapshotDataDir()).toEqual(before)
      expect(fetchSpy).not.toHaveBeenCalled()
      consoleError.mockRestore()
    })

    // Kontrola pozytywna: bez niej wszystkie powyższe asercje przechodziłyby
    // także wtedy, gdyby moduł był po prostu zepsuty i odmawiał wszystkim.
    it("przepuszcza użytkownika z grantem na kafelek", async () => {
      loadGrantedApplicationCodes.mockResolvedValue([ENTITLEMENT])
      const handlers = await handlersOf(load)

      for (const { method, handler } of handlers) {
        const response = await handler(buildRequest(method, GRANTED_EMAIL), ROUTE_CONTEXT)

        expect([401, 403], `${modulePath} ${method}`).not.toContain(response.status)
      }
    })
  })
}

describe("skutki uboczne, których odmowa nie może wywołać", () => {
  it("anonimowy POST /films nie dopisuje filmu do pliku na dysku", async () => {
    loadGrantedApplicationCodes.mockResolvedValue([])
    const { POST } = await import("./films/route")

    const response = await POST(buildRequest("POST", null) as Parameters<typeof POST>[0])

    expect(response.status).toBe(401)
    expect(readFilmsFromDisk()).toEqual([SEEDED_FILM])
  })

  it("anonimowy DELETE /films/[id] nie kasuje cudzego filmu", async () => {
    loadGrantedApplicationCodes.mockResolvedValue([])
    const { DELETE } = await import("./films/[id]/route")

    const response = await DELETE(
      buildRequest("DELETE", null) as Parameters<typeof DELETE>[0],
      ROUTE_CONTEXT,
    )

    expect(response.status).toBe(401)
    expect(readFilmsFromDisk()).toEqual([SEEDED_FILM])
  })

  // Najdroższa z odmów: /scan wypuszcza z serwera ruch WYCHODZĄCY do publicznego
  // API JustWatch, więc bez bramki anonimowe żądanie generowałoby obciążenie po
  // stronie zewnętrznego serwisu w imieniu tej instalacji. 403 zwrócone PO
  // wykonaniu skanu byłoby tu bezwartościowe.
  it("POST /scan bez grantu nie odpytuje zewnętrznego JustWatch", async () => {
    loadGrantedApplicationCodes.mockResolvedValue(["intrastat"])
    const { POST } = await import("./scan/route")

    const response = await POST(buildRequest("POST", "ktos@firma.pl") as Parameters<typeof POST>[0])

    expect(response.status).toBe(403)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("POST /scan z grantem faktycznie odpytuje JustWatch", async () => {
    loadGrantedApplicationCodes.mockResolvedValue([ENTITLEMENT])
    const { POST } = await import("./scan/route")

    const response = await POST(buildRequest("POST", GRANTED_EMAIL) as Parameters<typeof POST>[0])

    expect(response.status).toBe(200)
    expect(
      fetchSpy.mock.calls.some(([input]) => String(input).includes("apis.justwatch.com")),
    ).toBe(true)
  })
})

// Druga bramka tego samego kafelka, od strony POWŁOKI: kod `okna-czasowe`
// musi być zseedowany w rejestrze `applications` (Postgres), inaczej
// `/api/me/access` wycina kafelek WSZYSTKIM, nawet po przyznaniu roli. Do
// 30.07.2026 ta sama luka istniała przez brak wpisu na allowliście
// cortex-admina — po unifikacji bramek (AppGate czyta Postgres, nie HTTP do
// cortex-admin, `app/idp/app/api/_lib/access.ts` usunięty) ten scenariusz
// jest pokryty ogólną macierzą dostępu w `e2e/shell/access-gate.spec.ts`
// (scenariusz `registry-one-user-per-code`, seedowany prawdziwym skryptem
// deployowym) i w `packages/@cortex/service/src/rbac.integration.test.ts`
// (prawdziwy Postgres, ten sam mechanizm co `/api/me/access`) — nie
// duplikuję tego tutaj osobnym mockiem nieistniejącego już mechanizmu.
