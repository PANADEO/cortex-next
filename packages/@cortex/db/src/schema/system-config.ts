// Schemat modułu Konfiguracja Systemu — port funkcji cortex-admin do środka
// monolitu. Jedna baza Postgres, schema-per-moduł (docs/database.md).
//
// Siedem tabel, OBIE warstwy uprawnień naraz (code-db/REFERENCE.md):
//   - gruboziarnista: permissions_matrix (rola ma dostęp do kafelka albo nie),
//   - granularna: application_scopes + role_application_scopes (akcje w kafelku).
// To nie duplikat — cortex-admin ma obie i obie są używane.
//
// `applications` jest jednocześnie katalogiem uprawnień i REJESTREM KAFELKÓW
// (rozszerzenie względem cortex-admin: kind/route/url/target/icon/category).
// Jedno źródło prawdy — dokładnie po to, żeby nie dało się rozjechać kodu
// z bazą, jak w starym cortex-box-prototype/services-config.json.

import { sql } from "drizzle-orm"
import {
  boolean,
  check,
  index,
  integer,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core"

export const systemConfig = pgSchema("system_config")

/** Dozwolone wartości `applications.kind`. Musi odpowiadać TileKind
 *  z @cortex/tile-sdk — pilnuje tego test system-config.test.ts. */
export const APPLICATION_KINDS = ["native", "external-link", "iframe"] as const
export type ApplicationKind = (typeof APPLICATION_KINDS)[number]

const createdAt = timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
const updatedAt = timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
const grantedAt = timestamp("granted_at", { withTimezone: true }).notNull().defaultNow()

export const users = systemConfig.table("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Zawsze zapisywany lowercase — dopasowanie e-maili jest case-insensitive.
  email: text("email").notNull().unique(),
  fullName: text("full_name"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt,
  updatedAt,
})

export const roles = systemConfig.table("roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  // Rola systemowa (np. admin) — chroniona przed usunięciem, wzorem cortex-admin.
  isSystem: boolean("is_system").notNull().default(false),
  createdAt,
  updatedAt,
})

export const userRoles = systemConfig.table(
  "user_roles",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    grantedAt,
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.roleId] }),
    // Klucz złożony pokrywa odczyt po user_id; "kto ma tę rolę" (i kaskada przy
    // usuwaniu roli) idzie po drugiej kolumnie i potrzebuje własnego indeksu.
    byRole: index("user_roles_role_id_idx").on(table.roleId),
  }),
)

export const applications = systemConfig.table(
  "applications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Entitlement code — to po nim pyta requireTileAccess().
    code: text("code").notNull().unique(),
    name: text("name").notNull(),
    description: text("description"),
    // Nazwa ikony lucide-react, nie ścieżka do pliku.
    icon: text("icon"),
    category: text("category"),
    kind: text("kind").notNull().default("native"),
    // native -> route (ścieżka w tym appie); external-link/iframe -> url.
    route: text("route"),
    url: text("url"),
    target: text("target"),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt,
    updatedAt,
  },
  (table) => ({
    kindAllowed: check(
      "applications_kind_allowed",
      sql`${table.kind} in ('native', 'external-link', 'iframe')`,
    ),
    // Niezmiennik pilnowany w bazie, nie tylko w formularzu: kafelek natywny ma
    // route i nie ma url; zewnętrzny/iframe odwrotnie.
    kindShape: check(
      "applications_kind_shape",
      sql`(${table.kind} = 'native' and ${table.route} is not null and ${table.url} is null)
          or (${table.kind} <> 'native' and ${table.url} is not null and ${table.route} is null)`,
    ),
    // Tak samo jak `kind`: dozwolone wartości pilnuje baza, nie tylko Zod.
    targetAllowed: check(
      "applications_target_allowed",
      sql`${table.target} is null or ${table.target} in ('_self', '_blank')`,
    ),
  }),
)

/** Gruboziarnisty grant: rola ma dostęp do aplikacji (kafelka) albo nie.
 *  Odpowiednik permissions_matrix z cortex-admin. */
export const permissionsMatrix = systemConfig.table(
  "permissions_matrix",
  {
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    grantedAt,
  },
  (table) => ({
    pk: primaryKey({ columns: [table.roleId, table.applicationId] }),
    // "które role mają dostęp do tej aplikacji" — ekran szczegółów aplikacji
    // i kaskada przy usuwaniu aplikacji czytają po tej kolumnie.
    byApplication: index("permissions_matrix_application_id_idx").on(table.applicationId),
  }),
)

/** Akcje możliwe w ramach jednej aplikacji (np. view/edit/generate). */
export const applicationScopes = systemConfig.table(
  "application_scopes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    name: text("name").notNull(),
    createdAt,
  },
  (table) => ({
    uniqueScopePerApplication: unique("application_scopes_application_code_unique").on(
      table.applicationId,
      table.code,
    ),
  }),
)

/** Granularny grant: rola ma konkretną akcję w konkretnej aplikacji. */
export const roleApplicationScopes = systemConfig.table(
  "role_application_scopes",
  {
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    applicationScopeId: uuid("application_scope_id")
      .notNull()
      .references(() => applicationScopes.id, { onDelete: "cascade" }),
    grantedAt,
  },
  (table) => ({
    pk: primaryKey({ columns: [table.roleId, table.applicationScopeId] }),
  }),
)

export type UserRow = typeof users.$inferSelect
export type RoleRow = typeof roles.$inferSelect
export type ApplicationRow = typeof applications.$inferSelect
export type ApplicationScopeRow = typeof applicationScopes.$inferSelect
