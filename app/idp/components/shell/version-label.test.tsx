// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import { createElement, type ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SHELL_VERSION", "v0.2.10")
})

afterEach(() => {
  vi.unstubAllEnvs()
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

function labelText(): string {
  // The component renders one <p>; reading textContent is the simplest assertion.
  const node = screen.getByText(/FE v/)
  return node.textContent ?? ""
}

describe("stripLeadingV", () => {
  it("strips leading 'v' when present", async () => {
    const { stripLeadingV } = await import("./version-label")
    expect(stripLeadingV("v0.2.10")).toBe("0.2.10")
  })

  it("returns the input unchanged when no leading 'v'", async () => {
    const { stripLeadingV } = await import("./version-label")
    expect(stripLeadingV("0.2.10")).toBe("0.2.10")
  })
})

describe("SHELL_VERSION export", () => {
  it("returns env value when NEXT_PUBLIC_SHELL_VERSION is set", async () => {
    vi.stubEnv("NEXT_PUBLIC_SHELL_VERSION", "v0.2.10")
    const { SHELL_VERSION } = await import("./version-label")
    expect(SHELL_VERSION).toBe("v0.2.10")
  })

  it("falls back to 'dev' when NEXT_PUBLIC_SHELL_VERSION is not set", async () => {
    vi.unstubAllEnvs()
    delete process.env.NEXT_PUBLIC_SHELL_VERSION
    const { SHELL_VERSION } = await import("./version-label")
    expect(SHELL_VERSION).toBe("dev")
  })
})

describe("VersionLabel", () => {
  it("renders FE version stripped of leading 'v' regardless of env format", async () => {
    vi.stubEnv("NEXT_PUBLIC_SHELL_VERSION", "v0.2.10")
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {})),
    )
    const { VersionLabel } = await import("./version-label")
    const Wrapper = wrapper(freshClient())

    render(createElement(Wrapper, null, createElement(VersionLabel, { tileId: "idp" })))

    expect(labelText()).toMatch(/^FE v0\.2\.10 ·/)
  })

  it("normalises FE version when env value has no leading 'v'", async () => {
    vi.stubEnv("NEXT_PUBLIC_SHELL_VERSION", "0.2.10")
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {})),
    )
    const { VersionLabel } = await import("./version-label")
    const Wrapper = wrapper(freshClient())

    render(createElement(Wrapper, null, createElement(VersionLabel, { tileId: "idp" })))

    expect(labelText()).toMatch(/^FE v0\.2\.10 ·/)
  })

  it("shows loading placeholder while module version is fetching", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {})),
    )
    const { VersionLabel } = await import("./version-label")
    const Wrapper = wrapper(freshClient())

    render(createElement(Wrapper, null, createElement(VersionLabel, { tileId: "idp" })))

    expect(labelText()).toBe("FE v0.2.10 · IDP v…")
  })

  it("shows module version on successful fetch", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ version: "1.13.0" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        ),
      ),
    )
    const { VersionLabel } = await import("./version-label")
    const Wrapper = wrapper(freshClient())

    render(createElement(Wrapper, null, createElement(VersionLabel, { tileId: "idp" })))

    await waitFor(() => {
      expect(labelText()).toBe("FE v0.2.10 · IDP v1.13.0")
    })
  })

  it("strips leading 'v' from backend version response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ version: "v1.13.0" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        ),
      ),
    )
    const { VersionLabel } = await import("./version-label")
    const Wrapper = wrapper(freshClient())

    render(createElement(Wrapper, null, createElement(VersionLabel, { tileId: "idp" })))

    await waitFor(() => {
      expect(labelText()).toBe("FE v0.2.10 · IDP v1.13.0")
    })
  })

  it("shows module label without version when fetch fails (graceful degradation)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response("oops", { status: 500 }))),
    )
    const { VersionLabel } = await import("./version-label")
    const Wrapper = wrapper(freshClient())

    render(createElement(Wrapper, null, createElement(VersionLabel, { tileId: "idp" })))

    await waitFor(() => {
      expect(labelText()).toBe("FE v0.2.10 · IDP")
    })
  })

  it("falls back to uppercased tileId when tile is not registered, with no version", async () => {
    const fetchMock = vi.fn(() => new Promise(() => {}))
    vi.stubGlobal("fetch", fetchMock)
    const { VersionLabel } = await import("./version-label")
    const Wrapper = wrapper(freshClient())

    render(
      createElement(Wrapper, null, createElement(VersionLabel, { tileId: "ghost" })),
    )

    expect(labelText()).toBe("FE v0.2.10 · GHOST")
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("falls back to 'dev' when NEXT_PUBLIC_SHELL_VERSION is not set", async () => {
    vi.unstubAllEnvs()
    delete process.env.NEXT_PUBLIC_SHELL_VERSION
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {})),
    )
    const { VersionLabel } = await import("./version-label")
    const Wrapper = wrapper(freshClient())

    render(createElement(Wrapper, null, createElement(VersionLabel, { tileId: "idp" })))

    expect(labelText()).toMatch(/^FE vdev ·/)
  })
})
