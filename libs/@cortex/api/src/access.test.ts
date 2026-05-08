// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderHook, waitFor } from "@testing-library/react"
import { createElement, type ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
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

describe("useAuthorizedApps", () => {
  it("returns allowed:true on 200 success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ allowed: true, email: "u@x.com" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        ),
      ),
    )
    const { useAuthorizedApps } = await import("./access")
    const { result } = renderHook(() => useAuthorizedApps(), {
      wrapper: wrapper(freshClient()),
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.allowed).toBe(true)
    expect(result.current.isError).toBe(false)
  })

  it("returns allowed:false on 200 with allowed:false body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ allowed: false, email: "no@x.com" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        ),
      ),
    )
    const { useAuthorizedApps } = await import("./access")
    const { result } = renderHook(() => useAuthorizedApps(), {
      wrapper: wrapper(freshClient()),
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.allowed).toBe(false)
  })

  it("surfaces isError on non-2xx; allowed stays null (fail-closed)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response("nope", { status: 403 }))),
    )
    const { useAuthorizedApps } = await import("./access")
    const { result } = renderHook(() => useAuthorizedApps(), {
      wrapper: wrapper(freshClient()),
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(result.current.allowed).toBeNull()
  })

  it("surfaces isError on network failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("boom"))),
    )
    const { useAuthorizedApps } = await import("./access")
    const { result } = renderHook(() => useAuthorizedApps(), {
      wrapper: wrapper(freshClient()),
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(result.current.allowed).toBeNull()
  })

  it("does not retry on failure", async () => {
    const fetchSpy = vi.fn(() => Promise.resolve(new Response("nope", { status: 500 })))
    vi.stubGlobal("fetch", fetchSpy)
    const { useAuthorizedApps } = await import("./access")
    const { result } = renderHook(() => useAuthorizedApps(), {
      wrapper: wrapper(freshClient()),
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })
})
