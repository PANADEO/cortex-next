// Orkiestracja trybu batch/pakiet (design doc D4, Faza 5+6 — Faza 6 explicite
// rozszerza infrastrukturę Fazy 5, nie osobna). Pula współbieżności o
// rozmiarze JOB_CONCURRENCY woła run-generation.ts's rdzeń
// (runContentGeneration, wspólny z trybem "Pojedyncza" i "Testuj generację")
// RAZ na każdą pozycję (temat × szablon) — NIE legacy'owy
// single-call-JSON-z-fallbackiem (design doc §1.3 korekta #3). Postęp jest
// persystowany POZYCYJNIE do Postgresa w miarę kończenia się poszczególnych
// wywołań cortex-proxy, nie all-at-once na końcu — użytkownik widzi które
// pozycje są gotowe, zanim reszta się skończy.
//
// Wołane jako fire-and-forget z app/idp/app/api/content-guru/jobs/route.ts
// PO wysłaniu odpowiedzi `202` — celowo NIE next/server's `after()`:
// `after()` rzuca synchronicznie "`after` was called outside a request
// scope" (node_modules/next/dist/server/after/after.js), gdy nie ma
// aktywnego `workAsyncStorage`, a DOKŁADNIE tak są wołane route handlery we
// WSZYSTKICH testach jednostkowych tego repo (bezpośrednie wywołanie
// wyeksportowanej funkcji `POST`/`GET`, nie przez realny serwer Next.js) —
// użycie `after()` uczyniłoby każdy test tej trasy niemożliwym bez
// mockowania wewnętrznego AsyncLocalStorage Next.js. W self-hosted Node
// procesie (`output: "standalone"`, docs/frontend-architecture.md) zwykły
// nie-awaitowany Promise przeżywa wysłanie odpowiedzi identycznie dobrze —
// proces nie kończy się po flush odpowiedzi jak w środowisku serverless, dla
// którego `after()` został zaprojektowany.
//
// Zero Drizzle bezpośrednio — cała persystencja idzie przez @cortex/service
// (code-service), zgodnie z konwencją lib/content-guru/ (orkiestracja
// promptu/modelu, nie właściciel danych).

import {
  finishGenerationJob,
  markGenerationJobRunning,
  saveArchiveEntry,
  updateGenerationJobItem,
  type GenerationJobItem,
} from "@cortex/service"
import { JOB_CONCURRENCY } from "./job-limits"
import { runContentGeneration } from "./run-generation"

export interface BatchGenerationItemInput {
  templateId: string
  templateLabel: string
  templateContent: string
  topic: string
}

export interface ProcessGenerationJobInput {
  email: string
  jobId: string
  mode: "batch" | "package"
  /** Kolejność MUSI odpowiadać dokładnie tej, z jaką job został utworzony
   *  (`createGenerationJob`) — indeks w tej tablicy jest indeksem w
   *  `generation_jobs.items`, na który `updateGenerationJobItem()` celuje. */
  items: readonly BatchGenerationItemInput[]
  targetAudience: string
  additionalInfo: string
  model: string
  clientContext: string | null
  marketContext: string | null
  clientProfileId: string | null
  marketProfileId: string | null
  forbiddenPhrases: readonly string[]
}

/**
 * Odpala WSZYSTKIE pozycje joba przez pulę współbieżności o rozmiarze
 * JOB_CONCURRENCY (4-6, D4) — NIGDY plain `Promise.all()` (nieograniczona
 * współbieżność zalałaby cortex-proxy przy pakiecie 30 pozycji), NIGDY
 * sekwencyjna pętla (zbyt wolno). Implementacja to klasyczna "pula
 * workerów": `JOB_CONCURRENCY` asynchronicznych pętli dzieli WSPÓLNY,
 * mutowalny kursor — w danej chwili w locie jest co najwyżej tyle wywołań
 * cortex-proxy, ile wynosi rozmiar puli, niezależnie od liczby pozycji.
 *
 * Zwraca dopiero, gdy KAŻDA pozycja ma status końcowy — wołający (route) NIE
 * czeka na ten zwrot (fire-and-forget, patrz komentarz nagłówkowy pliku),
 * ale funkcja sama w sobie jest w pełni awaitowalna, więc testy jednostkowe
 * mogą ją odpalić i poczekać na zakończenie bez fightowania z timerami.
 */
export async function processGenerationJob(input: ProcessGenerationJobInput): Promise<void> {
  const { email, jobId, items } = input

  let hasError = false
  let cursor = 0

  async function runOneItem(index: number, item: BatchGenerationItemInput): Promise<void> {
    // Widoczne "w toku" PRZED wywołaniem modelu — user widzi realny,
    // per-pozycyjny postęp na pollu, nie tylko skok pending->done.
    await updateGenerationJobItem(email, jobId, index, { status: "running" })

    try {
      const generated = await runContentGeneration({
        email,
        model: input.model,
        contentType: item.templateLabel,
        topic: item.topic,
        targetAudience: input.targetAudience,
        additionalInfo: input.additionalInfo,
        template: item.templateContent,
        clientContext: input.clientContext,
        marketContext: input.marketContext,
        keywordPhrase: null,
        metaDescription: null,
        forbiddenPhrases: input.forbiddenPhrases,
      })

      // Treść jest ZAWSZE zapisywana do archiwum, nawet przy
      // "done-with-warnings" — nigdy nie wyrzucamy płatnego wywołania LLM po
      // cichu (D5, ta sama zasada co tryb "Pojedyncza").
      const saved = await saveArchiveEntry(email, {
        contentType: item.templateLabel,
        topic: item.topic,
        generatedContent: generated.content,
        status: generated.status,
        matchedForbiddenPhrases: generated.matchedForbiddenPhrases,
        targetAudience: input.targetAudience || null,
        additionalInfo: input.additionalInfo || null,
        keywordPhrase: null,
        metaDescription: null,
        modelUsed: generated.model,
        clientProfileId: input.clientProfileId,
        marketProfileId: input.marketProfileId,
        metadata: { generationMode: input.mode, jobId },
      })

      const patch: Partial<GenerationJobItem> = {
        status: generated.status,
        content: generated.content,
        archiveId: saved.id,
      }
      if (generated.matchedForbiddenPhrases.length > 0) {
        patch.matchedForbiddenPhrases = generated.matchedForbiddenPhrases
      }
      await updateGenerationJobItem(email, jobId, index, patch)
    } catch (error) {
      // Błąd JEDNEJ pozycji nie przerywa reszty puli (worker po prostu
      // przechodzi do kolejnego indeksu) i nie psuje treści już zapisanych
      // przez inne pozycje — partial-failure widoczny, nie ukryty (D4 krok
      // 5, decyzja Alexa 03.08.2026 §9 p.3).
      hasError = true
      const message = error instanceof Error ? error.message : "Nieoczekiwany błąd generowania."
      console.error(`[content-guru] błąd generowania pozycji joba ${jobId}[${index}]:`, error)
      await updateGenerationJobItem(email, jobId, index, { status: "error", errorMessage: message })
    }
  }

  async function worker(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      const item = items[index]
      if (!item) continue
      await runOneItem(index, item)
    }
  }

  // Cały bieg joba (włącznie z markGenerationJobRunning i pulą workerów) jest
  // owinięty w try/catch — pojedyncze pozycje już łapią własne błędy
  // (runOneItem powyżej), ale coś poza tym (np. przejściowa awaria Postgresa
  // w markGenerationJobRunning albo w updateGenerationJobItem wewnątrz
  // catch-a runOneItem) NIE może zostawić joba trwale zawieszonego na
  // "running"/"queued" bez ścieżki wyjścia — polling na UI (useGenerationJob)
  // czeka wyłącznie na status końcowy. Znalezione przez review Rundy C
  // (03.08.2026).
  try {
    await markGenerationJobRunning(email, jobId)

    const workerCount = Math.min(JOB_CONCURRENCY, items.length)
    await Promise.all(Array.from({ length: workerCount }, () => worker()))

    await finishGenerationJob(email, jobId, hasError ? "done-with-errors" : "done")
  } catch (error) {
    console.error(`[content-guru] processGenerationJob: nieoczekiwany błąd joba ${jobId}:`, error)
    try {
      await finishGenerationJob(email, jobId, "done-with-errors")
    } catch (finishError) {
      console.error(`[content-guru] processGenerationJob: finishGenerationJob też zawiódł dla joba ${jobId}:`, finishError)
    }
  }
}
