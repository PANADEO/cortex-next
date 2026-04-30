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

export interface UserPreferencesResponse {
  document_panel_ratio: number | null
  theme_mode: ThemeMode | null
}

export interface SetUserPreferencesRequest {
  document_panel_ratio?: number | null
  theme_mode?: ThemeMode | null
}
