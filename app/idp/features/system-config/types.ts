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

/** Kształt zwracany przez POST/PATCH /users — bez ról (te dociąga osobne query,
 *  odświeżane przez invalidateQueries po każdej mutacji). */
export interface UserRecord {
  id: string
  email: string
  fullName: string | null
  isActive: boolean
}

export interface UserInput {
  email: string
  fullName?: string | null
}

export interface UserPatch {
  fullName?: string | null
  isActive?: boolean
}

/** Kształt zwracany przez POST/PATCH /roles. */
export interface RoleRecord {
  id: string
  code: string
  name: string
  description: string | null
  isSystem: boolean
}

export interface RoleInput {
  code: string
  name: string
  description?: string | null
}

export interface RolePatch {
  name?: string
  description?: string | null
}

/** Kształt po stronie klienta: daty przychodzą z API jako stringi ISO, nie Date. */
export interface Application {
  id: string
  code: string
  name: string
  description: string | null
  icon: string | null
  kind: TileKind
  route: string | null
  url: string | null
  target: string | null
  isActive: boolean
  sortOrder: number
  // Hub-render (Krok 1/3, PROJECT/cortex-frontend-hub-db-driven-projekt.md).
  showOnHub: boolean
  color: string | null
  categoryFunctional: string | null
  /** W UI: po prostu "Kategoria" (zakładka „Działy” na hubie) — nazwa pola
   *  została jak w bazie, patrz komentarz przy kolumnie w @cortex/db. */
  categoryDepartment: string[] | null
  // NULL = zarejestrowany manifestem, nigdy nie aktywowany w tej instancji.
  activatedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface ApplicationInput {
  code: string
  name: string
  description?: string | null
  icon?: string | null
  kind: TileKind
  route?: string | null
  url?: string | null
  target?: "_self" | "_blank" | null
  isActive?: boolean
  sortOrder?: number
  showOnHub?: boolean
  color?: string | null
  categoryFunctional?: string | null
  categoryDepartment?: string[] | null
}

/** PATCH przyjmuje wyłącznie zmieniane pola (`applicationPatchSchema` w
 *  serwisie) — reguły międzypolowe (natywny ↔ route, embed ↔ url) walidowane
 *  są po scaleniu z wierszem w bazie, nie tutaj. */
export type ApplicationPatch = Partial<ApplicationInput>

/** Katalog zakresów granularnych jednej aplikacji (D8: definiowany przez kod
 *  modułu/seed, nie tworzony z UI — `code` jest wyłącznie do wyświetlenia). */
export interface ApplicationScope {
  id: string
  code: string
  name: string
}

/** Wyłącznie etykieta jest edytowalna z tego panelu. */
export interface ApplicationScopePatch {
  name: string
}

/** Jeden wpis macierzy = jeden zakres + komplet ról, które go dziś mają
 *  (pusta lista, nie brak wpisu, gdy zakres bez żadnego grantu). */
export interface ApplicationScopeGrant {
  scopeId: string
  roleIds: string[]
}

// ── Synchronizacja rola -> grupa OpenWebUI ──────────────────────
// (PROJECT/cortex-frontend-sync-uprawnien-openwebui-projekt.md, Wariant A —
// decyzja Alexa 31.07.2026: klucz mapowania to ROLA, nie aplikacja.)

export interface OpenwebuiSyncResult {
  status: "ok" | "skipped" | "failed"
  message?: string
}

export interface OpenwebuiGroupMapping {
  groupId: string
  groupName: string
  lastSyncedAt: string | null
  lastSyncError: string | null
}

export interface OpenwebuiGroupSummary {
  id: string
  name: string
}

/** Podgląd BEZ zapisu (R2) — co zrobiłoby najbliższe "Synchronizuj teraz". */
export type OpenwebuiRoleGroupPreview =
  | { status: "ok"; groupName: string; targetCount: number; toAdd: number; toRemove: number }
  | { status: "skipped" }
  | { status: "failed"; message?: string }

export interface OpenwebuiRoleGroupState {
  mapping: OpenwebuiGroupMapping | null
  /** `false` = OPENWEBUI_URL/OPENWEBUI_ADMIN_TOKEN nieustawione w tej instancji. */
  configured: boolean
  availableGroups: OpenwebuiGroupSummary[] | null
  preview?: OpenwebuiRoleGroupPreview
}

export type AttachOpenwebuiGroupInput =
  { action: "create" } | { action: "existing"; groupId: string }

/** Wygląd narzucony instancji. `preset: null` = nic nie narzuca, czyli
 *  rozstrzyga wybór użytkownika, a po nim `DEFAULT_PRESET`. */
export interface InstanceAppearance {
  preset: string | null
}
