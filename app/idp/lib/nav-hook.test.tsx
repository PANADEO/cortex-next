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
      vi.fn((input: RequestInfo | URL) => {
        const path = typeof input === "string" ? input : input.toString()
        if (path.includes("/config/feature-flags")) {
          return Promise.resolve(new Response("{}", { status: 403 }))
        }
        return Promise.resolve(
          new Response(JSON.stringify({ hide_menu_items: "export,rules" }), {
            headers: { "Content-Type": "application/json" },
          }),
        )
      }),
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
    expect(itemIds(result.current)).not.toContain("configuration")
    expect(itemIds(result.current)).toContain("audit-log")
  })

  it("shows Configuration when admin settings endpoint succeeds", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const path = typeof input === "string" ? input : input.toString()
        if (path.includes("/config/feature-flags")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                enable_verification_process: true,
                package_custom_statuses: false,
                enable_user_notes: false,
                enable_po_number: false,
                enable_customs_code: false,
                enable_additional_ai_context: false,
                enable_atr_processing: false,
                enable_packaging_selection_mode: false,
                enable_cn_ai_enrichment: false,
                enable_document_preview: true,
                enable_classification: false,
                hide_menu_items: [],
              }),
              { headers: { "Content-Type": "application/json" } },
            ),
          )
        }
        return Promise.resolve(
          new Response(JSON.stringify({ hide_menu_items: [] }), {
            headers: { "Content-Type": "application/json" },
          }),
        )
      }),
    )

    const client = freshClient()
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )

    const { result } = renderHook(() => useIdpNavSections(), { wrapper })

    await waitFor(() => {
      expect(itemIds(result.current)).toContain("configuration")
    })
  })
})
