// Pokrycie bramki admina dla CAŁEJ powierzchni /api/cortex-config, na ścieżce
// ŻĄDANIA. Odpowiednik app/idp/app/api/ai-tools/guard-coverage.test.ts dla
// panelu governance Cortex Cowork.
//
// Klasa błędu, którą to łapie: RBAC sprawdzany wyłącznie w UI. Panel
// cortex-config pokazuje AccessDeniedState, gdy zapytanie zwróci błąd
// (features/cortex-config/components/config-screen.tsx) — to jest kosmetyka.
// Jedyną prawdziwą bramką jest requireAdmin() w każdym handlerze i to ona jest
// tu sprawdzana.
//
// DLACZEGO import.meta.glob, a nie ręczna lista route'ów: lista, którą trzeba
// dopisać, jest listą, którą ktoś zapomni dopisać. Glob odkrywa pliki na dysku,
// więc NOWY route pod /api/cortex-config, który nie woła requireAdmin(),
// zapala się tutaj od razu po dodaniu pliku — bez edycji tego testu.
//
// Najmocniejsza asercja to nie sam kod 403, tylko `dirSnapshot` — odmowa MUSI
// nastąpić ZANIM handler cokolwiek zapisze. 403 zwrócone po zapisaniu zmiany
// jest nadal luką.

import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { setGrants } from "@/lib/cortex-governance/testing/grants"
import type { CoworkGovernanceConfig } from "@cortex/types"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type * as CortexService from "@cortex/service"

const ADMIN_EMAIL = "admin@example.com"
const OUTSIDER_EMAIL = "obcy@example.com"
/** Ktoś, komu deploy nadał kafelek `cortex-config` — czyli ADMIN_EMAIL z seeda. */
const DEPLOY_ADMIN_EMAIL = "deploy-admin@example.com"

// Mock system_config: od 30.07.2026 tryb bootstrap pyta o grant na kafelek,
// zamiast wpuszczać każdego. Suita zostaje bez Postgresa.
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

/** Konfiguracja ZAMKNIĘTA: `adminEmails` niepuste, więc bootstrap-admin mode
 *  (każdy jest adminem, dopóki nie ma ani jednego admina) już nie obowiązuje. */
function closedConfig(): CoworkGovernanceConfig {
  return {
    version: 3,
    departments: ["wspolne"],
    skillSources: [],
    connectors: [],
    roles: [{ id: "analyst", name: "Analityk" }],
    userAssignments: { "analityk@example.com": ["analyst"] },
    adminEmails: [ADMIN_EMAIL],
    projects: [
      {
        id: "proj-a",
        name: "Projekt A",
        description: "",
        enabled: true,
        archetype: "task-chat",
        allowedRoleIds: ["analyst"],
        model: { provider: "anthropic", modelId: "claude-sonnet-4-5" },
        composition: {
          skills: { branches: [], leaves: [] },
          connectors: { branches: [], leaves: [] },
          secrets: { branches: [], leaves: [] },
        },
        sandbox: { mode: "local", allowedPaths: [] },
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
  }
}

async function writeConfig(config: CoworkGovernanceConfig): Promise<void> {
  const { saveGovernanceConfig } = await import("@/lib/cortex-governance/store")
  await saveGovernanceConfig(config)
}

/** Zawartość całego katalogu danych — governance.json ORAZ credentials.json.
 *  Porównanie przed/po jest dowodem, że odmowa wyprzedziła każdy zapis. */
function dirSnapshot(): string {
  const files = readdirSync(dataDir).filter((name) => name.endsWith(".json")).sort()
  return files.map((name) => `${name}:${readFileSync(path.join(dataDir, name), "utf8")}`).join("\n")
}

/** Ciało na tyle sensowne, żeby przejść walidację KAŻDEGO z handlerów mutujących
 *  — gdyby bramka zniknęła, żądanie faktycznie by coś zmieniło, a nie odbiło się
 *  o 400. Bez tego test „403 i dysk bez zmian" przechodziłby także dla handlera
 *  bez bramki, ale z niepasującym ciałem. */
const MUTATION_BODY = {
  roles: [{ id: "wstrzykniete", name: "Wstrzyknieta rola" }],
  adminEmails: [OUTSIDER_EMAIL],
  departments: ["wstrzykniete"],
  skillSources: [],
  connectors: [],
  path: "wstrzykniete/haslo",
  value: "sekret",
  id: "proj-wstrzykniety",
  name: "Projekt wstrzykniety",
  description: "",
  enabled: true,
  archetype: "task-chat",
  allowedRoleIds: ["analyst"],
  model: { provider: "anthropic", modelId: "claude-sonnet-4-5" },
  composition: {
    skills: { branches: [], leaves: [] },
    connectors: { branches: [], leaves: [] },
    secrets: { branches: [], leaves: [] },
  },
  sandbox: { mode: "local", allowedPaths: [] },
}

function buildRequest(method: HttpMethod, email: string | null): unknown {
  const nextUrl = new URL("http://localhost/api/cortex-config?path=wstrzykniete%2Fhaslo")
  const headers = new Headers({ "content-type": "application/json" })
  if (email) headers.set("x-auth-request-email", email)
  const init: RequestInit =
    method === "GET" || method === "DELETE"
      ? { method, headers }
      : { method, headers, body: JSON.stringify(MUTATION_BODY) }
  const request = new Request(nextUrl, init) as Request & { nextUrl: URL }
  request.nextUrl = nextUrl
  return request
}

/** Wszystkie handlery wołane są z tym samym kontekstem — te, które go nie
 *  używają, po prostu go ignorują. */
const ROUTE_CONTEXT = { params: Promise.resolve({ projectId: "proj-a" }) }

beforeEach(() => {
  vi.resetModules()
  vi.unstubAllEnvs()
  setGrants({ [DEPLOY_ADMIN_EMAIL]: ["cortex-config"] })
  dataDir = mkdtempSync(path.join(tmpdir(), "cortex-config-guard-"))
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

describe("cortex-config — bramka admina na ścieżce żądania", () => {
  // Sanity check samego testu: gdyby glob przestał cokolwiek znajdować, pętle
  // niżej nie miałyby czego sprawdzać, a plik nadal byłby zielony.
  it("glob odkrywa wszystkie pliki route.ts modułu", () => {
    expect(Object.keys(routeModules).length).toBeGreaterThanOrEqual(9)
  })

  for (const [modulePath, load] of Object.entries(routeModules)) {
    describe(modulePath, () => {
      it("każdy eksportowany handler odmawia użytkownikowi bez uprawnień admina i nic nie zapisuje", async () => {
        await writeConfig(closedConfig())
        const routeModule = await load()
        const handlers = HTTP_METHODS.filter((method) => typeof routeModule[method] === "function")

        // Plik route.ts bez ani jednego handlera HTTP byłby cichym pominięciem.
        expect(handlers.length).toBeGreaterThan(0)

        for (const method of handlers) {
          const before = dirSnapshot()
          const handler = routeModule[method] as Handler
          const response = await handler(buildRequest(method, OUTSIDER_EMAIL), ROUTE_CONTEXT)

          expect(response.status, `${modulePath} ${method}`).toBe(403)
          expect(dirSnapshot(), `${modulePath} ${method} zapisał na dysk mimo odmowy`).toBe(before)

          // Odmowa nie może po drodze wypuścić treści konfiguracji.
          const body = await response.text()
          expect(body, `${modulePath} ${method} wypuścił dane w ciele odmowy`).not.toContain("proj-a")
        }
      })

      // 401, nie 403: od 30.07.2026 bramka rozstrzyga "to żądanie nie ma
      // ŻADNEJ tożsamości" osobno i PRZED sprawdzeniem uprawnień — dokładnie
      // ten sam kod i ta sama kolejność co w project-gate.ts. Wcześniej brak
      // nagłówka szedł prosto do isAdmin(), które w trybie bootstrap mówiło
      // "tak" (patrz admin-gate.test.ts).
      it("każdy eksportowany handler odmawia żądaniu bez tożsamości i nic nie zapisuje", async () => {
        await writeConfig(closedConfig())
        const routeModule = await load()
        const handlers = HTTP_METHODS.filter((method) => typeof routeModule[method] === "function")

        for (const method of handlers) {
          const before = dirSnapshot()
          const handler = routeModule[method] as Handler
          const response = await handler(buildRequest(method, null), ROUTE_CONTEXT)

          expect(response.status, `${modulePath} ${method}`).toBe(401)
          expect(dirSnapshot(), `${modulePath} ${method} zapisał na dysk mimo odmowy`).toBe(before)
        }
      })

      // Ta sama pętla, ale na konfiguracji BOOTSTRAP (pusta lista adminów) —
      // czyli w stanie, w którym startuje każde świeże wdrożenie. To jest
      // powierzchnia, która do 30.07.2026 odpowiadała 200 na wszystko.
      it("każdy eksportowany handler odmawia w trybie bootstrap użytkownikowi bez grantu", async () => {
        await writeConfig({ ...closedConfig(), adminEmails: [] })
        const routeModule = await load()
        const handlers = HTTP_METHODS.filter((method) => typeof routeModule[method] === "function")

        for (const method of handlers) {
          const before = dirSnapshot()
          const handler = routeModule[method] as Handler
          const response = await handler(buildRequest(method, OUTSIDER_EMAIL), ROUTE_CONTEXT)

          expect(response.status, `${modulePath} ${method}`).toBe(403)
          expect(dirSnapshot(), `${modulePath} ${method} zapisał na dysk mimo odmowy`).toBe(before)
        }
      })
    })
  }
})

// Kontrola pozytywna. Bez niej cały plik wyżej przechodziłby także wtedy, gdyby
// moduł był po prostu zepsuty i odmawiał WSZYSTKIM — a to nie jest bramka, tylko
// awaria. Te trzy testy dowodzą, że 403 wyżej wynika z tożsamości, nie z tego,
// że handlery w ogóle nie działają.
describe("cortex-config — jawny admin przechodzi (kontrola pozytywna)", () => {
  it("GET /api/cortex-config zwraca pełną konfigurację adminowi", async () => {
    await writeConfig(closedConfig())
    const { GET } = await import("./route")

    const response = await GET(buildRequest("GET", ADMIN_EMAIL) as Parameters<typeof GET>[0])
    const body = (await response.json()) as CoworkGovernanceConfig

    expect(response.status).toBe(200)
    expect(body.projects.map((project) => project.id)).toEqual(["proj-a"])
  })

  it("PUT /api/cortex-config/governance zapisuje zmianę adminowi", async () => {
    await writeConfig(closedConfig())
    const { PUT } = await import("./governance/route")

    const before = dirSnapshot()
    const response = await PUT(buildRequest("PUT", ADMIN_EMAIL) as Parameters<typeof PUT>[0])

    expect(response.status).toBe(200)
    expect(dirSnapshot()).not.toBe(before)
  })

  // Bootstrap, wersja po poprawce: dopóki adminEmails jest puste, przechodzi
  // ten, komu DEPLOY nadał kafelek `cortex-config` — czyli konto z ADMIN_EMAIL,
  // które seed-system-config.mjs uzgadnia przy każdym wdrożeniu. To jest
  // LEGALNA ścieżka inicjalizacji świeżego środowiska i ten test jej pilnuje:
  // gdyby zniknęła, nowej instancji nie dałoby się w ogóle skonfigurować.
  // Wcześniej ten test brzmiał "przechodzi każdy uwierzytelniony" i utrwalał
  // lukę z audytu 6.1.
  it("w trybie bootstrap przechodzi administrator zadeklarowany przez deploy", async () => {
    await writeConfig({ ...closedConfig(), adminEmails: [] })
    const { GET } = await import("./route")

    const response = await GET(
      buildRequest("GET", DEPLOY_ADMIN_EMAIL) as Parameters<typeof GET>[0],
    )

    expect(response.status).toBe(200)
  })
})
