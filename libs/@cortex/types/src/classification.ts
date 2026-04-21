import type { DirtyPackageStatus, DocMode, DocType, SortOrder } from "./enums"
import type { Paginated } from "./pagination"

export interface DirtyDocument {
  id: string
  file_name: string
  media_type: string
  size_bytes: number
  preview_kind: "pdf" | "image" | "download_only"
  page_count: number
  doc_type: DocType
  mode: DocMode
  confidence: number | null
  target_clean_package_id: string | null
  human_reviewed: boolean
  notes: string | null
}

export interface CleanPackageDraft {
  id: string
  name: string
  document_ids: string[]
  customer_tag: string | null
  notes: string | null
}

export interface DirtyPackageReadModel {
  id: string
  name: string
  status: DirtyPackageStatus
  customer_tag: string | null
  created_date: string
  document_count: number
  needs_review_count: number
  promoted_clean_package_ids: string[]
}

export interface DirtyPackageDetailsResponse {
  id: string
  name: string
  status: DirtyPackageStatus
  customer_tag: string | null
  created_date: string
  documents: DirtyDocument[]
  drafts: CleanPackageDraft[]
  last_classification_run_at: string | null
  promoted_clean_package_ids: string[]
}

export interface GetDirtyPackagesQuery {
  limit?: number
  offset?: number
  status?: DirtyPackageStatus | null
  customer_tag?: string | null
  search?: string | null
  sort_by?: "created_date" | "name" | "status"
  sort_order?: SortOrder
}

export interface UpdateDocumentClassificationRequest {
  doc_type?: DocType
  mode?: DocMode
  target_clean_package_id?: string | null
  notes?: string | null
  human_reviewed?: boolean
}

export interface UpsertDraftRequest {
  id?: string | null
  name: string
  customer_tag?: string | null
  notes?: string | null
}

export interface AutoClassifyResponse {
  classification_run_id: string
  documents_updated: number
  drafts_proposed: number
}

export interface PromoteDirtyPackageResponse {
  clean_package_ids: string[]
  skipped_documents: number
}

export type PaginatedDirtyPackageResponse = Paginated<DirtyPackageReadModel>
