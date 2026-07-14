import type { CoworkConnectorConfig, CoworkProjectConfig } from "@cortex/types"
import { z } from "zod"
import type { ProjectInput } from "./queries"

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

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,62}$/
const SLUG_MESSAGE = "Małe litery, cyfry i myślniki (2-63 znaki)"

const connectorFormSchema = z.object({
  id: z.string().min(1),
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

export const projectFormSchema = z.object({
  id: z.string().regex(SLUG_PATTERN, SLUG_MESSAGE),
  name: z.string().min(1, "Nazwa jest wymagana"),
  description: z.string().min(1, "Opis jest wymagany"),
  icon: z.string().optional(),
  enabled: z.boolean(),
  allowedRoleIds: z.array(z.string()),
  provider: z.enum(["anthropic", "openai-compatible"]),
  modelId: z.string().min(1, "Model jest wymagany"),
  baseUrl: z.string().optional(),
  apiKeyRef: z.string().optional(),
  systemPrompt: z.string().optional(),
  sandboxMode: z.enum(["local", "docker"]),
  /** One path per line in the textarea. */
  sandboxPaths: z.string(),
  connectors: z.array(connectorFormSchema),
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
  provider: "anthropic",
  modelId: "claude-sonnet-4-5",
  baseUrl: "",
  apiKeyRef: "",
  systemPrompt: "",
  sandboxMode: "local",
  sandboxPaths: "",
  connectors: [],
  exportDir: "",
  exportDisplayPath: "",
}

export function emptyConnector(): ConnectorFormValues {
  // Stable-per-render id assigned by the form when a connector is appended.
  return {
    id: "",
    type: "mcp",
    name: "",
    description: "",
    enabled: true,
    target: "",
    credentialRefs: "",
    baseArgs: "",
  }
}

function connectorToFormValues(connector: CoworkConnectorConfig): ConnectorFormValues {
  return {
    id: connector.id,
    type: connector.type,
    name: connector.name,
    description: connector.description ?? "",
    enabled: connector.enabled,
    target: connector.target,
    credentialRefs: stringifyKeyValue(connector.credentialRefs),
    baseArgs: (connector.baseArgs ?? []).join(" "),
  }
}

function connectorFormValuesToConfig(
  values: ConnectorFormValues,
  index: number,
): CoworkConnectorConfig {
  const credentialRefs = parseKeyValueLines(values.credentialRefs)
  const baseArgs = values.baseArgs.trim() ? values.baseArgs.trim().split(/\s+/) : []
  return {
    id: values.id || `connector-${index + 1}`,
    type: values.type,
    name: values.name,
    ...(values.description?.trim() ? { description: values.description.trim() } : {}),
    enabled: values.enabled,
    target: values.target.trim(),
    ...(Object.keys(credentialRefs).length > 0 ? { credentialRefs } : {}),
    ...(values.type === "cli" && baseArgs.length > 0 ? { baseArgs } : {}),
  }
}

function parsePathLines(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
}

export function projectToFormValues(project: CoworkProjectConfig): ProjectFormValues {
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
    systemPrompt: project.systemPrompt ?? "",
    sandboxMode: project.sandbox.mode ?? "local",
    sandboxPaths: project.sandbox.allowedPaths.join("\n"),
    connectors: project.connectors.map(connectorToFormValues),
    exportDir: project.artifactExport?.exportDir ?? "",
    exportDisplayPath: project.artifactExport?.displayPath ?? "",
  }
}

export function projectFormValuesToInput(values: ProjectFormValues): ProjectInput {
  const exportDir = values.exportDir?.trim()
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
    ...(values.systemPrompt?.trim() ? { systemPrompt: values.systemPrompt.trim() } : {}),
    connectors: values.connectors.map(connectorFormValuesToConfig),
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

export const roleFormSchema = z.object({
  id: z.string().regex(SLUG_PATTERN, SLUG_MESSAGE),
  name: z.string().min(1, "Nazwa jest wymagana"),
  description: z.string().optional(),
  skillGroupIds: z.array(z.string()),
})

export type RoleFormValues = z.infer<typeof roleFormSchema>

export const skillGroupFormSchema = z.object({
  id: z.string().regex(SLUG_PATTERN, SLUG_MESSAGE),
  name: z.string().min(1, "Nazwa jest wymagana"),
  description: z.string().optional(),
  skillIds: z.array(z.string()),
})

export type SkillGroupFormValues = z.infer<typeof skillGroupFormSchema>

export const assignmentFormSchema = z.object({
  email: z.string().email("Podaj poprawny email"),
  roleIds: z.array(z.string()).min(1, "Wybierz co najmniej jedną rolę"),
})

export type AssignmentFormValues = z.infer<typeof assignmentFormSchema>
