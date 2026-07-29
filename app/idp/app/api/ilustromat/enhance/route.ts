// "Popraw (AI)" dla tytułu/podtytułu. Wołane wyłącznie na jawne kliknięcie —
// nigdy automatycznie w tle, żeby nie podmieniać cicho tego, co user napisał.

import { callCortexProxy } from "@cortex/api/cortex-proxy-client"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { z } from "zod"
import { APP_LABEL, SCOPES, SOURCE_APP, ilustromatConfig } from "@/lib/ilustromat/config"
import { SUBTITLE_MAX_CHARS, TITLE_MAX_CHARS } from "@/lib/ilustromat/presets"
import { buildEnhanceMessages, normalizeEnhancedText } from "@/lib/ilustromat/prompt-builder"
import { denyUnlessAllowed, toUpstreamErrorResponse } from "../_lib/guard"

export const runtime = "nodejs"

const requestSchema = z.object({
  field: z.enum(["title", "subtitle"]),
  text: z.string().min(1).max(2000),
})

export async function POST(request: NextRequest): Promise<NextResponse> {
  const denied = await denyUnlessAllowed(request)
  if (denied) return denied

  const parsed = requestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid-request", message: parsed.error.issues[0]?.message },
      { status: 400 },
    )
  }

  if (!parsed.data.text.trim()) {
    return NextResponse.json({ error: "empty-text" }, { status: 400 })
  }

  const baseUrl = process.env.CORTEX_PROXY_URL
  if (!baseUrl) {
    console.error("[ilustromat] CORTEX_PROXY_URL nie jest ustawione")
    return NextResponse.json({ error: "proxy-not-configured" }, { status: 502 })
  }

  const maxChars = parsed.data.field === "title" ? TITLE_MAX_CHARS : SUBTITLE_MAX_CHARS
  const messages = buildEnhanceMessages({
    text: parsed.data.text,
    field: parsed.data.field,
    maxChars,
  })

  try {
    const result = await callCortexProxy({
      baseUrl,
      email: request.headers.get("x-auth-request-email") ?? "anonymous",
      model: ilustromatConfig().textModel,
      scope: SCOPES.textEnhance,
      systemPrompt: messages[0]!.content,
      userPrompt: messages[1]!.content,
      maxTokens: 300,
      temperature: 0.5,
      image: undefined,
      appLabel: APP_LABEL,
      sourceApp: SOURCE_APP,
    })

    const text = normalizeEnhancedText(result.content, maxChars)
    if (!text) {
      return NextResponse.json({ error: "empty-response" }, { status: 502 })
    }
    return NextResponse.json({ text })
  } catch (error) {
    return toUpstreamErrorResponse(error)
  }
}
