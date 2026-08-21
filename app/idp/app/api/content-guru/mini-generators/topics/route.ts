// POST /api/content-guru/mini-generators/topics — generator tematów z
// transkrypcji (design doc D8, §1.4/§4.1) — źródło danych dla modalu
// "Generator tematów" na ekranie generowania. Utility call: NIE przechodzi
// przez run-generation.ts (D5 skan zakazanych fraz nie ma sensu dla surowej
// listy tematów) i NIE zapisuje do content_archive — dokładnie jak "Testuj
// generację" (templates/test-generation/route.ts, Round B).

import { ContentGuruServiceError, generateContent } from "@/lib/content-guru/integration-client"
import {
  MINI_GENERATOR_MAX_TOKENS,
  MINI_GENERATOR_TEMPERATURE,
  TOPIC_COUNT_MAX,
  TOPIC_COUNT_MIN,
  buildTopicsPrompt,
  parseJsonStringArray,
} from "@/lib/content-guru/mini-generators"
import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { requireContentGuruAccess } from "../../_lib/guard"

export const runtime = "nodejs"

const requestSchema = z.object({
  transcript: z.string().trim().min(1).max(20000),
  topicCount: z.number().int().min(TOPIC_COUNT_MIN).max(TOPIC_COUNT_MAX),
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
  const { transcript, topicCount, model } = parsed.data

  try {
    const prompt = buildTopicsPrompt({ transcript, topicCount })
    const generated = await generateContent({
      email,
      model,
      systemPrompt: prompt.systemPrompt,
      userPrompt: prompt.userPrompt,
      maxTokens: MINI_GENERATOR_MAX_TOKENS,
      temperature: MINI_GENERATOR_TEMPERATURE,
    })

    const topics = parseJsonStringArray(generated.content)
    if (topics.length === 0) {
      return NextResponse.json(
        {
          error: "generation-failed",
          message: "Model nie zwrócił poprawnej listy tematów. Spróbuj ponownie.",
        },
        { status: 502 },
      )
    }

    return NextResponse.json({ topics })
  } catch (error) {
    if (error instanceof ContentGuruServiceError) {
      if (error.code === "model-not-allowed") {
        return NextResponse.json(
          { error: "invalid-request", message: error.message },
          { status: 400 },
        )
      }
      console.error("[content-guru] błąd generatora tematów:", error)
      return NextResponse.json({ error: "upstream-error", message: error.message }, { status: 502 })
    }
    console.error("[content-guru] nieoczekiwany błąd generatora tematów:", error)
    return NextResponse.json({ error: "internal-error" }, { status: 500 })
  }
}
