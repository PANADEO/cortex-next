/**
 * Backend feature-flag bundle from `GET /config`.
 *
 * Snake_case to match FastAPI Pydantic. All fields are optional so a backend
 * without a given field still type-checks and the client can fall back to
 * defaults safely.
 */
export interface FeatureFlagsResponse {
  enable_classification?: boolean
}
