// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { cleanup, render, waitFor } from "@testing-library/react"
import { Component, type ReactNode } from "react"
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest"

const { notFound, useParams, useRouter } = vi.hoisted(() => ({
  notFound: vi.fn((): never => {
    throw new Error("NEXT_NOT_FOUND")
  }),
  useParams: vi.fn(() => ({ id: "test-1" })),
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    back: vi.fn(),
    replace: vi.fn(),
  })),
}))

vi.mock("next/navigation", () => ({
  notFound,
  useParams,
  useRouter,
}))

let originalError: typeof console.error
beforeAll(() => {
  originalError = console.error
  console.error = vi.fn()
})

afterAll(() => {
  console.error = originalError
})

afterEach(() => {
  cleanup()
  notFound.mockClear()
  vi.unstubAllGlobals()
})

class TestErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
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

function freshClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
  })
}

function Wrapper({
  client,
  children,
}: {
  client: QueryClient
  children: ReactNode
}) {
  return (
    <QueryClientProvider client={client}>
      <TestErrorBoundary>{children}</TestErrorBoundary>
    </QueryClientProvider>
  )
}

interface RouteResponse {
  status?: number
  body: unknown
}

function makeFetchMock(routes: Record<string, RouteResponse>) {
  return vi.fn((input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString()
    const path = url.startsWith("http") ? new URL(url).pathname : url.split("?")[0] ?? url
    const route = routes[path ?? ""]
    if (!route) {
      return new Promise<Response>(() => {}) // hang for unexpected routes
    }
    return Promise.resolve(
      new Response(JSON.stringify(route.body), {
        status: route.status ?? 200,
        headers: { "Content-Type": "application/json" },
      }),
    )
  })
}

import ClassificationWorkspacePage from "./page"

describe("ClassificationWorkspacePage — feature flag gating", () => {
  it("calls notFound() when /config returns enable_classification: false", async () => {
    const fetchMock = makeFetchMock({
      "/config": { body: { enable_classification: false } },
    })
    vi.stubGlobal("fetch", fetchMock)

    const { container } = render(
      <Wrapper client={freshClient()}>
        <ClassificationWorkspacePage />
      </Wrapper>,
    )

    await waitFor(() => {
      expect(notFound).toHaveBeenCalled()
    })
    expect(container.querySelector('[data-testid="not-found-boundary"]')).not.toBeNull()
  })

  it("does NOT fetch /classification/dirty-packages/{id} when flag is off", async () => {
    const fetchMock = makeFetchMock({
      "/config": { body: { enable_classification: false } },
    })
    vi.stubGlobal("fetch", fetchMock)

    render(
      <Wrapper client={freshClient()}>
        <ClassificationWorkspacePage />
      </Wrapper>,
    )

    await waitFor(() => {
      expect(notFound).toHaveBeenCalled()
    })
    const calls = fetchMock.mock.calls.map((c) => String(c[0]))
    expect(
      calls.some((u) => u.includes("/classification/dirty-packages/test-1")),
    ).toBe(false)
  })

  it("renders LoadingState while /config is in flight", async () => {
    const inflightFetch = vi.fn(() => new Promise<Response>(() => {}))
    vi.stubGlobal("fetch", inflightFetch)

    const { container } = render(
      <Wrapper client={freshClient()}>
        <ClassificationWorkspacePage />
      </Wrapper>,
    )

    expect(notFound).not.toHaveBeenCalled()
    expect(container.textContent).toMatch(/loading classification/i)
  })
})
