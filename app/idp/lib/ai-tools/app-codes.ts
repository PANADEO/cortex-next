export const AI_TOOLS_TILE_ID = "ai-tools"

export const AI_TOOL_APP_CODES = [
  "text-highlighter",
  "text-transformer",
  "text-analyzer",
  "ai-summarizer",
  "content-guru",
  "linkedin-generator",
  "presentation-generator",
  "fakturomat",
  "ai-daily-assistant",
] as const

export type AiToolId = (typeof AI_TOOL_APP_CODES)[number]

export function isAiToolId(value: string): value is AiToolId {
  return AI_TOOL_APP_CODES.includes(value as AiToolId)
}

export function canAccessAiTool(apps: readonly string[], toolId: AiToolId): boolean {
  return apps.includes(AI_TOOLS_TILE_ID) || apps.includes(toolId)
}

export function hasAnyAiToolAccess(apps: readonly string[]): boolean {
  return apps.includes(AI_TOOLS_TILE_ID) || AI_TOOL_APP_CODES.some((code) => apps.includes(code))
}
