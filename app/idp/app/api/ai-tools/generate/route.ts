import { canAccessAiTool, isAiToolId } from "@/lib/ai-tools/app-codes"
import { getAiToolDefinition } from "@/lib/ai-tools/registry"
import { callCortexProxy, type CortexProxyResult } from "@cortex/api/cortex-proxy-client"
import { getRequestEmail } from "@cortex/service"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { z } from "zod"
import { saveAiToolHistoryRecord } from "../../_lib/ai-tools-history"
import { grantedAppCodes } from "../../_lib/granted-apps"

export const runtime = "nodejs"

const DEFAULT_TEXT_MODEL = process.env.LLM_DEFAULT_MODEL ?? "anthropic/claude-sonnet-4.6"
const DEFAULT_VISION_MODEL = process.env.AI_TOOLS_VISION_MODEL ?? "openai/gpt-4o-mini"

const DEFAULT_APP_LABEL = "AI Tools"
const DEFAULT_MAX_TOKENS = 8000

// Etykiety specyficzne dla AI Tools (nagłówek X-App) — domena tego modułu,
// dlatego zostają w kontrolerze i są wstrzykiwane do adaptera, a nie zaszyte
// we wspólnym kliencie cortex-proxy.
const SCOPE_LABELS: Record<string, string> = {
  chatbot: "AI Chatbot",
  "linkedin-generator": "LinkedIn Generator",
  "text-analyzer": "Text Analyzer",
  "text-transformer": "Text Transformer",
  "text-highlighter": "Text Highlighter",
  summarizer: "Summarizer",
  "invoice-analyzer": "Invoice Analyzer",
  "presentation-generator": "Presentation Generator",
}

// `scope`, `model` i `maxTokens` NIE są polami żądania — wyprowadza je serwer
// z `toolId` przez rejestr narzędzi. Klient nie może ich podać: decydują o
// atrybucji zużycia tokenów (X-Scope) i o koszcie wywołania, a RBAC weryfikuje
// wyłącznie `toolId`. Przyjmowanie ich z body pozwalało użytkownikowi z grantem
// na jedno narzędzie księgować zużycie na cudzy scope i podnosić limit tokenów.
const generateRequestSchema = z.object({
  toolId: z.string().min(1),
  systemPrompt: z.string().min(1).max(20_000),
  userPrompt: z.string().min(1).max(80_000),
  temperature: z.number().min(0).max(2).optional(),
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
  const tool = isAiToolId(body.toolId) ? getAiToolDefinition(body.toolId) : undefined
  if (!tool) {
    return NextResponse.json({ error: "unknown-tool" }, { status: 404 })
  }

  const apps = await grantedAppCodes(email)
  if (!canAccessAiTool(apps, tool.id)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }

  const cortexProxyUrl = process.env.CORTEX_PROXY_URL
  if (!cortexProxyUrl) {
    return NextResponse.json({ error: "cortex-proxy-not-configured" }, { status: 503 })
  }

  const model = body.image ? DEFAULT_VISION_MODEL : DEFAULT_TEXT_MODEL

  let response: CortexProxyResult
  try {
    response = await callCortexProxy({
      appLabel: SCOPE_LABELS[tool.scope] ?? DEFAULT_APP_LABEL,
      baseUrl: cortexProxyUrl,
      email,
      image: body.image,
      maxTokens: tool.maxTokens ?? DEFAULT_MAX_TOKENS,
      model,
      scope: tool.scope,
      systemPrompt: body.systemPrompt,
      temperature: body.temperature ?? 1,
      userPrompt: body.userPrompt,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cortex Proxy request failed"
    return NextResponse.json({ error: "cortex-proxy-error", message }, { status: 502 })
  }

  // Historia jest efektem ubocznym udanej generacji. Zapis MUSI zostać poza try
  // obejmującym callCortexProxy(): odpowiedź LLM jest już opłacona, więc błąd
  // SQLite (brak katalogu, pełny dysk, lock) nie może jej skasować ani podszyć
  // się pod awarię integracji z cortex-proxy.
  try {
    saveAiToolHistoryRecord({
      content: response.content,
      image: body.image,
      model: response.model,
      scope: tool.scope,
      systemPrompt: body.systemPrompt,
      tokensUsed: response.tokensUsed,
      toolId: tool.id,
      userEmail: email,
      userPrompt: body.userPrompt,
    })
  } catch (error) {
    console.warn(`[ai-tools] history save failed for ${tool.id}:`, error)
  }

  return NextResponse.json(response satisfies GenerateResponse)
}
