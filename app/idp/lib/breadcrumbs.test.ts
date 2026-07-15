// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderHook } from "@testing-library/react"
import { createElement, type ReactNode } from "react"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

beforeAll(() => {
  // Prevent the cold-cache test from making real network requests:
  // usePackage stays in `isLoading` while fetch never resolves, so the
  // hook returns the unchanged trail (which is exactly what we assert).
  vi.stubGlobal(
    "fetch",
    vi.fn(() => new Promise(() => {})),
  )
})

afterAll(() => {
  vi.unstubAllGlobals()
})

const { breadcrumbsFromPath, useResolvedBreadcrumbs } = await import("./breadcrumbs")
const { queryKeys } = await import("@cortex/api")

describe("breadcrumbsFromPath", () => {
  it("returns IDP root for /idp", () => {
    expect(breadcrumbsFromPath("/idp")).toEqual([{ label: "IDP", href: "/" }])
  })

  it("maps /idp/packages to IDP / Extraction", () => {
    expect(breadcrumbsFromPath("/idp/packages")).toEqual([
      { label: "IDP", href: "/" },
      { label: "Extraction" },
    ])
  })

  it("falls through to raw segment for /idp/packages/<id>", () => {
    expect(breadcrumbsFromPath("/idp/packages/abc-123")).toEqual([
      { label: "IDP", href: "/" },
      { label: "Extraction", href: "/idp/packages" },
      { label: "abc-123" },
    ])
  })

  it("maps /idp/dashboard to IDP / Dashboard", () => {
    expect(breadcrumbsFromPath("/idp/dashboard")).toEqual([
      { label: "IDP", href: "/" },
      { label: "Dashboard" },
    ])
  })

  it("maps /idp-basic/dashboard to IDP Basic / Dashboard", () => {
    expect(breadcrumbsFromPath("/idp-basic/dashboard")).toEqual([
      { label: "IDP Basic", href: "/" },
      { label: "Dashboard" },
    ])
  })

  it("maps /idp-basic/files to IDP Basic / Files", () => {
    expect(breadcrumbsFromPath("/idp-basic/files")).toEqual([
      { label: "IDP Basic", href: "/" },
      { label: "Files" },
    ])
  })

  it("maps /idp-basic/results detail to IDP Basic / Results / id", () => {
    expect(breadcrumbsFromPath("/idp-basic/results/result-1")).toEqual([
      { label: "IDP Basic", href: "/" },
      { label: "Results", href: "/idp-basic/results" },
      { label: "result-1" },
    ])
  })

  it("maps /intrastat/review to Intrastat / Review", () => {
    expect(breadcrumbsFromPath("/intrastat/review")).toEqual([
      { label: "Intrastat", href: "/" },
      { label: "Review" },
    ])
  })

  it("maps /invoice-supervisor/inbox to Nadzorca Faktur / Skrzynka", () => {
    expect(breadcrumbsFromPath("/invoice-supervisor/inbox")).toEqual([
      { label: "Nadzorca Faktur", href: "/" },
      { label: "Skrzynka" },
    ])
  })

  it("maps /ai-tools to the app hub root", () => {
    expect(breadcrumbsFromPath("/ai-tools")).toEqual([{ label: "Aplikacje", href: "/" }])
  })

  it("maps /ai-tools/text-highlighter to Aplikacje / Podświetlacz", () => {
    expect(breadcrumbsFromPath("/ai-tools/text-highlighter")).toEqual([
      { label: "Aplikacje", href: "/" },
      { label: "Podświetlacz" },
    ])
  })

  it("tolerates trailing slash on package detail path", () => {
    expect(breadcrumbsFromPath("/idp/packages/abc-123/")).toEqual([
      { label: "IDP", href: "/" },
      { label: "Extraction", href: "/idp/packages" },
      { label: "abc-123" },
    ])
  })
})

interface SeededPackage {
  id: string
  file_name: string
  package_name?: string | null
}

function seededClient(seeds: SeededPackage[] = []): QueryClient {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
    },
  })
  for (const seed of seeds) {
    client.setQueryData(queryKeys.packages.detail(seed.id), seed)
  }
  return client
}

function wrapper(client: QueryClient) {
  function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client }, children)
  }
  Wrapper.displayName = "TestQueryClientProvider"
  return Wrapper
}

describe("useResolvedBreadcrumbs", () => {
  it("swaps the last entry's label with file_name when package is in cache", () => {
    const client = seededClient([{ id: "abc-123", file_name: "INV-2026-001.zip" }])
    const { result } = renderHook(() => useResolvedBreadcrumbs("/idp/packages/abc-123"), {
      wrapper: wrapper(client),
    })
    expect(result.current).toEqual([
      { label: "IDP", href: "/" },
      { label: "Extraction", href: "/idp/packages" },
      { label: "INV-2026-001.zip" },
    ])
  })

  it("prefers package_name over file_name when package has a display name", () => {
    const client = seededClient([
      { id: "abc-123", file_name: "INV-2026-001.zip", package_name: "May shipment" },
    ])
    const { result } = renderHook(() => useResolvedBreadcrumbs("/idp/packages/abc-123"), {
      wrapper: wrapper(client),
    })
    expect(result.current).toEqual([
      { label: "IDP", href: "/" },
      { label: "Extraction", href: "/idp/packages" },
      { label: "May shipment" },
    ])
  })

  it("returns unchanged trail on non-package routes", () => {
    const client = seededClient()
    const { result } = renderHook(() => useResolvedBreadcrumbs("/idp/dashboard"), {
      wrapper: wrapper(client),
    })
    expect(result.current).toEqual([{ label: "IDP", href: "/" }, { label: "Dashboard" }])
  })

  it("returns unchanged trail when package data is unavailable (cold cache)", () => {
    const client = seededClient()
    const { result } = renderHook(() => useResolvedBreadcrumbs("/idp/packages/missing-id"), {
      wrapper: wrapper(client),
    })
    expect(result.current).toEqual([
      { label: "IDP", href: "/" },
      { label: "Extraction", href: "/idp/packages" },
      { label: "missing-id" },
    ])
  })
})
