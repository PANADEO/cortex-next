import type {
  PackageActionType,
  PackageSortField,
  PackageTransition,
  ProcessingState,
  SortOrder,
  VerificationState,
} from "./enums"
import type { Paginated } from "./pagination"

export interface PackageReadModel {
  id: string
  file_name: string
  package_name: string | null
  file_hash: string
  created_date: string
  processing_state: ProcessingState
  verification_state: VerificationState
  assignee: string | null
  uploaded_by: string | null
  custom_status: string | null
  user_notes: string | null
}

export interface PackageDetailsResponse {
  id: string
  file_name: string
  package_name: string | null
  file_hash: string
  file_size_mb: number
  created_date: string
  processing_state: ProcessingState
  verification_state: VerificationState
  assignee: string | null
  uploaded_by: string | null
  custom_status: string | null
  user_notes: string | null
  last_additional_ai_context: string | null
  analysis_result: unknown[] | Record<string, unknown> | null
  verified_result: unknown[] | Record<string, unknown> | null
  total_tokens: number | null
  total_cost_usd: string | null
}

export interface PackageActionReadModel {
  id: string
  action_type: PackageActionType
  timestamp: string
  performed_by: string
  payload: string | null
}

export interface PackageActionsResponse {
  package_id: string
  actions: PackageActionReadModel[]
}

export interface PackageTransitionsResponse {
  transitions: PackageTransition[]
}

export interface DashboardStatsResponse {
  in_queue: number
  processing: number
  ready_for_verification: number
  in_verification: number
  verified: number
  failed: number
}

export interface GetPackagesQuery {
  limit?: number
  offset?: number
  processing_state?: ProcessingState | null
  verification_state?: VerificationState | null
  custom_status?: string | null
  assignee?: string | null
  uploaded_by?: string | null
  search?: string | null
  sort_by?: PackageSortField
  sort_order?: SortOrder
  date_from?: string | null
  date_to?: string | null
}

export interface ImportPackageBody {
  file: File
  package_name?: string | null
  fast_processing?: boolean
  additional_ai_context_enabled?: boolean
  additional_ai_context?: string | null
}

export interface ImportEmailPackageBody {
  file: File
  package_name?: string | null
  fast_processing?: boolean
  additional_ai_context_enabled?: boolean
  additional_ai_context?: string | null
}

export interface ImportMultiplePackagesBody {
  files: File[]
  package_name?: string | null
  fast_processing?: boolean
  additional_ai_context_enabled?: boolean
  additional_ai_context?: string | null
}

export interface ImportPackageResponse {
  id: string
}

export interface ReprocessRequest {
  fast_processing?: boolean
  additional_ai_context_enabled?: boolean
  additional_ai_context?: string | null
}

export interface SetCustomStatusRequest {
  custom_status: string | null
}

export interface SetUserNotesRequest {
  user_notes: string | null
}

export interface SetAdditionalAiContextRequest {
  additional_ai_context: string | null
}

export interface DeletePackagesRequest {
  package_ids: string[]
}

export interface SourceFileReadModel {
  path: string
  file_name: string
  media_type: string
  preview_kind: "pdf" | "image" | "download_only"
  size_bytes: number
}

export interface ExportTemplateInfo {
  name: string
  display_name: string
  format: string
  description: string
}

export interface ExportValidationResponse {
  warnings: Array<Record<string, unknown>>
}

export type PaginatedPackageResponse = Paginated<PackageReadModel>
