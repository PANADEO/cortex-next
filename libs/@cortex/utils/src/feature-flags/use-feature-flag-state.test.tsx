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

function configResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })
}

describe("useFeatureFlagState", () => {
  it("returns isPending: true while /config is in flight (default-disabled)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {})),
    )
    const { useFeatureFlagState } = await import("./use-feature-flag-state")
    const { result } = renderHook(() => useFeatureFlagState("idp.classification"), {
      wrapper: wrapper(freshClient()),
    })

    expect(result.current.isPending).toBe(true)
    expect(result.current.enabled).toBe(false)
    expect(result.current.isError).toBe(false)
  })

  it("settles to enabled: true when backend reports the flag on", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(configResponse({ enable_classification: true }))),
    )
    const { useFeatureFlagState } = await import("./use-feature-flag-state")
    const { result } = renderHook(() => useFeatureFlagState("idp.classification"), {
      wrapper: wrapper(freshClient()),
    })

    await waitFor(() => {
      expect(result.current.isPending).toBe(false)
    })
    expect(result.current.enabled).toBe(true)
    expect(result.current.isError).toBe(false)
  })

  it("settles to enabled: false when backend reports the flag off", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(configResponse({ enable_classification: false }))),
    )
    const { useFeatureFlagState } = await import("./use-feature-flag-state")
    const { result } = renderHook(() => useFeatureFlagState("idp.classification"), {
      wrapper: wrapper(freshClient()),
    })

    await waitFor(() => {
      expect(result.current.isPending).toBe(false)
    })
    expect(result.current.enabled).toBe(false)
    expect(result.current.isError).toBe(false)
  })

  it("falls back to DEFAULTS when response is missing the mapped field", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(configResponse({}))),
    )
    const { useFeatureFlagState } = await import("./use-feature-flag-state")
    const { result } = renderHook(() => useFeatureFlagState("idp.classification"), {
      wrapper: wrapper(freshClient()),
    })

    await waitFor(() => {
      expect(result.current.isPending).toBe(false)
    })
    expect(result.current.enabled).toBe(false)
    expect(result.current.isError).toBe(false)
  })

  it("returns isError: true and DEFAULTS fallback on 5xx error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response("oops", { status: 500 }))),
    )
    const { useFeatureFlagState } = await import("./use-feature-flag-state")
    const { result } = renderHook(() => useFeatureFlagState("idp.classification"), {
      wrapper: wrapper(freshClient()),
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    expect(result.current.enabled).toBe(false)
    expect(result.current.isPending).toBe(false)
  })
})
