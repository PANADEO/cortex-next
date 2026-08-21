// Pokrycie bramek dla CAŁEJ powierzchni /api/cortex-cowork, na ścieżce ŻĄDANIA.
//
// Po co osobny plik obok sześciu istniejących route.test.ts: tamte dowodzą
// bramki dla KONKRETNYCH handlerów sesji, każdy z osobna. Ten iteruje po
// plikach route.ts znalezionych na dysku, więc NOWY endpoint dołożony bez
// bramki zapala się tutaj samoczynnie — bez edycji testu. Klasa błędu, którą
// to łapie: RBAC widoczny wyłącznie w UI (AppGate/CoworkShell) i nigdy
// sprawdzany po stronie żądania.
//
// Do 30.07.2026 plik miał listę OPEN_ENDPOINTS z dwoma route'ami, które
// przechodziły anonimowo: `projects` (visibleProjectsFor() traktował brak
// e-maila jak "pokaż wszystko") i `skills` (zero sprawdzenia tożsamości). Obie
// luki są domknięte, więc lista zniknęła — dziś reguła jest bezwarunkowa:
// ŻADEN handler modułu nie odpowiada 200 na żądanie bez tożsamości. Dopisanie
// kolejnego wyjątku wymaga rozmontowania tej pętli, nie dopisania wpisu.
//
// Do 30.07.2026 był jeszcze jeden świadomy wyjątek: tryb OPEN (bootstrap, zero
// przypisań ról) przechodził KAŻDE żądanie, anonimowe włącznie. To był stan
// startowy każdego świeżego wdrożenia, a nie chwilowy etap konfiguracji, więc
// wyjątek zniknął — tryb otwarty nadal pomija filtr RÓL, ale nie pomija już
// grantu `cortex-cowork` z system_config (lib/cortex-governance/bootstrap-trust.ts).

import { setGrants } from "@/lib/cortex-governance/testing/grants"
import type * as CortexService from "@cortex/service"
import type { CoworkGovernanceConfig, CoworkProjectConfig } from "@cortex/types"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const ADMIN_EMAIL = "admin@example.com"
const ANALYST_EMAIL = "analityk@example.com"
const MANAGER_EMAIL = "manager@example.com"
const OUTSIDER_EMAIL = "obcy@example.com"

// Mock system_config, żeby ta suita została bez Postgresa. Wszyscy nazwani
// wyżej mają grant na kafelek — przedmiotem tych testów jest warstwa
// GOVERNANCE (role, adminEmails), nie warstwa platformy.
vi.mock("@cortex/service", async (importOriginal) => {
  const actual = await importOriginal<typeof CortexService>()
  const { fakeRequireTileAccess } = await import("@/lib/cortex-governance/testing/grants")
  return { ...actual, requireTileAccess: fakeRequireTileAccess }
})

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH"
const HTTP_METHODS: HttpMethod[] = ["GET", "POST", "PUT", "DELETE", "PATCH"]

type Handler = (request: unknown, context?: unknown) => Promise<Response>

const routeModules = import.meta.glob<Record<string, unknown>>("./**/route.ts")

let dataDir: string

function project(
  id: string,
  name: string,
  allowedRoleIds: string[],
  enabled = true,
): CoworkProjectConfig {
  return {
    id,
    name,
    description: `Opis ${name}`,
    enabled,
    archetype: "task-chat",
    allowedRoleIds,
    model: { provider: "openai-compatible", modelId: "claude-sonnet-4-5" },
    composition: {
      skills: { branches: [], leaves: [] },
      connectors: { branches: [], leaves: [] },
      secrets: { branches: [], leaves: [] },
    },
    sandbox: { mode: "local", allowedPaths: [] },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  }
}

const PROJECTS = [
  project("proj-analiza", "Projekt Analiza", ["analyst"]),
  project("proj-raporty", "Projekt Raporty", ["manager"]),
  project("proj-wylaczony", "Projekt Wylaczony", ["analyst", "manager"], false),
]

/** Governance WŁĄCZONE: istnieje co najmniej jedno przypisanie roli, więc
 *  isOpenMode() jest false i filtr ról faktycznie działa. */
function closedConfig(): CoworkGovernanceConfig {
  return {
    version: 3,
    departments: ["wspolne"],
    skillSources: [],
    connectors: [],
    roles: [
      { id: "analyst", name: "Analityk" },
      { id: "manager", name: "Manager" },
    ],
    userAssignments: { [ANALYST_EMAIL]: ["analyst"], [MANAGER_EMAIL]: ["manager"] },
    adminEmails: [ADMIN_EMAIL],
    projects: PROJECTS,
  }
}

/** Tryb bootstrap: zero przypisań ról, więc governance jeszcze nie wystartowało. */
function openModeConfig(): CoworkGovernanceConfig {
  return { ...closedConfig(), adminEmails: [], userAssignments: {} }
}

async function writeConfig(config: CoworkGovernanceConfig): Promise<void> {
  const { saveGovernanceConfig } = await import("@/lib/cortex-governance/store")
  await saveGovernanceConfig(config)
}

function buildRequest(method: HttpMethod, email: string | null, search = ""): unknown {
  const nextUrl = new URL(`http://localhost/api/cortex-cowork${search}`)
  const headers = new Headers({ "content-type": "application/json" })
  if (email) headers.set("x-auth-request-email", email)
  const init: RequestInit =
    method === "GET" || method === "DELETE"
      ? { method, headers }
      : {
          method,
          headers,
          body: JSON.stringify({
            projectId: "proj-analiza",
            content: "test",
            instructions: "test",
          }),
        }
  const request = new Request(nextUrl, init) as Request & { nextUrl: URL }
  request.nextUrl = nextUrl
  return request
}

/** Jeden kontekst dla wszystkich handlerów — te, które nie mają parametrów
 *  ścieżki, po prostu go ignorują. Nieistniejące id daje 404 z bramki, co też
 *  jest odmową (dane nie wypływają). */
const ROUTE_CONTEXT = {
  params: Promise.resolve({
    sessionId: "nieistniejaca-sesja",
    artifactId: "nieistniejacy-artefakt",
  }),
}

beforeEach(() => {
  vi.resetModules()
  vi.unstubAllEnvs()
  setGrants({
    [ADMIN_EMAIL]: ["cortex-cowork"],
    [ANALYST_EMAIL]: ["cortex-cowork"],
    [MANAGER_EMAIL]: ["cortex-cowork"],
    [OUTSIDER_EMAIL]: ["cortex-cowork"],
  })
  dataDir = mkdtempSync(path.join(tmpdir(), "cortex-cowork-guard-"))
  // requestEmail() nie odczytuje NODE_ENV (rbac.ts getRequestEmail) — fallback
  // bramkowany wyłącznie obecnością DEV_USER_EMAIL. Gasimy ją tu jawnie: bez
  // tego "brak nagłówka" nie znaczyłoby "brak tożsamości".
  vi.stubEnv("DEV_USER_EMAIL", "")
  vi.stubEnv("COWORK_DATA_DIR", dataDir)
})

afterEach(() => {
  vi.unstubAllEnvs()
  rmSync(dataDir, { force: true, recursive: true })
})

describe("cortex-cowork — bramki na ścieżce żądania", () => {
  // Sanity check samego testu: bez tego wyczyszczony glob dałby zielony plik
  // bez ani jednej realnej asercji.
  it("glob odkrywa wszystkie pliki route.ts modułu", () => {
    expect(Object.keys(routeModules).length).toBeGreaterThanOrEqual(9)
  })

  for (const [modulePath, load] of Object.entries(routeModules)) {
    describe(modulePath, () => {
      it("żaden handler nie zwraca 200 żądaniu bez tożsamości", async () => {
        await writeConfig(closedConfig())
        const routeModule = await load()
        const handlers = HTTP_METHODS.filter((method) => typeof routeModule[method] === "function")

        expect(handlers.length).toBeGreaterThan(0)

        for (const method of handlers) {
          const handler = routeModule[method] as Handler
          const response = await handler(
            buildRequest(method, null, "?projectId=proj-analiza"),
            ROUTE_CONTEXT,
          )

          expect(response.status, `${modulePath} ${method}`).not.toBe(200)
          expect([401, 403, 404], `${modulePath} ${method}`).toContain(response.status)
        }
      })
    })
  }
})

// Kluczowy mechanizm modułu wg CLAUDE.md: hub dociąga kafelki task-chat per user
// z GET /api/cortex-cowork/projects, z filtrem ról PO STRONIE SERWERA. Filtr jest
// jedyną rzeczą, która stoi między użytkownikiem a cudzym projektem agentowym —
// UI go nie powtarza, tylko renderuje to, co dostanie.
describe("GET /api/cortex-cowork/projects — filtr ról po stronie serwera", () => {
  async function listProjectsAs(
    email: string | null,
  ): Promise<{ status: number; names: string[] }> {
    const { GET } = await import("./projects/route")
    const response = await GET(buildRequest("GET", email) as Parameters<typeof GET>[0])
    const body: unknown = await response.json()
    // Odmowa oddaje obiekt z komunikatem, nie tablicę — brak nazw jest tu
    // wynikiem, a nie błędem parsowania, więc nie rzucamy.
    const names = Array.isArray(body) ? (body as Array<{ name: string }>).map((t) => t.name) : []
    return { status: response.status, names }
  }

  it("analityk widzi wyłącznie projekt swojej roli", async () => {
    await writeConfig(closedConfig())

    const { status, names } = await listProjectsAs(ANALYST_EMAIL)

    expect(status).toBe(200)
    expect(names).toEqual(["Projekt Analiza"])
  })

  it("manager widzi wyłącznie projekt swojej roli", async () => {
    await writeConfig(closedConfig())

    const { names } = await listProjectsAs(MANAGER_EMAIL)

    expect(names).toEqual(["Projekt Raporty"])
  })

  it("użytkownik bez żadnej roli nie widzi żadnego projektu", async () => {
    await writeConfig(closedConfig())

    const { status, names } = await listProjectsAs(OUTSIDER_EMAIL)

    // 200 z pustą listą, nie 403 — to lista kafelków do wyrenderowania, nie
    // operacja na zasobie. Istotne jest, że NIC nie wyciekło.
    expect(status).toBe(200)
    expect(names).toEqual([])
  })

  it("jawny admin widzi wszystkie WŁĄCZONE projekty, ale nie wyłączony", async () => {
    await writeConfig(closedConfig())

    const { names } = await listProjectsAs(ADMIN_EMAIL)

    expect(names.sort()).toEqual(["Projekt Analiza", "Projekt Raporty"])
  })

  it("tryb otwarty: przed pierwszym przypisaniem roli każdy widzi wszystkie włączone projekty", async () => {
    await writeConfig(openModeConfig())

    const { names } = await listProjectsAs(OUTSIDER_EMAIL)

    expect(names.sort()).toEqual(["Projekt Analiza", "Projekt Raporty"])
  })

  it("wyłączony projekt nie trafia do nikogo, nawet do posiadacza roli", async () => {
    await writeConfig(closedConfig())

    const analyst = await listProjectsAs(ANALYST_EMAIL)
    const admin = await listProjectsAs(ADMIN_EMAIL)

    expect(analyst.names).not.toContain("Projekt Wylaczony")
    expect(admin.names).not.toContain("Projekt Wylaczony")
  })

  // Regresja domknięta 30.07.2026. Gałąź `!email` w visibleProjectsFor()
  // wypuszczała anonimowemu żądaniu nazwy, opisy i briefy wszystkich włączonych
  // projektów. project-gate.ts zauważył tę gałąź wcześniej, ale zabezpieczył
  // przed nią wyłącznie sesje, uzasadniając to tym, że na liście kafelków "no
  // identity just means an empty-feeling list" — co było nieprawdą właśnie
  // tutaj. Dziś obie powierzchnie modułu odpowiadają tak samo (denyAnonymous).
  it("żądanie bez tożsamości dostaje 401, a nie listę projektów", async () => {
    await writeConfig(closedConfig())

    const { status, names } = await listProjectsAs(null)

    expect(status).toBe(401)
    expect(names).toEqual([])
  })

  // 401 dotyczy BRAKU TOŻSAMOŚCI, nie braku uprawnień — te dwa przypadki mają
  // różne odpowiedzi i test trzyma je obok siebie, żeby nikt ich nie zlał w
  // jedno "odmów wszystkim bez roli".
  it("odróżnia brak tożsamości (401) od tożsamości bez roli (200 z pustą listą)", async () => {
    await writeConfig(closedConfig())

    const anonymous = await listProjectsAs(null)
    const identified = await listProjectsAs(OUTSIDER_EMAIL)

    expect(anonymous.status).toBe(401)
    expect(identified.status).toBe(200)
    expect(identified.names).toEqual([])
  })

  // Wyjątek zniknął 30.07.2026 i zniknął w OBU miejscach naraz, tak jak
  // zapowiadał komentarz, który tu wcześniej stał. Tryb otwarty jest stanem
  // startowym KAŻDEGO świeżego wdrożenia (governance.json w .gitignore, pusty
  // wolumen w docker-compose.image.yml), więc "przechodzi każde żądanie"
  // znaczyło w praktyce "panel i kafelki stoją otworem", a nie "chwilowo, na
  // czas konfiguracji".
  it("tryb otwarty: anonimowe żądanie dostaje 401, nie listę projektów", async () => {
    await writeConfig(openModeConfig())

    const { status, names } = await listProjectsAs(null)

    expect(status).toBe(401)
    expect(names).toEqual([])
  })

  // Druga połowa tej samej reguły: tożsamość jest, ale grantu na kafelek nie
  // ma. Hub takiemu użytkownikowi tej sekcji i tak nie renderuje
  // (hub/use-hub-model.ts pyta o ten sam kod), więc API przestaje oddawać
  // nazwy, opisy i briefy projektów, których UI by nie pokazało.
  it("tryb otwarty: bez grantu cortex-cowork lista jest pusta (200)", async () => {
    setGrants({})
    await writeConfig(openModeConfig())

    const { status, names } = await listProjectsAs(OUTSIDER_EMAIL)

    expect(status).toBe(200)
    expect(names).toEqual([])
  })
})

// Katalog skilli to metadane (id, nazwy, opisy, przypisanie do departamentów),
// ale wciąż wgląd w wewnętrzną strukturę organizacji. Do 30.07.2026 handler nie
// miał żadnej bramki i oddawał całość dowolnemu żądaniu.
describe("GET /api/cortex-cowork/skills — wymóg tożsamości", () => {
  async function readSkills(email: string | null): Promise<{ status: number; body: unknown }> {
    const { GET } = await import("./skills/route")
    const response = await GET(buildRequest("GET", email) as Parameters<typeof GET>[0])
    return { status: response.status, body: await response.json() }
  }

  it("odmawia 401 żądaniu bez tożsamości i nie oddaje katalogu", async () => {
    await writeConfig(closedConfig())

    const { status, body } = await readSkills(null)

    expect(status).toBe(401)
    expect(Array.isArray(body)).toBe(false)
  })

  // Kontrola pozytywna: sam fakt zalogowania wystarcza — to nie jest bramka
  // projektowa, więc użytkownik bez żadnej roli też ma dostać katalog.
  it("przepuszcza zalogowanego użytkownika, także bez roli", async () => {
    await writeConfig(closedConfig())

    const { status, body } = await readSkills(OUTSIDER_EMAIL)

    expect(status).toBe(200)
    expect(Array.isArray(body)).toBe(true)
  })
})

describe("GET/PUT /api/cortex-cowork/my-instructions — warstwa użytkownika", () => {
  it("odmawia 401 bez tożsamości i nie zapisuje instrukcji", async () => {
    await writeConfig(closedConfig())
    const { GET, PUT } = await import("./my-instructions/route")

    expect((await GET(buildRequest("GET", null) as Parameters<typeof GET>[0])).status).toBe(401)
    expect((await PUT(buildRequest("PUT", null) as Parameters<typeof PUT>[0])).status).toBe(401)
  })

  it("instrukcje jednego użytkownika nie wyciekają do drugiego", async () => {
    await writeConfig(closedConfig())
    const { GET, PUT } = await import("./my-instructions/route")

    const nextUrl = new URL("http://localhost/api/cortex-cowork/my-instructions")
    const write = new Request(nextUrl, {
      method: "PUT",
      headers: new Headers({
        "content-type": "application/json",
        "x-auth-request-email": ANALYST_EMAIL,
      }),
      body: JSON.stringify({ instructions: "sekret analityka" }),
    }) as Request & { nextUrl: URL }
    write.nextUrl = nextUrl
    await PUT(write as Parameters<typeof PUT>[0])

    const response = await GET(buildRequest("GET", MANAGER_EMAIL) as Parameters<typeof GET>[0])
    const body = (await response.json()) as { instructions: string }

    expect(response.status).toBe(200)
    expect(body.instructions).toBe("")
  })
})
