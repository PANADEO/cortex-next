// Testy PRÓBUJĄCE OMINĄĆ bramkę uprawnień — twardy wymóg code-service/SKILL.md
// pkt 3 (lekcja z audytu cortex2, gdzie RBAC był sprawdzany tylko w UI).
//
// Warstwa bazodanowa (użytkownik nieaktywny, aplikacja nieaktywna) jest
// egzekwowana w SQL, więc jej dowód siedzi w rbac.integration.test.ts na
// prawdziwym Postgresie — tutaj testowana jest sama bramka.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const loadGrantedApplicationCodes = vi.hoisted(() => vi.fn<(email: string) => Promise<string[]>>())

vi.mock("./rbac-store", () => ({ loadGrantedApplicationCodes }))

const { clearTileAccessCache, requireTileAccess } = await import("./rbac")

const ENTITLEMENT = "system-config"

function makeRequest(email: string | null): Request {
  const headers = new Headers()
  if (email !== null) headers.set("x-auth-request-email", email)
  return new Request("http://localhost/api/system-config/users", { headers })
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

describe("requireTileAccess — próby ominięcia", () => {
  it("odmawia bez nagłówka tożsamości", async () => {
    const result = await requireTileAccess(makeRequest(null), ENTITLEMENT)
    expect(result).toEqual({ allowed: false, email: null })
    expect(loadGrantedApplicationCodes).not.toHaveBeenCalled()
  })

  it("odmawia gdy nagłówek jest pusty albo sam z białych znaków", async () => {
    for (const value of ["", "   "]) {
      const result = await requireTileAccess(makeRequest(value), ENTITLEMENT)
      expect(result.allowed, `nagłówek [${value}]`).toBe(false)
      expect(result.email).toBeNull()
    }
  })

  it("IGNORUJE DEV_USER_EMAIL na produkcji", async () => {
    vi.stubEnv("DEV_USER_EMAIL", "admin@cortex.local")
    loadGrantedApplicationCodes.mockResolvedValue([ENTITLEMENT])

    const result = await requireTileAccess(makeRequest(null), ENTITLEMENT)

    expect(result).toEqual({ allowed: false, email: null })
    expect(loadGrantedApplicationCodes).not.toHaveBeenCalled()
  })

  it("odmawia użytkownikowi bez żadnej roli", async () => {
    loadGrantedApplicationCodes.mockResolvedValue([])
    const result = await requireTileAccess(makeRequest("nikt@firma.pl"), ENTITLEMENT)
    expect(result).toEqual({ allowed: false, email: "nikt@firma.pl" })
  })

  it("odmawia gdy rola ma granty, ale NIE do tego kafelka", async () => {
    loadGrantedApplicationCodes.mockResolvedValue(["intrastat", "idp"])
    const result = await requireTileAccess(makeRequest("ktos@firma.pl"), ENTITLEMENT)
    expect(result.allowed).toBe(false)
  })

  it("odmawia gdy baza jest niedostępna (fail-closed, nie wyjątek)", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    loadGrantedApplicationCodes.mockRejectedValue(new Error("connection refused"))

    const result = await requireTileAccess(makeRequest("admin@firma.pl"), ENTITLEMENT)

    expect(result).toEqual({ allowed: false, email: "admin@firma.pl" })
    expect(consoleError).toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it("nie daje się oszukać podobnym kodem uprawnienia", async () => {
    loadGrantedApplicationCodes.mockResolvedValue(["system-config-readonly"])
    const result = await requireTileAccess(makeRequest("ktos@firma.pl"), ENTITLEMENT)
    expect(result.allowed).toBe(false)
  })
})

describe("requireTileAccess — dostęp przyznany", () => {
  it("przepuszcza przy poprawnym grancie", async () => {
    loadGrantedApplicationCodes.mockResolvedValue([ENTITLEMENT])
    const result = await requireTileAccess(makeRequest("admin@firma.pl"), ENTITLEMENT)
    expect(result).toEqual({ allowed: true, email: "admin@firma.pl" })
  })

  it("dopasowuje e-mail bez względu na wielkość liter", async () => {
    loadGrantedApplicationCodes.mockResolvedValue([ENTITLEMENT])
    const result = await requireTileAccess(makeRequest("Admin@Firma.PL"), ENTITLEMENT)

    expect(result.allowed).toBe(true)
    expect(result.email).toBe("admin@firma.pl")
    expect(loadGrantedApplicationCodes).toHaveBeenCalledWith("admin@firma.pl")
  })

  it("honoruje DEV_USER_EMAIL poza produkcją", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("DEV_USER_EMAIL", "dev@cortex.local")
    loadGrantedApplicationCodes.mockResolvedValue([ENTITLEMENT])

    const result = await requireTileAccess(makeRequest(null), ENTITLEMENT)

    expect(result).toEqual({ allowed: true, email: "dev@cortex.local" })
  })

  it("nagłówek ma pierwszeństwo przed DEV_USER_EMAIL", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("DEV_USER_EMAIL", "dev@cortex.local")
    loadGrantedApplicationCodes.mockResolvedValue([ENTITLEMENT])

    await requireTileAccess(makeRequest("prawdziwy@firma.pl"), ENTITLEMENT)

    expect(loadGrantedApplicationCodes).toHaveBeenCalledWith("prawdziwy@firma.pl")
  })
})

describe("requireTileAccess — cache", () => {
  it("nie odpytuje bazy ponownie w oknie TTL", async () => {
    loadGrantedApplicationCodes.mockResolvedValue([ENTITLEMENT])

    await requireTileAccess(makeRequest("admin@firma.pl"), ENTITLEMENT)
    await requireTileAccess(makeRequest("admin@firma.pl"), ENTITLEMENT)

    expect(loadGrantedApplicationCodes).toHaveBeenCalledTimes(1)
  })

  it("odebranie grantu działa dopiero po wygaśnięciu/wyczyszczeniu cache", async () => {
    loadGrantedApplicationCodes.mockResolvedValue([ENTITLEMENT])
    const granted = await requireTileAccess(makeRequest("admin@firma.pl"), ENTITLEMENT)
    expect(granted.allowed).toBe(true)

    // Grant odebrany w bazie, ale cache jeszcze go trzyma — udokumentowane
    // okno stale do 30 s.
    loadGrantedApplicationCodes.mockResolvedValue([])
    const stillCached = await requireTileAccess(makeRequest("admin@firma.pl"), ENTITLEMENT)
    expect(stillCached.allowed).toBe(true)

    clearTileAccessCache()
    const afterClear = await requireTileAccess(makeRequest("admin@firma.pl"), ENTITLEMENT)
    expect(afterClear.allowed).toBe(false)
  })

  it("cache'uje per e-mail, nie globalnie", async () => {
    loadGrantedApplicationCodes.mockImplementation(async (email) =>
      email === "admin@firma.pl" ? [ENTITLEMENT] : [],
    )

    const admin = await requireTileAccess(makeRequest("admin@firma.pl"), ENTITLEMENT)
    const intruder = await requireTileAccess(makeRequest("intruz@firma.pl"), ENTITLEMENT)

    expect(admin.allowed).toBe(true)
    expect(intruder.allowed).toBe(false)
  })
})

describe("cache — pojedynczy odczyt w locie (single-flight)", () => {
  it("dwa równoległe żądania tego samego usera robią JEDNO zapytanie", async () => {
    let release: (codes: string[]) => void = () => {}
    loadGrantedApplicationCodes.mockImplementation(
      () => new Promise<string[]>((resolve) => (release = resolve)),
    )

    const first = requireTileAccess(makeRequest("admin@firma.pl"), ENTITLEMENT)
    const second = requireTileAccess(makeRequest("admin@firma.pl"), ENTITLEMENT)

    release([ENTITLEMENT])
    const [a, b] = await Promise.all([first, second])

    expect(loadGrantedApplicationCodes).toHaveBeenCalledTimes(1)
    expect(a.allowed).toBe(true)
    expect(b.allowed).toBe(true)
  })

  it("różni użytkownicy nie dzielą odczytu w locie", async () => {
    loadGrantedApplicationCodes.mockImplementation(async (email) =>
      email === "admin@firma.pl" ? [ENTITLEMENT] : [],
    )

    const [admin, intruder] = await Promise.all([
      requireTileAccess(makeRequest("admin@firma.pl"), ENTITLEMENT),
      requireTileAccess(makeRequest("intruz@firma.pl"), ENTITLEMENT),
    ])

    expect(admin.allowed).toBe(true)
    expect(intruder.allowed).toBe(false)
    expect(loadGrantedApplicationCodes).toHaveBeenCalledTimes(2)
  })

  it("po nieudanym odczycie kolejne żądanie próbuje ponownie", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    loadGrantedApplicationCodes.mockRejectedValueOnce(new Error("connection refused"))
    loadGrantedApplicationCodes.mockResolvedValueOnce([ENTITLEMENT])

    const failed = await requireTileAccess(makeRequest("admin@firma.pl"), ENTITLEMENT)
    const retried = await requireTileAccess(makeRequest("admin@firma.pl"), ENTITLEMENT)

    expect(failed.allowed).toBe(false)
    expect(retried.allowed).toBe(true)
    consoleError.mockRestore()
  })
})

describe("cache — unieważnienie wygrywa z odczytem w locie", () => {
  it("wynik odczytu rozpoczętego PRZED czyszczeniem nie wraca do cache", async () => {
    let release: (codes: string[]) => void = () => {}
    loadGrantedApplicationCodes.mockImplementationOnce(
      () => new Promise<string[]>((resolve) => (release = resolve)),
    )

    // Żądanie startuje przy zimnym cache, jeszcze z ważnym grantem...
    const inFlight = requireTileAccess(makeRequest("admin@firma.pl"), ENTITLEMENT)

    // ...w międzyczasie administrator odbiera uprawnienia (mutacja woła clear).
    clearTileAccessCache()

    release([ENTITLEMENT])
    expect((await inFlight).allowed).toBe(true)

    // Nieaktualny wynik NIE MOŻE osiąść w cache na kolejne 30 s.
    loadGrantedApplicationCodes.mockResolvedValue([])
    const afterRevoke = await requireTileAccess(makeRequest("admin@firma.pl"), ENTITLEMENT)

    expect(afterRevoke.allowed).toBe(false)
  })
})
