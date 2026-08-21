// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { cleanup, render, waitFor } from "@testing-library/react"
import { Component, type ReactNode } from "react"
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest"

let originalError: typeof console.error
beforeAll(() => {
  // React logs caught errors to console.error; silence the boundary catch noise
  // while keeping real assertion failures visible.
  originalError = console.error
  console.error = vi.fn()
})

afterAll(() => {
  console.error = originalError
})

const { notFound } = vi.hoisted(() => ({
  notFound: vi.fn((): never => {
    throw new Error("NEXT_NOT_FOUND")
  }),
}))

vi.mock("next/navigation", () => ({
  notFound,
}))

class TestErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  render() {
    if (this.state.error?.message === "NEXT_NOT_FOUND") {
      return <div data-testid="not-found-boundary">404</div>
    }
    if (this.state.error) throw this.state.error
    return this.props.children
  }
}

afterEach(() => {
  cleanup()
  notFound.mockClear()
  vi.unstubAllGlobals()
})

function freshClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
  })
}

function Wrapper({ client, children }: { client: QueryClient; children: ReactNode }) {
  return (
    <QueryClientProvider client={client}>
      <TestErrorBoundary>{children}</TestErrorBoundary>
    </QueryClientProvider>
  )
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

interface RouteResponse {
  status?: number
  body: unknown
}

function makeFetchMock(routes: Record<string, RouteResponse>) {
  return vi.fn((input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString()
    const path = url.startsWith("http") ? new URL(url).pathname : (url.split("?")[0] ?? url)
    const route = routes[path ?? ""]
    if (!route) {
      return new Promise<Response>(() => {}) // hang for unexpected routes
    }
    return Promise.resolve(jsonResponse(route.body, route.status ?? 200))
  })
}

import ClassificationPage from "./page"

describe("ClassificationPage — feature flag gating", () => {
  it("calls notFound() when /config returns enable_classification: false", async () => {
    const fetchMock = makeFetchMock({
      "/config": { body: { enable_classification: false } },
      "/classification/dirty-packages": { body: { items: [], total: 0 } },
    })
    vi.stubGlobal("fetch", fetchMock)

    const { container } = render(
      <Wrapper client={freshClient()}>
        <ClassificationPage />
      </Wrapper>,
    )

    await waitFor(() => {
      expect(notFound).toHaveBeenCalled()
    })
    expect(container.querySelector('[data-testid="not-found-boundary"]')).not.toBeNull()
  })

  it("renders LoadingState while /config is in flight", async () => {
    const inflightFetch = vi.fn(() => new Promise<Response>(() => {}))
    vi.stubGlobal("fetch", inflightFetch)

    const { container } = render(
      <Wrapper client={freshClient()}>
        <ClassificationPage />
      </Wrapper>,
    )

    expect(notFound).not.toHaveBeenCalled()
    expect(container.textContent).toMatch(/wczytywanie klasyfikacji/i)
  })

  it("renders the page (not 404, not loading) when flag is on", async () => {
    const fetchMock = makeFetchMock({
      "/config": { body: { enable_classification: true } },
      "/classification/dirty-packages": { body: { items: [], total: 0 } },
    })
    vi.stubGlobal("fetch", fetchMock)

    const { container } = render(
      <Wrapper client={freshClient()}>
        <ClassificationPage />
      </Wrapper>,
    )

    await waitFor(() => {
      expect(container.textContent).toContain("Klasyfikacja")
    })
    expect(notFound).not.toHaveBeenCalled()
  })
})
