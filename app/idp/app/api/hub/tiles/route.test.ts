// Kontrakt GET /api/hub/tiles (Krok 2, D7,
// PROJECT/cortex-frontend-hub-db-driven-projekt.md): 401 wyłącznie przy braku
// identyfikowalnego e-maila, w przeciwnym razie 200 z katalogiem — BEZ
// jakiejkolwiek bramki uprawnień (świadomie brak denyUnlessAllowed/
// requireTileAccess). Sedno tej suity: dowód, że listHubApplications() jest
// jedynym źródłem odpowiedzi i że warstwa uprawnień (loadGrantedApplicationCodes)
// nigdy nie jest odpytywana z tej ścieżki.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const loadGrantedApplicationCodes = vi.hoisted(() => vi.fn<(email: string) => Promise<string[]>>())
const listHubApplications = vi.hoisted(() => vi.fn())

vi.mock("@cortex/service/rbac-store", () => ({
  loadGrantedApplicationCodes,
  loadGrantedScopes: vi.fn(async () => []),
}))

vi.mock("@cortex/service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@cortex/service")>()
  return { ...actual, listHubApplications }
})

const { clearTileAccessCache } = await import("@cortex/service")
const { GET } = await import("./route")

const FIXTURE_TILE = {
  id: "9f1d3c62-1f4a-4a6b-9f3c-2b7d5e8a1c40",
  code: "raportowanie-tokenow",
  name: "Raportowanie Tokenów",
  description: null,
  icon: "BarChart3",
  category: "Narzędzia",
  kind: "native",
  route: "/token-usage",
  url: null,
  target: null,
  isActive: true,
  sortOrder: 10,
  showOnHub: true,
  color: "sky",
  categoryFunctional: null,
  categoryDepartment: null,
  activatedAt: null,
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
}

function makeRequest(email: string | null): Parameters<typeof GET>[0] {
  const headers = new Headers()
  if (email !== null) headers.set("x-auth-request-email", email)
  return { headers } as Parameters<typeof GET>[0]
}

beforeEach(() => {
  clearTileAccessCache()
  loadGrantedApplicationCodes.mockReset()
  loadGrantedApplicationCodes.mockResolvedValue([])
  listHubApplications.mockReset()
  listHubApplications.mockResolvedValue([FIXTURE_TILE])
  vi.unstubAllEnvs()
  vi.stubEnv("NODE_ENV", "production")
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("GET /api/hub/tiles — tożsamość", () => {
  it("odmawia 401 bez nagłówka i bez DEV_USER_EMAIL", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("DEV_USER_EMAIL", "")

    const response = await GET(makeRequest(null))

    expect(response.status).toBe(401)
    expect(listHubApplications).not.toHaveBeenCalled()
  })

  it("IGNORUJE DEV_USER_EMAIL na produkcji", async () => {
    vi.stubEnv("DEV_USER_EMAIL", "leaked@dev.local")

    const response = await GET(makeRequest(null))

    expect(response.status).toBe(401)
    expect(listHubApplications).not.toHaveBeenCalled()
  })

  it("poza produkcją używa DEV_USER_EMAIL, gdy nagłówka nie ma", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("DEV_USER_EMAIL", "dev@cortex.local")

    const response = await GET(makeRequest(null))

    expect(response.status).toBe(200)
    expect(listHubApplications).toHaveBeenCalledTimes(1)
  })

  it("odmawia 401 przy nagłówku pustym albo z samych białych znaków", async () => {
    for (const value of ["", "   "]) {
      const response = await GET(makeRequest(value))
      expect(response.status, `nagłówek [${value}]`).toBe(401)
    }
    expect(listHubApplications).not.toHaveBeenCalled()
  })
})

describe("GET /api/hub/tiles — kontrakt i brak bramki uprawnień", () => {
  it("zwraca 200 z katalogiem z listHubApplications(), bez opakowania", async () => {
    const response = await GET(makeRequest("u@firma.pl"))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual([FIXTURE_TILE])
  })

  it("SEDNO: zwraca 200 z pełnym katalogiem nawet userowi BEZ żadnego grantu", async () => {
    // Deliberately no denyUnlessAllowed/requireTileAccess — dostępne każdemu
    // zalogowanemu, tak jak sam hub dziś (D7).
    loadGrantedApplicationCodes.mockResolvedValue([])

    const response = await GET(makeRequest("nikt-nic-nie-ma@firma.pl"))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual([FIXTURE_TILE])
  })

  it("SEDNO: nigdy nie odpytuje warstwy uprawnień (loadGrantedApplicationCodes) — zero bramki entitlementu", async () => {
    await GET(makeRequest("ktokolwiek@firma.pl"))

    expect(loadGrantedApplicationCodes).not.toHaveBeenCalled()
  })

  it("odpowiedź to DOKŁADNIE to, co zwróciło listHubApplications() — kontroler niczego nie filtruje ani nie dokłada", async () => {
    listHubApplications.mockResolvedValue([])

    const response = await GET(makeRequest("u@firma.pl"))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual([])
  })
})

describe("GET /api/hub/tiles — błąd bazy", () => {
  it("zwraca 500 i loguje, gdy listHubApplications() rzuca", async () => {
    listHubApplications.mockRejectedValue(new Error("connection refused"))
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})

    const response = await GET(makeRequest("u@firma.pl"))

    expect(response.status).toBe(500)
    expect(consoleError).toHaveBeenCalled()
    consoleError.mockRestore()
  })
})
