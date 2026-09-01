/**
 * IDP API — TypeScript types extracted from openapi.json (v1.0.0).
 * Source of truth: idp-next-prototype/streamlit/openapi.json
 * Target location: libs/@cortex/types/idp.ts
 *
 * Conventions:
 * - ISO-8601 datetimes are typed as `string` (brand later if needed).
 * - Monetary / weight / quantity fields that the API serialises as strings are kept as `string`
 *   (arbitrary precision — do not parseFloat blindly).
 * - `unknown` is used where openapi schema is intentionally open (analysis_result etc.).
 */

// ============================================================================
// 1. Enums
// ============================================================================

export const PACKAGE_STATUS = [
  "imported",
  "imported_with_error",
  "analysing",
  "analysis_failed",
  "ready_for_verification",
  "verification",
  "verified",
] as const
export type PackageStatus = (typeof PACKAGE_STATUS)[number]

export const PACKAGE_TRANSITION = [
  "start_verification",
  "cancel_verification",
  "finish_verification",
  "reset_verification",
  "reprocess",
] as const
export type PackageTransition = (typeof PACKAGE_TRANSITION)[number]

export const PACKAGE_ACTION_TYPE = [
  "imported",
  "imported_with_error",
  "analysing",
  "analysis_failed",
  "ready_for_verification",
  "verification",
  "cancel_verification",
  "verified",
  "reset_verification",
  "seller_updated",
  "buyer_updated",
  "consignor_updated",
  "consignee_updated",
  "invoice_updated",
  "invoice_line_updated",
  "invoice_totals_updated",
  "delivery_terms_updated",
  "transport_info_updated",
] as const
export type PackageActionType = (typeof PACKAGE_ACTION_TYPE)[number]

export const ERROR_CODE = [
  "PACKAGE_DUPLICATE",
  "PACKAGE_NOT_FOUND",
  "FILE_NOT_FOUND",
  "INVALID_PACKAGE_FILE",
  "TRANSITION_NOT_ALLOWED",
  "RESULT_NOT_FOUND",
  "ENTITY_NOT_FOUND",
  "CSV_EXPORT_VALIDATION_FAILED",
] as const
export type ErrorCode = (typeof ERROR_CODE)[number]

export const SORT_ORDER = ["asc", "desc"] as const
export type SortOrder = (typeof SORT_ORDER)[number]

export const PACKAGE_SORT_FIELD = ["created_date", "file_name", "status"] as const
export type PackageSortField = (typeof PACKAGE_SORT_FIELD)[number]

// ============================================================================
// 2. Read Models
// ============================================================================

export interface PackageReadModel {
  id: string
  file_name: string
  file_hash: string
  created_date: string // date-time
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
  /** Extraction payload — shape intentionally untyped in openapi. */
  analysis_result: unknown[] | Record<string, unknown> | null
  /** Human-corrected result — same shape as analysis_result. */
  verified_result: unknown[] | Record<string, unknown> | null
  total_tokens: number | null
  /** Serialised as string to preserve decimal precision. */
  total_cost_usd: string | null
}

export interface PackageActionReadModel {
  id: string
  action_type: PackageActionType
  timestamp: string
  performed_by: string
  /** JSON-string or null; parse on demand. */
  payload: string | null
}

export interface ActionLogReadModel {
  id: string
  package_id: string
  package_file_name: string
  action_type: PackageActionType
  timestamp: string
  performed_by: string
  payload: string | null
}

export interface UserInfoResponse {
  email: string
  has_access: boolean
}

export interface DashboardStatsResponse {
  in_queue: number
  processing: number
  ready_for_verification: number
  in_verification: number
  verified: number
  failed: number
}

export interface PackageActionsResponse {
  package_id: string
  actions: PackageActionReadModel[]
}

export interface PackageTransitionsResponse {
  transitions: PackageTransition[]
}

export interface PackageTransportOrdersResponse {
  package_id: string
  /** Domain shape not in openapi — treat as unknown until TransportOrder type lands. */
  transport_orders: unknown[] | null
  verified_transport_orders: unknown[] | null
}

// ============================================================================
// 3. Request DTOs
// ============================================================================

// ---- Query params ----------------------------------------------------------

export interface GetPackagesQuery {
  limit?: number // 1..100, default 10
  offset?: number // >=0, default 0
  status?: PackageStatus | null // server accepts free string; we constrain client-side
  search?: string | null
  sort_by?: PackageSortField // default 'created_date'
  sort_order?: SortOrder // default 'desc'
  date_from?: string | null // date-time
  date_to?: string | null
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

// ---- Multipart bodies ------------------------------------------------------

export interface ImportPackageBody {
  file: File // multipart binary
}

export interface ImportMultiplePackagesBody {
  files: File[]
}

// ---- Transport-order edit DTOs --------------------------------------------
// All fields optional — these are partial updates. String fields holding numbers
// keep precision.

export interface UpdatePartyRequest {
  name?: string | null
  street?: string | null
  postal_code?: string | null
  city?: string | null
  country_code?: string | null
  vat_id?: string | null
  eori?: string | null
  partner_id?: string | null
}

export interface UpdateTransportInfoRequest {
  transport_order_number?: string | null
  mode?: string | null
  truck_plate?: string | null
  trailer_plate?: string | null
  country_of_dispatch?: string | null
  country_of_destination?: string | null
}

export interface UpdateInvoiceRequest {
  invoice_number?: string | null
  invoice_date?: string | null // API uses string, not date-time format
  invoice_currency?: string | null // ISO 4217 by convention
  country_of_dispatch?: string | null
  country_of_destination?: string | null
}

export interface UpdateInvoiceTotalsRequest {
  total_invoice_value?: string | null // decimal as string
  total_net_weight_kg?: string | null
  total_gross_weight_kg?: string | null
  total_packages_quantity?: string | null
}

export interface UpdateDeliveryTermsRequest {
  incoterms_code?: string | null
  incoterms_place?: string | null
  delivery_area?: string | null
  base_of_delivery?: string | null
}

export interface InvoiceLineUpdateRequest {
  line_id: string // required — addresses the existing line
  line_number?: string | null
  product_code?: string | null
  description?: string | null
  cn_code?: string | null
  quantity?: string | null
  unit_of_measure?: string | null
  invoice_value?: string | null
  net_weight_kg?: string | null
  gross_weight_kg?: string | null
  packages_quantity?: string | null
  packages_type?: string | null
  packages_marking?: string | null
  origin_country?: string | null
}

export interface UpdateInvoiceLinesRequest {
  lines: InvoiceLineUpdateRequest[]
}

// ============================================================================
// 4. Response Wrappers
// ============================================================================

export interface Paginated<T> {
  items: T[]
  total: number
  limit: number
  offset: number
}

export type PaginatedPackageResponse = Paginated<PackageReadModel>
export type PaginatedActionLogResponse = Paginated<ActionLogReadModel>

/** All mutation endpoints return HTTP 200 with an empty object body. */
export type EmptyOk = Record<string, never>

// ============================================================================
// 5. Error shape
// ============================================================================

export interface ErrorResponse {
  error_code: ErrorCode
  message: string
  /** Key/value substitutions used inside `message`; use for i18n. */
  variables?: Record<string, string>
}

export interface ValidationErrorItem {
  loc: Array<string | number>
  msg: string
  type: string
}

export interface HTTPValidationError {
  detail?: ValidationErrorItem[]
}

// ============================================================================
// 6. Header contract
// ============================================================================

/**
 * Every authenticated request must include this header (injected by oauth2-proxy in prod;
 * MSW / local dev must spoof it). Not declared in openapi.json.
 */
export const AUTH_HEADER = "X-Auth-Request-Email"
