// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import ConfigurationPage from "./page"

function freshClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
  })
}

function Wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={freshClient()}>{children}</QueryClientProvider>
}

function settings(overrides: Record<string, unknown> = {}) {
  return {
    enable_verification_process: true,
    package_custom_statuses: false,
    enable_user_notes: false,
    enable_po_number: false,
    enable_customs_code: false,
    enable_additional_ai_context: false,
    enable_atr_processing: false,
    enable_document_preview: true,
    enable_classification: false,
    hide_menu_items: ["export"],
    custom_statuses: ["Accounting Department"],
    export_templates: ["csv_new"],
    sad_context_defaults: "",
    smtp_host: "smtp.gmail.com",
    smtp_port: 587,
    smtp_from_email: "idp@example.com",
    smtp_from_name: "Cortex IDP",
    smtp_use_tls: true,
    smtp_use_ssl: false,
    smtp_timeout_seconds: 10,
    ...overrides,
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("ConfigurationPage", () => {
  it("renders settings and saves edited feature flags", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString()
      if (init?.method === "PUT") {
        return Promise.resolve(
          jsonResponse(settings({ enable_classification: true, hide_menu_items: ["rules"] })),
        )
      }
      if (url.includes("/config/feature-flags")) {
        return Promise.resolve(jsonResponse(settings()))
      }
      return Promise.resolve(jsonResponse({}))
    })
    vi.stubGlobal("fetch", fetchMock)

    render(
      <Wrapper>
        <ConfigurationPage />
      </Wrapper>,
    )

    await screen.findByText("Classification")
    fireEvent.click(screen.getByLabelText("Classification"))
    fireEvent.change(screen.getByLabelText("Hidden menu items"), {
      target: { value: "rules" },
    })
    fireEvent.change(screen.getByLabelText("Custom statuses"), {
      target: { value: "Accepted, Controling Department" },
    })
    fireEvent.change(screen.getByLabelText("Export templates"), {
      target: { value: "standard_xml, sad_xml" },
    })
    fireEvent.change(screen.getByLabelText("SAD context defaults"), {
      target: { value: '{"header":{"decl_customs_off_no":"PL123456"}}' },
    })
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/config/feature-flags",
        expect.objectContaining({ method: "PUT" }),
      )
    })

    const putCall = fetchMock.mock.calls.find(([, init]) => init?.method === "PUT")
    expect(JSON.parse(String(putCall?.[1]?.body))).toMatchObject({
      enable_classification: true,
      hide_menu_items: ["rules"],
      custom_statuses: ["Accepted", "Controling Department"],
      export_templates: ["standard_xml", "sad_xml"],
      sad_context_defaults: '{"header":{"decl_customs_off_no":"PL123456"}}',
    })
  })

  it("loads feature flags from env and updates the form", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString()
      if (init?.method === "POST" && url.includes("/reload-from-env")) {
        return Promise.resolve(jsonResponse(settings({ hide_menu_items: ["rules"] })))
      }
      if (url.includes("/config/feature-flags")) {
        return Promise.resolve(jsonResponse(settings()))
      }
      return Promise.resolve(jsonResponse({}))
    })
    vi.stubGlobal("fetch", fetchMock)

    render(
      <Wrapper>
        <ConfigurationPage />
      </Wrapper>,
    )

    await screen.findByText("Classification")
    fireEvent.click(screen.getByRole("button", { name: /load from env/i }))

    await waitFor(() => {
      const input = screen.getByLabelText("Hidden menu items") as HTMLInputElement
      expect(input.value).toBe("rules")
    })
  })
})
