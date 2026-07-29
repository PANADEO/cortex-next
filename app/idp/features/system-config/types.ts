import type { TileKind } from "@cortex/tile-sdk"

export interface RoleSummary {
  id: string
  code: string
  name: string
  description: string | null
  isSystem: boolean
}

export interface UserWithRoles {
  id: string
  email: string
  fullName: string | null
  isActive: boolean
  roles: RoleSummary[]
}

/** Kształt po stronie klienta: daty przychodzą z API jako stringi ISO, nie Date. */
export interface Application {
  id: string
  code: string
  name: string
  description: string | null
  icon: string | null
  category: string | null
  kind: TileKind
  route: string | null
  url: string | null
  target: string | null
  isActive: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface ApplicationInput {
  code: string
  name: string
  description?: string | null
  icon?: string | null
  category?: string | null
  kind: TileKind
  route?: string | null
  url?: string | null
  target?: "_self" | "_blank" | null
  isActive?: boolean
  sortOrder?: number
}
