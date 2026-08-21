// POST /api/content-guru/mini-generators/keyword — fraza kluczowa SEO
// (design doc D8, §1.4/§4.1) — inline "Generuj" przy polu na ekranie
// generowania. Utility call, wzorem topics/route.ts: NIE przechodzi przez
// run-generation.ts, NIE zapisuje do content_archive.

import { ContentGuruServiceError, generateContent } from "@/lib/content-guru/integration-client"
import {
  MINI_GENERATOR_MAX_TOKENS,
  MINI_GENERATOR_TEMPERATURE,
  buildKeywordPhrasePrompt,
  stripWrappingQuotes,
} from "@/lib/content-guru/mini-generators"
import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
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
    // Sam KOD, bez napisu: serwer nie zna języka użytkownika (wybór siedzi w
    // localStorage przeglądarki), więc zdanie powstaje na kliencie.
    return NextResponse.json({ error: "invalid-request" }, { status: 400 })
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
      return NextResponse.json({ error: "generation-failed" }, { status: 502 })
    }

    return NextResponse.json({ keywordPhrase })
  } catch (error) {
    if (error instanceof ContentGuruServiceError) {
      if (error.code === "model-not-allowed") {
        return NextResponse.json({ error: "model-not-allowed" }, { status: 400 })
      }
      console.error("[content-guru] błąd generatora frazy kluczowej:", error)
      return NextResponse.json({ error: "upstream-error" }, { status: 502 })
    }
    console.error("[content-guru] nieoczekiwany błąd generatora frazy kluczowej:", error)
    return NextResponse.json({ error: "internal-error" }, { status: 500 })
  }
}
