// Pokrycie bramek dla CAŁEJ powierzchni /api/cortex-cowork, na ścieżce ŻĄDANIA.
//
// Po co osobny plik obok sześciu istniejących route.test.ts: tamte dowodzą
// bramki dla KONKRETNYCH handlerów sesji, każdy z osobna. Ten iteruje po
// plikach route.ts znalezionych na dysku, więc NOWY endpoint dołożony bez
// bramki zapala się tutaj samoczynnie — bez edycji testu. Klasa błędu, którą
// to łapie: RBAC widoczny wyłącznie w UI (AppGate/CoworkShell) i nigdy
// sprawdzany po stronie żądania.
//
// ⚠️ OTWARTE ENDPOINTY: dwa route'y przechodzą dziś anonimowo i są wpisane do
// OPEN_ENDPOINTS niżej. To NIE jest akceptacja tego stanu — to jawna,
// przeglądalna lista, którą trzeba świadomie rozszerzyć, żeby dołożyć kolejną
// dziurę. Opis obu z dowodem: Obsidian PROJECT/cortex-frontend-testy-pozostalych-kafelkow.md,
// sekcja "Znalezione przy okazji".

import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import type { CoworkGovernanceConfig, CoworkProjectConfig } from "@cortex/types"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const ADMIN_EMAIL = "admin@example.com"
const ANALYST_EMAIL = "analityk@example.com"
const MANAGER_EMAIL = "manager@example.com"
const OUTSIDER_EMAIL = "obcy@example.com"

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH"
const HTTP_METHODS: HttpMethod[] = ["GET", "POST", "PUT", "DELETE", "PATCH"]

type Handler = (request: unknown, context?: unknown) => Promise<Response>

const routeModules = import.meta.glob<Record<string, unknown>>("./**/route.ts")

/**
 * Endpointy, które DZIŚ odpowiadają 200 na żądanie bez żadnej tożsamości.
 * Wartość to opis luki, nie jej uzasadnienie — wpis tutaj ma być niewygodny.
 */
const OPEN_ENDPOINTS: Record<string, string> = {
  "./projects/route.ts":
    "visibleProjectsFor() traktuje brak e-maila jako 'pokaż wszystko', więc anonimowe żądanie dostaje nazwy, opisy i briefy wszystkich włączonych projektów",
  "./skills/route.ts":
    "buildSkillCatalog() zwracany bez jakiegokolwiek sprawdzenia tożsamości — pełny katalog skilli instancji dla dowolnego żądania",
}

let dataDir: string

function project(id: string, name: string, allowedRoleIds: string[], enabled = true): CoworkProjectConfig {
  return {
    id,
    name,
    description: `Opis ${name}`,
    enabled,
    archetype: "task-chat",
    allowedRoleIds,
    model: { provider: "anthropic", modelId: "claude-sonnet-4-5" },
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
    version: 2,
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
      : { method, headers, body: JSON.stringify({ projectId: "proj-analiza", content: "test", instructions: "test" }) }
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
  dataDir = mkdtempSync(path.join(tmpdir(), "cortex-cowork-guard-"))
  // NODE_ENV=production wyłącza fallback DEV_USER_EMAIL w requestEmail() —
  // bez tego "brak nagłówka" nie znaczyłoby "brak tożsamości".
  vi.stubEnv("NODE_ENV", "production")
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

  it("lista otwartych endpointów zawiera tylko istniejące pliki route.ts", () => {
    // Nieaktualny wpis na allowliście = cicha zgoda na coś, czego już nie ma
    // (albo literówka, przez którą prawdziwa dziura przechodzi bez alarmu).
    for (const openPath of Object.keys(OPEN_ENDPOINTS)) {
      expect(Object.keys(routeModules)).toContain(openPath)
    }
  })

  for (const [modulePath, load] of Object.entries(routeModules)) {
    const knownOpen = OPEN_ENDPOINTS[modulePath]

    describe(modulePath, () => {
      it(
        knownOpen
          ? `LUKA (udokumentowana, do naprawy): przechodzi bez tożsamości — ${knownOpen}`
          : "żaden handler nie zwraca 200 żądaniu bez tożsamości",
        async () => {
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

            if (knownOpen) {
              // Charakteryzacja stanu obecnego. Gdy bramka zostanie dodana, ten
              // test zrobi się czerwony — wtedy usuń wpis z OPEN_ENDPOINTS,
              // a poniższa gałąź zacznie obowiązywać.
              expect(response.status, `${modulePath} ${method}`).toBe(200)
            } else {
              expect(response.status, `${modulePath} ${method}`).not.toBe(200)
              expect([401, 403, 404]).toContain(response.status)
            }
          }
        },
      )
    })
  }
})

// Kluczowy mechanizm modułu wg CLAUDE.md: hub dociąga kafelki task-chat per user
// z GET /api/cortex-cowork/projects, z filtrem ról PO STRONIE SERWERA. Filtr jest
// jedyną rzeczą, która stoi między użytkownikiem a cudzym projektem agentowym —
// UI go nie powtarza, tylko renderuje to, co dostanie.
describe("GET /api/cortex-cowork/projects — filtr ról po stronie serwera", () => {
  async function listProjectsAs(email: string | null): Promise<{ status: number; names: string[] }> {
    const { GET } = await import("./projects/route")
    const response = await GET(buildRequest("GET", email) as Parameters<typeof GET>[0])
    const body = (await response.json()) as Array<{ name: string }>
    return { status: response.status, names: body.map((tile) => tile.name) }
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

  // LUKA (udokumentowana, do naprawy). project-gate.ts komentuje tę samą gałąź
  // `!email` w visibleProjectsFor() jako "lower-stakes use... nothing is
  // actually exposed by omission" i zabezpiecza się przed nią WŁASNYM
  // sprawdzeniem — ale tylko dla sesji. Na tym endpoincie gałąź działa dalej i
  // wypuszcza nazwy oraz opisy wszystkich włączonych projektów.
  it("LUKA (udokumentowana, do naprawy): żądanie bez tożsamości dostaje wszystkie włączone projekty", async () => {
    await writeConfig(closedConfig())

    const { status, names } = await listProjectsAs(null)

    expect(status).toBe(200)
    expect(names.sort()).toEqual(["Projekt Analiza", "Projekt Raporty"])
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
      headers: new Headers({ "content-type": "application/json", "x-auth-request-email": ANALYST_EMAIL }),
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
