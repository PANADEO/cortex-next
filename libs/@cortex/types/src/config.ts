/**
 * Backend feature-flag bundle from `GET /config`.
 *
 * Snake_case to match FastAPI Pydantic. All fields are optional so a backend
 * without a given field still type-checks and the client can fall back to
 * defaults safely.
 */
export interface FeatureFlagsResponse {
  enable_classification?: boolean
  enable_customs_code?: boolean
  enable_atr_processing?: boolean
  hide_menu_items?: string | string[] | null
}
