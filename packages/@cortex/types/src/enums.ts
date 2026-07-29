export const PROCESSING_STATE = [
  "imported",
  "imported_with_error",
  "analysing",
  "analysis_failed",
  "ready",
] as const
export type ProcessingState = (typeof PROCESSING_STATE)[number]

export const VERIFICATION_STATE = ["not_started", "in_progress", "completed"] as const
export type VerificationState = (typeof VERIFICATION_STATE)[number]

export const PACKAGE_TRANSITION = [
  "start_verification",
  "cancel_verification",
  "unlock_verification",
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
  "unlock_verification",
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
  "sad_context_updated",
  "custom_status_updated",
  "user_notes_updated",
  "deleted",
  "restored",
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
  "PERMISSION_DENIED",
  "EMAIL_DELIVERY_NOT_CONFIGURED",
  "EMAIL_DELIVERY_FAILED",
] as const
export type ErrorCode = (typeof ERROR_CODE)[number]

export const SORT_ORDER = ["asc", "desc"] as const
export type SortOrder = (typeof SORT_ORDER)[number]

export const PACKAGE_SORT_FIELD = [
  "created_date",
  "file_name",
  "package_name",
  "processing_state",
] as const
export type PackageSortField = (typeof PACKAGE_SORT_FIELD)[number]

export const DIRTY_PACKAGE_STATUS = [
  "needs_classification",
  "classifying",
  "classified",
  "promoted",
  "archived",
] as const
export type DirtyPackageStatus = (typeof DIRTY_PACKAGE_STATUS)[number]

export const DOC_TYPE = [
  "invoice",
  "packing_list",
  "translation_sheet",
  "code_assignment",
  "bill_of_lading",
  "certificate_of_origin",
  "correspondence",
  "other",
  "skip",
] as const
export type DocType = (typeof DOC_TYPE)[number]

export const DOC_MODE = ["process", "pass_through", "skip"] as const
export type DocMode = (typeof DOC_MODE)[number]

export const RULE_STATUS = ["draft", "active", "archived"] as const
export type RuleStatus = (typeof RULE_STATUS)[number]

export const RULE_CATEGORY = [
  "transport_allocation",
  "aggregation",
  "split",
  "lookup",
  "currency",
  "tax",
  "weight_derivation",
  "custom",
] as const
export type RuleCategory = (typeof RULE_CATEGORY)[number]

export const RULE_TRIGGER = ["manual", "auto_on_extraction"] as const
export type RuleTrigger = (typeof RULE_TRIGGER)[number]
