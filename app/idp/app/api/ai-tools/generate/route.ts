import { canAccessAiTool, isAiToolId, type AiToolId } from "@/lib/ai-tools/app-codes"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { z } from "zod"
import { getAccessResult, getRequestEmail } from "../../_lib/access"
import { saveAiToolHistoryRecord } from "../../_lib/ai-tools-history"

export const runtime = "nodejs"

const REQUEST_TIMEOUT_MS = 300_000
const DEFAULT_TEXT_MODEL = process.env.LLM_DEFAULT_MODEL ?? "anthropic/claude-sonnet-4.6"
const DEFAULT_VISION_MODEL = process.env.AI_TOOLS_VISION_MODEL ?? "openai/gpt-4o-mini"

const SCOPE_LABELS: Record<string, string> = {
  chatbot: "AI Chatbot",
  "linkedin-generator": "LinkedIn Generator",
  "text-analyzer": "Text Analyzer",
  "text-transformer": "Text Transformer",
  "text-highlighter": "Text Highlighter",
  "content-creator": "Content Creator",
  summarizer: "Summarizer",
  "invoice-analyzer": "Invoice Analyzer",
  "presentation-generator": "Presentation Generator",
}

const generateRequestSchema = z.object({
  toolId: z.string().min(1),
  scope: z.string().min(1).max(80),
  systemPrompt: z.string().min(1).max(20_000),
  userPrompt: z.string().min(1).max(80_000),
  model: z.string().min(1).max(120).optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(512).max(16_000).optional(),
  image: z
    .object({
      dataUrl: z.string().min(1).max(16_000_000),
      mimeType: z.string().min(1).max(80),
    })
    .optional(),
})

interface CortexChoice {
  message?: { content?: unknown }
  text?: unknown
}

interface CortexResponse {
  choices?: CortexChoice[]
  usage?: { total_tokens?: unknown }
}

interface GenerateResponse {
  content: string
  tokensUsed: number | null
  model: string
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const email = getRequestEmail(request.headers)
  if (!email) return NextResponse.json({ error: "missing-email" }, { status: 401 })

  const parsed = generateRequestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid-request" }, { status: 400 })
  }

  const body = parsed.data
  if (!isAiToolId(body.toolId)) {
    return NextResponse.json({ error: "unknown-tool" }, { status: 404 })
  }

  const access = await getAccessResult(email)
  if (!canAccessAiTool(access.apps, body.toolId)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }

  const cortexProxyUrl = process.env.CORTEX_PROXY_URL
  if (!cortexProxyUrl) {
    return NextResponse.json({ error: "cortex-proxy-not-configured" }, { status: 503 })
  }

  const model = body.model ?? (body.image ? DEFAULT_VISION_MODEL : DEFAULT_TEXT_MODEL)

  try {
    const response = await callCortexProxy({
      baseUrl: cortexProxyUrl,
      email,
      image: body.image,
      maxTokens: body.maxTokens ?? 8000,
      model,
      scope: body.scope,
      systemPrompt: body.systemPrompt,
      temperature: body.temperature ?? 1,
      toolId: body.toolId,
      userPrompt: body.userPrompt,
    })

    saveAiToolHistoryRecord({
      content: response.content,
      image: body.image,
      model: response.model,
      scope: body.scope,
      systemPrompt: body.systemPrompt,
      tokensUsed: response.tokensUsed,
      toolId: body.toolId,
      userEmail: email,
      userPrompt: body.userPrompt,
    })

    return NextResponse.json(response satisfies GenerateResponse)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cortex Proxy request failed"
    return NextResponse.json({ error: "cortex-proxy-error", message }, { status: 502 })
  }
}

interface CallCortexProxyInput {
  baseUrl: string
  email: string
  image: { dataUrl: string; mimeType: string } | undefined
  maxTokens: number
  model: string
  scope: string
  systemPrompt: string
  temperature: number
  toolId: AiToolId
  userPrompt: string
}

async function callCortexProxy(input: CallCortexProxyInput): Promise<GenerateResponse> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(`${input.baseUrl.replace(/\/$/, "")}/v1/chat/completions`, {
      method: "POST",
      headers: buildCortexHeaders(input.email, input.scope),
      body: JSON.stringify(buildCortexPayload(input)),
      signal: controller.signal,
      cache: "no-store",
    })

    if (!response.ok) {
      const text = await response.text().catch(() => "")
      throw new Error(text || `Cortex Proxy returned ${response.status}`)
    }

    const data = (await response.json()) as CortexResponse
    const content = readCortexContent(data)
    return {
      content,
      model: input.model,
      tokensUsed: readTokensUsed(data),
    }
  } finally {
    clearTimeout(timeout)
  }
}

function buildCortexHeaders(email: string, scope: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "X-App": SCOPE_LABELS[scope] ?? "AI Tools",
    "X-Scope": scope,
    "X-Source-App": "Cortex360 AI Tools",
    "X-User-ID": email,
  }

  const apiKey = process.env.CORTEX_PROXY_API_KEY ?? process.env.CORTEX_API_KEY
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`
  return headers
}

function buildCortexPayload(input: CallCortexProxyInput): Record<string, unknown> {
  const maxTokensKey = isOpenRouterModel(input.model) ? "max_tokens" : "max_completion_tokens"
  const payload: Record<string, unknown> = {
    model: input.model,
    [maxTokensKey]: input.maxTokens,
  }

  if (isOpenRouterModel(input.model)) {
    payload.prompt = `${input.systemPrompt}\n\nUser: ${input.userPrompt}\n\nAssistant:`
    payload.temperature = input.temperature
    if (input.image) payload.image = input.image.dataUrl
    return payload
  }

  if (input.image) {
    payload.messages = [
      { role: "system", content: input.systemPrompt },
      {
        role: "user",
        content: [
          { type: "text", text: input.userPrompt },
          {
            type: "image_url",
            image_url: {
              url: input.image.dataUrl,
              detail: "high",
            },
          },
        ],
      },
    ]
  } else {
    payload.messages = [
      { role: "system", content: input.systemPrompt },
      { role: "user", content: input.userPrompt },
    ]
  }

  if (input.temperature !== 1 && !input.model.startsWith("o3") && !input.model.includes("gpt-5")) {
    payload.temperature = input.temperature
  }

  return payload
}

function isOpenRouterModel(model: string): boolean {
  return model.includes("/")
}

function readCortexContent(data: CortexResponse): string {
  const firstChoice = data.choices?.[0]
  const content = firstChoice?.message?.content ?? firstChoice?.text
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("Unexpected Cortex Proxy response")
  }
  return content
}

function readTokensUsed(data: CortexResponse): number | null {
  const value = data.usage?.total_tokens
  return typeof value === "number" ? value : null
}
