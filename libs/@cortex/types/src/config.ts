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
  enable_document_preview?: boolean
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
  enable_document_preview: boolean
  enable_classification: boolean
  hide_menu_items: string[]
  custom_statuses: string[]
  export_templates: string[]
  sad_context_defaults: string
  smtp_host: string | null
  smtp_port: number
  smtp_from_email: string | null
  smtp_from_name: string
  smtp_use_tls: boolean
  smtp_use_ssl: boolean
  smtp_timeout_seconds: number
}

export type UpdateFeatureFlagSettingsRequest = FeatureFlagSettingsResponse
