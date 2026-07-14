import type { UpsertProjectInput } from "@/lib/cortex-governance/store"
import type {
  CoworkConnectorConfig,
  CoworkModelConfig,
  CoworkProjectConfig,
} from "@cortex/types"

// Server-side validation for project create/update bodies. Kept as plain
// checks (not Zod) to match the other BFF routes in this app - the client
// forms carry the Zod layer.

const PROJECT_ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,62}$/

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
}

function isModelConfig(value: unknown): value is CoworkModelConfig {
  if (typeof value !== "object" || value === null) return false
  const model = value as CoworkModelConfig
  if (model.provider !== "anthropic" && model.provider !== "openai-compatible") return false
  if (typeof model.modelId !== "string" || model.modelId.length === 0) return false
  if (model.provider === "openai-compatible" && !model.baseUrl) return false
  return true
}

function isConnector(value: unknown): value is CoworkConnectorConfig {
  if (typeof value !== "object" || value === null) return false
  const connector = value as CoworkConnectorConfig
  return (
    typeof connector.id === "string" &&
    (connector.type === "mcp" || connector.type === "cli") &&
    typeof connector.name === "string" &&
    typeof connector.enabled === "boolean" &&
    typeof connector.target === "string"
  )
}

export type ParsedProject = { value: UpsertProjectInput } | { error: string }

export function parseProjectBody(body: unknown): ParsedProject {
  if (typeof body !== "object" || body === null) return { error: "Invalid JSON body" }
  const input = body as Partial<CoworkProjectConfig>

  if (!input.id || !PROJECT_ID_PATTERN.test(input.id)) {
    return { error: "id must be a lowercase slug (a-z, 0-9, hyphens)" }
  }
  if (!input.name || typeof input.name !== "string") return { error: "name is required" }
  if (typeof input.description !== "string") return { error: "description is required" }
  if (typeof input.enabled !== "boolean") return { error: "enabled must be a boolean" }
  if (input.archetype !== "task-chat") return { error: 'archetype must be "task-chat"' }
  if (!isStringArray(input.allowedRoleIds)) return { error: "allowedRoleIds must be a string array" }
  if (!isModelConfig(input.model)) {
    return { error: "model needs provider (anthropic | openai-compatible), modelId, and baseUrl for openai-compatible" }
  }
  if (!Array.isArray(input.connectors) || !input.connectors.every(isConnector)) {
    return { error: "connectors must be an array of connector configs" }
  }
  if (
    typeof input.sandbox !== "object" ||
    input.sandbox === null ||
    !isStringArray(input.sandbox.allowedPaths)
  ) {
    return { error: "sandbox.allowedPaths must be a string array" }
  }
  if (input.artifactExport !== undefined) {
    if (
      typeof input.artifactExport !== "object" ||
      input.artifactExport === null ||
      typeof input.artifactExport.exportDir !== "string"
    ) {
      return { error: "artifactExport.exportDir must be a string" }
    }
  }

  return {
    value: {
      id: input.id,
      name: input.name,
      description: input.description,
      ...(input.icon ? { icon: input.icon } : {}),
      enabled: input.enabled,
      archetype: "task-chat",
      allowedRoleIds: input.allowedRoleIds,
      model: input.model,
      ...(input.systemPrompt ? { systemPrompt: input.systemPrompt } : {}),
      connectors: input.connectors,
      sandbox: { allowedPaths: input.sandbox.allowedPaths },
      ...(input.artifactExport ? { artifactExport: input.artifactExport } : {}),
    },
  }
}
