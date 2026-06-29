// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import "@testing-library/jest-dom/vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { PackageMetadataEditors } from "./package-metadata-editors"

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
  },
}))

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function freshClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  })
}

function Wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={freshClient()}>{children}</QueryClientProvider>
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
  })
}

describe("PackageMetadataEditors", () => {
  it("resets custom status dirty state after saving an empty value", async () => {
    const requests: string[] = []
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString()
        const path = url.startsWith("http") ? new URL(url).pathname : url.split("?")[0]
        requests.push(`${init?.method ?? "GET"} ${path}`)
        return Promise.resolve(jsonResponse({}))
      }),
    )

    render(
      <Wrapper>
        <PackageMetadataEditors
          packageId="pkg-1"
          customStatus={null}
          userNotes={null}
          additionalAiContext={null}
        />
      </Wrapper>,
    )

    const input = screen.getByLabelText(/custom status/i)
    const save = screen.getByRole("button", { name: /save custom status/i })

    expect(save).toBeDisabled()

    fireEvent.change(input, { target: { value: "   " } })

    expect(save).toBeEnabled()

    fireEvent.click(save)

    await waitFor(() => {
      expect(save).toBeDisabled()
    })
    expect(input).toHaveValue("")
    expect(requests).toContain("POST /packages/pkg-1/custom-status")
  })
})
