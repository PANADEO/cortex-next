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
