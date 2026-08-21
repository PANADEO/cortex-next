// Testy orkiestracji trybu batch/pakiet (D4) — pula współbieżności GENUINE
// (nie tylko "ma limit w komentarzu" — empirycznie dowiedziona przez
// zliczanie równoczesnych w-locie wywołań runContentGeneration, wzorem
// wymogu weryfikacji z design docu), per-pozycyjna aktualizacja Postgresa w
// miarę kończenia się pozycji (nie all-at-once), i widoczny partial-failure
// ("done-with-errors" z zachowaniem treści udanych pozycji).

import { beforeEach, describe, expect, it, vi } from "vitest"
import { JOB_CONCURRENCY } from "./job-limits"
import type { BatchGenerationItemInput, ProcessGenerationJobInput } from "./run-batch-generation"

interface ItemPatch {
  status?: string
  content?: string
  archiveId?: string
  matchedForbiddenPhrases?: string[]
  errorMessage?: string
}

const service = vi.hoisted(() => ({
  markGenerationJobRunning: vi.fn<(userEmail: string, jobId: string) => Promise<void>>(),
  updateGenerationJobItem:
    vi.fn<
      (userEmail: string, jobId: string, itemIndex: number, patch: ItemPatch) => Promise<void>
    >(),
  saveArchiveEntry: vi.fn(async (_userEmail: string, input: { modelUsed: string }) => ({
    id: `archive-${Math.random().toString(36).slice(2)}`,
    modelUsed: input.modelUsed,
  })),
  finishGenerationJob: vi.fn<(userEmail: string, jobId: string, status: string) => Promise<void>>(),
}))
vi.mock("@cortex/service", () => service)

const runContentGeneration = vi.hoisted(() => vi.fn())
vi.mock("./run-generation", () => ({ runContentGeneration }))

const { processGenerationJob } = await import("./run-batch-generation")

const EMAIL = "tworca@firma.pl"
const JOB_ID = "job-1"

function makeItem(topic: string, templateId = "template-1"): BatchGenerationItemInput {
  return {
    templateId,
    templateLabel: "Kategoria — Nazwa",
    templateContent: "treść szablonu",
    topic,
  }
}

function baseInput(items: BatchGenerationItemInput[]): ProcessGenerationJobInput {
  return {
    email: EMAIL,
    jobId: JOB_ID,
    mode: "batch",
    items,
    targetAudience: "",
    additionalInfo: "",
    model: "anthropic/claude-sonnet-4.6",
    clientContext: null,
    marketContext: null,
    clientProfileId: null,
    marketProfileId: null,
    forbiddenPhrases: [],
  }
}

/** Odblokowuje mikrozadania w kolejce (kilka `await`-ów w łańcuchu workera:
 *  updateGenerationJobItem "running" -> runContentGeneration) — `setTimeout`
 *  jako makrozadanie wykonuje się dopiero PO wyczerpaniu WSZYSTKICH bieżących
 *  mikrozadań, więc jedno użycie wystarcza, by wszyscy workerzy dotarli do
 *  swojego punktu oczekiwania. */
function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

beforeEach(() => {
  service.markGenerationJobRunning.mockClear()
  service.updateGenerationJobItem.mockClear()
  service.saveArchiveEntry.mockClear()
  service.finishGenerationJob.mockClear()
  runContentGeneration.mockReset()
})

describe("processGenerationJob — pula współbieżności (D4)", () => {
  it(`ogranicza w-locie wywołania runContentGeneration do JOB_CONCURRENCY (${JOB_CONCURRENCY}), nie odpala wszystkich naraz`, async () => {
    const items = Array.from({ length: JOB_CONCURRENCY + 3 }, (_, i) => makeItem(`temat ${i}`))
    let inFlight = 0
    let maxInFlight = 0
    const releases: (() => void)[] = []

    runContentGeneration.mockImplementation(() => {
      inFlight += 1
      maxInFlight = Math.max(maxInFlight, inFlight)
      return new Promise((resolve) => {
        releases.push(() => {
          inFlight -= 1
          resolve({
            content: "treść",
            status: "done",
            matchedForbiddenPhrases: [],
            model: "m",
            tokensUsed: 1,
          })
        })
      })
    })

    const done = processGenerationJob(baseInput(items))
    await flush()

    // Dokładnie JOB_CONCURRENCY pozycji odpaliło wywołanie modelu — reszta
    // (3 dodatkowe pozycje ponad limit) czeka na wolnego workera, mimo że
    // WSZYSTKIE 8 pozycji jest już "dostępnych" do przetworzenia.
    expect(runContentGeneration).toHaveBeenCalledTimes(JOB_CONCURRENCY)
    expect(inFlight).toBe(JOB_CONCURRENCY)

    // Zwolnienie JEDNEJ pozycji odblokowuje DOKŁADNIE jednego kolejnego
    // workera (cursor advances by one), nie więcej — pula pozostaje
    // ograniczona przez cały czas trwania joba, nie tylko na starcie.
    releases[0]!()
    await flush()
    expect(runContentGeneration).toHaveBeenCalledTimes(JOB_CONCURRENCY + 1)
    expect(inFlight).toBe(JOB_CONCURRENCY)

    // Dokończ resztę — zwalniaj każdą pozycję w miarę pojawiania się w
    // `releases` (worker startuje kolejną dopiero PO zwolnieniu poprzedniej,
    // więc trzeba przeplatać release+flush, nie zwolnić wszystkiego naraz).
    let releasedCount = 1
    let guard = 0
    while (releasedCount < items.length && guard < 50) {
      guard += 1
      while (releasedCount < releases.length) {
        releases[releasedCount]!()
        releasedCount += 1
      }
      await flush()
    }
    await done

    expect(runContentGeneration).toHaveBeenCalledTimes(items.length)
    // Pula GENUINE osiągnęła pełny rozmiar (nie sekwencyjna pętla, gdzie
    // maxInFlight byłoby 1).
    expect(maxInFlight).toBe(JOB_CONCURRENCY)
    expect(service.finishGenerationJob).toHaveBeenCalledWith(EMAIL, JOB_ID, "done")
  })

  it("nigdy nie przekracza JOB_CONCURRENCY nawet gdy pozycje kończą się w różnym tempie", async () => {
    const items = Array.from({ length: JOB_CONCURRENCY * 2 }, (_, i) => makeItem(`temat ${i}`))
    let inFlight = 0
    let maxInFlight = 0

    runContentGeneration.mockImplementation(async () => {
      inFlight += 1
      maxInFlight = Math.max(maxInFlight, inFlight)
      // Czas losowy, ale ograniczony — symuluje pozycje kończące się w
      // różnej kolejności, nie FIFO.
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 5))
      inFlight -= 1
      return {
        content: "treść",
        status: "done",
        matchedForbiddenPhrases: [],
        model: "m",
        tokensUsed: 1,
      }
    })

    await processGenerationJob(baseInput(items))

    expect(maxInFlight).toBeLessThanOrEqual(JOB_CONCURRENCY)
    expect(maxInFlight).toBe(JOB_CONCURRENCY)
    expect(runContentGeneration).toHaveBeenCalledTimes(items.length)
  })
})

describe("processGenerationJob — postęp per-pozycyjny (nie all-at-once)", () => {
  it("każda pozycja dostaje 'running' PRZED wywołaniem modelu, potem status końcowy PO", async () => {
    const items = [makeItem("temat A"), makeItem("temat B")]
    runContentGeneration.mockResolvedValue({
      content: "treść",
      status: "done",
      matchedForbiddenPhrases: [],
      model: "m",
      tokensUsed: 1,
    })

    await processGenerationJob(baseInput(items))

    const calls = service.updateGenerationJobItem.mock.calls
    const runningCalls = calls.filter(
      (call) => (call[3] as { status?: string }).status === "running",
    )
    const doneCalls = calls.filter((call) => (call[3] as { status?: string }).status === "done")
    expect(runningCalls).toHaveLength(2)
    expect(doneCalls).toHaveLength(2)

    // Dla KAŻDEGO indeksu "running" poprzedza jego własny status końcowy.
    for (const index of [0, 1]) {
      const runningIdx = calls.findIndex(
        (call) => call[2] === index && (call[3] as { status?: string }).status === "running",
      )
      const doneIdx = calls.findIndex(
        (call) => call[2] === index && (call[3] as { status?: string }).status === "done",
      )
      expect(runningIdx).toBeGreaterThanOrEqual(0)
      expect(doneIdx).toBeGreaterThan(runningIdx)
    }
  })

  it("markGenerationJobRunning wołane RAZ na starcie, PRZED pierwszą pozycją", async () => {
    runContentGeneration.mockResolvedValue({
      content: "treść",
      status: "done",
      matchedForbiddenPhrases: [],
      model: "m",
      tokensUsed: 1,
    })

    await processGenerationJob(baseInput([makeItem("temat")]))

    expect(service.markGenerationJobRunning).toHaveBeenCalledTimes(1)
    expect(service.markGenerationJobRunning).toHaveBeenCalledWith(EMAIL, JOB_ID)
  })

  it("saveArchiveEntry zapisuje KAŻDĄ udaną pozycję, przekazując clientProfileId/marketProfileId z joba", async () => {
    runContentGeneration.mockResolvedValue({
      content: "treść wygenerowana",
      status: "done",
      matchedForbiddenPhrases: [],
      model: "anthropic/claude-sonnet-4.6",
      tokensUsed: 42,
    })

    const input = baseInput([makeItem("temat")])
    input.clientProfileId = "client-1"
    input.marketProfileId = "market-1"
    await processGenerationJob(input)

    expect(service.saveArchiveEntry).toHaveBeenCalledWith(
      EMAIL,
      expect.objectContaining({
        generatedContent: "treść wygenerowana",
        clientProfileId: "client-1",
        marketProfileId: "market-1",
        metadata: { generationMode: "batch", jobId: JOB_ID },
      }),
    )
  })
})

describe("processGenerationJob — partial failure widoczny (D4 krok 5)", () => {
  it("jedna nieudana pozycja -> 'error' TYLKO dla niej, reszta zachowuje realną treść, job 'done-with-errors'", async () => {
    const items = [makeItem("temat OK 1"), makeItem("temat ZŁY"), makeItem("temat OK 2")]

    runContentGeneration.mockImplementation(async (args: { topic: string }) => {
      if (args.topic === "temat ZŁY") throw new Error("cortex-proxy: upstream timeout")
      return {
        content: `treść dla ${args.topic}`,
        status: "done",
        matchedForbiddenPhrases: [],
        model: "m",
        tokensUsed: 1,
      }
    })

    await processGenerationJob(baseInput(items))

    const calls = service.updateGenerationJobItem.mock.calls
    const errorPatch = calls.find(
      (call) => call[2] === 1 && (call[3] as { status?: string }).status === "error",
    )
    expect(errorPatch).toBeDefined()
    expect((errorPatch![3] as { errorMessage?: string }).errorMessage).toContain("upstream timeout")

    const okPatch0 = calls.find(
      (call) => call[2] === 0 && (call[3] as { status?: string }).status === "done",
    )
    const okPatch2 = calls.find(
      (call) => call[2] === 2 && (call[3] as { status?: string }).status === "done",
    )
    expect((okPatch0![3] as { content?: string }).content).toBe("treść dla temat OK 1")
    expect((okPatch2![3] as { content?: string }).content).toBe("treść dla temat OK 2")

    // Pozycja, która się nie powiodła, NIE trafia do archiwum — tylko dwie
    // udane.
    expect(service.saveArchiveEntry).toHaveBeenCalledTimes(2)

    expect(service.finishGenerationJob).toHaveBeenCalledWith(EMAIL, JOB_ID, "done-with-errors")
  })

  it("'done-with-warnings' (zakazane frazy po retry) NIE liczy się jako błąd -> job nadal 'done'", async () => {
    runContentGeneration.mockResolvedValue({
      content: "treść z zakazaną frazą",
      status: "done-with-warnings",
      matchedForbiddenPhrases: ["najlepszy na rynku"],
      model: "m",
      tokensUsed: 1,
    })

    await processGenerationJob(baseInput([makeItem("temat")]))

    expect(service.finishGenerationJob).toHaveBeenCalledWith(EMAIL, JOB_ID, "done")
    const patch = service.updateGenerationJobItem.mock.calls.find(
      (call) => call[2] === 0 && (call[3] as { status?: string }).status === "done-with-warnings",
    )
    expect(patch).toBeDefined()
    expect((patch![3] as { matchedForbiddenPhrases?: string[] }).matchedForbiddenPhrases).toEqual([
      "najlepszy na rynku",
    ])
  })

  it("błąd saveArchiveEntry (nie tylko generowania) też mapuje pozycję na 'error', nie wywraca reszty puli", async () => {
    const items = [makeItem("temat 1"), makeItem("temat 2")]
    runContentGeneration.mockResolvedValue({
      content: "treść",
      status: "done",
      matchedForbiddenPhrases: [],
      model: "m",
      tokensUsed: 1,
    })
    service.saveArchiveEntry.mockRejectedValueOnce(new Error("DB zapis nieudany"))

    await processGenerationJob(baseInput(items))

    const calls = service.updateGenerationJobItem.mock.calls
    const errorPatch = calls.find((call) => (call[3] as { status?: string }).status === "error")
    expect(errorPatch).toBeDefined()
    expect(service.finishGenerationJob).toHaveBeenCalledWith(EMAIL, JOB_ID, "done-with-errors")
  })
})
