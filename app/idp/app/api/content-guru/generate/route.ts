// POST /api/content-guru/generate — tryb "Pojedyncza", jedyny funkcjonalny
// tryb tej rundy (design doc §8 Faza 1+2 połączone; "Kilka"/"Pakiet" to Round
// E/F, generation_jobs jeszcze nieużywane). Kontroler: parse -> auth ->
// deleguj -> odpowiedz (code-api) — rdzeń prompt+model+D5 w
// lib/content-guru/run-generation.ts (wspólny z templates/test-generation/
// route.ts, Round B), CRUD w @cortex/service/content-guru.ts.
//
// D5: jedna automatyczna eskalowana próba ponowienia, jeśli pierwsza
// odpowiedź zawiera zakazaną frazę usera. Treść ZAWSZE zapisywana do
// archiwum — nigdy nie wyrzucamy płatnego wywołania LLM po cichu, status
// "done-with-warnings" jest wyłącznie widocznym ostrzeżeniem, nie blokadą
// (decyzja Alexa 03.08.2026, design doc §9 p.2, zamknięta).
//
// Round B: opcjonalny `templateId`/`clientProfileId`/`marketProfileId` —
// jeśli podane, wynik faktycznie zmienia to, co trafia do promptu (D6/D7):
//  - `templateId` -> treść szablonu jako sekcja "Instrukcje szablonu", a
//    `contentType` zapisany w archiwum jest NADPISYWANY etykietą "kategoria —
//    nazwa" wybranego szablonu (źródło prawdy jest po stronie serwera, nie
//    ufamy wolnemu tekstowi z klienta, gdy realny szablon jest wybrany).
//  - `clientProfileId`/`marketProfileId` -> profil (wyłącznie WŁASNY usera,
//    code-service "Rekordy per-user") renderowany przez
//    lib/content-guru/profile-markdown.ts jako sekcja kontekstu, i jego id
//    zapisywany w content_archive.{client,market}ProfileId (kolumny już
//    istniały w schemacie Fazy 0).
// Round D (design doc D8, §1.4/§4.1): `keywordPhrase`/`metaDescription`
// opcjonalne — panel "SEO i metadane" na ekranie generowania jest wspólny
// dla wszystkich trybów, ale tylko "Pojedyncza" faktycznie wysyła te dwie
// wartości do promptu/archiwum (batch/pakiet zostają `null`, wzorem
// run-batch-generation.ts — nie każdy z N*M elementów batcha ma sens z tą
// samą frazą/meta, poza zakresem Round D). `metaDescription` capowane na 160
// znaków — legacy walidował to twardo przed submitem.

import { ContentGuruServiceError } from "@/lib/content-guru/integration-client"
import { META_DESCRIPTION_MAX_CHARS } from "@/lib/content-guru/mini-generators"
import {
  clientProfileToMarkdown,
  marketProfileToMarkdown,
} from "@/lib/content-guru/profile-markdown"
import { runContentGeneration } from "@/lib/content-guru/run-generation"
import {
  getMyClientProfile,
  getMyMarketProfile,
  getTemplate,
  listMyForbiddenPhrases,
  saveArchiveEntry,
} from "@cortex/service"
import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { requireContentGuruAccess } from "../_lib/guard"

export const runtime = "nodejs"

const requestSchema = z.object({
  contentType: z.string().trim().min(1).max(200),
  topic: z.string().trim().min(1).max(500),
  targetAudience: z.string().trim().max(500).optional().default(""),
  additionalInfo: z.string().trim().max(4000).optional().default(""),
  model: z.string().trim().min(1),
  templateId: z.string().uuid().optional(),
  clientProfileId: z.string().uuid().optional(),
  marketProfileId: z.string().uuid().optional(),
  keywordPhrase: z.string().trim().max(200).optional(),
  metaDescription: z.string().trim().max(META_DESCRIPTION_MAX_CHARS).optional(),
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
  let { contentType } = parsed.data

  try {
    let template: string | null = null
    if (parsed.data.templateId) {
      const templateRow = await getTemplate(parsed.data.templateId)
      if (!templateRow) {
        return NextResponse.json(
          { error: "invalid-request", message: "Wybrany szablon nie istnieje." },
          { status: 400 },
        )
      }
      template = templateRow.content
      contentType = `${templateRow.category} — ${templateRow.name}`
    }

    let clientContext: string | null = null
    let clientProfileId: string | null = null
    if (parsed.data.clientProfileId) {
      const profile = await getMyClientProfile(email, parsed.data.clientProfileId)
      if (!profile) {
        return NextResponse.json(
          { error: "invalid-request", message: "Wybrany profil klienta nie istnieje." },
          { status: 400 },
        )
      }
      clientContext = clientProfileToMarkdown(profile)
      clientProfileId = profile.id
    }

    let marketContext: string | null = null
    let marketProfileId: string | null = null
    if (parsed.data.marketProfileId) {
      const profile = await getMyMarketProfile(email, parsed.data.marketProfileId)
      if (!profile) {
        return NextResponse.json(
          { error: "invalid-request", message: "Wybrany profil rynku nie istnieje." },
          { status: 400 },
        )
      }
      marketContext = marketProfileToMarkdown(profile)
      marketProfileId = profile.id
    }

    const forbiddenPhraseRows = await listMyForbiddenPhrases(email)
    const forbiddenPhrases = forbiddenPhraseRows.map((row) => row.phrase)

    const keywordPhrase = parsed.data.keywordPhrase ?? null
    const metaDescription = parsed.data.metaDescription ?? null

    const generated = await runContentGeneration({
      email,
      model,
      contentType,
      topic,
      targetAudience,
      additionalInfo,
      template,
      clientContext,
      marketContext,
      keywordPhrase,
      metaDescription,
      forbiddenPhrases,
    })

    const saved = await saveArchiveEntry(email, {
      contentType,
      topic,
      generatedContent: generated.content,
      status: generated.status,
      matchedForbiddenPhrases: generated.matchedForbiddenPhrases,
      targetAudience: targetAudience || null,
      additionalInfo: additionalInfo || null,
      keywordPhrase,
      metaDescription,
      modelUsed: generated.model,
      clientProfileId,
      marketProfileId,
      metadata: { generationMode: "single" },
    })

    return NextResponse.json({
      id: saved.id,
      content: saved.generatedContent,
      status: saved.status,
      matchedForbiddenPhrases: generated.matchedForbiddenPhrases,
      model: saved.modelUsed,
      createdAt: saved.createdAt,
    })
  } catch (error) {
    if (error instanceof ContentGuruServiceError) {
      if (error.code === "model-not-allowed") {
        return NextResponse.json(
          { error: "invalid-request", message: error.message },
          { status: 400 },
        )
      }
      console.error("[content-guru] błąd generowania:", error)
      return NextResponse.json({ error: "upstream-error", message: error.message }, { status: 502 })
    }
    console.error("[content-guru] nieoczekiwany błąd generowania:", error)
    return NextResponse.json({ error: "internal-error" }, { status: 500 })
  }
}
