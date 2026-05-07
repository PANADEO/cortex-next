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

describe("useFeatureFlag", () => {
  it("returns false (default) while the /config request is in flight", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {})),
    )
    const { useFeatureFlag } = await import("./use-feature-flag")
    const { result } = renderHook(() => useFeatureFlag("idp.classification"), {
      wrapper: wrapper(freshClient()),
    })

    expect(result.current).toBe(false)
  })

  it("returns false (default) when /config returns 5xx error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response("oops", { status: 500 }))),
    )
    const { useFeatureFlag } = await import("./use-feature-flag")
    const { result } = renderHook(() => useFeatureFlag("idp.classification"), {
      wrapper: wrapper(freshClient()),
    })

    await waitFor(() => {
      expect(result.current).toBe(false)
    })
  })

  it("returns false (default) when response is missing the mapped field", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({}), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        ),
      ),
    )
    const { useFeatureFlag } = await import("./use-feature-flag")
    const { result } = renderHook(() => useFeatureFlag("idp.classification"), {
      wrapper: wrapper(freshClient()),
    })

    await waitFor(() => {
      expect(result.current).toBe(false)
    })
  })

  it("returns true when backend reports enable_classification: true", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ enable_classification: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        ),
      ),
    )
    const { useFeatureFlag } = await import("./use-feature-flag")
    const { result } = renderHook(() => useFeatureFlag("idp.classification"), {
      wrapper: wrapper(freshClient()),
    })

    await waitFor(() => {
      expect(result.current).toBe(true)
    })
  })

  it("returns false when backend reports enable_classification: false", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ enable_classification: false }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        ),
      ),
    )
    const { useFeatureFlag } = await import("./use-feature-flag")
    const { result } = renderHook(() => useFeatureFlag("idp.classification"), {
      wrapper: wrapper(freshClient()),
    })

    await waitFor(() => {
      expect(result.current).toBe(false)
    })
  })
})
