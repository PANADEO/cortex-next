import type {
  PackageActionType,
  PackageSortField,
  PackageStatus,
  PackageTransition,
  SortOrder,
} from "./enums"
import type { Paginated } from "./pagination"

export interface PackageReadModel {
  id: string
  file_name: string
  file_hash: string
  created_date: string
  status: PackageStatus
  assignee: string | null
}

export interface PackageDetailsResponse {
  id: string
  file_name: string
  file_hash: string
  file_size_mb: number
  created_date: string
  status: PackageStatus
  assignee: string | null
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
  status?: PackageStatus | null
  search?: string | null
  sort_by?: PackageSortField
  sort_order?: SortOrder
  date_from?: string | null
  date_to?: string | null
}

export interface ImportPackageBody {
  file: File
}

export interface ImportMultiplePackagesBody {
  files: File[]
}

export type PaginatedPackageResponse = Paginated<PackageReadModel>
