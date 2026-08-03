// POST /api/content-guru/jobs — tryby "Kilka" (batch) i "Pakiet" (package),
// design doc D4/Faza 5+6. Kontroler: parse -> auth -> resolve (szablony/
// profile/frazy) -> INSERT queued -> fire-and-forget orkiestracja -> 202 FAST
// (code-api) — rdzeń per-pozycyjny w lib/content-guru/run-batch-generation.ts
// (pula współbieżności wołająca run-generation.ts, wspólną z trybem
// "Pojedyncza" i "Testuj generację"), CRUD/joby w
// @cortex/service/content-guru.ts.
//
// MAX_COMBINATIONS (D4, design doc §9 p.3, ZAMKNIĘTE) — Zod odrzuca `400`
// PRZED insertem, jeśli topics.length * templateIds.length > 30. Batch
// (jeden szablon) jest szczególnym przypadkiem tej samej reguły:
// templateIds.length wymuszone na dokładnie 1 przez `superRefine`, więc
// combinations === topics.length, dokładnie jak design doc opisuje ("albo
// topics.length dla batcha jednoszablonowego").
//
// Model jest walidowany PRZED utworzeniem joba (isAllowedContentGuruModel) —
// inaczej user dostałby "202 queued" job, którego WSZYSTKIE pozycje i tak
// zakończyłyby się błędem "model-not-allowed" (D3, fail-closed) w tle,
// zamiast natychmiastowego, czytelnego 400.

import type { TemplateRow } from "@cortex/db"
import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import {
  createGenerationJob,
  getMyClientProfile,
  getMyMarketProfile,
  getTemplate,
  listMyForbiddenPhrases,
} from "@cortex/service"
import { isAllowedContentGuruModel } from "@/lib/content-guru/config"
import { MAX_COMBINATIONS } from "@/lib/content-guru/job-limits"
import { clientProfileToMarkdown, marketProfileToMarkdown } from "@/lib/content-guru/profile-markdown"
import { processGenerationJob, type BatchGenerationItemInput } from "@/lib/content-guru/run-batch-generation"
import { requireContentGuruAccess } from "../_lib/guard"

export const runtime = "nodejs"

const requestSchema = z
  .object({
    mode: z.enum(["batch", "package"]),
    topics: z.array(z.string().trim().min(1).max(500)).min(1).max(MAX_COMBINATIONS),
    templateIds: z.array(z.string().uuid()).min(1),
    targetAudience: z.string().trim().max(500).optional().default(""),
    additionalInfo: z.string().trim().max(4000).optional().default(""),
    model: z.string().trim().min(1),
    clientProfileId: z.string().uuid().optional(),
    marketProfileId: z.string().uuid().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.mode === "batch" && data.templateIds.length !== 1) {
      ctx.addIssue({
        code: "custom",
        message: "Tryb 'Kilka' wymaga dokładnie jednego wybranego szablonu.",
        path: ["templateIds"],
      })
    }
    const combinations = data.topics.length * data.templateIds.length
    if (combinations > MAX_COMBINATIONS) {
      ctx.addIssue({
        code: "custom",
        message: `Zbyt wiele kombinacji (${combinations}) — limit to ${MAX_COMBINATIONS}. Zmniejsz liczbę tematów lub szablonów.`,
        path: ["topics"],
      })
    }
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
  const { mode, topics, templateIds, targetAudience, additionalInfo, model } = parsed.data

  if (!isAllowedContentGuruModel(model)) {
    return NextResponse.json(
      { error: "invalid-request", message: `Model "${model}" nie jest na liście dozwolonych modeli.` },
      { status: 400 },
    )
  }

  try {
    const uniqueTemplateIds = Array.from(new Set(templateIds))
    const templateRows = await Promise.all(uniqueTemplateIds.map((id) => getTemplate(id)))
    const templateById = new Map<string, TemplateRow>()
    for (let i = 0; i < uniqueTemplateIds.length; i++) {
      const row = templateRows[i]
      if (!row) {
        return NextResponse.json(
          { error: "invalid-request", message: "Jeden z wybranych szablonów nie istnieje." },
          { status: 400 },
        )
      }
      templateById.set(uniqueTemplateIds[i]!, row)
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

    const labelFor = (template: TemplateRow) => `${template.category} — ${template.name}`

    // Batch: 1 szablon × N tematów. Pakiet: M szablonów × N tematów
    // (iloczyn kartezjański, kolejność szablon-zewnętrzna/temat-wewnętrzna —
    // job-card.tsx buduje z tego macierz wierszy=tematy/kolumn=szablony,
    // design doc §4.1 "addresses what legacy's flat list didn't have").
    const items: BatchGenerationItemInput[] =
      mode === "batch"
        ? topics.map((topic) => {
            const template = templateById.get(templateIds[0]!)!
            return {
              templateId: template.id,
              templateLabel: labelFor(template),
              templateContent: template.content,
              topic,
            }
          })
        : templateIds.flatMap((templateId) =>
            topics.map((topic) => {
              const template = templateById.get(templateId)!
              return {
                templateId: template.id,
                templateLabel: labelFor(template),
                templateContent: template.content,
                topic,
              }
            }),
          )

    const job = await createGenerationJob(
      email,
      mode,
      items.map(({ templateId, templateLabel, topic }) => ({ templateId, templateLabel, topic })),
    )

    // Fire-and-forget — celowo NIE awaitowane, patrz komentarz nagłówkowy
    // run-batch-generation.ts o `after()`. Błędy per-pozycyjne są łapane
    // WEWNĄTRZ processGenerationJob; ten `.catch()` jest wyłącznie siecią
    // bezpieczeństwa na nieoczekiwany błąd PRZED/MIĘDZY pozycjami (np.
    // markGenerationJobRunning albo finishGenerationJob), żeby nigdy nie
    // zostawić nieobsłużonego odrzucenia Promise.
    void processGenerationJob({
      email,
      jobId: job.id,
      mode,
      items,
      targetAudience,
      additionalInfo,
      model,
      clientContext,
      marketContext,
      clientProfileId,
      marketProfileId,
      forbiddenPhrases,
    }).catch((error: unknown) => {
      console.error(`[content-guru] nieoczekiwany błąd orkiestracji joba ${job.id}:`, error)
    })

    return NextResponse.json({ jobId: job.id, status: job.status }, { status: 202 })
  } catch (error) {
    console.error("[content-guru] błąd tworzenia zadania generowania:", error)
    return NextResponse.json({ error: "internal-error" }, { status: 500 })
  }
}
