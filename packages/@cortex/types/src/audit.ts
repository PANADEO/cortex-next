import type { PackageActionType, SortOrder } from "./enums"
import type { Paginated } from "./pagination"

export interface ActionLogReadModel {
  id: string
  package_id: string
  package_file_name: string
  action_type: PackageActionType
  timestamp: string
  performed_by: string
  payload: string | null
}

export interface GetActionLogsQuery {
  limit?: number
  offset?: number
  action_type?: PackageActionType | null
  performed_by?: string | null
  date_from?: string | null
  date_to?: string | null
  sort_order?: SortOrder
}

export type PaginatedActionLogResponse = Paginated<ActionLogReadModel>
