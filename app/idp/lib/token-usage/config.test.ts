import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { TOKEN_USAGE_APP_CODE, tokenUsageConfig } from "./config"

const KEY = "wartosc-ADMIN_API_KEY-z-cortex-proxy"

beforeEach(() => {
  vi.unstubAllEnvs()
  vi.stubEnv("CORTEX_PROXY_URL", "")
  vi.stubEnv("CORTEX_PROXY_ADMIN_API_KEY", "")
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("tokenUsageConfig", () => {
  it("czyta oba wymagane wejścia", () => {
    vi.stubEnv("CORTEX_PROXY_URL", "http://cortex-proxy")
    vi.stubEnv("CORTEX_PROXY_ADMIN_API_KEY", KEY)

    const result = tokenUsageConfig()

    expect(result).toEqual({
      ok: true,
      config: { baseUrl: "http://cortex-proxy", adminApiKey: KEY },
    })
  })

  // Sam import tego modułu nie ma prawa rzucić — inaczej brak JEDNEGO sekretu
  // wywróciłby wszystkie pozostałe kafelki, bo route'y ładują się razem.
  it("brak konfiguracji zwraca wynik, nie wyjątek", () => {
    expect(() => tokenUsageConfig()).not.toThrow()
    expect(tokenUsageConfig().ok).toBe(false)
  })

  it("wskazuje po nazwie, czego brakuje", () => {
    const result = tokenUsageConfig()

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.missing).toContain("CORTEX_PROXY_URL")
      expect(result.missing).toContain("CORTEX_PROXY_ADMIN_API_KEY")
    }
  })

  // docker-compose wstawia `VAR: ${VAR:-}`, więc nieustawiona zmienna dociera
  // tu jako pusty string, nie jako undefined.
  it("pusty string i same spacje to brak wartości, nie wartość", () => {
    vi.stubEnv("CORTEX_PROXY_URL", "http://cortex-proxy")
    vi.stubEnv("CORTEX_PROXY_ADMIN_API_KEY", "   ")

    const result = tokenUsageConfig()

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.missing).toEqual(["CORTEX_PROXY_ADMIN_API_KEY"])
  })

  it("odrzuca URL, który nie jest URL-em", () => {
    vi.stubEnv("CORTEX_PROXY_URL", "localhost:8240")
    vi.stubEnv("CORTEX_PROXY_ADMIN_API_KEY", KEY)

    const result = tokenUsageConfig()

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.missing).toEqual(["CORTEX_PROXY_URL"])
  })

  // Lista braków trafia do odpowiedzi 503 i widzi ją administrator w
  // przeglądarce — ma nieść NAZWY zmiennych, nigdy ich wartości.
  it("lista braków nie zawiera żadnej wartości sekretu", () => {
    vi.stubEnv("CORTEX_PROXY_URL", "nie-url")
    vi.stubEnv("CORTEX_PROXY_ADMIN_API_KEY", KEY)

    const result = tokenUsageConfig()

    expect(result.ok).toBe(false)
    if (!result.ok) expect(JSON.stringify(result.missing)).not.toContain(KEY)
  })

  // Czytane przy KAŻDYM wywołaniu, nie raz przy imporcie modułu.
  it("widzi zmianę środowiska bez przeładowania modułu", () => {
    expect(tokenUsageConfig().ok).toBe(false)

    vi.stubEnv("CORTEX_PROXY_URL", "http://cortex-proxy")
    vi.stubEnv("CORTEX_PROXY_ADMIN_API_KEY", KEY)

    expect(tokenUsageConfig().ok).toBe(true)
  })

  it("kod kafelka jest kebab-case, spójnie z resztą rejestru", () => {
    expect(TOKEN_USAGE_APP_CODE).toBe("token-usage")
  })
})
