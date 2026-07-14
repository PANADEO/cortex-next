/**
 * Cortex Cowork platform types: configurable task-chat project tiles governed
 * by the cortex-config admin tile.
 *
 * Central model — one departmental resource catalog, composed into projects:
 *
 *   departments  = a tree of org paths ("finanse", "finanse/kontroling")
 *   resources    = skills / connectors / secrets, each attached to a department
 *   project tile = task-chat instance that COMPOSES resources by granting
 *                  department branches (everything under) or specific leaves,
 *                  per resource kind. The composition IS the project's toolkit.
 *   role         = a pure ACCESS GATE: which users may open which project tiles
 *                  (email -> roles, project -> allowed roles). Roles no longer
 *                  carry skills - the project composition defines the toolkit.
 *
 * Persisted by the app's config store (JSON on disk, single-tenant on-prem);
 * the cowork-runner receives only the resolved per-turn slice it needs.
 */

/** Wire protocol families the model provider layer supports. */
export type CoworkModelProvider = "anthropic" | "openai-compatible"

/** Seeded first project; also the fallback for pre-governance session metadata. */
export const DEFAULT_COWORK_PROJECT_ID = "cortex-cowork"

/** Default department the built-in resources are seeded under. */
export const DEFAULT_DEPARTMENT = "wspolne"

/** One slug rule for project/role/department-segment ids, client AND server. */
export const COWORK_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,62}$/

/** Department path: slash-separated slugs, e.g. "finanse/kontroling". */
export const COWORK_DEPARTMENT_PATTERN = /^[a-z0-9][a-z0-9-]*(\/[a-z0-9][a-z0-9-]*)*$/

/**
 * Per-project model configuration. `apiKeyRef` is a credential-store path
 * ("dept/key/subkey"); the raw secret never lives in project config nor
 * reaches the browser. `baseUrl` unset = provider's default endpoint. An
 * OpenAI-compatible entry pointed at cortex-proxy is how proxy registration
 * plugs in later without new code paths.
 */
export interface CoworkModelConfig {
  provider: CoworkModelProvider
  modelId: string
  baseUrl?: string
  apiKeyRef?: string
}

export type CoworkSandboxMode = "local" | "docker"

/**
 * Sandbox execution and filesystem exposure for a project. "docker" runs each
 * harness in a container where `allowedPaths` become bind-mounts (":ro"
 * suffix = read-only) - hard deny-by-default isolation. "local" executes on
 * the host with directory-level separation only; allowedPaths are then just
 * prompt-level hints. A docker project never silently degrades to local.
 */
export interface CoworkSandboxConfig {
  mode: CoworkSandboxMode
  /** Host paths the agent may access; mounted into the container in docker mode. */
  allowedPaths: string[]
}

export type CoworkConnectorType = "mcp" | "cli"

/**
 * External capability in the catalog, attached to a department. MCP connectors
 * use Flue's streamable-http/sse client; CLI connectors expose one whitelisted
 * command as an agent tool. Secrets are credential-store refs, never inline
 * values. Projects pull connectors in via composition grants.
 */
export interface CoworkConnectorConfig {
  id: string
  /** Department path this connector belongs to. */
  department: string
  type: CoworkConnectorType
  name: string
  description?: string
  enabled: boolean
  /** MCP: server endpoint URL. CLI: absolute path to the executable. */
  target: string
  /** MCP: header name -> credential ref. CLI: env var name -> credential ref. */
  credentialRefs?: Record<string, string>
  /** CLI only: fixed arguments always prepended to invocations. */
  baseArgs?: string[]
}

/**
 * A skill source: a folder on disk whose "<dir>/SKILL.md" packages are
 * attached to one department. Adding a customer's skills = adding a source.
 */
export interface CoworkSkillSource {
  id: string
  name: string
  /** Absolute path to a folder containing `<skill>/SKILL.md` subdirectories. */
  folderPath: string
  /** Department the discovered skills are attached to. */
  department: string
}

/** A skill discovered from a source, placed in the department tree (derived). */
export interface CoworkCatalogSkill {
  id: string
  name: string
  description: string
  department: string
  sourceId: string
}

export type CoworkResourceKind = "skill" | "connector" | "secret"

/**
 * A composition grant for one resource kind: department branches (pull every
 * resource at or under the path) plus specific leaves (resource ids, or
 * credential paths for secrets). Additive - the "klocki" a project assembles.
 */
export interface CoworkResourceGrant {
  branches: string[]
  leaves: string[]
}

export interface CoworkProjectComposition {
  skills: CoworkResourceGrant
  connectors: CoworkResourceGrant
  secrets: CoworkResourceGrant
}

/** Where artifact export drops files and what path users see for it. */
export interface CoworkArtifactExportConfig {
  /** Server-local directory (typically a mounted network share). */
  exportDir: string
  /** User-facing path shown for copy-paste (e.g. a UNC path). */
  displayPath?: string
}

export type CoworkTileArchetype = "agent-config" | "dashboard" | "task-chat"

/** One configurable task-chat project tile. */
export interface CoworkProjectConfig {
  id: string
  name: string
  description: string
  /** lucide-react icon name rendered on the tile card. */
  icon?: string
  enabled: boolean
  archetype: "task-chat"
  /** Role ids that may see and open this tile. Empty = admins only. */
  allowedRoleIds: string[]
  model: CoworkModelConfig
  /** Extra system prompt appended to the base cowork instructions. */
  systemPrompt?: string
  /** Resources this project is built from (skills/connectors/secrets). */
  composition: CoworkProjectComposition
  sandbox: CoworkSandboxConfig
  artifactExport?: CoworkArtifactExportConfig
  createdAt: string
  updatedAt: string
}

/** Role = pure access gate (no skills). */
export interface CoworkRole {
  id: string
  name: string
  description?: string
}

/** Presentation-only project meta served to every authenticated user (hub tiles). */
export interface CoworkProjectTileInfo {
  id: string
  name: string
  description: string
  icon?: string
  /** True when the project has an export share configured (drives export UI). */
  exportEnabled: boolean
}

/** Response of the artifact export endpoint. */
export interface CoworkArtifactExportResult {
  /** Server-local absolute path the file was copied to. */
  exportedPath: string
  /** Path shown to the user for copy-paste (UNC / network path), or the server path. */
  displayPath: string
}

/** Root document persisted by the cortex-config store. */
export interface CoworkGovernanceConfig {
  version: 2
  /** Department tree as an explicit path list (resources may add implicit ones). */
  departments: string[]
  /** Skill sources (folder -> department); scanned to build the skill catalog. */
  skillSources: CoworkSkillSource[]
  /** Connector catalog (each attached to a department). */
  connectors: CoworkConnectorConfig[]
  /** Access-gate roles. */
  roles: CoworkRole[]
  /** email -> role ids */
  userAssignments: Record<string, string[]>
  /** emails with cortex-config admin access */
  adminEmails: string[]
  projects: CoworkProjectConfig[]
}

/** An empty composition (grants nothing) - default for a new project. */
export function emptyComposition(): CoworkProjectComposition {
  return {
    skills: { branches: [], leaves: [] },
    connectors: { branches: [], leaves: [] },
    secrets: { branches: [], leaves: [] },
  }
}

/** Whether `department` is at or under `branch` in the department tree. */
export function departmentUnder(department: string, branch: string): boolean {
  return department === branch || department.startsWith(`${branch}/`)
}

/** Whether a resource (by department + id) is pulled in by a grant. */
export function grantMatches(
  grant: CoworkResourceGrant,
  resource: { id: string; department: string },
): boolean {
  if (grant.leaves.includes(resource.id)) return true
  return grant.branches.some((branch) => departmentUnder(resource.department, branch))
}

/** Whether a credential path is granted (leaf match or under a granted branch). */
export function secretPathGranted(grant: CoworkResourceGrant, credentialPath: string): boolean {
  if (grant.leaves.includes(credentialPath)) return true
  return grant.branches.some(
    (branch) => credentialPath === branch || credentialPath.startsWith(`${branch}/`),
  )
}
