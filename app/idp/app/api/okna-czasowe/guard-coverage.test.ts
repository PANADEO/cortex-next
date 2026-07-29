// ⚠️ TEN PLIK DOKUMENTUJE LUKĘ, NIE POTWIERDZA POPRAWNOŚCI.
//
// Moduł "Okna czasowe" nie ma ŻADNEJ bramki dostępu na ścieżce żądania. Żaden
// z pięciu plików route.ts pod /api/okna-czasowe nie woła `requireTileAccess()`
// (@cortex/service), `requireAdmin()` ani nawet `getRequestEmail()` — pełny
// odczyt, zapis, usunięcie i uruchomienie skanu są dostępne dla dowolnego
// żądania, bez tożsamości. `app/idp/middleware.ts` też nic tu nie sprawdza:
// przepisuje wyłącznie ścieżki innych kafelków, a dla /api/** robi
// NextResponse.next().
//
// RBAC tego kafelka jest dziś WYŁĄCZNIE wizualny: `AppGate` (komponent React)
// sprawdza `canAccessTile(apps, "okna-czasowe")` przed wyrenderowaniem strony.
// AppGate nigdy nie owija Route Handlerów — to dokładnie ta sama klasa błędu,
// którą project-gate.ts opisuje dla sesji Cortex Cowork ("AppGate is a
// client-side React component that never wraps Route Handlers, which is exactly
// the gap this closes"), tyle że tutaj nikt jej jeszcze nie zamknął.
//
// Testy niżej są CHARAKTERYZACJĄ stanu obecnego: asertują to, co kod robi dziś,
// żeby luka miała wykonywalny dowód, a nie tylko akapit w notatce. W chwili
// dodania bramki zrobią się czerwone — wtedy trzeba je przepisać na oczekiwane
// 401/403, a nie „naprawić" przez rozluźnienie asercji.
//
// Nie naprawiane tutaj świadomie: to zmiana logiki produkcyjnej, a zadaniem tej
// zmiany było dopisanie testów. Opis z dowodem (live curl, 201 Created na
// anonimowym POST): Obsidian PROJECT/cortex-frontend-testy-pozostalych-kafelkow.md.

import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import type { Film } from "@/features/okna-czasowe/types"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH"
const HTTP_METHODS: HttpMethod[] = ["GET", "POST", "PUT", "DELETE", "PATCH"]

type Handler = (request: unknown, context?: unknown) => Promise<Response>

// scan/route.ts celowo poza globem: jego handler woła publiczne API JustWatch
// po sieci. Jest omówiony osobnym testem niżej, ze stubem fetch.
const routeModules = import.meta.glob<Record<string, unknown>>("./{data,films,log}/**/route.ts")

let dataDir: string

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

/** Żądanie BEZ nagłówka `x-auth-request-email` — czyli takie, jakie dotarłoby
 *  do kontenera z pominięciem oauth2-proxy. */
function anonymousRequest(method: HttpMethod): unknown {
  const nextUrl = new URL("http://localhost/api/okna-czasowe")
  const init: RequestInit =
    method === "GET" || method === "DELETE"
      ? { method }
      : {
          method,
          headers: new Headers({ "content-type": "application/json" }),
          body: JSON.stringify({ title: "Anonimowy Zapis", year: 2026, foreignTitles: [] }),
        }
  const request = new Request(nextUrl, init) as Request & { nextUrl: URL }
  request.nextUrl = nextUrl
  return request
}

const ROUTE_CONTEXT = { params: Promise.resolve({ id: SEEDED_FILM.id }) }

beforeEach(async () => {
  vi.resetModules()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  dataDir = mkdtempSync(path.join(tmpdir(), "okna-czasowe-guard-"))
  // NODE_ENV=production wyłącza fallback DEV_USER_EMAIL wszędzie tam, gdzie
  // jakakolwiek bramka by go czytała — czyli „brak nagłówka" znaczy naprawdę
  // „brak tożsamości", a nie „lokalny dev user".
  vi.stubEnv("NODE_ENV", "production")
  vi.stubEnv("OKNA_CZASOWE_DATA_DIR", dataDir)
  await seedFilms([SEEDED_FILM])
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  rmSync(dataDir, { force: true, recursive: true })
})

describe("okna-czasowe — bramka na ścieżce żądania NIE ISTNIEJE (luka udokumentowana)", () => {
  it("glob odkrywa pliki route.ts modułu", () => {
    expect(Object.keys(routeModules).length).toBeGreaterThanOrEqual(3)
  })

  // Statyczny dowód, niezależny od tego, co zwrócą handlery: w kodzie modułu nie
  // ma ani jednego wywołania czegokolwiek, co czyta tożsamość żądania. Gdy
  // ktokolwiek doda bramkę, ten test zapali się jako pierwszy i wskaże, że resztę
  // pliku trzeba przepisać.
  it("żaden route.ts modułu nie odwołuje się do tożsamości żądania", () => {
    const moduleDir = path.dirname(new URL(import.meta.url).pathname)
    const sources = ["data/route.ts", "films/route.ts", "films/[id]/route.ts", "log/route.ts", "scan/route.ts"]

    for (const source of sources) {
      const code = readFileSync(path.join(moduleDir, source), "utf8")
      expect(code, `${source} — bramka pojawiła się, zaktualizuj ten plik testów`).not.toMatch(
        /requireTileAccess|requireAdmin|getRequestEmail|requestEmail|x-auth-request-email/,
      )
    }
  })

  for (const [modulePath, load] of Object.entries(routeModules)) {
    it(`LUKA (do naprawy): ${modulePath} obsługuje żądanie bez tożsamości zamiast odmówić`, async () => {
      const routeModule = await load()
      const handlers = HTTP_METHODS.filter((method) => typeof routeModule[method] === "function")

      expect(handlers.length).toBeGreaterThan(0)

      for (const method of handlers) {
        const handler = routeModule[method] as Handler
        const response = await handler(anonymousRequest(method), ROUTE_CONTEXT)

        // Stan docelowy po naprawie: 401 (brak tożsamości) lub 403 (brak grantu
        // na kafelek `okna-czasowe`). Stan dzisiejszy: pełna obsługa.
        expect(response.status, `${modulePath} ${method}`).toBeLessThan(400)
      }
    })
  }

  it("LUKA (do naprawy): anonimowy POST /films dopisuje film do pliku na dysku", async () => {
    const { POST } = await import("./films/route")

    const response = await POST(anonymousRequest("POST") as Parameters<typeof POST>[0])

    expect(response.status).toBe(201)
    expect(readFilmsFromDisk().map((film) => film.title)).toEqual([
      SEEDED_FILM.title,
      "Anonimowy Zapis",
    ])
  })

  it("LUKA (do naprawy): anonimowy DELETE /films/[id] kasuje cudzy film", async () => {
    const { DELETE } = await import("./films/[id]/route")

    const response = await DELETE(
      anonymousRequest("DELETE") as Parameters<typeof DELETE>[0],
      ROUTE_CONTEXT,
    )

    expect(response.status).toBe(200)
    expect(readFilmsFromDisk()).toEqual([])
  })

  // Druga, niezależna luka tego samego kafelka, od strony POWŁOKI: kod
  // "okna-czasowe" nie występuje na allowliście AUTHORIZED_APP_CODES
  // (app/idp/app/api/_lib/access.ts), a getAuthorizedAppsAtCortexAdmin()
  // filtruje odpowiedź cortex-admina przez tę allowlistę. Skutek: nawet gdy
  // cortex-admin przyzna użytkownikowi dostęp do tego kafelka, /api/me/access
  // go NIE zwróci, canAccessTile() zwróci false i AppGate odetnie stronę
  // każdemu. Sprawdzane zachowaniem prawdziwego route'u, nie grepem po źródle.
  it("LUKA (do naprawy): /api/me/access wycina kod okna-czasowe, więc kafelek jest nieosiągalny dla wszystkich", async () => {
    vi.stubEnv("CORTEX_ADMIN_API_BASE_URL", "http://cortex-admin")
    vi.stubEnv("CORTEX_ADMIN_API_KEY", "admin-key")
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ apps: ["okna-czasowe", "intrastat"] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        ),
      ),
    )
    const { GET } = await import("../me/access/route")

    const nextUrl = new URL("http://localhost/api/me/access")
    const request = new Request(nextUrl, {
      headers: new Headers({ "x-auth-request-email": "ktos@example.com" }),
    }) as Request & { nextUrl: URL }
    request.nextUrl = nextUrl

    const response = await GET(request as Parameters<typeof GET>[0])
    const body = (await response.json()) as { apps: string[] }

    expect(response.status).toBe(200)
    // Kontrola pozytywna: kod, który JEST na allowliście, przechodzi — czyli
    // brak `okna-czasowe` to skutek allowlisty, nie zepsutego route'u.
    expect(body.apps).toContain("intrastat")
    expect(body.apps).not.toContain("okna-czasowe")
  })

  // Najdroższy z całej piątki: nie tylko czyta i pisze, ale wypuszcza z serwera
  // ruch wychodzący do zewnętrznego API — czyli anonimowe żądanie potrafi
  // wygenerować obciążenie po stronie JustWatch w imieniu tej instalacji.
  it("LUKA (do naprawy): anonimowy POST /scan uruchamia odpytanie zewnętrznego JustWatch", async () => {
    const calls: string[] = []
    vi.stubGlobal(
      "fetch",
      vi.fn((input: Parameters<typeof fetch>[0]) => {
        calls.push(String(input))
        return Promise.resolve(
          new Response(JSON.stringify({ data: { popularTitles: { edges: [] } } }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        )
      }),
    )
    const { POST } = await import("./scan/route")

    const response = await POST()

    expect(response.status).toBe(200)
    expect(calls.some((url) => url.includes("apis.justwatch.com"))).toBe(true)
  })
})
