/**
 * Cortex Cowork platform types: configurable task-chat project tiles governed
 * by the cortex-config admin tile. Central governance model:
 *
 *   skill group  = named set of skill ids (e.g. "reporting")
 *   role         = named set of skill groups (e.g. "analyst")
 *   user         = email -> role ids (assignments are central, not per project)
 *   project tile = task-chat instance; access limited to `allowedRoleIds`,
 *                  a user's effective skills = union of skills from their
 *                  roles' groups, filtered to roles the project allows.
 *
 * Persisted by the app's config store (JSON on disk, single-tenant on-prem);
 * the cowork-runner receives only the resolved per-turn slice it needs.
 */

/** Wire protocol families the model provider layer supports. */
export type CoworkModelProvider = "anthropic" | "openai-compatible"

/**
 * Per-project model configuration. `apiKeyRef` is a credential-store path
 * ("key/subkey"); the raw secret never lives in project config nor reaches
 * the browser. `baseUrl` unset = provider's default endpoint. An
 * OpenAI-compatible entry pointed at cortex-proxy is how proxy registration
 * plugs in later without new code paths.
 */
export interface CoworkModelConfig {
  provider: CoworkModelProvider
  modelId: string
  baseUrl?: string
  apiKeyRef?: string
}

export interface CoworkSkillGroup {
  id: string
  name: string
  description?: string
  skillIds: string[]
}

export interface CoworkRole {
  id: string
  name: string
  description?: string
  skillGroupIds: string[]
}

/** Sandbox filesystem exposure for a project (bind-mounts once dockerized). */
export interface CoworkSandboxConfig {
  /** Host paths the agent may read/write, mounted into the sandbox. */
  allowedPaths: string[]
}

export type CoworkConnectorType = "mcp" | "cli"

/**
 * External capability wired into the agent. MCP connectors use Flue's
 * streamable-http/sse client; CLI connectors expose one whitelisted command
 * as an agent tool. Secrets are credential-store refs, never inline values.
 */
export interface CoworkConnectorConfig {
  id: string
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
  /** Role ids that may see and use this tile. Empty = admins only. */
  allowedRoleIds: string[]
  model: CoworkModelConfig
  /** Extra system prompt appended to the base cowork instructions. */
  systemPrompt?: string
  connectors: CoworkConnectorConfig[]
  sandbox: CoworkSandboxConfig
  artifactExport?: CoworkArtifactExportConfig
  createdAt: string
  updatedAt: string
}

/** Root document persisted by the cortex-config store. */
export interface CoworkGovernanceConfig {
  version: 1
  skillGroups: CoworkSkillGroup[]
  roles: CoworkRole[]
  /** email -> role ids */
  userAssignments: Record<string, string[]>
  /** emails with cortex-config admin access */
  adminEmails: string[]
  projects: CoworkProjectConfig[]
}
