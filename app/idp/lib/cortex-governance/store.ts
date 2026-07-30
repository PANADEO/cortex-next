import path from "node:path"
import { builtinSkillsDir, resolveAppDataDir } from "@/lib/data-dir"
import type {
  CoworkConnectorConfig,
  CoworkGovernanceConfig,
  CoworkProjectConfig,
  CoworkRole,
} from "@cortex/types"
import {
  DEFAULT_COWORK_PROJECT_ID,
  DEFAULT_DEPARTMENT,
  emptyComposition,
  grantMatches,
} from "@cortex/types"
import { emailsMatch } from "@cortex/utils"
import { readJsonOr, writeJsonAtomic } from "./json-file"

// Governance config store for the cortex-config tile: department tree, skill
// sources, connector catalog, roles (access gates), user assignments and
// project tiles (with composition grants), persisted as one JSON document.
// Real disk instead of module state (Turbopack route isolation), single-writer
// semantics are fine for an on-prem admin panel.

function resolveDataDir(): string {
  return process.env.COWORK_DATA_DIR ?? resolveAppDataDir("cortex-cowork")
}

export const COWORK_DATA_DIR = resolveDataDir()
const CONFIG_FILE = path.join(COWORK_DATA_DIR, "governance.json")

function nowIso(): string {
  return new Date().toISOString()
}

/**
 * First-run seed: one department, the built-in skills as a source, and the
 * legacy cortex-cowork tile composed from that department so existing chat
 * routes work with no manual setup.
 */
function seedConfig(): CoworkGovernanceConfig {
  const createdAt = nowIso()
  return {
    version: 2,
    departments: [DEFAULT_DEPARTMENT],
    skillSources: [
      {
        id: "builtin",
        name: "Wbudowane skille",
        folderPath: builtinSkillsDir(),
        department: DEFAULT_DEPARTMENT,
      },
    ],
    connectors: [],
    roles: [{ id: "analyst", name: "Analyst", description: "Domyślna rola dostępu" }],
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
        composition: {
          skills: { branches: [DEFAULT_DEPARTMENT], leaves: [] },
          connectors: { branches: [], leaves: [] },
          secrets: { branches: [], leaves: [] },
        },
        sandbox: { mode: "local", allowedPaths: [] },
        createdAt,
        updatedAt: createdAt,
      },
    ],
  }
}

// --- v1 -> v2 migration -------------------------------------------------------

interface LegacyProjectConfig extends Omit<CoworkProjectConfig, "composition"> {
  connectors?: CoworkConnectorConfig[]
}
interface LegacyConfig {
  version: 1
  skillGroups?: unknown
  roles?: Array<{ id: string; name: string; description?: string }>
  userAssignments?: Record<string, string[]>
  adminEmails?: string[]
  projects?: LegacyProjectConfig[]
}

/**
 * v1 stored skills as flat groups + role->group entitlement and connectors
 * inline per project. v2 is a departmental catalog + project composition.
 * Migration: everything lands in the default department, each project grants
 * that department's skills and keeps its (now catalog-promoted) connectors.
 */
function migrateV1(legacy: LegacyConfig): CoworkGovernanceConfig {
  const connectors: CoworkConnectorConfig[] = []
  const projects: CoworkProjectConfig[] = (legacy.projects ?? []).map((project) => {
    const inline = project.connectors ?? []
    for (const connector of inline) {
      if (!connectors.some((existing) => existing.id === connector.id)) {
        connectors.push({ ...connector, department: DEFAULT_DEPARTMENT })
      }
    }
    const { connectors: _legacyConnectors, ...rest } = project
    void _legacyConnectors
    return {
      ...rest,
      composition: {
        skills: { branches: [DEFAULT_DEPARTMENT], leaves: [] },
        connectors: { branches: [], leaves: inline.map((connector) => connector.id) },
        secrets: { branches: [], leaves: [] },
      },
    }
  })

  return {
    version: 2,
    departments: [DEFAULT_DEPARTMENT],
    skillSources: [
      {
        id: "builtin",
        name: "Wbudowane skille",
        folderPath: builtinSkillsDir(),
        department: DEFAULT_DEPARTMENT,
      },
    ],
    connectors,
    roles: (legacy.roles ?? []).map((role) => ({
      id: role.id,
      name: role.name,
      ...(role.description ? { description: role.description } : {}),
    })),
    userAssignments: legacy.userAssignments ?? {},
    adminEmails: legacy.adminEmails ?? [],
    projects,
  }
}

// --- persistence --------------------------------------------------------------

export async function readGovernanceConfig(): Promise<CoworkGovernanceConfig> {
  let seeded = false
  const raw = await readJsonOr<CoworkGovernanceConfig | LegacyConfig>(CONFIG_FILE, () => {
    seeded = true
    return seedConfig()
  })
  if (seeded) {
    await writeJsonAtomic(CONFIG_FILE, raw)
    return raw as CoworkGovernanceConfig
  }
  if ((raw as LegacyConfig).version === 1) {
    const migrated = migrateV1(raw as LegacyConfig)
    await writeJsonAtomic(CONFIG_FILE, migrated)
    return migrated
  }
  return raw as CoworkGovernanceConfig
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

// --- access gates -------------------------------------------------------------

/**
 * The "activates on first entry" backbone: until the admin creates the first
 * user->role assignment, governance is OPEN - every user sees every enabled
 * tile. This predicate is the only definition of that rule.
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

/**
 * Admin check with the same bootstrap semantics as role assignments: while
 * adminEmails is empty (fresh install) every authenticated user may
 * administer, so the first admin can bootstrap from the UI. Adding the first
 * email locks the panel down.
 */
export function isAdmin(config: CoworkGovernanceConfig, email: string | undefined): boolean {
  if (isBootstrapAdminMode(config)) return true
  return isExplicitAdmin(config, email)
}

/**
 * Projects a user should see as tiles: enabled, and either open mode, or the
 * user holds one of the project's allowed roles. An EXPLICIT admin sees
 * everything (to reach misconfigured tiles); bootstrap-admin does NOT bypass
 * the role filter once assignments exist.
 *
 * NO IDENTITY MEANS NO PROJECTS. Until 30.07.2026 a missing email fell into
 * the same branch as open mode and returned EVERY enabled project - so an
 * anonymous GET /api/cortex-cowork/projects (oauth2-proxy bypassed) got the
 * names, descriptions and briefs of all of them, in closed mode too. An
 * unidentified caller holds no role assignment, so the role filter must
 * answer with an empty list, not with everything. Open mode is intentionally
 * unaffected: while no assignment exists at all, every enabled project is
 * visible to everyone by design (see isOpenMode).
 */
export function visibleProjectsFor(
  config: CoworkGovernanceConfig,
  email: string | undefined,
): CoworkProjectConfig[] {
  const openMode = isOpenMode(config)
  const explicitAdmin = isExplicitAdmin(config, email)
  return config.projects.filter((project) => {
    if (!project.enabled) return false
    if (openMode || explicitAdmin) return true
    if (!email) return false
    const userRoleIds = new Set(config.userAssignments[email.toLowerCase()] ?? [])
    return project.allowedRoleIds.some((roleId) => userRoleIds.has(roleId))
  })
}

// --- composition resolution (pure; skill catalog resolves on disk elsewhere) --

/** Enabled catalog connectors a project's composition grants. */
export function grantedConnectors(
  config: CoworkGovernanceConfig,
  project: CoworkProjectConfig,
): CoworkConnectorConfig[] {
  return config.connectors.filter(
    (connector) =>
      connector.enabled &&
      grantMatches(project.composition.connectors, {
        id: connector.id,
        department: connector.department,
      }),
  )
}

/** Departments referenced anywhere (explicit list + resource assignments), sorted. */
export function allDepartments(config: CoworkGovernanceConfig): string[] {
  const set = new Set<string>(config.departments)
  for (const source of config.skillSources) set.add(source.department)
  for (const connector of config.connectors) set.add(connector.department)
  return [...set].sort()
}

export { emptyComposition }
