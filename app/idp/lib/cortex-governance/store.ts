import { existsSync } from "node:fs"
import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import path from "node:path"
import type {
  CoworkGovernanceConfig,
  CoworkProjectConfig,
  CoworkRole,
  CoworkSkillGroup,
} from "@cortex/types"

// Governance config store for the cortex-config tile: skill groups, roles,
// user assignments and project tiles, persisted as one JSON document on disk.
// Same trade-off as sandbox-store: real disk instead of module state (Turbopack
// route isolation), single-writer semantics are fine for an on-prem admin
// panel. Writes are atomic (tmp file + rename) so a crash mid-write never
// leaves a torn document behind.

// Mirrors okna-czasowe's resolveDataDir: `next <cmd> app/idp` runs with the
// repo root as cwd, so anchor the store under app/idp explicitly.
function resolveDataDir(): string {
  if (process.env.COWORK_DATA_DIR) return process.env.COWORK_DATA_DIR
  const appIdpRelative = path.join(process.cwd(), "app", "idp")
  const base = existsSync(appIdpRelative) ? appIdpRelative : process.cwd()
  return path.join(base, ".data", "cortex-cowork")
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
        id: "cortex-cowork",
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

async function writeConfigFile(config: CoworkGovernanceConfig): Promise<void> {
  await mkdir(COWORK_DATA_DIR, { recursive: true })
  const tmpPath = `${CONFIG_FILE}.tmp`
  await writeFile(tmpPath, JSON.stringify(config, null, 2), "utf8")
  await rename(tmpPath, CONFIG_FILE)
}

export async function readGovernanceConfig(): Promise<CoworkGovernanceConfig> {
  try {
    const raw = await readFile(CONFIG_FILE, "utf8")
    return JSON.parse(raw) as CoworkGovernanceConfig
  } catch (error) {
    const code = (error as { code?: string }).code
    if (code !== "ENOENT") throw error
    const seeded = seedConfig()
    await writeConfigFile(seeded)
    return seeded
  }
}

export async function saveGovernanceConfig(config: CoworkGovernanceConfig): Promise<void> {
  await writeConfigFile(config)
}

export async function getProject(projectId: string): Promise<CoworkProjectConfig | undefined> {
  const config = await readGovernanceConfig()
  return config.projects.find((project) => project.id === projectId)
}

export async function listProjects(): Promise<CoworkProjectConfig[]> {
  const config = await readGovernanceConfig()
  return config.projects
}

export type UpsertProjectInput = Omit<CoworkProjectConfig, "createdAt" | "updatedAt">

export async function upsertProject(input: UpsertProjectInput): Promise<CoworkProjectConfig> {
  const config = await readGovernanceConfig()
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
  await writeConfigFile(config)
  return project
}

export async function deleteProject(projectId: string): Promise<boolean> {
  const config = await readGovernanceConfig()
  const next = config.projects.filter((project) => project.id !== projectId)
  if (next.length === config.projects.length) return false
  config.projects = next
  await writeConfigFile(config)
  return true
}

/** Roles a user holds, resolved from central assignments. */
export function rolesForUser(config: CoworkGovernanceConfig, email: string): CoworkRole[] {
  const roleIds = config.userAssignments[email.toLowerCase()] ?? []
  return config.roles.filter((role) => roleIds.includes(role.id))
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
  const groupIds = new Set(userRoles.flatMap((role) => role.skillGroupIds))
  const skillIds = new Set<string>()
  for (const group of config.skillGroups) {
    if (!groupIds.has(group.id)) continue
    for (const skillId of group.skillIds) skillIds.add(skillId)
  }
  return [...skillIds]
}

/**
 * Skill ids a new session should be provisioned with. Governance activates on
 * first assignment: while no user->role assignments exist at all (fresh
 * install), every user gets the union of skills behind the project's allowed
 * roles, so the tile works out of the box. Once the admin assigns the first
 * role, entitlements are enforced per user.
 */
export function sessionSkillIds(
  config: CoworkGovernanceConfig,
  project: CoworkProjectConfig,
  email: string | undefined,
): string[] {
  const openMode = Object.keys(config.userAssignments).length === 0
  if (openMode || !email) {
    const allowedRoles = config.roles.filter((role) => project.allowedRoleIds.includes(role.id))
    const groupIds = new Set(allowedRoles.flatMap((role) => role.skillGroupIds))
    const skillIds = new Set<string>()
    for (const group of config.skillGroups) {
      if (!groupIds.has(group.id)) continue
      for (const skillId of group.skillIds) skillIds.add(skillId)
    }
    return [...skillIds]
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
  if (config.adminEmails.length === 0) return true
  if (!email) return false
  return config.adminEmails.some((admin) => admin.toLowerCase() === email.toLowerCase())
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
  const openMode = Object.keys(config.userAssignments).length === 0
  const explicitAdmin = Boolean(
    email && config.adminEmails.some((admin) => admin.toLowerCase() === email.toLowerCase()),
  )
  return config.projects.filter((project) => {
    if (!project.enabled) return false
    if (openMode || explicitAdmin || !email) return true
    const userRoleIds = new Set(config.userAssignments[email.toLowerCase()] ?? [])
    return project.allowedRoleIds.some((roleId) => userRoleIds.has(roleId))
  })
}

/** Skill groups referenced by at least one of the given roles. */
export function skillGroupsForRoles(
  config: CoworkGovernanceConfig,
  roles: CoworkRole[],
): CoworkSkillGroup[] {
  const groupIds = new Set(roles.flatMap((role) => role.skillGroupIds))
  return config.skillGroups.filter((group) => groupIds.has(group.id))
}
