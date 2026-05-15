// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { cleanup, renderHook, waitFor } from "@testing-library/react"
import { type ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { useIdpNavSections } from "./nav"

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function freshClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
  })
}

function itemIds(sections: ReturnType<typeof useIdpNavSections>): string[] {
  return sections.flatMap((section) => section.items.map((item) => item.id))
}

describe("useIdpNavSections", () => {
  it("hides menu items from /config hide_menu_items", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ hide_menu_items: "export,rules" }), {
            headers: { "Content-Type": "application/json" },
          }),
        ),
      ),
    )

    const client = freshClient()
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )

    const { result } = renderHook(() => useIdpNavSections(), { wrapper })

    await waitFor(() => {
      expect(itemIds(result.current)).not.toContain("export")
    })
    expect(itemIds(result.current)).not.toContain("rules")
    expect(itemIds(result.current)).toContain("audit-log")
  })
})
