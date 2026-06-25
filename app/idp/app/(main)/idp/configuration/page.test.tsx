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
    enable_imap_import: false,
    enable_import_email_notifications: true,
    hide_menu_items: ["export"],
    custom_statuses: ["Accounting Department"],
    export_templates: ["csv_new"],
    sad_context_defaults: "",
    smtp_host: "smtp.gmail.com",
    smtp_port: 587,
    smtp_username: "smtp-user@example.com",
    smtp_from_email: "idp@example.com",
    smtp_from_name: "Cortex IDP",
    smtp_use_tls: true,
    smtp_use_ssl: false,
    smtp_timeout_seconds: 10,
    smtp_password_configured: true,
    imap_host: "imap.gmail.com",
    imap_port: 993,
    imap_secure: true,
    imap_user: "idp@example.com",
    imap_mailbox: "INBOX",
    imap_processed_mailbox: "Processed",
    imap_drafts_mailbox: "[Gmail]/Drafts",
    imap_poll_limit: 25,
    imap_password_configured: true,
    gemini_model: "gemini-pro",
    gemini_fast_model: "gemini-fast",
    gemini_temperature: 0.2,
    gemini_fast_temperature: null,
    gemini_thinking_budget: 1024,
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
    fireEvent.change(screen.getByLabelText("SMTP user"), {
      target: { value: "new-smtp-user@example.com" },
    })
    fireEvent.change(screen.getByLabelText("SMTP password (configured)"), {
      target: { value: "new-smtp-secret" },
    })
    fireEvent.change(screen.getByLabelText("Model"), {
      target: { value: "gemini-custom" },
    })
    fireEvent.change(screen.getByLabelText("Fast model"), {
      target: { value: "" },
    })
    fireEvent.change(screen.getByLabelText("Temperature"), {
      target: { value: "0.4" },
    })
    fireEvent.change(screen.getByLabelText("Fast temperature"), {
      target: { value: "" },
    })
    fireEvent.change(screen.getByLabelText("Thinking budget"), {
      target: { value: "-1" },
    })
    fireEvent.click(screen.getByLabelText("IMAP import"))
    fireEvent.click(screen.getByLabelText("Import email notifications"))
    fireEvent.change(screen.getByLabelText("IMAP host"), {
      target: { value: "imap.example.com" },
    })
    fireEvent.change(screen.getByLabelText("IMAP password (configured)"), {
      target: { value: "new-secret" },
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
      gemini_model: "gemini-custom",
      gemini_fast_model: null,
      gemini_temperature: 0.4,
      gemini_fast_temperature: null,
      gemini_thinking_budget: -1,
      smtp_username: "new-smtp-user@example.com",
      smtp_password: "new-smtp-secret",
      enable_imap_import: true,
      enable_import_email_notifications: false,
      imap_host: "imap.example.com",
      imap_password: "new-secret",
    })
  })

  it("loads feature flags from env and updates the form", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString()
      if (init?.method === "POST" && url.includes("/reload-from-env")) {
        return Promise.resolve(
          jsonResponse(settings({ hide_menu_items: ["rules"], gemini_model: "env-model" })),
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
    fireEvent.click(screen.getByRole("button", { name: /load from env/i }))

    await waitFor(() => {
      const input = screen.getByLabelText("Hidden menu items") as HTMLInputElement
      expect(input.value).toBe("rules")
    })
    expect((screen.getByLabelText("Model") as HTMLInputElement).value).toBe("env-model")
  })

  it("tests IMAP connection with current form values", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString()
      if (init?.method === "POST" && url.includes("/test-imap")) {
        return Promise.resolve(jsonResponse({ ok: true, message: "IMAP connection successful." }))
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
    fireEvent.change(screen.getByLabelText("IMAP host"), {
      target: { value: "imap.changed.example.com" },
    })
    fireEvent.change(screen.getByLabelText("IMAP password (configured)"), {
      target: { value: "typed-secret" },
    })
    fireEvent.click(screen.getByRole("button", { name: /test connection/i }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/config/feature-flags/test-imap",
        expect.objectContaining({ method: "POST" }),
      )
    })

    const postCall = fetchMock.mock.calls.find(
      ([url, init]) => String(url).includes("/test-imap") && init?.method === "POST",
    )
    expect(JSON.parse(String(postCall?.[1]?.body))).toMatchObject({
      imap_host: "imap.changed.example.com",
      imap_password: "typed-secret",
    })
  })

  it("tests SMTP connection with current form values", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString()
      if (init?.method === "POST" && url.includes("/test-smtp")) {
        return Promise.resolve(jsonResponse({ ok: true, message: "SMTP connection successful." }))
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
    fireEvent.change(screen.getByLabelText("SMTP host"), {
      target: { value: "smtp.changed.example.com" },
    })
    fireEvent.change(screen.getByLabelText("SMTP password (configured)"), {
      target: { value: "typed-smtp-secret" },
    })
    fireEvent.click(screen.getByRole("button", { name: /test smtp/i }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/config/feature-flags/test-smtp",
        expect.objectContaining({ method: "POST" }),
      )
    })

    const postCall = fetchMock.mock.calls.find(
      ([url, init]) => String(url).includes("/test-smtp") && init?.method === "POST",
    )
    expect(JSON.parse(String(postCall?.[1]?.body))).toMatchObject({
      smtp_host: "smtp.changed.example.com",
      smtp_password: "typed-smtp-secret",
    })
  })
})
