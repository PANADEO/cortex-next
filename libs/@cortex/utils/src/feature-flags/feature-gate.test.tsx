// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import { type ReactNode } from "react"
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

function Wrapper({
  client,
  children,
}: {
  client: QueryClient
  children: ReactNode
}) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

function configResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })
}

describe("FeatureGate", () => {
  it("renders children when the flag is true", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(configResponse({ enable_classification: true }))),
    )
    const { FeatureGate } = await import("./feature-gate")

    render(
      <Wrapper client={freshClient()}>
        <FeatureGate flag="idp.classification">
          <span>shown</span>
        </FeatureGate>
      </Wrapper>,
    )

    await waitFor(() => {
      expect(screen.getByText("shown")).not.toBeNull()
    })
  })

  it("renders fallback when the flag is false", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(configResponse({ enable_classification: false }))),
    )
    const { FeatureGate } = await import("./feature-gate")

    render(
      <Wrapper client={freshClient()}>
        <FeatureGate flag="idp.classification" fallback={<span>fallback</span>}>
          <span>children</span>
        </FeatureGate>
      </Wrapper>,
    )

    await waitFor(() => {
      expect(screen.getByText("fallback")).not.toBeNull()
    })
    expect(screen.queryByText("children")).toBeNull()
  })

  it("renders fallback while /config is loading (safe-by-default)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {})),
    )
    const { FeatureGate } = await import("./feature-gate")

    render(
      <Wrapper client={freshClient()}>
        <FeatureGate flag="idp.classification" fallback={<span>fallback</span>}>
          <span>children</span>
        </FeatureGate>
      </Wrapper>,
    )

    expect(screen.getByText("fallback")).not.toBeNull()
    expect(screen.queryByText("children")).toBeNull()
  })

  it("renders nothing by default (no fallback prop) when flag is false", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(configResponse({ enable_classification: false }))),
    )
    const { FeatureGate } = await import("./feature-gate")

    const { container } = render(
      <Wrapper client={freshClient()}>
        <FeatureGate flag="idp.classification">
          <span>children</span>
        </FeatureGate>
      </Wrapper>,
    )

    await waitFor(() => {
      expect(screen.queryByText("children")).toBeNull()
    })
    expect(container.textContent).toBe("")
  })
})
