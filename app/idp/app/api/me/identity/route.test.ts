// Kontrakt GET /api/me/identity: 401 wyłącznie przy braku identyfikowalnego
// e-maila (fail-closed na tożsamości), w przeciwnym razie 200 { email, name }.
//
// Sedno tej suity: dowód, że odpowiedź powstaje WYŁĄCZNIE z nagłówka
// oauth2-proxy + własnego Postgresa — nigdy z HTTP do backendu IDP, którego na
// cortex-next nie ma. Dlatego `getUserDisplayName` jest podmieniony, a
// `getRequestEmail` zostaje PRAWDZIWY: normalizacja e-maila to część
// testowanego zachowania, nie mock.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const getUserDisplayName = vi.hoisted(() => vi.fn<(email: string) => Promise<string | null>>())

vi.mock("@cortex/service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@cortex/service")>()
  return { ...actual, getUserDisplayName }
})

const { GET } = await import("./route")

function makeRequest(email: string | null): Parameters<typeof GET>[0] {
  const headers = new Headers()
  if (email !== null) headers.set("x-auth-request-email", email)
  return { headers } as Parameters<typeof GET>[0]
}

beforeEach(() => {
  getUserDisplayName.mockReset()
  getUserDisplayName.mockResolvedValue(null)
  vi.unstubAllEnvs()
  // getRequestEmail() ma fallback bramkowany wyłącznie obecnością
  // DEV_USER_EMAIL (rbac.ts) — gaszony tu jawnie, żeby "brak nagłówka" niżej
  // znaczyło "brak tożsamości" niezależnie od env maszyny uruchamiającej testy.
  vi.stubEnv("DEV_USER_EMAIL", "")
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("GET /api/me/identity — brak tożsamości (fail-closed)", () => {
  it("odmawia 401 bez nagłówka i bez DEV_USER_EMAIL, nie dotykając bazy", async () => {
    const response = await GET(makeRequest(null))

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: "missing-email" })
    expect(getUserDisplayName).not.toHaveBeenCalled()
  })

  it("odmawia 401 przy nagłówku pustym albo z samych białych znaków", async () => {
    for (const value of ["", "   "]) {
      const response = await GET(makeRequest(value))
      expect(response.status, `nagłówek [${value}]`).toBe(401)
    }
    expect(getUserDisplayName).not.toHaveBeenCalled()
  })
})

describe("GET /api/me/identity — poprawna tożsamość", () => {
  it("zwraca 200 z e-mailem z nagłówka i nazwą z bazy", async () => {
    getUserDisplayName.mockResolvedValue("Jan Kowalski")

    const response = await GET(makeRequest("jan@firma.pl"))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ email: "jan@firma.pl", name: "Jan Kowalski" })
    expect(getUserDisplayName).toHaveBeenCalledWith("jan@firma.pl")
  })

  it("normalizuje e-mail z nagłówka — do bazy i do odpowiedzi idzie lowercase", async () => {
    // users.email trzyma wyłącznie lowercase, więc bez normalizacji
    // "Jan@Firma.PL" nie trafiłby w swój wiersz i user widziałby cudzą (pustą)
    // tożsamość mimo poprawnego logowania.
    getUserDisplayName.mockResolvedValue("Jan Kowalski")

    const response = await GET(makeRequest("  Jan@Firma.PL  "))

    expect(await response.json()).toEqual({ email: "jan@firma.pl", name: "Jan Kowalski" })
    expect(getUserDisplayName).toHaveBeenCalledWith("jan@firma.pl")
  })

  it("honoruje DEV_USER_EMAIL nawet z NODE_ENV=production (układ docker-compose.yml)", async () => {
    // Regresja opisana przy getRequestEmail() w rbac.ts — NODE_ENV jest
    // w standalone buildzie zamrożony, więc fallback nie może od niego zależeć.
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("DEV_USER_EMAIL", "dev@cortex.local")

    const response = await GET(makeRequest(null))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ email: "dev@cortex.local", name: null })
  })

  it("nagłówek ma pierwszeństwo przed DEV_USER_EMAIL", async () => {
    vi.stubEnv("DEV_USER_EMAIL", "dev@cortex.local")

    const response = await GET(makeRequest("prawdziwy@firma.pl"))

    expect((await response.json()).email).toBe("prawdziwy@firma.pl")
  })
})

describe("GET /api/me/identity — użytkownik nieobecny w bazie", () => {
  it("zwraca 200 z samym e-mailem, NIE 401/404", async () => {
    // Tożsamość to nie autoryzacja: e-mail jest uwierzytelniony przez
    // oauth2-proxy niezależnie od tego, czy istnieje wiersz w system_config.
    // Ekran odmowy ma pokazać, kim użytkownik się przedstawił.
    getUserDisplayName.mockResolvedValue(null)

    const response = await GET(makeRequest("nieznany@firma.pl"))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ email: "nieznany@firma.pl", name: null })
  })
})

describe("GET /api/me/identity — awaria bazy", () => {
  it("degraduje do samego e-maila i loguje, zamiast gasić menu użytkownika", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    getUserDisplayName.mockRejectedValue(new Error("connection refused"))

    const response = await GET(makeRequest("jan@firma.pl"))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ email: "jan@firma.pl", name: null })
    expect(consoleError).toHaveBeenCalled()
    consoleError.mockRestore()
  })
})

describe("GET /api/me/identity — kontrakt odpowiedzi", () => {
  it("nie wystawia has_access ani scopes — to pojęcia backendu IDP, nie tego źródła", async () => {
    getUserDisplayName.mockResolvedValue("Jan Kowalski")

    const body = await (await GET(makeRequest("jan@firma.pl"))).json()

    expect(Object.keys(body).sort()).toEqual(["email", "name"])
  })
})
