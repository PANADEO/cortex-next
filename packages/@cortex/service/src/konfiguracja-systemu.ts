// Logika modułu Konfiguracja Systemu (code-service). Kontrolery w
// app/idp/app/api/konfiguracja-systemu/** tylko walidują wejście i wołają to.
// Zero surowego SQL poza tym plikiem i rbac-store.ts — dostęp przez Drizzle.

import {
  applications,
  getDb,
  permissionsMatrix,
  roles,
  userRoles,
  users,
  type ApplicationRow,
} from "@cortex/db"
import { TileKind } from "@cortex/tile-sdk"
import { asc, eq, inArray } from "drizzle-orm"
import { z } from "zod"

export const ADMIN_ROLE_CODE = "admin"
export const KONFIGURACJA_SYSTEMU_APP_CODE = "konfiguracja-systemu"

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

/** Kafelek natywny opisuje `route`; zewnętrzny/iframe opisuje `url`.
 *  Ten sam niezmiennik jest wymuszony check constraintem w bazie — walidacja
 *  tutaj daje czytelny błąd 400 zamiast błędu Postgresa. */
export const applicationInputSchema = z
  .object({
    code: z
      .string()
      .min(1)
      .max(64)
      .regex(/^[a-z0-9-]+$/, "Kod może zawierać tylko małe litery, cyfry i myślnik"),
    name: z.string().min(1).max(120),
    description: z.string().max(500).nullish(),
    icon: z.string().max(64).nullish(),
    category: z.string().max(64).nullish(),
    kind: TileKind,
    route: z.string().max(200).nullish(),
    url: z.string().url().max(500).nullish(),
    target: z.enum(["_self", "_blank"]).nullish(),
    isActive: z.boolean().optional(),
    sortOrder: z.number().int().min(0).max(10_000).optional(),
  })
  .refine((value) => (value.kind === "native" ? Boolean(value.route) : true), {
    message: "Kafelek natywny wymaga pola route",
    path: ["route"],
  })
  .refine((value) => (value.kind === "native" ? !value.url : true), {
    message: "Kafelek natywny nie może mieć url",
    path: ["url"],
  })
  .refine((value) => (value.kind === "native" ? true : Boolean(value.url)), {
    message: "Kafelek zewnętrzny wymaga pola url",
    path: ["url"],
  })
  .refine((value) => (value.kind === "native" ? true : !value.route), {
    message: "Kafelek zewnętrzny nie może mieć route",
    path: ["route"],
  })

export type ApplicationInput = z.infer<typeof applicationInputSchema>

export async function listUsers(): Promise<UserWithRoles[]> {
  const db = getDb()

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      isActive: users.isActive,
      roleId: roles.id,
      roleCode: roles.code,
      roleName: roles.name,
      roleDescription: roles.description,
      roleIsSystem: roles.isSystem,
    })
    .from(users)
    .leftJoin(userRoles, eq(userRoles.userId, users.id))
    .leftJoin(roles, eq(roles.id, userRoles.roleId))
    .orderBy(asc(users.email))

  const byId = new Map<string, UserWithRoles>()
  for (const row of rows) {
    const existing = byId.get(row.id)
    const user =
      existing ??
      ({
        id: row.id,
        email: row.email,
        fullName: row.fullName,
        isActive: row.isActive,
        roles: [],
      } satisfies UserWithRoles)

    if (!existing) byId.set(row.id, user)

    if (row.roleId && row.roleCode && row.roleName !== null) {
      user.roles.push({
        id: row.roleId,
        code: row.roleCode,
        name: row.roleName,
        description: row.roleDescription,
        isSystem: row.roleIsSystem ?? false,
      })
    }
  }

  return [...byId.values()]
}

export async function listRoles(): Promise<RoleSummary[]> {
  const rows = await getDb()
    .select({
      id: roles.id,
      code: roles.code,
      name: roles.name,
      description: roles.description,
      isSystem: roles.isSystem,
    })
    .from(roles)
    .orderBy(asc(roles.code))

  return rows
}

/**
 * Ustawia komplet ról użytkownika (zastępuje, nie dokłada).
 * W transakcji — inaczej nieudany insert zostawiłby użytkownika bez ról.
 */
export async function setUserRoles(userId: string, roleIds: string[]): Promise<void> {
  const db = getDb()

  await db.transaction(async (tx) => {
    const [user] = await tx.select({ id: users.id }).from(users).where(eq(users.id, userId))
    if (!user) throw new UnknownUserError(userId)

    if (roleIds.length > 0) {
      const existing = await tx.select({ id: roles.id }).from(roles).where(inArray(roles.id, roleIds))
      if (existing.length !== roleIds.length) throw new UnknownRoleError()
    }

    await tx.delete(userRoles).where(eq(userRoles.userId, userId))
    if (roleIds.length > 0) {
      await tx.insert(userRoles).values(roleIds.map((roleId) => ({ userId, roleId })))
    }
  })
}

export async function listApplications(): Promise<ApplicationRow[]> {
  return getDb()
    .select()
    .from(applications)
    .orderBy(asc(applications.sortOrder), asc(applications.code))
}

export async function createApplication(input: ApplicationInput): Promise<ApplicationRow> {
  const [created] = await getDb()
    .insert(applications)
    .values(toApplicationValues(input))
    .returning()

  return created as ApplicationRow
}

export async function updateApplication(
  id: string,
  input: ApplicationInput,
): Promise<ApplicationRow | null> {
  const [updated] = await getDb()
    .update(applications)
    .set({ ...toApplicationValues(input), updatedAt: new Date() })
    .where(eq(applications.id, id))
    .returning()

  return updated ?? null
}

export async function deleteApplication(id: string): Promise<boolean> {
  const deleted = await getDb().delete(applications).where(eq(applications.id, id)).returning()
  return deleted.length > 0
}

/** Granty roli do kafelków (warstwa gruboziarnista). */
export async function setRoleApplications(roleId: string, applicationIds: string[]): Promise<void> {
  const db = getDb()

  await db.transaction(async (tx) => {
    const [role] = await tx.select({ id: roles.id }).from(roles).where(eq(roles.id, roleId))
    if (!role) throw new UnknownRoleError()

    await tx.delete(permissionsMatrix).where(eq(permissionsMatrix.roleId, roleId))
    if (applicationIds.length > 0) {
      await tx
        .insert(permissionsMatrix)
        .values(applicationIds.map((applicationId) => ({ roleId, applicationId })))
    }
  })
}

export class UnknownUserError extends Error {
  constructor(userId: string) {
    super(`Nie ma użytkownika o id ${userId}`)
    this.name = "UnknownUserError"
  }
}

export class UnknownRoleError extends Error {
  constructor() {
    super("Co najmniej jedna ze wskazanych ról nie istnieje")
    this.name = "UnknownRoleError"
  }
}

function toApplicationValues(input: ApplicationInput) {
  const isNative = input.kind === "native"
  return {
    code: input.code,
    name: input.name,
    description: input.description ?? null,
    icon: input.icon ?? null,
    category: input.category ?? null,
    kind: input.kind,
    route: isNative ? (input.route ?? null) : null,
    url: isNative ? null : (input.url ?? null),
    target: input.target ?? null,
    isActive: input.isActive ?? true,
    sortOrder: input.sortOrder ?? 0,
  }
}
