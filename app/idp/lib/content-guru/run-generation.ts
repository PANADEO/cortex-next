// Wspólny rdzeń generowania — prompt + wywołanie modelu + D5 (skan
// zakazanych fraz, jedna eskalowana próba ponowienia). WYDZIELONE z
// api/content-guru/generate/route.ts w Round B, żeby "Testuj generację" na
// ekranie szablonów (design doc §4.2) mogło użyć DOKŁADNIE tej samej
// maszynerii co realna generacja, różniąc się wyłącznie tym, że NIE zapisuje
// wyniku do content_archive (zapis zostaje w wołającym route'cie — to jedyna
// odpowiedzialność, która NIE jest tu wspólna).
//
// Zero Drizzle/RBAC — to warstwa orkiestracji promptu, nie serwis ani
// kontroler.

import {
  findMatchedForbiddenPhrases,
  resolveGenerationStatus,
  type ContentGuruGenerationStatus,
} from "./forbidden-phrase-check"
import { generateContent } from "./integration-client"
import { buildContentGuruPrompt } from "./prompt-builder"

// 1:1 z dzisiejszym limitem cienkiego narzędzia AI Tools (registry.ts,
// content-guru maxTokens: 8000) — nie zmieniany przy porcie (Round A).
export const GENERATION_MAX_TOKENS = 8000
// D3: stała w kodzie, 1:1 z legacy `temperature=0.7` dla generacji treści
// (mini-generatory, Round D, dostają osobną stałą 0.3 wtedy).
export const GENERATION_TEMPERATURE = 0.7

export interface RunContentGenerationInput {
  /** Zawsze `access.email` z bramki — nigdy z ciała żądania. */
  email: string
  model: string
  contentType: string
  topic: string
  targetAudience: string
  additionalInfo: string
  template: string | null
  clientContext: string | null
  marketContext: string | null
  keywordPhrase: string | null
  metaDescription: string | null
  forbiddenPhrases: readonly string[]
}

export interface RunContentGenerationResult {
  content: string
  status: ContentGuruGenerationStatus
  matchedForbiddenPhrases: string[]
  model: string
  tokensUsed: number | null
}

/**
 * Buduje prompt, woła model, i (D5) jeśli wynik zawiera zakazaną frazę —
 * jedna automatyczna próba ponowienia z eskalowaną instrukcją cytującą
 * dokładnie którą frazę model złamał. Zwraca wynik OSTATNIEJ próby zawsze,
 * niezależnie od tego, czy nadal zawiera zakazaną frazę (nigdy nie wyrzucamy
 * płatnego wywołania LLM po cichu — decyzja Alexa 03.08.2026, design doc §9
 * p.2).
 */
export async function runContentGeneration(
  input: RunContentGenerationInput,
): Promise<RunContentGenerationResult> {
  const buildPrompt = (escalation: { matchedPhrases: readonly string[] } | null = null) =>
    buildContentGuruPrompt({
      contentType: input.contentType,
      topic: input.topic,
      targetAudience: input.targetAudience,
      additionalInfo: input.additionalInfo,
      template: input.template,
      clientContext: input.clientContext,
      marketContext: input.marketContext,
      keywordPhrase: input.keywordPhrase,
      metaDescription: input.metaDescription,
      forbiddenPhrases: input.forbiddenPhrases,
      escalation,
    })

  const callModel = (prompt: ReturnType<typeof buildPrompt>) =>
    generateContent({
      email: input.email,
      model: input.model,
      systemPrompt: prompt.systemPrompt,
      userPrompt: prompt.userPrompt,
      maxTokens: GENERATION_MAX_TOKENS,
      temperature: GENERATION_TEMPERATURE,
    })

  let generated = await callModel(buildPrompt())
  let matched = findMatchedForbiddenPhrases(generated.content, input.forbiddenPhrases)

  if (matched.length > 0) {
    generated = await callModel(buildPrompt({ matchedPhrases: matched }))
    matched = findMatchedForbiddenPhrases(generated.content, input.forbiddenPhrases)
  }

  return {
    content: generated.content,
    status: resolveGenerationStatus(matched),
    matchedForbiddenPhrases: matched,
    model: generated.model,
    tokensUsed: generated.tokensUsed,
  }
}
