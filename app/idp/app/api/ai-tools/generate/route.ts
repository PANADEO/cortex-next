import { callCortexProxy } from "@cortex/api/cortex-proxy-client"
import { canAccessAiTool, isAiToolId } from "@/lib/ai-tools/app-codes"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { z } from "zod"
import { getAccessResult, getRequestEmail } from "../../_lib/access"
import { saveAiToolHistoryRecord } from "../../_lib/ai-tools-history"

export const runtime = "nodejs"

const DEFAULT_TEXT_MODEL = process.env.LLM_DEFAULT_MODEL ?? "anthropic/claude-sonnet-4.6"
const DEFAULT_VISION_MODEL = process.env.AI_TOOLS_VISION_MODEL ?? "openai/gpt-4o-mini"

const DEFAULT_APP_LABEL = "AI Tools"

// Etykiety specyficzne dla AI Tools (nagłówek X-App) — domena tego modułu,
// dlatego zostają w kontrolerze i są wstrzykiwane do adaptera, a nie zaszyte
// we wspólnym kliencie cortex-proxy.
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
      appLabel: SCOPE_LABELS[body.scope] ?? DEFAULT_APP_LABEL,
      baseUrl: cortexProxyUrl,
      email,
      image: body.image,
      maxTokens: body.maxTokens ?? 8000,
      model,
      scope: body.scope,
      systemPrompt: body.systemPrompt,
      temperature: body.temperature ?? 1,
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
