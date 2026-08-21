// Asysta tekstowa formularza: "Dopracuj" (polish), "Inna wersja" (rephrase),
// "Podpowiedz" (propose). Wołana wyłącznie na jawne kliknięcie — nigdy
// automatycznie w tle, żeby nie podmieniać cicho tego, co user napisał.

import { APP_LABEL, SCOPES, SOURCE_APP, ilustromatConfig } from "@/lib/ilustromat/config"
import { IDEA_MAX_CHARS, SUBTITLE_MAX_CHARS, TITLE_MAX_CHARS } from "@/lib/ilustromat/presets"
import type { AssistField } from "@/lib/ilustromat/prompt-builder"
import {
  ASSIST_TEMPERATURE,
  buildAssistMessages,
  isSupportedAssist,
  normalizeAssistedText,
} from "@/lib/ilustromat/prompt-builder"
import { callCortexProxy } from "@cortex/api/cortex-proxy-client"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { z } from "zod"
import { denyUnlessAllowed, toUpstreamErrorResponse } from "../_lib/guard"

export const runtime = "nodejs"

const requestSchema = z
  .object({
    field: z.enum(["title", "subtitle", "idea"]),
    mode: z.enum(["polish", "rephrase", "propose"]).default("polish"),
    text: z.string().max(2000).optional(),
    context: z
      .object({ title: z.string().max(2000).optional(), subtitle: z.string().max(2000).optional() })
      .optional(),
    /** Wersje już pokazane userowi — bez nich kolejne kliknięcie "Inna wersja"
     *  wraca do tego samego sformułowania. */
    avoid: z.array(z.string().max(2000)).max(20).optional(),
  })
  .refine((value) => isSupportedAssist(value.field, value.mode), {
    message: "Nieobsługiwana kombinacja pola i trybu",
  })
  .refine(
    (value) =>
      value.mode === "propose"
        ? Boolean(value.context?.title?.trim())
        : Boolean(value.text?.trim()),
    { message: "Brak tekstu wejściowego dla wybranego trybu" },
  )

const MAX_CHARS: Record<AssistField, number> = {
  title: TITLE_MAX_CHARS,
  subtitle: SUBTITLE_MAX_CHARS,
  idea: IDEA_MAX_CHARS,
}

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

  const baseUrl = process.env.CORTEX_PROXY_URL
  if (!baseUrl) {
    console.error("[ilustromat] CORTEX_PROXY_URL nie jest ustawione")
    return NextResponse.json({ error: "proxy-not-configured" }, { status: 502 })
  }

  const { field, mode, text, context, avoid } = parsed.data
  const maxChars = MAX_CHARS[field]
  const messages = buildAssistMessages({ field, mode, maxChars, text, context, avoid })

  try {
    const result = await callCortexProxy({
      baseUrl,
      email: request.headers.get("x-auth-request-email") ?? "anonymous",
      model: ilustromatConfig().textModel,
      scope: mode === "propose" ? SCOPES.textSuggest : SCOPES.textEnhance,
      systemPrompt: messages[0]!.content,
      userPrompt: messages[1]!.content,
      maxTokens: 300,
      temperature: ASSIST_TEMPERATURE[mode],
      image: undefined,
      appLabel: APP_LABEL,
      sourceApp: SOURCE_APP,
    })

    const assisted = normalizeAssistedText(result.content, maxChars)
    if (!assisted) {
      return NextResponse.json({ error: "empty-response" }, { status: 502 })
    }
    return NextResponse.json({ text: assisted })
  } catch (error) {
    return toUpstreamErrorResponse(error)
  }
}
