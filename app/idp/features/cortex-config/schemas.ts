import type { CoworkProjectConfig } from "@cortex/types"
import { z } from "zod"
import type { ProjectInput } from "./queries"

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,62}$/
const SLUG_MESSAGE = "Małe litery, cyfry i myślniki (2-63 znaki)"

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
  /** One path per line in the textarea. */
  sandboxPaths: z.string(),
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
  sandboxPaths: "",
  exportDir: "",
  exportDisplayPath: "",
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
    sandboxPaths: project.sandbox.allowedPaths.join("\n"),
    exportDir: project.artifactExport?.exportDir ?? "",
    exportDisplayPath: project.artifactExport?.displayPath ?? "",
  }
}

export function projectFormValuesToInput(
  values: ProjectFormValues,
  existing?: CoworkProjectConfig,
): ProjectInput {
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
    connectors: existing?.connectors ?? [],
    sandbox: { allowedPaths: parsePathLines(values.sandboxPaths) },
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
