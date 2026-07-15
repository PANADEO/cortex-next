/**
 * Backend feature-flag bundle from `GET /config`.
 *
 * Snake_case to match FastAPI Pydantic. All fields are optional so a backend
 * without a given field still type-checks and the client can fall back to
 * defaults safely.
 */
export interface FeatureFlagsResponse {
  enable_verification_process?: boolean
  package_custom_statuses?: boolean
  enable_user_notes?: boolean
  enable_po_number?: boolean
  enable_classification?: boolean
  enable_customs_code?: boolean
  enable_additional_ai_context?: boolean
  enable_atr_processing?: boolean
  enable_packaging_selection_mode?: boolean
  enable_document_preview?: boolean
  enable_imap_import?: boolean
  enable_import_email_notifications?: boolean
  hide_menu_items?: string | string[] | null
}

export interface FeatureFlagSettingsResponse {
  enable_verification_process: boolean
  package_custom_statuses: boolean
  enable_user_notes: boolean
  enable_po_number: boolean
  enable_customs_code: boolean
  enable_additional_ai_context: boolean
  enable_atr_processing: boolean
  enable_packaging_selection_mode: boolean
  enable_document_preview: boolean
  enable_classification: boolean
  enable_imap_import: boolean
  enable_import_email_notifications: boolean
  hide_menu_items: string[]
  custom_statuses: string[]
  export_templates: string[]
  sad_context_defaults: string
  smtp_host: string | null
  smtp_port: number
  smtp_username: string | null
  smtp_from_email: string | null
  smtp_from_name: string
  smtp_use_tls: boolean
  smtp_use_ssl: boolean
  smtp_timeout_seconds: number
  smtp_password_configured: boolean
  imap_host: string | null
  imap_port: number
  imap_secure: boolean
  imap_user: string | null
  imap_mailbox: string
  imap_processed_mailbox: string | null
  imap_drafts_mailbox: string | null
  imap_poll_limit: number
  imap_password_configured: boolean
  gemini_model: string
  gemini_fast_model: string | null
  gemini_temperature: number | null
  gemini_fast_temperature: number | null
  gemini_thinking_budget: number | null
}

export type UpdateFeatureFlagSettingsRequest = FeatureFlagSettingsResponse & {
  smtp_password?: string | null
  imap_password?: string | null
}

export interface ImapConnectionTestResponse {
  ok: boolean
  message: string
}

export interface SmtpConnectionTestResponse {
  ok: boolean
  message: string
}
