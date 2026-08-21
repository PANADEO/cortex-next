// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { cleanup, renderHook, waitFor } from "@testing-library/react"
import { createElement, type ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { usePipelineBoard } from "./use-pipeline-board"

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function freshClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
  })
}

function wrapper(client: QueryClient) {
  function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client }, children)
  }
  Wrapper.displayName = "TestQueryClientProvider"
  return Wrapper
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
      return Promise.reject(new Error(`Unexpected fetch: ${url}`))
    }
    return Promise.resolve(
      new Response(JSON.stringify(route.body), {
        status: route.status ?? 200,
        headers: { "Content-Type": "application/json" },
      }),
    )
  })
}

const PACKAGES_BODY = { items: [], total: 0 }
const ME_BODY = { email: "test@example.com" }

describe("usePipelineBoard — classification flag gating", () => {
  it("does NOT fetch /classification/dirty-packages when flag is off", async () => {
    const fetchMock = makeFetchMock({
      "/config": { body: { enable_classification: false } },
      "/packages/get_all": { body: PACKAGES_BODY },
      "/user/me": { body: ME_BODY },
    })
    vi.stubGlobal("fetch", fetchMock)

    const { result } = renderHook(() => usePipelineBoard(), {
      wrapper: wrapper(freshClient()),
    })

    await waitFor(() => {
      expect(result.current.totalCount).toBe(0)
    })

    const calls = fetchMock.mock.calls.map((c) => String(c[0]))
    expect(calls.some((u) => u.includes("/classification/dirty-packages"))).toBe(false)
    expect(calls.some((u) => u.includes("/config"))).toBe(true)
    expect(calls.some((u) => u.includes("/packages/get_all"))).toBe(true)
  })

  it("DOES fetch /classification/dirty-packages when flag is on", async () => {
    const fetchMock = makeFetchMock({
      "/config": { body: { enable_classification: true } },
      "/packages/get_all": { body: PACKAGES_BODY },
      "/classification/dirty-packages": { body: { items: [], total: 0 } },
      "/user/me": { body: ME_BODY },
    })
    vi.stubGlobal("fetch", fetchMock)

    renderHook(() => usePipelineBoard(), {
      wrapper: wrapper(freshClient()),
    })

    await waitFor(() => {
      const calls = fetchMock.mock.calls.map((c) => String(c[0]))
      expect(calls.some((u) => u.includes("/classification/dirty-packages"))).toBe(true)
    })
  })

  it("does NOT fetch /classification/dirty-packages while /config is in flight (safe-by-default)", async () => {
    const otherFetches = makeFetchMock({
      "/packages/get_all": { body: PACKAGES_BODY },
      "/user/me": { body: ME_BODY },
    })
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString()
      if (url.includes("/config") && !url.includes("custom-statuses")) {
        return new Promise<Response>(() => {})
      }
      return otherFetches(input)
    })
    vi.stubGlobal("fetch", fetchMock)

    renderHook(() => usePipelineBoard(), {
      wrapper: wrapper(freshClient()),
    })

    await waitFor(() => {
      const calls = fetchMock.mock.calls.map((c) => String(c[0]))
      expect(calls.some((u) => u.includes("/packages/get_all"))).toBe(true)
    })
    const calls = fetchMock.mock.calls.map((c) => String(c[0]))
    expect(calls.some((u) => u.includes("/classification/dirty-packages"))).toBe(false)
  })
})
