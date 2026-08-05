import type {
  CoworkConnectorConfig,
  CoworkProjectComposition,
  CoworkProjectConfig,
  CoworkSkillSource,
} from "@cortex/types"
import {
  cortexProxyModelBaseUrl,
  COWORK_DEPARTMENT_PATTERN,
  COWORK_SLUG_PATTERN,
  DEFAULT_COWORK_MODEL_ID,
} from "@cortex/types"
import { z } from "zod"
import type { ProjectInput } from "./queries"

const SLUG_MESSAGE = "Małe litery, cyfry i myślniki (2-63 znaki)"
const DEPT_MESSAGE = "Ścieżka departamentu (np. finanse/kontroling)"

function parseKeyValueLines(value: string): Record<string, string> {
  const result: Record<string, string> = {}
  for (const line of value.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const eq = trimmed.indexOf("=")
    if (eq <= 0) continue
    result[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim()
  }
  return result
}

function stringifyKeyValue(refs: Record<string, string> | undefined): string {
  if (!refs) return ""
  return Object.entries(refs)
    .map(([key, val]) => `${key}=${val}`)
    .join("\n")
}

function parsePathLines(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
}

// --- Project form -------------------------------------------------------------

export const briefFormSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1, "Tytuł karty jest wymagany"),
  prompt: z.string().min(1, "Prompt jest wymagany"),
  hint: z.string().optional(),
})

export const projectFormSchema = z
  .object({
    id: z.string().regex(COWORK_SLUG_PATTERN, SLUG_MESSAGE),
    name: z.string().min(1, "Nazwa jest wymagana"),
    description: z.string().min(1, "Opis jest wymagany"),
    icon: z.string().optional(),
    enabled: z.boolean(),
    allowedRoleIds: z.array(z.string()),
    provider: z.enum(["anthropic", "openai-compatible"]),
    modelId: z.string().min(1, "Model jest wymagany"),
    baseUrl: z.string().optional(),
    apiKeyRef: z.string().optional(),
    department: z
      .string()
      .regex(COWORK_DEPARTMENT_PATTERN, DEPT_MESSAGE)
      .or(z.literal(""))
      .optional(),
    systemPrompt: z.string().optional(),
    briefs: z.array(briefFormSchema),
    sandboxMode: z.enum(["local", "docker"]),
    /** One path per line in the textarea. */
    sandboxPaths: z.string(),
    // Composition grants per kind: department branches + specific leaves.
    skillBranches: z.array(z.string()),
    skillLeaves: z.array(z.string()),
    connectorBranches: z.array(z.string()),
    connectorLeaves: z.array(z.string()),
    secretBranches: z.array(z.string()),
    secretLeaves: z.array(z.string()),
    exportDir: z.string().optional(),
    exportDisplayPath: z.string().optional(),
  })
  .refine(
    (values) => values.provider !== "openai-compatible" || Boolean(values.baseUrl?.trim()),
    { path: ["baseUrl"], message: "Base URL jest wymagany dla openai-compatible" },
  )

export type ProjectFormValues = z.infer<typeof projectFormSchema>

export const EMPTY_PROJECT_FORM_VALUES: ProjectFormValues = {
  id: "",
  name: "",
  description: "",
  icon: "",
  enabled: true,
  allowedRoleIds: [],
  // Same cortex-proxy routing the store seeds (lib/cortex-governance/store.ts)
  // and seed-demo.mjs uses. No CORTEX_PROXY_URL here - this default is rendered
  // in the browser, which cannot read it; the helper's fallback is the org's
  // Docker-DNS convention and the admin edits the field if their proxy differs.
  provider: "openai-compatible",
  modelId: DEFAULT_COWORK_MODEL_ID,
  baseUrl: cortexProxyModelBaseUrl(),
  apiKeyRef: "",
  department: "",
  systemPrompt: "",
  briefs: [],
  sandboxMode: "local",
  sandboxPaths: "",
  skillBranches: [],
  skillLeaves: [],
  connectorBranches: [],
  connectorLeaves: [],
  secretBranches: [],
  secretLeaves: [],
  exportDir: "",
  exportDisplayPath: "",
}

export function projectToFormValues(project: CoworkProjectConfig): ProjectFormValues {
  const { skills, connectors, secrets } = project.composition
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    icon: project.icon ?? "",
    enabled: project.enabled,
    allowedRoleIds: project.allowedRoleIds,
    provider: project.model.provider,
    modelId: project.model.modelId,
    baseUrl: project.model.baseUrl ?? "",
    apiKeyRef: project.model.apiKeyRef ?? "",
    department: project.department ?? "",
    systemPrompt: project.systemPrompt ?? "",
    briefs: (project.briefs ?? []).map((brief) => ({
      id: brief.id,
      title: brief.title,
      prompt: brief.prompt,
      hint: brief.hint ?? "",
    })),
    sandboxMode: project.sandbox.mode ?? "local",
    sandboxPaths: project.sandbox.allowedPaths.join("\n"),
    skillBranches: skills.branches,
    skillLeaves: skills.leaves,
    connectorBranches: connectors.branches,
    connectorLeaves: connectors.leaves,
    secretBranches: secrets.branches,
    secretLeaves: secrets.leaves,
    exportDir: project.artifactExport?.exportDir ?? "",
    exportDisplayPath: project.artifactExport?.displayPath ?? "",
  }
}

export function projectFormValuesToInput(values: ProjectFormValues): ProjectInput {
  const exportDir = values.exportDir?.trim()
  const composition: CoworkProjectComposition = {
    skills: { branches: values.skillBranches, leaves: values.skillLeaves },
    connectors: { branches: values.connectorBranches, leaves: values.connectorLeaves },
    secrets: { branches: values.secretBranches, leaves: values.secretLeaves },
  }
  return {
    id: values.id,
    name: values.name,
    description: values.description,
    ...(values.icon?.trim() ? { icon: values.icon.trim() } : {}),
    enabled: values.enabled,
    archetype: "task-chat",
    allowedRoleIds: values.allowedRoleIds,
    model: {
      provider: values.provider,
      modelId: values.modelId,
      ...(values.baseUrl?.trim() ? { baseUrl: values.baseUrl.trim() } : {}),
      ...(values.apiKeyRef?.trim() ? { apiKeyRef: values.apiKeyRef.trim() } : {}),
    },
    ...(values.department?.trim() ? { department: values.department.trim() } : {}),
    ...(values.systemPrompt?.trim() ? { systemPrompt: values.systemPrompt.trim() } : {}),
    ...(values.briefs.length > 0
      ? {
          briefs: values.briefs.map((brief) => ({
            id: brief.id,
            title: brief.title.trim(),
            prompt: brief.prompt.trim(),
            ...(brief.hint?.trim() ? { hint: brief.hint.trim() } : {}),
          })),
        }
      : {}),
    composition,
    sandbox: { mode: values.sandboxMode, allowedPaths: parsePathLines(values.sandboxPaths) },
    ...(exportDir
      ? {
          artifactExport: {
            exportDir,
            ...(values.exportDisplayPath?.trim()
              ? { displayPath: values.exportDisplayPath.trim() }
              : {}),
          },
        }
      : {}),
  }
}

// --- Role / assignment forms --------------------------------------------------

export const roleFormSchema = z.object({
  id: z.string().regex(COWORK_SLUG_PATTERN, SLUG_MESSAGE),
  name: z.string().min(1, "Nazwa jest wymagana"),
  description: z.string().optional(),
})

export type RoleFormValues = z.infer<typeof roleFormSchema>

export const assignmentFormSchema = z.object({
  email: z.string().email("Podaj poprawny email"),
  roleIds: z.array(z.string()).min(1, "Wybierz co najmniej jedną rolę"),
})

export type AssignmentFormValues = z.infer<typeof assignmentFormSchema>

// --- Catalog forms ------------------------------------------------------------

export const skillSourceFormSchema = z.object({
  id: z.string().regex(COWORK_SLUG_PATTERN, SLUG_MESSAGE),
  name: z.string().min(1, "Nazwa jest wymagana"),
  folderPath: z.string().regex(/^\//, "Ścieżka musi być absolutna"),
  department: z.string().regex(COWORK_DEPARTMENT_PATTERN, DEPT_MESSAGE),
})

export type SkillSourceFormValues = z.infer<typeof skillSourceFormSchema>

export function skillSourceToConfig(values: SkillSourceFormValues): CoworkSkillSource {
  return {
    id: values.id,
    name: values.name,
    folderPath: values.folderPath.trim(),
    department: values.department,
  }
}

export const connectorFormSchema = z.object({
  id: z.string().regex(COWORK_SLUG_PATTERN, SLUG_MESSAGE),
  department: z.string().regex(COWORK_DEPARTMENT_PATTERN, DEPT_MESSAGE),
  type: z.enum(["mcp", "cli"]),
  name: z.string().min(1, "Nazwa konektora jest wymagana"),
  description: z.string().optional(),
  enabled: z.boolean(),
  target: z.string().min(1, "Podaj URL (MCP) lub ścieżkę do narzędzia (CLI)"),
  /** "header-or-env-name=credential/path" per line. */
  credentialRefs: z.string(),
  /** Space-separated fixed CLI args. */
  baseArgs: z.string(),
})

export type ConnectorFormValues = z.infer<typeof connectorFormSchema>

export const EMPTY_CONNECTOR_FORM_VALUES: ConnectorFormValues = {
  id: "",
  department: "",
  type: "mcp",
  name: "",
  description: "",
  enabled: true,
  target: "",
  credentialRefs: "",
  baseArgs: "",
}

export function connectorToFormValues(connector: CoworkConnectorConfig): ConnectorFormValues {
  return {
    id: connector.id,
    department: connector.department,
    type: connector.type,
    name: connector.name,
    description: connector.description ?? "",
    enabled: connector.enabled,
    target: connector.target,
    credentialRefs: stringifyKeyValue(connector.credentialRefs),
    baseArgs: (connector.baseArgs ?? []).join(" "),
  }
}

export function connectorFormValuesToConfig(values: ConnectorFormValues): CoworkConnectorConfig {
  const credentialRefs = parseKeyValueLines(values.credentialRefs)
  const baseArgs = values.baseArgs.trim() ? values.baseArgs.trim().split(/\s+/) : []
  return {
    id: values.id,
    department: values.department,
    type: values.type,
    name: values.name,
    ...(values.description?.trim() ? { description: values.description.trim() } : {}),
    enabled: values.enabled,
    target: values.target.trim(),
    ...(Object.keys(credentialRefs).length > 0 ? { credentialRefs } : {}),
    ...(values.type === "cli" && baseArgs.length > 0 ? { baseArgs } : {}),
  }
}
