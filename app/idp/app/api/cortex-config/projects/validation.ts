import type { UpsertProjectInput } from "@/lib/cortex-governance/store"
import type {
  CoworkModelConfig,
  CoworkProjectBrief,
  CoworkProjectComposition,
  CoworkProjectConfig,
  CoworkResourceGrant,
} from "@cortex/types"
import { COWORK_DEPARTMENT_PATTERN, COWORK_SLUG_PATTERN } from "@cortex/types"

// Server-side validation for project create/update bodies. Kept as plain
// checks (not Zod) to match the other BFF routes in this app - the client
// forms carry the Zod layer; substantive rules (slug pattern, provider
// requirements) live in shared constants so the two dialects can't diverge.

export function isStringArray(value: unknown): value is string[] {
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

function isGrant(value: unknown): value is CoworkResourceGrant {
  if (typeof value !== "object" || value === null) return false
  const grant = value as CoworkResourceGrant
  return isStringArray(grant.branches) && isStringArray(grant.leaves)
}

function isBriefArray(value: unknown): value is CoworkProjectBrief[] {
  if (!Array.isArray(value)) return false
  return value.every((item) => {
    if (typeof item !== "object" || item === null) return false
    const brief = item as CoworkProjectBrief
    return (
      typeof brief.id === "string" &&
      brief.id.length > 0 &&
      typeof brief.title === "string" &&
      brief.title.length > 0 &&
      typeof brief.prompt === "string" &&
      brief.prompt.length > 0 &&
      (brief.hint === undefined || typeof brief.hint === "string")
    )
  })
}

function isComposition(value: unknown): value is CoworkProjectComposition {
  if (typeof value !== "object" || value === null) return false
  const composition = value as CoworkProjectComposition
  return (
    isGrant(composition.skills) &&
    isGrant(composition.connectors) &&
    isGrant(composition.secrets)
  )
}

export type ParsedProject = { value: UpsertProjectInput } | { error: string }

export function parseProjectBody(body: unknown): ParsedProject {
  if (typeof body !== "object" || body === null) return { error: "Invalid JSON body" }
  const input = body as Partial<CoworkProjectConfig>

  if (!input.id || !COWORK_SLUG_PATTERN.test(input.id)) {
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
  if (!isComposition(input.composition)) {
    return { error: "composition needs skills/connectors/secrets grants (branches[] + leaves[])" }
  }
  if (
    typeof input.sandbox !== "object" ||
    input.sandbox === null ||
    !isStringArray(input.sandbox.allowedPaths) ||
    (input.sandbox.mode !== "local" && input.sandbox.mode !== "docker")
  ) {
    return { error: "sandbox needs mode (local | docker) and allowedPaths[]" }
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
  if (input.department !== undefined && !COWORK_DEPARTMENT_PATTERN.test(input.department)) {
    return { error: "department must be a department path (e.g. finanse/kontroling)" }
  }
  if (input.briefs !== undefined && !isBriefArray(input.briefs)) {
    return { error: "briefs must be an array of { id, title, prompt, hint? }" }
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
      ...(input.department ? { department: input.department } : {}),
      ...(input.systemPrompt ? { systemPrompt: input.systemPrompt } : {}),
      ...(input.briefs && input.briefs.length > 0 ? { briefs: input.briefs } : {}),
      composition: input.composition,
      sandbox: { mode: input.sandbox.mode, allowedPaths: input.sandbox.allowedPaths },
      ...(input.artifactExport ? { artifactExport: input.artifactExport } : {}),
    },
  }
}
