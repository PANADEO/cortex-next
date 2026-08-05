export interface User {
  id: string
  email: string
  name: string
}

/** Odpowiedź ZEWNĘTRZNEGO backendu IDP (`GET /user/me`, osobne repo).
 *  `has_access` i `scopes` są pojęciami tamtego backendu — nie da się ich
 *  odtworzyć z własnego Postgresa, patrz UserIdentityResponse niżej. */
export interface UserInfoResponse {
  email: string
  has_access: boolean
  scopes?: string[]
}

/** Odpowiedź WŁASNEGO endpointu tożsamości (`GET /api/me/identity`): kto jest
 *  zalogowany, ustalone z nagłówka oauth2-proxy + `system_config.users`.
 *  Świadomie rozłączna z UserInfoResponse — niesie wyłącznie to, co własne
 *  źródło naprawdę wie, zamiast udawać kontrakt backendu IDP. */
export interface UserIdentityResponse {
  email: string
  name: string | null
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
