// Zachowanie kontrolera POST /api/system-config/applications/activate: co
// dokładnie widzi klient, gdy instancja nie ma licencji na moduł (D9,
// PROJECT/cortex-frontend-licencjonowanie-projekt.md). Bramkę dostępu na tym
// handlerze pokrywa ../../guard-coverage.test.ts.
//
// Kluczowe rozróżnienie, którego pilnuje ten plik: "brak licencji" (403) NIE
// MOŻE wyglądać jak "nie ma takiego modułu" (404) ani jak "złe żądanie" (400).

import { beforeEach, describe, expect, it, vi } from "vitest"

const loadGrantedApplicationCodes = vi.hoisted(() => vi.fn<(email: string) => Promise<string[]>>())
const activateApplication = vi.hoisted(() => vi.fn())

vi.mock("@cortex/service/rbac-store", () => ({ loadGrantedApplicationCodes }))

vi.mock("@cortex/service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@cortex/service")>()
  return { ...actual, activateApplication }
})

const { ModuleNotLicensedError, clearTileAccessCache } = await import("@cortex/service")
// Prawdziwa implementacja serwisu, obok mocka — pozwala puścić żądanie przez
// CAŁY łańcuch (route -> bramka licencyjna w serwisie -> toErrorResponse) bez
// bazy: odmowa licencyjna jest czystym predykatem na env i zapada, zanim
// activateApplication() sięgnie po getDb().
const realService = await vi.importActual<typeof import("@cortex/service")>("@cortex/service")
const { POST } = await import("./route")

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/system-config/applications/activate", {
    method: "POST",
    headers: new Headers({
      "Content-Type": "application/json",
      "x-auth-request-email": "admin@firma.pl",
    }),
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  clearTileAccessCache()
  loadGrantedApplicationCodes.mockReset()
  loadGrantedApplicationCodes.mockResolvedValue(["system-config"])
  activateApplication.mockReset()
  vi.unstubAllEnvs()
  vi.stubEnv("NODE_ENV", "production")
})

describe("odmowa licencyjna", () => {
  it("odrzucenie przez serwis wraca jako 403 z czytelnym komunikatem", async () => {
    activateApplication.mockRejectedValue(new ModuleNotLicensedError("document-parser"))

    const response = await POST(makeRequest({ code: "document-parser" }) as never)
    const body = (await response.json()) as { error: string; message: string }

    expect(response.status).toBe(403)
    expect(body.error).toBe("module-not-licensed")
    expect(body.message).toContain("document-parser")
    expect(body.message).toContain("ENABLED_MODULES")
  })

  // SEDNO: dokładnie to żądanie, którym dawało się obejść allowlistę —
  // znany kod modułu (manifesty, .env.example, docs/local-run.md) wysłany
  // curlem przez admina instancji. Bez mocka serwisu: bramka, którą sprawdza
  // ten test, to ta prawdziwa.
  it("SEDNO: prawdziwa bramka serwisowa, prawdziwy route — POST spoza allowlisty daje 403", async () => {
    activateApplication.mockImplementation(realService.activateApplication)
    vi.stubEnv("ENABLED_MODULES", "content-guru")

    const response = await POST(makeRequest({ code: "document-parser" }) as never)

    expect(response.status).toBe(403)
    expect((await response.json()).error).toBe("module-not-licensed")
  })

  // Backward compatibility (centralna obietnica MVP): bez ENABLED_MODULES to
  // samo żądanie NIE jest odmawiane — leci dalej, do warstwy danych. Kod celowo
  // nieistniejący, żeby ten test nigdy nie aktywował niczego na bazie, gdy
  // suita jest puszczana z DATABASE_URL.
  it("ENABLED_MODULES nieustawione -> ta sama ścieżka nie kończy się odmową licencyjną", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    activateApplication.mockImplementation(realService.activateApplication)

    const response = await POST(makeRequest({ code: "kod-ktorego-nie-ma-w-rejestrze" }) as never)

    expect(response.status).not.toBe(403)
    consoleError.mockRestore()
  })
})

describe("ścieżki podstawowe — odmowa licencyjna nie miesza się z resztą", () => {
  it("nieznany kod nadal daje 404, nie 403", async () => {
    activateApplication.mockResolvedValue(null)

    const response = await POST(makeRequest({ code: "kod-ktorego-nie-ma" }) as never)

    expect(response.status).toBe(404)
    expect((await response.json()).error).toBe("unknown-application")
  })

  it("niepoprawne ciało daje 400 przed dotknięciem serwisu", async () => {
    const response = await POST(makeRequest({ code: "ZŁY KOD" }) as never)

    expect(response.status).toBe(400)
    expect(activateApplication).not.toHaveBeenCalled()
  })

  it("kod z allowlisty przechodzi normalnie", async () => {
    vi.stubEnv("ENABLED_MODULES", "content-guru,document-parser")
    activateApplication.mockResolvedValue({ code: "document-parser", isActive: true })

    const response = await POST(makeRequest({ code: "document-parser" }) as never)

    expect(response.status).toBe(200)
    expect(activateApplication).toHaveBeenCalledWith("document-parser")
  })
})
