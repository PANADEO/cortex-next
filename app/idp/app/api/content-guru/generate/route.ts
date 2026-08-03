// POST /api/content-guru/generate — tryb "Pojedyncza", jedyny funkcjonalny
// tryb tej rundy (design doc §8 Faza 1+2 połączone; "Kilka"/"Pakiet" to Round
// E/F, generation_jobs jeszcze nieużywane). Kontroler: parse -> auth ->
// deleguj -> odpowiedz (code-api) — logika promptu w
// lib/content-guru/prompt-builder.ts, walidacja zakazanych fraz w
// lib/content-guru/forbidden-phrase-check.ts, wywołanie LLM w
// lib/content-guru/integration-client.ts, CRUD w @cortex/service/content-guru.ts.
//
// D5: jedna automatyczna eskalowana próba ponowienia, jeśli pierwsza
// odpowiedź zawiera zakazaną frazę usera. Treść ZAWSZE zapisywana do
// archiwum — nigdy nie wyrzucamy płatnego wywołania LLM po cichu, status
// "done-with-warnings" jest wyłącznie widocznym ostrzeżeniem, nie blokadą
// (decyzja Alexa 03.08.2026, design doc §9 p.2, zamknięta).
//
// Round B/C/D nie są tu jeszcze wpięte (brak CRUD szablonów/profili/mini-
// generatorów) — stąd template/clientContext/marketContext/keywordPhrase/
// metaDescription lecą do prompt-buildera jako `null`, kontrakt funkcji już
// je przewiduje (patrz prompt-builder.ts).

import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { listMyForbiddenPhrases, saveArchiveEntry } from "@cortex/service"
import { buildContentGuruPrompt } from "@/lib/content-guru/prompt-builder"
import {
  findMatchedForbiddenPhrases,
  resolveGenerationStatus,
} from "@/lib/content-guru/forbidden-phrase-check"
import { ContentGuruServiceError, generateContent } from "@/lib/content-guru/integration-client"
import { requireContentGuruAccess } from "../_lib/guard"

export const runtime = "nodejs"

// 1:1 z dzisiejszym limitem cienkiego narzędzia AI Tools (registry.ts,
// content-guru maxTokens: 8000) — nie zmieniany przy porcie.
const GENERATION_MAX_TOKENS = 8000
// D3: stała w kodzie, 1:1 z legacy `temperature=0.7` dla generacji treści
// (mini-generatory, Round D, dostają osobną stałą 0.3 wtedy).
const GENERATION_TEMPERATURE = 0.7

const requestSchema = z.object({
  contentType: z.string().trim().min(1).max(200),
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
  const { contentType, topic, targetAudience, additionalInfo, model } = parsed.data

  try {
    const forbiddenPhraseRows = await listMyForbiddenPhrases(email)
    const forbiddenPhrases = forbiddenPhraseRows.map((row) => row.phrase)

    const buildPrompt = (escalation: { matchedPhrases: readonly string[] } | null = null) =>
      buildContentGuruPrompt({
        contentType,
        topic,
        targetAudience,
        additionalInfo,
        template: null,
        clientContext: null,
        marketContext: null,
        keywordPhrase: null,
        metaDescription: null,
        forbiddenPhrases,
        escalation,
      })

    const callModel = (prompt: ReturnType<typeof buildPrompt>) =>
      generateContent({
        email,
        model,
        systemPrompt: prompt.systemPrompt,
        userPrompt: prompt.userPrompt,
        maxTokens: GENERATION_MAX_TOKENS,
        temperature: GENERATION_TEMPERATURE,
      })

    let generated = await callModel(buildPrompt())
    let matched = findMatchedForbiddenPhrases(generated.content, forbiddenPhrases)

    // Warstwa 2 (D5): jedna automatyczna, eskalowana próba ponowienia. Treść
    // z TEJ (drugiej) próby jest tą, którą zapisujemy — niezależnie od tego,
    // czy nadal zawiera zakazaną frazę.
    if (matched.length > 0) {
      generated = await callModel(buildPrompt({ matchedPhrases: matched }))
      matched = findMatchedForbiddenPhrases(generated.content, forbiddenPhrases)
    }

    const status = resolveGenerationStatus(matched)

    const saved = await saveArchiveEntry(email, {
      contentType,
      topic,
      generatedContent: generated.content,
      status,
      matchedForbiddenPhrases: matched,
      targetAudience: targetAudience || null,
      additionalInfo: additionalInfo || null,
      keywordPhrase: null,
      metaDescription: null,
      modelUsed: generated.model,
      metadata: { generationMode: "single" },
    })

    return NextResponse.json({
      id: saved.id,
      content: saved.generatedContent,
      status: saved.status,
      matchedForbiddenPhrases: matched,
      model: saved.modelUsed,
      createdAt: saved.createdAt,
    })
  } catch (error) {
    if (error instanceof ContentGuruServiceError) {
      if (error.code === "model-not-allowed") {
        return NextResponse.json({ error: "invalid-request", message: error.message }, { status: 400 })
      }
      console.error("[content-guru] błąd generowania:", error)
      return NextResponse.json({ error: "upstream-error", message: error.message }, { status: 502 })
    }
    console.error("[content-guru] nieoczekiwany błąd generowania:", error)
    return NextResponse.json({ error: "internal-error" }, { status: 500 })
  }
}
