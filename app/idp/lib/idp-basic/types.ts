export type IdpBasicPackageStatus = "queued" | "processing" | "ready" | "failed"
export type IdpBasicPreviewKind = "pdf" | "image" | "download_only"

export interface IdpBasicDocument {
  id: string
  package_id: string
  file_name: string
  media_type: string
  size_bytes: number
  preview_kind: IdpBasicPreviewKind
  label: string | null
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
  package_received_at: string | null
  package_created_at: string
}

export interface IdpBasicFileListResponse {
  items: IdpBasicFileItem[]
  total: number
  limit: number
  offset: number
}

export interface IdpBasicStats {
  packages_total: number
  queued: number
  processing: number
  ready: number
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
