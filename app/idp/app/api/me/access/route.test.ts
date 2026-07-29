import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

interface MeAccessRoute {
  GET: (request: { headers: { get: (name: string) => string | null } }) => Promise<Response>
}

async function loadHandler(): Promise<MeAccessRoute> {
  vi.resetModules()
  return (await import("./route")) as unknown as MeAccessRoute
}

function makeRequest(email: string | null): {
  headers: { get: (name: string) => string | null }
} {
  return {
    headers: {
      get: (name: string) => (name.toLowerCase() === "x-auth-request-email" ? email : null),
    },
  }
}

beforeEach(() => {
  vi.unstubAllEnvs()
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe("/api/me/access route handler", () => {
  it("returns 401 when no email header and no dev fallback", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("DEV_USER_EMAIL", "")
    const { GET } = await loadHandler()

    const response = await GET(makeRequest(null))

    expect(response.status).toBe(401)
  })

  it("ignores DEV_USER_EMAIL fallback in production (security)", async () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("DEV_USER_EMAIL", "leaked@dev.local")
    const { GET } = await loadHandler()

    const response = await GET(makeRequest(null))

    expect(response.status).toBe(401)
  })

  it("uses DEV_USER_EMAIL fallback in development when header is missing", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("DEV_USER_EMAIL", "dev@cortex.local")
    vi.stubEnv("CORTEX_ADMIN_API_BASE_URL", "http://cortex-admin")
    vi.stubEnv("CORTEX_ADMIN_API_KEY", "test-key")
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ apps: ["idp"] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        ),
      ),
    )
    const { GET } = await loadHandler()

    const response = await GET(makeRequest(null))
    const body = (await response.json()) as { allowed: boolean; apps: string[]; email: string }

    expect(response.status).toBe(200)
    expect(body.email).toBe("dev@cortex.local")
    expect(body.allowed).toBe(true)
    expect(body.apps).toEqual(["idp"])
  })

  it("fails closed (allowed:false) when CORTEX_ADMIN env vars are not configured", async () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("CORTEX_ADMIN_API_BASE_URL", "")
    vi.stubEnv("CORTEX_ADMIN_API_KEY", "")
    const { GET } = await loadHandler()

    const response = await GET(makeRequest("u@example.com"))
    const body = (await response.json()) as { allowed: boolean; apps: string[]; email: string }

    expect(response.status).toBe(200)
    expect(body.allowed).toBe(false)
    expect(body.apps).toEqual([])
    expect(body.email).toBe("u@example.com")
  })

  it("checks shell and AI mini-app codes and returns authorized apps", async () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("CORTEX_ADMIN_API_BASE_URL", "http://cortex-admin")
    vi.stubEnv("CORTEX_ADMIN_API_KEY", "test-key")
    const fetchSpy = vi.fn((input: string | URL | Request) => {
      void input
      return Promise.resolve(
        new Response(JSON.stringify({ apps: ["idp-basic", "intrastat"] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
    })
    vi.stubGlobal("fetch", fetchSpy)
    const { GET } = await loadHandler()

    const response = await GET(makeRequest("u@example.com"))
    const body = (await response.json()) as { allowed: boolean; apps: string[]; email: string }
    const firstCall = fetchSpy.mock.calls.at(0)
    expect(firstCall).toBeDefined()
    const requestedUrl = new URL(String(firstCall?.[0]))

    expect(response.status).toBe(200)
    expect(body).toEqual({
      allowed: true,
      apps: ["idp-basic", "intrastat"],
      email: "u@example.com",
    })
    expect(requestedUrl.searchParams.get("email")).toBe("u@example.com")
    expect(requestedUrl.searchParams.getAll("apps")).toEqual([
      "idp",
      "idp-basic",
      "intrastat",
      "invoice-supervisor",
      "ai-tools",
      "intrastat-cn-editor",
      "intrastat-config-editor",
      "cortex-config",
      "cortex-cowork",
      "konfiguracja-systemu",
      "text-highlighter",
      "text-transformer",
      "text-analyzer",
      "ai-summarizer",
      "content-guru",
      "linkedin-generator",
      "visual-guru",
      "fakturomat",
      "ai-daily-assistant",
    ])
  })

  it("prefers x-auth-request-email header over DEV_USER_EMAIL in development", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("DEV_USER_EMAIL", "dev@cortex.local")
    const { GET } = await loadHandler()

    const response = await GET(makeRequest("real@user.com"))
    const body = (await response.json()) as { email: string }

    expect(response.status).toBe(200)
    expect(body.email).toBe("real@user.com")
  })
})
