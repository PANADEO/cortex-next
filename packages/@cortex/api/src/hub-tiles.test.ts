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

const FIXTURE_TILE = {
  id: "9f1d3c62-1f4a-4a6b-9f3c-2b7d5e8a1c40",
  code: "raportowanie-tokenow",
  name: "Raportowanie Tokenów",
  description: null,
  icon: "BarChart3",
  kind: "native",
  route: "/token-usage",
  url: null,
  target: null,
  isActive: true,
  sortOrder: 10,
  showOnHub: true,
  color: "sky",
  categoryFunctional: null,
  categoryDepartment: null,
  activatedAt: null,
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
}

describe("useHubTiles", () => {
  it("zwraca katalog kafelków na 200", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify([FIXTURE_TILE]), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        ),
      ),
    )
    const { useHubTiles } = await import("./hub-tiles")
    const { result } = renderHook(() => useHubTiles(), { wrapper: wrapper(freshClient()) })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.tiles).toEqual([FIXTURE_TILE])
    expect(result.current.isError).toBe(false)
  })

  it("zwraca pustą listę, gdy odpowiedź jest pustą tablicą", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify([]), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        ),
      ),
    )
    const { useHubTiles } = await import("./hub-tiles")
    const { result } = renderHook(() => useHubTiles(), { wrapper: wrapper(freshClient()) })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.tiles).toEqual([])
  })

  it("surfaces isError na non-2xx; tiles zostaje pustą listą", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response("nope", { status: 401 }))),
    )
    const { useHubTiles } = await import("./hub-tiles")
    const { result } = renderHook(() => useHubTiles(), { wrapper: wrapper(freshClient()) })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(result.current.tiles).toEqual([])
  })

  it("nie ponawia próby po błędzie (retry: false)", async () => {
    const fetchSpy = vi.fn(() => Promise.resolve(new Response("nope", { status: 500 })))
    vi.stubGlobal("fetch", fetchSpy)
    const { useHubTiles } = await import("./hub-tiles")
    const { result } = renderHook(() => useHubTiles(), { wrapper: wrapper(freshClient()) })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it("odpytuje dokładnie /api/hub/tiles", async () => {
    // Sygnatura deklarowana w generyku, nie w argumentach implementacji — dzięki
    // temu `mock.calls[0]` ma typ krotki (odczyt URL-a bez rzutowania).
    const fetchSpy = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(() =>
      Promise.resolve(
        new Response(JSON.stringify([]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    )
    vi.stubGlobal("fetch", fetchSpy)
    const { useHubTiles } = await import("./hub-tiles")
    const { result } = renderHook(() => useHubTiles(), { wrapper: wrapper(freshClient()) })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    const call = fetchSpy.mock.calls[0]
    if (!call) throw new Error("fetch nie został zawołany")
    expect(call[0]).toContain("/api/hub/tiles")
  })
})
