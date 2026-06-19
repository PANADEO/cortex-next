export type IdpBasicPackageStatus = "queued" | "processing" | "ready" | "needs_review" | "failed"
export type IdpBasicPreviewKind = "pdf" | "image" | "download_only"
export type IdpBasicDocumentType = "cost_invoice" | "cmr" | "pod" | "transport_order" | "other"
export type IdpBasicCompletenessStatus = "complete" | "incomplete" | "unknown"

export interface IdpBasicExtractedField {
  name: string
  value: string
}

export interface IdpBasicDocument {
  id: string
  package_id: string
  file_name: string
  media_type: string
  size_bytes: number
  preview_kind: IdpBasicPreviewKind
  label: string | null
  document_type: IdpBasicDocumentType | null
  document_reference_number: string | null
  document_date: string | null
  issuer_or_carrier: string | null
  invoice_number: string | null
  cmr_notes: string | null
  ai_alerts: string[]
  extracted_data: IdpBasicExtractedField[]
  confidence: number | null
  summary: string | null
  created_at: string
}

export interface IdpBasicPackageSummary {
  id: string
  subject: string
  sender: string
  received_at: string | null
  status: IdpBasicPackageStatus
  reference_number: string | null
  completeness_status: IdpBasicCompletenessStatus | null
  missing_required: string[]
  missing_optional: string[]
  alerts: string[]
  document_count: number
  created_at: string
  updated_at: string
  error_message: string | null
}

export interface IdpBasicPackageDetail extends IdpBasicPackageSummary {
  message_id: string | null
  documents: IdpBasicDocument[]
}

export interface IdpBasicPackageListResponse {
  items: IdpBasicPackageSummary[]
  total: number
  limit: number
  offset: number
}

export interface IdpBasicFileItem extends IdpBasicDocument {
  package_subject: string
  package_status: IdpBasicPackageStatus
  package_reference_number: string | null
  package_completeness_status: IdpBasicCompletenessStatus | null
  package_received_at: string | null
  package_created_at: string
}

export interface IdpBasicFileListResponse {
  items: IdpBasicFileItem[]
  total: number
  limit: number
  offset: number
}

export interface IdpBasicResultSummary {
  id: string
  reference_number: string | null
  document_count: number
  document_types: IdpBasicDocumentType[]
  completeness_status: IdpBasicCompletenessStatus | null
  missing_required: string[]
  missing_optional: string[]
  alerts: string[]
  received_at: string | null
  sender: string
  subject: string
  status: IdpBasicPackageStatus
  created_at: string
  updated_at: string
  error_message: string | null
}

export interface IdpBasicResultDetail extends IdpBasicResultSummary {
  message_id: string | null
  documents: IdpBasicDocument[]
}

export interface IdpBasicResultListResponse {
  items: IdpBasicResultSummary[]
  total: number
  limit: number
  offset: number
}

export interface IdpBasicStats {
  packages_total: number
  queued: number
  processing: number
  ready: number
  needs_review: number
  failed: number
  documents_total: number
}

export interface IdpBasicSettings {
  mailbox_configured: boolean
  mailbox_enabled: boolean
  imap_host: string | null
  imap_mailbox: string
  poll_interval_seconds: number
  worker_enabled: boolean
  gemini_configured: boolean
  gemini_model: string
}

export interface IdpBasicPollResponse {
  imported: number
}

export type IdpBasicCsvExportSource = "files" | "packages"

export interface IdpBasicCsvExportColumn {
  id: string
  label: string
}

export interface IdpBasicCsvColumnsResponse {
  columns: IdpBasicCsvExportColumn[]
  selected_columns: string[]
}

export interface IdpBasicCsvExportFilters {
  status?: IdpBasicPackageStatus | "all" | null
  search?: string | null
  reference?: string | null
  label?: string | null
  date_from?: string | null
  date_to?: string | null
}

export interface IdpBasicCsvExportRequest extends IdpBasicCsvExportFilters {
  source: IdpBasicCsvExportSource
  columns: string[]
  package_ids?: string[]
}

export interface IdpBasicCsvDownload {
  blob: Blob
  filename: string
}
