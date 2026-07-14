import path from "node:path"
import { resolveAppDataDir } from "@/lib/data-dir"
import type {
  CoworkGovernanceConfig,
  CoworkProjectConfig,
  CoworkRole,
} from "@cortex/types"
import { DEFAULT_COWORK_PROJECT_ID } from "@cortex/types"
import { emailsMatch } from "@cortex/utils"
import { readJsonOr, writeJsonAtomic } from "./json-file"

// Governance config store for the cortex-config tile: skill groups, roles,
// user assignments and project tiles, persisted as one JSON document on disk.
// Same trade-off as sandbox-store: real disk instead of module state (Turbopack
// route isolation), single-writer semantics are fine for an on-prem admin
// panel.

function resolveDataDir(): string {
  return process.env.COWORK_DATA_DIR ?? resolveAppDataDir("cortex-cowork")
}

export const COWORK_DATA_DIR = resolveDataDir()
const CONFIG_FILE = path.join(COWORK_DATA_DIR, "governance.json")

function nowIso(): string {
  return new Date().toISOString()
}

/**
 * First-run seed: today's hardcoded cortex-cowork tile becomes the first
 * governed project, so existing chat routes keep working with no manual setup.
 */
function seedConfig(): CoworkGovernanceConfig {
  const createdAt = nowIso()
  return {
    version: 1,
    skillGroups: [
      {
        id: "reporting",
        name: "Reporting",
        description: "Spreadsheet and data-export deliverables",
        skillIds: ["excel-report", "csv-export"],
      },
    ],
    roles: [
      {
        id: "analyst",
        name: "Analyst",
        description: "Default role: full reporting skill set",
        skillGroupIds: ["reporting"],
      },
    ],
    userAssignments: {},
    adminEmails: [],
    projects: [
      {
        id: DEFAULT_COWORK_PROJECT_ID,
        name: "Cortex Cowork",
        description: "Chat with an agent that produces downloadable artifacts in a sandbox.",
        icon: "bot",
        enabled: true,
        archetype: "task-chat",
        allowedRoleIds: ["analyst"],
        model: { provider: "anthropic", modelId: "claude-sonnet-4-5" },
        connectors: [],
        sandbox: { mode: "local", allowedPaths: [] },
        createdAt,
        updatedAt: createdAt,
      },
    ],
  }
}

export async function readGovernanceConfig(): Promise<CoworkGovernanceConfig> {
  let seeded = false
  const config = await readJsonOr<CoworkGovernanceConfig>(CONFIG_FILE, () => {
    seeded = true
    return seedConfig()
  })
  if (seeded) await writeJsonAtomic(CONFIG_FILE, config)
  return config
}

export async function saveGovernanceConfig(config: CoworkGovernanceConfig): Promise<void> {
  await writeJsonAtomic(CONFIG_FILE, config)
}

export async function getProject(projectId: string): Promise<CoworkProjectConfig | undefined> {
  const config = await readGovernanceConfig()
  return config.projects.find((project) => project.id === projectId)
}

export type UpsertProjectInput = Omit<CoworkProjectConfig, "createdAt" | "updatedAt">

/** Pass `preloaded` when the caller already read the config (avoids a re-read). */
export async function upsertProject(
  input: UpsertProjectInput,
  preloaded?: CoworkGovernanceConfig,
): Promise<CoworkProjectConfig> {
  const config = preloaded ?? (await readGovernanceConfig())
  const existing = config.projects.find((project) => project.id === input.id)
  const project: CoworkProjectConfig = {
    ...input,
    createdAt: existing?.createdAt ?? nowIso(),
    updatedAt: nowIso(),
  }
  config.projects = [
    ...config.projects.filter((candidate) => candidate.id !== project.id),
    project,
  ]
  await saveGovernanceConfig(config)
  return project
}

export async function deleteProject(
  projectId: string,
  preloaded?: CoworkGovernanceConfig,
): Promise<boolean> {
  const config = preloaded ?? (await readGovernanceConfig())
  const next = config.projects.filter((project) => project.id !== projectId)
  if (next.length === config.projects.length) return false
  config.projects = next
  await saveGovernanceConfig(config)
  return true
}

/**
 * The "activates on first entry" backbone of this layer: until the admin
 * creates the first user->role assignment, governance is OPEN - every user
 * sees every enabled tile and gets the tile's full skill set. These two
 * predicates are the only definition of that rule.
 */
export function isOpenMode(config: CoworkGovernanceConfig): boolean {
  return Object.keys(config.userAssignments).length === 0
}

function isBootstrapAdminMode(config: CoworkGovernanceConfig): boolean {
  return config.adminEmails.length === 0
}

function isExplicitAdmin(config: CoworkGovernanceConfig, email: string | undefined): boolean {
  return config.adminEmails.some((admin) => emailsMatch(admin, email))
}

/** Roles a user holds, resolved from central assignments. */
export function rolesForUser(config: CoworkGovernanceConfig, email: string): CoworkRole[] {
  const roleIds = config.userAssignments[email.toLowerCase()] ?? []
  return config.roles.filter((role) => roleIds.includes(role.id))
}

/** Union of skill ids granted by a set of roles (via their skill groups). */
function skillIdsForRoles(config: CoworkGovernanceConfig, roles: CoworkRole[]): string[] {
  const groupIds = new Set(roles.flatMap((role) => role.skillGroupIds))
  const skillIds = new Set<string>()
  for (const group of config.skillGroups) {
    if (!groupIds.has(group.id)) continue
    for (const skillId of group.skillIds) skillIds.add(skillId)
  }
  return [...skillIds]
}

/**
 * Effective skill ids for a user inside a project: union of skills from the
 * groups attached to the user's roles, restricted to roles the project allows.
 * Users with no matching role get an empty set - the tile is not for them.
 */
export function effectiveSkillIds(
  config: CoworkGovernanceConfig,
  project: CoworkProjectConfig,
  email: string,
): string[] {
  const userRoles = rolesForUser(config, email).filter((role) =>
    project.allowedRoleIds.includes(role.id),
  )
  return skillIdsForRoles(config, userRoles)
}

/**
 * Skill ids a new session should be provisioned with. In open mode (and for
 * identity-less dev requests) every user gets the union of skills behind the
 * project's allowed roles, so the tile works out of the box; once the admin
 * assigns the first role, entitlements are enforced per user.
 */
export function sessionSkillIds(
  config: CoworkGovernanceConfig,
  project: CoworkProjectConfig,
  email: string | undefined,
): string[] {
  if (isOpenMode(config) || !email) {
    const allowedRoles = config.roles.filter((role) => project.allowedRoleIds.includes(role.id))
    return skillIdsForRoles(config, allowedRoles)
  }
  return effectiveSkillIds(config, project, email)
}

/**
 * Admin check with the same "activates on first entry" semantics as role
 * assignments: while adminEmails is empty (fresh install) every authenticated
 * user may administer, so the first admin can bootstrap themselves from the
 * UI. Adding the first email locks the panel down.
 */
export function isAdmin(config: CoworkGovernanceConfig, email: string | undefined): boolean {
  if (isBootstrapAdminMode(config)) return true
  return isExplicitAdmin(config, email)
}

/**
 * Projects a user should see as tiles: enabled, and either governance is in
 * open mode (no assignments yet), or the user holds one of the project's
 * allowed roles. An EXPLICIT admin (on adminEmails) sees everything so they
 * can reach misconfigured tiles - but bootstrap-admin (empty adminEmails)
 * does NOT bypass the role filter here: once the admin has started assigning
 * roles, a user with a limited role must not still see every tile just
 * because no admin email was set yet.
 */
export function visibleProjectsFor(
  config: CoworkGovernanceConfig,
  email: string | undefined,
): CoworkProjectConfig[] {
  const openMode = isOpenMode(config)
  const explicitAdmin = isExplicitAdmin(config, email)
  return config.projects.filter((project) => {
    if (!project.enabled) return false
    if (openMode || explicitAdmin || !email) return true
    const userRoleIds = new Set(config.userAssignments[email.toLowerCase()] ?? [])
    return project.allowedRoleIds.some((roleId) => userRoleIds.has(roleId))
  })
}
