// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest"

import type { UpdateFeatureFlagSettingsRequest } from "@cortex/types"
import { buildImportForm, endpoints } from "./endpoints"

function settingsPayload(
  overrides: Partial<UpdateFeatureFlagSettingsRequest> = {},
): UpdateFeatureFlagSettingsRequest {
  return {
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
    enable_imap_import: true,
    enable_import_email_notifications: true,
    hide_menu_items: [],
    custom_statuses: [],
    export_templates: [],
    sad_context_defaults: "",
    smtp_host: null,
    smtp_port: 587,
    smtp_username: null,
    smtp_from_email: null,
    smtp_from_name: "Cortex IDP",
    smtp_use_tls: true,
    smtp_use_ssl: false,
    smtp_timeout_seconds: 10,
    smtp_password_configured: false,
    smtp_password: null,
    imap_host: "imap.example.com",
    imap_port: 993,
    imap_secure: true,
    imap_user: "mailbox@example.com",
    imap_mailbox: "INBOX",
    imap_processed_mailbox: null,
    imap_drafts_mailbox: null,
    imap_poll_limit: 25,
    imap_password_configured: false,
    imap_password: "secret",
    gemini_model: "gemini-pro",
    gemini_fast_model: null,
    gemini_temperature: null,
    gemini_fast_temperature: null,
    gemini_thinking_budget: null,
    ...overrides,
  }
}

describe("buildImportForm", () => {
  it("adds notification fields only when provided", () => {
    const withEmail = buildImportForm({
      file: new File(["zip"], "package.zip", { type: "application/zip" }),
      notification_email: "user@example.com",
      notification_export_template: "sad_xml",
    })
    const withoutEmail = buildImportForm({
      file: new File(["zip"], "package.zip", { type: "application/zip" }),
    })

    expect(withEmail.get("notification_email")).toBe("user@example.com")
    expect(withEmail.get("notification_export_template")).toBe("sad_xml")
    expect(withoutEmail.has("notification_email")).toBe(false)
    expect(withoutEmail.has("notification_export_template")).toBe(false)
  })

  it("adds packaging selection mode when provided", () => {
    const form = buildImportForm({
      file: new File(["zip"], "package.zip", { type: "application/zip" }),
      packaging_selection_mode: "force_pallets",
    })

    expect(form.get("packaging_selection_mode")).toBe("force_pallets")
  })
})

describe("config endpoints", () => {
  it("posts IMAP test payload", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ ok: true, message: "ok" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    )
    vi.stubGlobal("fetch", fetchMock)

    await endpoints.config.testImapConnection(settingsPayload())

    expect(fetchMock).toHaveBeenCalledWith(
      "/config/feature-flags/test-imap",
      expect.objectContaining({ method: "POST" }),
    )
  })

  it("posts SMTP test payload", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ ok: true, message: "ok" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    )
    vi.stubGlobal("fetch", fetchMock)

    await endpoints.config.testSmtpConnection(
      settingsPayload({
        smtp_host: "smtp.example.com",
        smtp_username: "smtp-user@example.com",
        smtp_password: "secret",
      }),
    )

    expect(fetchMock).toHaveBeenCalledWith(
      "/config/feature-flags/test-smtp",
      expect.objectContaining({ method: "POST" }),
    )
  })
})
