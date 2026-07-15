import { NextRequest } from "next/server"
import { afterEach, describe, expect, it, vi } from "vitest"

async function loadMiddleware() {
  vi.resetModules()
  return (await import("./middleware")).default
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe("middleware Intrastat rewrite", () => {
  it("rewrites /intrastat/api/* to INTRASTAT_BACKEND_URL /api/*", async () => {
    vi.stubEnv("INTRASTAT_BACKEND_URL", "http://intrastat-app")
    const middleware = await loadMiddleware()
    const request = new NextRequest("http://frontend.local/intrastat/api/stats", {
      headers: { accept: "application/json" },
    })

    const response = middleware(request)

    expect(response.headers.get("x-middleware-rewrite")).toBe("http://intrastat-app/api/stats")
  })

  it("rewrites /intrastat/version to backend /version", async () => {
    vi.stubEnv("INTRASTAT_BACKEND_URL", "http://intrastat-app")
    const middleware = await loadMiddleware()
    const request = new NextRequest("http://frontend.local/intrastat/version")

    const response = middleware(request)

    expect(response.headers.get("x-middleware-rewrite")).toBe("http://intrastat-app/version")
  })
})

describe("middleware Invoice Supervisor rewrite", () => {
  it("rewrites /invoice-supervisor/api/* to INVOICE_SUPERVISOR_BACKEND_URL /* (no /api prefix on the backend)", async () => {
    vi.stubEnv("INVOICE_SUPERVISOR_BACKEND_URL", "http://invoice-supervisor-app")
    const middleware = await loadMiddleware()
    const request = new NextRequest("http://frontend.local/invoice-supervisor/api/invoices", {
      headers: { accept: "application/json" },
    })

    const response = middleware(request)

    expect(response.headers.get("x-middleware-rewrite")).toBe("http://invoice-supervisor-app/invoices")
  })

  it("rewrites /invoice-supervisor/version to backend /version", async () => {
    vi.stubEnv("INVOICE_SUPERVISOR_BACKEND_URL", "http://invoice-supervisor-app")
    const middleware = await loadMiddleware()
    const request = new NextRequest("http://frontend.local/invoice-supervisor/version")

    const response = middleware(request)

    expect(response.headers.get("x-middleware-rewrite")).toBe("http://invoice-supervisor-app/version")
  })
})
