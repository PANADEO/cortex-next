import { NextRequest } from "next/server"
import { afterEach, describe, expect, it, vi } from "vitest"

async function loadMiddleware() {
  vi.resetModules()
  return (await import("./middleware")).default
}

function request(pathname: string): NextRequest {
  return new NextRequest(new URL(pathname, "https://cortex.example"))
}

function expectRedirect(response: Response, location: string) {
  expect(response.status).toBe(308)
  expect(response.headers.get("location")).toBe(location)
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("middleware default home redirect", () => {
  it("redirects root to the configured default path", async () => {
    vi.stubEnv("CORTEX_FRONTEND_DEFAULT_PATH", "/idp/packages")
    const middleware = await loadMiddleware()

    const response = middleware(request("/"))

    expectRedirect(response, "https://cortex.example/idp/packages")
  })

  it("preserves basePath when redirecting basePath root", async () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_PATH", "/idp-uat-new")
    vi.stubEnv("CORTEX_FRONTEND_DEFAULT_PATH", "/idp/packages")
    const middleware = await loadMiddleware()

    const response = middleware(request("/idp-uat-new"))

    expectRedirect(response, "https://cortex.example/idp-uat-new/idp/packages")
  })

  it("leaves root unchanged when no default path is configured", async () => {
    const middleware = await loadMiddleware()

    const response = middleware(request("/"))

    expect(response.headers.get("location")).toBeNull()
  })

  it("leaves non-root app paths unchanged", async () => {
    vi.stubEnv("CORTEX_FRONTEND_DEFAULT_PATH", "/idp/packages")
    const middleware = await loadMiddleware()

    const dashboardResponse = middleware(request("/idp/dashboard"))
    const extractionResponse = middleware(request("/idp/packages"))

    expect(dashboardResponse.headers.get("location")).toBeNull()
    expect(extractionResponse.headers.get("location")).toBeNull()
  })
})
