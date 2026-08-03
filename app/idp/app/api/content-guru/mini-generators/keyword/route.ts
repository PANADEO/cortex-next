// POST /api/content-guru/mini-generators/keyword — fraza kluczowa SEO
// (design doc D8, §1.4/§4.1) — inline "Generuj" przy polu na ekranie
// generowania. Utility call, wzorem topics/route.ts: NIE przechodzi przez
// run-generation.ts, NIE zapisuje do content_archive.

import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { ContentGuruServiceError, generateContent } from "@/lib/content-guru/integration-client"
import {
  MINI_GENERATOR_MAX_TOKENS,
  MINI_GENERATOR_TEMPERATURE,
  buildKeywordPhrasePrompt,
  stripWrappingQuotes,
} from "@/lib/content-guru/mini-generators"
import { requireContentGuruAccess } from "../../_lib/guard"

export const runtime = "nodejs"

const requestSchema = z.object({
  topic: z.string().trim().min(1).max(500),
  targetAudience: z.string().trim().max(500).optional().default(""),
  additionalInfo: z.string().trim().max(4000).optional().default(""),
  model: z.string().trim().min(1),
})

export async function POST(request: NextRequest): Promise<NextResponse> {
  const gate = await requireContentGuruAccess(request)
  if ("deny" in gate) return gate.deny
  const { email } = gate

  const parsed = requestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid-request", message: parsed.error.issues[0]?.message },
      { status: 400 },
    )
  }
  const { topic, targetAudience, additionalInfo, model } = parsed.data

  try {
    const prompt = buildKeywordPhrasePrompt({ topic, targetAudience, additionalInfo })
    const generated = await generateContent({
      email,
      model,
      systemPrompt: prompt.systemPrompt,
      userPrompt: prompt.userPrompt,
      maxTokens: MINI_GENERATOR_MAX_TOKENS,
      temperature: MINI_GENERATOR_TEMPERATURE,
    })

    const keywordPhrase = stripWrappingQuotes(generated.content)
    if (!keywordPhrase) {
      return NextResponse.json(
        { error: "generation-failed", message: "Model nie zwrócił frazy kluczowej. Spróbuj ponownie." },
        { status: 502 },
      )
    }

    return NextResponse.json({ keywordPhrase })
  } catch (error) {
    if (error instanceof ContentGuruServiceError) {
      if (error.code === "model-not-allowed") {
        return NextResponse.json({ error: "invalid-request", message: error.message }, { status: 400 })
      }
      console.error("[content-guru] błąd generatora frazy kluczowej:", error)
      return NextResponse.json({ error: "upstream-error", message: error.message }, { status: 502 })
    }
    console.error("[content-guru] nieoczekiwany błąd generatora frazy kluczowej:", error)
    return NextResponse.json({ error: "internal-error" }, { status: 500 })
  }
}
