// Bramka POWŁOKI na ścieżce żądania. Napisany od zera razem z przepięciem
// źródła uprawnień z zewnętrznego cortex-admin na własny Postgres — poprzednia
// wersja w całości stubowała `fetch` do cortex-admin, więc po zmianie
// sprawdzałaby kod, którego już nie ma.
//
// PODZIAŁ ODPOWIEDZIALNOŚCI, świadomy:
//   - TUTAJ (podmieniony rbac-store): rozstrzyganie tożsamości, liczenie
//     `allowed`, kształt odpowiedzi, fail-closed przy awarii bazy, brak
//     jakiegokolwiek filtrowania kodów po stronie route'a.
//   - route.integration.test.ts (prawdziwy Postgres, ten sam handler): warunki
//     egzekwowane w SQL — użytkownik nieistniejący/nieaktywny, aplikacja
//     nieaktywna, rola bez grantu, dwie role z tym samym grantem (dedup),
//     dopasowanie e-maila bez względu na wielkość liter.
// Z mockiem tamte przypadki byłyby asercją na własnym mocku, nie na zachowaniu
// systemu — dlatego każdy z nich jest dowodzony tam, gdzie faktycznie działa.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const loadGrantedApplicationCodes = vi.hoisted(() => vi.fn<(email: string) => Promise<string[]>>())

vi.mock("@cortex/service/rbac-store", () => ({
  loadGrantedApplicationCodes,
  loadGrantedScopes: vi.fn(async () => []),
}))

const { clearTileAccessCache } = await import("@cortex/service")
const { GET } = await import("./route")

interface AccessBody {
  allowed: boolean
  apps: string[]
  email: string
}

function makeRequest(email: string | null): Parameters<typeof GET>[0] {
  const headers = new Headers()
  if (email !== null) headers.set("x-auth-request-email", email)
  return { headers } as Parameters<typeof GET>[0]
}

async function call(email: string | null): Promise<{ status: number; body: AccessBody }> {
  const response = await GET(makeRequest(email))
  return { status: response.status, body: (await response.json()) as AccessBody }
}

beforeEach(() => {
  clearTileAccessCache()
  loadGrantedApplicationCodes.mockReset()
  loadGrantedApplicationCodes.mockResolvedValue([])
  vi.unstubAllEnvs()
  vi.stubEnv("NODE_ENV", "production")
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("GET /api/me/access — tożsamość", () => {
  it("odmawia 401 bez nagłówka i bez DEV_USER_EMAIL", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("DEV_USER_EMAIL", "")

    const response = await GET(makeRequest(null))

    expect(response.status).toBe(401)
    expect(loadGrantedApplicationCodes).not.toHaveBeenCalled()
  })

  it("IGNORUJE DEV_USER_EMAIL na produkcji", async () => {
    vi.stubEnv("DEV_USER_EMAIL", "leaked@dev.local")

    const response = await GET(makeRequest(null))

    expect(response.status).toBe(401)
    expect(loadGrantedApplicationCodes).not.toHaveBeenCalled()
  })

  it("poza produkcją używa DEV_USER_EMAIL, gdy nagłówka nie ma", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("DEV_USER_EMAIL", "dev@cortex.local")
    loadGrantedApplicationCodes.mockResolvedValue(["idp"])

    const { status, body } = await call(null)

    expect(status).toBe(200)
    expect(body.email).toBe("dev@cortex.local")
    expect(body.apps).toEqual(["idp"])
  })

  it("nagłówek wygrywa z DEV_USER_EMAIL poza produkcją", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("DEV_USER_EMAIL", "dev@cortex.local")

    const { status, body } = await call("real@user.com")

    expect(status).toBe(200)
    expect(body.email).toBe("real@user.com")
    expect(loadGrantedApplicationCodes).toHaveBeenCalledWith("real@user.com")
  })

  it("odmawia 401 przy nagłówku pustym albo z samych białych znaków", async () => {
    for (const value of ["", "   "]) {
      const response = await GET(makeRequest(value))
      expect(response.status, `nagłówek [${value}]`).toBe(401)
    }
    expect(loadGrantedApplicationCodes).not.toHaveBeenCalled()
  })

  it("normalizuje e-mail do lowercase, zanim spyta bazę", async () => {
    // Kolumna users.email trzyma wyłącznie lowercase. Poprzednia implementacja
    // tego nie robiła, więc "Jan@Firma.pl" nie trafiał w swój wiersz — powłoka
    // była case-sensitive, a API modułów nie.
    const { body } = await call("Jan.Kowalski@Firma.PL")

    expect(loadGrantedApplicationCodes).toHaveBeenCalledWith("jan.kowalski@firma.pl")
    expect(body.email).toBe("jan.kowalski@firma.pl")
  })
})

describe("GET /api/me/access — decyzja i kontrakt", () => {
  it("zwraca 200 i allowed:false, gdy baza nie daje żadnego grantu", async () => {
    // Jeden wynik dla kilku różnych przyczyn (brak użytkownika, brak roli, rola
    // bez grantu) — rozróżnia je route.integration.test.ts na prawdziwym SQL.
    const { status, body } = await call("nikt@firma.pl")

    expect(status).toBe(200)
    expect(body).toEqual({ allowed: false, apps: [], email: "nikt@firma.pl" })
  })

  it("zwraca 200 i allowed:true z pełną listą kodów", async () => {
    loadGrantedApplicationCodes.mockResolvedValue(["idp", "intrastat", "ai-tools"])

    const { status, body } = await call("u@firma.pl")

    expect(status).toBe(200)
    expect(body.allowed).toBe(true)
    expect(body.apps).toEqual(["idp", "intrastat", "ai-tools"])
  })

  it("NIE filtruje kodów przez żadną allowlistę w kodzie", async () => {
    // Sedno migracji: allowlista AUTHORIZED_APP_CODES zniknęła razem
    // z cortex-adminem. Rejestr w bazie JEST allowlistą — kod, którego nie ma
    // w `applications`, nie może się w odpowiedzi pojawić, bo SQL go nie zwróci.
    // Cztery kody poniżej były realnie gubione przez starą listę.
    const odzyskane = ["sp-console", "sp-client", "okna-czasowe", "meeting-guru"]
    loadGrantedApplicationCodes.mockResolvedValue([...odzyskane, "kod-spoza-tiles.ts"])

    const { body } = await call("u@firma.pl")

    expect(body.apps).toEqual([...odzyskane, "kod-spoza-tiles.ts"])
  })

  it("odpowiedź ma dokładnie trzy klucze: allowed, apps, email", async () => {
    loadGrantedApplicationCodes.mockResolvedValue(["idp"])

    const { body } = await call("u@firma.pl")

    expect(Object.keys(body).sort()).toEqual(["allowed", "apps", "email"])
  })
})

describe("GET /api/me/access — fail-closed", () => {
  it("przy błędzie bazy zwraca 200 z pustą listą, nie 500 i nie wyjątek", async () => {
    // Kontrakt jest tu ważniejszy niż kod błędu: AppGate rozróżnia "nie masz
    // dostępu" od "bramka padła" po treści odpowiedzi. 500 przeniosłoby
    // użytkownika na inny ekran (reason="error") niż zwykła odmowa.
    loadGrantedApplicationCodes.mockRejectedValue(new Error("connection refused"))
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})

    const { status, body } = await call("u@firma.pl")

    expect(status).toBe(200)
    expect(body).toEqual({ allowed: false, apps: [], email: "u@firma.pl" })
    // Awaria bazy MUSI zostawić ślad — inaczej jest nieodróżnialna od
    // "użytkownik nie ma uprawnień", czym była w wersji z cortex-adminem.
    expect(consoleError).toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it("przy timeoutcie bazy zachowuje się tak samo", async () => {
    loadGrantedApplicationCodes.mockRejectedValue(
      Object.assign(new Error("query timeout"), { code: "ETIMEDOUT" }),
    )
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})

    const { status, body } = await call("u@firma.pl")

    expect(status).toBe(200)
    expect(body.allowed).toBe(false)
    consoleError.mockRestore()
  })
})

describe("GET /api/me/access — wspólny cache z requireTileAccess", () => {
  it("dwa żądania tego samego usera to JEDNO zapytanie do bazy", async () => {
    loadGrantedApplicationCodes.mockResolvedValue(["idp"])

    await call("u@firma.pl")
    await call("u@firma.pl")

    expect(loadGrantedApplicationCodes).toHaveBeenCalledTimes(1)
  })

  it("clearTileAccessCache() unieważnia także tę ścieżkę", async () => {
    // Dowód, że powłoka NIE ma własnego, nieinwalidowanego cache'a: mutacja
    // uprawnień z UI woła clearTileAccessCache() i musi natychmiast zmienić to,
    // co widzi hub — a nie dopiero po wygaśnięciu cudzego TTL.
    loadGrantedApplicationCodes.mockResolvedValue(["idp"])
    expect((await call("u@firma.pl")).body.apps).toEqual(["idp"])

    loadGrantedApplicationCodes.mockResolvedValue([])
    clearTileAccessCache()

    expect((await call("u@firma.pl")).body).toEqual({
      allowed: false,
      apps: [],
      email: "u@firma.pl",
    })
  })
})
