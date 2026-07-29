import type { RuleCategory, RuleStatus, RuleTrigger, SortOrder } from "./enums"
import type { Paginated } from "./pagination"

export interface RuleColumnSpec {
  name: string
  description: string
  data_type: "string" | "number" | "boolean" | "date"
}

export interface RuleVersionReadModel {
  version: number
  nl_definition: string
  python_code: string
  output_columns: RuleColumnSpec[]
  created_at: string
  created_by: string
  notes: string | null
}

export interface RuleReadModel {
  id: string
  name: string
  description: string | null
  category: RuleCategory
  status: RuleStatus
  current_version: number
  tags: string[]
  customer_tag: string | null
  trigger: RuleTrigger
  created_at: string
  updated_at: string
  last_run_at: string | null
  attached_package_count: number
}

export interface RuleDetailsResponse {
  id: string
  name: string
  description: string | null
  category: RuleCategory
  status: RuleStatus
  tags: string[]
  customer_tag: string | null
  trigger: RuleTrigger
  current_version: number
  versions: RuleVersionReadModel[]
}

export interface GetRulesQuery {
  limit?: number
  offset?: number
  status?: RuleStatus | null
  category?: RuleCategory | null
  customer_tag?: string | null
  search?: string | null
  sort_by?: "name" | "updated_at" | "last_run_at"
  sort_order?: SortOrder
}

export interface UpsertRuleRequest {
  name: string
  description?: string | null
  category: RuleCategory
  tags?: string[]
  customer_tag?: string | null
  trigger?: RuleTrigger
  status?: RuleStatus
}

export interface CompileRuleRequest {
  nl_definition: string
  rule_id?: string | null
  sample_package_id?: string | null
}

export interface CompileRuleResponse {
  python_code: string
  output_columns: RuleColumnSpec[]
  warnings: string[]
}

export interface ExplainRuleRequest {
  nl_definition: string
  rule_id?: string | null
  sample_package_id?: string | null
}

export interface ExplainRuleResponse {
  is_valid: boolean
  summary: string
  worked_example: string
  affected_columns: string[]
  concerns: string[]
  clarifying_questions: string[]
}

export interface SaveRuleVersionRequest {
  nl_definition: string
  python_code: string
  output_columns: RuleColumnSpec[]
  notes?: string | null
}

export interface RulePreviewRequest {
  python_code: string
  sample_package_id: string
}

export interface RulePreviewRow {
  line_number: number
  before: Record<string, string | number | null>
  after: Record<string, string | number | null>
  changed_columns: string[]
}

export interface RulePreviewResponse {
  rows: RulePreviewRow[]
  added_columns: string[]
  warnings: string[]
  errors: string[]
}

export interface PackageRuleAttachment {
  id: string
  rule_id: string
  rule_name: string
  rule_version: number
  trigger: RuleTrigger
  attached_at: string
  last_executed_at: string | null
  last_status: "success" | "failed" | "pending" | null
}

export interface PackageRuleAttachmentsResponse {
  package_id: string
  attachments: PackageRuleAttachment[]
}

export interface AttachRuleRequest {
  rule_id: string
  trigger?: RuleTrigger
}

export interface RuleTemplateReadModel {
  id: string
  name: string
  description: string
  category: RuleCategory
  example_nl: string
  default_tags: string[]
}

export type PaginatedRuleResponse = Paginated<RuleReadModel>
