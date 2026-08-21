// Kroki 2+3 flow: prompt builder (tani model tekstowy) -> N wariantów TŁA
// (model obrazkowy) -> od razu gotowe kafelki przez compose().
//
// Klient dostaje ZARÓWNO gotowy kafelek, jak i surowe tło: kafelek do
// pokazania (REQ-06 — wariant ma wyglądać jak produkt końcowy, nie jak surowy
// obraz), tło do późniejszej rekompozycji bez ponownego płacenia za AI (REQ-08).

import { compose } from "@/lib/ilustromat/composer"
import { APP_LABEL, SCOPES, SOURCE_APP, ilustromatConfig } from "@/lib/ilustromat/config"
import {
  DEFAULT_VARIANTS,
  FORMAT_BY_KEY,
  MAX_VARIANTS,
  MIN_VARIANTS,
  STYLE_BY_KEY,
  SUBTITLE_MAX_CHARS,
  TITLE_MAX_CHARS,
} from "@/lib/ilustromat/presets"
import { buildImagePromptMessages } from "@/lib/ilustromat/prompt-builder"
import { resolveTemplateRender } from "@/lib/ilustromat/render"
import {
  callCortexProxy,
  callCortexProxyImage,
  decodeDataUrl,
} from "@cortex/api/cortex-proxy-client"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { z } from "zod"
import { denyUnlessAllowed, toErrorResponse, toUpstreamErrorResponse } from "../_lib/guard"

export const runtime = "nodejs"

const IMAGE_TIMEOUT_MS = 90_000

const requestSchema = z.object({
  templateId: z.string().min(1),
  formatKey: z.string().min(1),
  styleKey: z.string().min(1),
  title: z.string().min(1).max(TITLE_MAX_CHARS),
  subtitle: z.string().max(SUBTITLE_MAX_CHARS).default(""),
  idea: z.string().max(1000).default(""),
  variants: z.number().int().min(MIN_VARIANTS).max(MAX_VARIANTS).default(DEFAULT_VARIANTS),
})

export async function POST(request: NextRequest): Promise<NextResponse> {
  const access = await denyUnlessAllowed(request)
  if (access) return access

  const parsed = requestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid-request", message: parsed.error.issues[0]?.message },
      { status: 400 },
    )
  }

  const format = FORMAT_BY_KEY.get(parsed.data.formatKey)
  const style = STYLE_BY_KEY.get(parsed.data.styleKey)
  if (!format || !style) {
    return NextResponse.json({ error: "unknown-preset" }, { status: 400 })
  }

  const baseUrl = process.env.CORTEX_PROXY_URL
  if (!baseUrl) {
    console.error("[ilustromat] CORTEX_PROXY_URL nie jest ustawione")
    return NextResponse.json({ error: "proxy-not-configured" }, { status: 502 })
  }

  const email = request.headers.get("x-auth-request-email") ?? "anonymous"
  const config = ilustromatConfig()

  let render: Awaited<ReturnType<typeof resolveTemplateRender>>
  try {
    render = await resolveTemplateRender(parsed.data.templateId)
  } catch (error) {
    return toErrorResponse(error)
  }

  let imagePrompt: string
  try {
    const messages = buildImagePromptMessages({
      title: parsed.data.title,
      subtitle: parsed.data.subtitle,
      idea: parsed.data.idea,
      style,
      aspectRatio: format.aspectRatio,
    })
    // Prompt builder to zwykłe wywołanie tekstowe — few-shot jest zaszyty
    // w wiadomościach, więc adapter dostaje je już złożone.
    const system = messages[0]!.content
    const conversation = messages
      .slice(1)
      .map(
        (message) => `${message.role === "assistant" ? "Assistant" : "User"}: ${message.content}`,
      )
      .join("\n\n")

    const result = await callCortexProxy({
      baseUrl,
      email,
      model: config.textModel,
      scope: SCOPES.promptBuilder,
      systemPrompt: system,
      userPrompt: conversation,
      maxTokens: 400,
      temperature: 0.6,
      image: undefined,
      appLabel: APP_LABEL,
      sourceApp: SOURCE_APP,
    })
    imagePrompt = result.content.trim()
  } catch (error) {
    return toUpstreamErrorResponse(error)
  }

  try {
    // Warianty lecą RÓWNOLEGLE — PoC robił to w pętli sekwencyjnie, co przy
    // 4 wariantach po ~10 s dawało minutę oczekiwania.
    const backgrounds = await Promise.all(
      Array.from({ length: parsed.data.variants }, () =>
        callCortexProxyImage({
          baseUrl,
          email,
          model: config.imageModel,
          scope: SCOPES.generation,
          messages: [{ role: "user", content: imagePrompt }],
          appLabel: APP_LABEL,
          sourceApp: SOURCE_APP,
          timeoutMs: IMAGE_TIMEOUT_MS,
        }),
      ),
    )

    const variants = await Promise.all(
      backgrounds.map(async (background) => {
        const raw = decodeDataUrl(background.dataUrl)
        const png = await compose({
          background: raw,
          title: parsed.data.title,
          subtitle: parsed.data.subtitle,
          format,
          template: render.template,
          fonts: render.fonts,
          logo: render.logo,
        })
        return {
          background: raw.toString("base64"),
          composed: png.toString("base64"),
        }
      }),
    )

    return NextResponse.json({
      prompt: imagePrompt,
      model: config.imageModel,
      templateId: render.template.id,
      formatKey: format.key,
      variants,
    })
  } catch (error) {
    if (error instanceof Error && error.name === "CortexProxyImageError") {
      return toUpstreamErrorResponse(error)
    }
    return toErrorResponse(error)
  }
}
