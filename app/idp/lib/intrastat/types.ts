export type IntrastatTransactionKind = "WNT" | "WDT"
export type IntrastatBatchStatus = "queued" | "processing" | "ready" | "needs_review" | "failed"
export type IntrastatCnMatchStatus =
  | "exact"
  | "prefix_unique"
  | "description_match"
  | "semantic_match"
  | "invoice_cn"
  | "manual"
  | "ambiguous"
  | "unmatched"

export interface IntrastatStats {
  batches_total: number
  queued: number
  processing: number
  ready: number
  needs_review: number
  failed: number
  invoices_total: number
  lines_total: number
  current_resource_rows: number
}

export interface IntrastatSettings {
  filesystem_configured: boolean
  filesystem_enabled: boolean
  intrastat_watch_dir: string | null
  filesystem_poll_interval_seconds: number
  worker_enabled: boolean
  gemini_configured: boolean
  gemini_model: string
  gemini_embedding_model: string
  cn_embedding_enabled: boolean
}

export interface IntrastatBatchSummary {
  id: string
  transaction_kind: IntrastatTransactionKind
  source_type: string
  name: string
  client_name: string | null
  period_month: string | null
  status: IntrastatBatchStatus
  invoice_count: number
  line_count: number
  alert_count: number
  error_message: string | null
  created_at: string
  updated_at: string
}

export interface IntrastatDocument {
  id: string
  batch_id: string
  file_name: string
  media_type: string
  size_bytes: number
  preview_kind: "pdf" | "download_only"
  created_at: string
}

export interface IntrastatBatchDetail extends IntrastatBatchSummary {
  documents: IntrastatDocument[]
}

export interface IntrastatBatchListResponse {
  items: IntrastatBatchSummary[]
  total: number
  limit: number
  offset: number
}

export interface IntrastatBatchFilterOptionsResponse {
  clients: string[]
  months: string[]
}

export interface IntrastatDeclarationLine {
  id: string
  batch_id: string
  invoice_id: string
  lp: number
  transaction_kind: IntrastatTransactionKind
  invoice_number: string
  invoice_date: string | null
  item_index: string
  matched_index: string | null
  matched_fragment: string | null
  cn_code: string | null
  description: string | null
  quantity: number | null
  value: number | null
  currency: string | null
  net_weight: number | null
  origin_country: string | null
  delivery_terms: string | null
  vat_number: string | null
  transaction_code: string
  transport_type: string
  cn_match_status: IntrastatCnMatchStatus
  confidence: number | null
  alerts: string[]
  source_file: string | null
  created_at: string
  updated_at: string
}

export interface IntrastatLineListResponse {
  items: IntrastatDeclarationLine[]
  total: number
  limit: number
  offset: number
}

export interface IntrastatLinePatchRequest {
  cn_code?: string | null
  description?: string | null
  net_weight?: number | null
  origin_country?: string | null
  delivery_terms?: string | null
  vat_number?: string | null
  transaction_code?: string | null
  quantity?: number | null
  value?: number | null
  currency?: string | null
}

export interface IntrastatResourceInfo {
  id: string | null
  file_name: string | null
  row_count: number
  embedding_count: number
  embedding_model: string | null
  created_at: string | null
}

export interface IntrastatResourceUploadResponse {
  id: string
  file_name: string
  row_count: number
  embedding_count: number
  embedding_model: string | null
}

export interface IntrastatCnSuggestion {
  id: string
  index_value: string
  cn8: string | null
  cn: string | null
  description: string | null
}

export interface IntrastatCnSuggestionListResponse {
  items: IntrastatCnSuggestion[]
}

export interface IntrastatUploadResponse {
  id: string
  transaction_kind: IntrastatTransactionKind
  status: IntrastatBatchStatus
  document_count: number
}

export interface IntrastatPollResponse {
  imported: number
}

export interface IntrastatDownload {
  blob: Blob
  filename: string
}
