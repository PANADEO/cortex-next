// POST /api/content-guru/templates/test-generation — "Testuj generację"
// (design doc §4.2): jednorazowe wywołanie modelu z BIEŻĄCĄ (możliwie
// niezapisaną jeszcze) treścią edytowanego szablonu i przykładowym tematem,
// przez DOKŁADNIE tę samą maszynerię co POST /generate
// (lib/content-guru/run-generation.ts — prompt + D5 skan/retry zakazanych
// fraz), z jedną różnicą: wynik NIE trafia do content_archive. To pozwala
// zweryfikować brzmienie/strukturę szablonu bez opuszczania ekranu edycji i
// bez zaśmiecania archiwum testowymi wpisami.
//
// Gated `manage-templates`, tak jak reszta ekranu edycji szablonów — to
// realne, płatne wywołanie LLM, więc tylko ten, kto i tak może zmieniać
// szablony, może je odpalać.

import { ContentGuruServiceError } from "@/lib/content-guru/integration-client"
import { runContentGeneration } from "@/lib/content-guru/run-generation"
import { listMyForbiddenPhrases } from "@cortex/service"
import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { requireContentGuruManageTemplates } from "../../_lib/guard"

export const runtime = "nodejs"

const DEFAULT_SAMPLE_TOPIC = "Przykładowy temat testowy"

const requestSchema = z.object({
  category: z.string().trim().min(1).max(120),
  name: z.string().trim().min(1).max(200),
  content: z.string().trim().min(1).max(20000),
  topic: z.string().trim().max(500).optional(),
  model: z.string().trim().min(1),
})

export async function POST(request: NextRequest): Promise<NextResponse> {
  const gate = await requireContentGuruManageTemplates(request)
  if ("deny" in gate) return gate.deny
  const { email } = gate

  const parsed = requestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid-request", message: parsed.error.issues[0]?.message },
      { status: 400 },
    )
  }
  const { category, name, content, topic, model } = parsed.data

  try {
    const forbiddenPhraseRows = await listMyForbiddenPhrases(email)

    const generated = await runContentGeneration({
      email,
      model,
      contentType: `${category} — ${name}`,
      topic: topic || DEFAULT_SAMPLE_TOPIC,
      targetAudience: "",
      additionalInfo: "",
      template: content,
      clientContext: null,
      marketContext: null,
      keywordPhrase: null,
      metaDescription: null,
      forbiddenPhrases: forbiddenPhraseRows.map((row) => row.phrase),
    })

    // Świadomie ŻADNEGO saveArchiveEntry() tutaj — patrz komentarz nagłówkowy.
    return NextResponse.json({
      content: generated.content,
      status: generated.status,
      matchedForbiddenPhrases: generated.matchedForbiddenPhrases,
      model: generated.model,
    })
  } catch (error) {
    if (error instanceof ContentGuruServiceError) {
      if (error.code === "model-not-allowed") {
        return NextResponse.json(
          { error: "invalid-request", message: error.message },
          { status: 400 },
        )
      }
      console.error("[content-guru] błąd testowej generacji szablonu:", error)
      return NextResponse.json({ error: "upstream-error", message: error.message }, { status: 502 })
    }
    console.error("[content-guru] nieoczekiwany błąd testowej generacji szablonu:", error)
    return NextResponse.json({ error: "internal-error" }, { status: 500 })
  }
}
