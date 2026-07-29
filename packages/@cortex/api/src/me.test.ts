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

describe("useMe", () => {
  it("returns UserInfoResponse shape with email and has_access", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ email: "u@x.com", has_access: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        ),
      ),
    )
    const { useMe } = await import("./me")
    const { result } = renderHook(() => useMe(), { wrapper: wrapper(freshClient()) })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual({ email: "u@x.com", has_access: true })
  })

  it("accepts optional user scopes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              email: "admin@x.com",
              has_access: true,
              scopes: ["package_unlock"],
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          ),
        ),
      ),
    )
    const { useMe } = await import("./me")
    const { result } = renderHook(() => useMe(), { wrapper: wrapper(freshClient()) })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual({
      email: "admin@x.com",
      has_access: true,
      scopes: ["package_unlock"],
    })
  })

  it("propagates has_access:false through the response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ email: "no@x.com", has_access: false }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        ),
      ),
    )
    const { useMe } = await import("./me")
    const { result } = renderHook(() => useMe(), { wrapper: wrapper(freshClient()) })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data?.has_access).toBe(false)
  })

  it("uses 60s staleTime so a second consumer within window does not refetch", async () => {
    const fetchSpy = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ email: "u@x.com", has_access: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    )
    vi.stubGlobal("fetch", fetchSpy)
    const { useMe } = await import("./me")
    const client = freshClient()
    const Wrapper = wrapper(client)

    const first = renderHook(() => useMe(), { wrapper: Wrapper })
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true))

    // Mount a second consumer — should reuse cache, not call fetch again.
    const second = renderHook(() => useMe(), { wrapper: Wrapper })
    await waitFor(() => expect(second.result.current.isSuccess).toBe(true))

    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })
})
