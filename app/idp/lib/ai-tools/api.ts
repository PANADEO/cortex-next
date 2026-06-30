import { apiClient } from "@cortex/api"
import type { AiToolId } from "./app-codes"

export interface AiToolGenerateRequest {
  toolId: AiToolId
  scope: string
  systemPrompt: string
  userPrompt: string
  model?: string
  temperature?: number
  maxTokens?: number
  image?: {
    dataUrl: string
    mimeType: string
  }
}

export interface AiToolGenerateResponse {
  content: string
  tokensUsed: number | null
  model: string
}

export interface AiToolHistoryItem {
  id: string
  createdAt: string
  toolId: AiToolId
  scope: string
  systemPrompt: string
  userPrompt: string
  content: string
  model: string
  tokensUsed: number | null
  hasImage: boolean
  imageMimeType: string | null
}

interface AiToolHistoryResponse {
  items: AiToolHistoryItem[]
}

export function aiToolHistoryQueryKey(toolId: AiToolId): readonly ["ai-tools", "history", AiToolId] {
  return ["ai-tools", "history", toolId] as const
}

export function generateAiToolContent(
  body: AiToolGenerateRequest,
): Promise<AiToolGenerateResponse> {
  return apiClient.post<AiToolGenerateResponse>("/api/ai-tools/generate", { jsonBody: body })
}

export async function getAiToolHistory(
  toolId: AiToolId,
  limit = 10,
): Promise<AiToolHistoryItem[]> {
  const response = await apiClient.get<AiToolHistoryResponse>("/api/ai-tools/history", {
    params: { limit, toolId },
  })
  return response.items
}
