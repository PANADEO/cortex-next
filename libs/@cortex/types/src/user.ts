export interface User {
  id: string
  email: string
  name: string
}

export interface UserInfoResponse {
  email: string
  has_access: boolean
}

export const THEME_MODE = ["system", "light", "dark"] as const
export type ThemeMode = (typeof THEME_MODE)[number]

export const INVOICE_LINE_COLUMN_KEYS = [
  "line_number",
  "po_number",
  "product_code",
  "description",
  "description_pl",
  "customs_code",
  "preference_code",
  "atr_documents",
  "quantity",
  "unit_of_measure",
  "invoice_value",
  "net_weight_kg",
  "gross_weight_kg",
  "estimated_gross_weight_kg",
  "packages_quantity",
  "packages_type",
  "packages_marking",
  "origin_country",
] as const
export type InvoiceLineColumnKey = (typeof INVOICE_LINE_COLUMN_KEYS)[number]

export interface UserPreferencesResponse {
  document_panel_ratio: number | null
  theme_mode: ThemeMode | null
  invoice_line_hidden_columns?: InvoiceLineColumnKey[] | null
}

export interface SetUserPreferencesRequest {
  document_panel_ratio?: number | null
  theme_mode?: ThemeMode | null
  invoice_line_hidden_columns?: InvoiceLineColumnKey[] | null
}
