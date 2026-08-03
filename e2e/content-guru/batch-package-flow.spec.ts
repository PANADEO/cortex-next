// E2E kafelka Content Guru — tryby "Kilka"/"Pakiet" (Tor B, design doc §7/D4,
// wzorem e2e/document-parser/upload-flow.spec.ts): batch/pakiet generują
// IN-PROCESS na serwerze (lib/content-guru/run-batch-generation.ts woła
// cortex-proxy bezpośrednio z Node, fire-and-forget PO wysłaniu odpowiedzi
// 202) — `page.route` nie dosięgnie tego wywołania (ten sam powód co
// Ilustromat/Parser Dokumentów/Visual Guru), więc CAŁY endpoint BFF
// (POST /jobs, GET /jobs/:id) jest mockowany na granicy przeglądarka<->serwer.
// Realny 30-elementowy pakiet trwałby ~20s i kosztowałby prawdziwe wywołania
// LLM — Tor B dowodzi mechaniki pollingu/UI (D4 krok 4-5) deterministycznie,
// bez płacenia za to. Zero seed()/asUser() — prawdziwy route handler nigdy
// się nie wykonuje.

import { expect, test, type Page, type Route } from "@playwright/test"
import { ContentGuruGeneratePage } from "../poms/content-guru/generate-page"
import { mockContentGuruScreenData } from "../support/mocks/content-guru-screen"
import { mockShellAccess } from "../support/mocks/shell-access"

const EMAIL = "demo@cortex.local"
const TILE_GRANT = { apps: ["content-guru"], email: EMAIL }
const JOB_ID = "mock-job-1"
const JOBS_ENDPOINT = "**/api/content-guru/jobs"

const TEMPLATE_A = { id: "22222222-0000-0000-0000-000000000001", name: "Post na LinkedIn", category: "Rekrutacja" }
const TEMPLATE_B = { id: "22222222-0000-0000-0000-000000000002", name: "Newsletter", category: "Rekrutacja" }

interface JobItemFixture {
  templateId: string
  templateLabel: string
  topic: string
  status: "pending" | "running" | "done" | "done-with-warnings" | "error"
  content?: string
  archiveId?: string
  errorMessage?: string
}

function jobFixture(overrides: {
  mode: "batch" | "package"
  status: "queued" | "running" | "done" | "done-with-errors"
  items: JobItemFixture[]
}) {
  const now = new Date().toISOString()
  return {
    id: JOB_ID,
    mode: overrides.mode,
    status: overrides.status,
    items: overrides.items,
    createdAt: now,
    completedAt: overrides.status === "done" || overrides.status === "done-with-errors" ? now : null,
  }
}

/** POST /api/content-guru/jobs -> 202 {jobId, status:"queued"} — dokładnie
 *  kontrakt, który route.ts faktycznie realizuje (D4 krok 1). */
async function mockCreateJob(page: Page): Promise<{ calls: number }> {
  const state = { calls: 0 }
  await page.route(JOBS_ENDPOINT, async (route: Route) => {
    if (route.request().method() !== "POST") return route.fallback()
    state.calls += 1
    await route.fulfill({
      status: 202,
      contentType: "application/json",
      body: JSON.stringify({ jobId: JOB_ID, status: "queued" }),
    })
  })
  return state
}

/** GET /api/content-guru/jobs/:id -> zaprogramowana sekwencja odpowiedzi,
 *  jedna per wywołanie (ostatnia powtarzana) — symuluje D4 krok 4-5
 *  (kolejne polle TanStack Query, refetchInterval 2s) bez dotykania
 *  prawdziwego cortex-proxy. */
async function mockJobPolling(page: Page, sequence: ReturnType<typeof jobFixture>[]): Promise<void> {
  let index = 0
  await page.route(`${JOBS_ENDPOINT}/${JOB_ID}`, async (route: Route) => {
    const body = sequence[Math.min(index, sequence.length - 1)]
    if (index < sequence.length - 1) index += 1
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) })
  })
}

test.describe("Content Guru — tryb Kilka (batch, mock)", () => {
  test("karta joba aktualizuje się między pollami: running -> done, bez ręcznego odświeżania", async ({
    page,
  }) => {
    await mockShellAccess(page, TILE_GRANT)
    await mockContentGuruScreenData(page, { templates: [TEMPLATE_A] })
    await mockCreateJob(page)
    await mockJobPolling(page, [
      jobFixture({
        mode: "batch",
        status: "running",
        items: [
          { templateId: TEMPLATE_A.id, templateLabel: "Rekrutacja — Post na LinkedIn", topic: "Temat A", status: "running" },
          { templateId: TEMPLATE_A.id, templateLabel: "Rekrutacja — Post na LinkedIn", topic: "Temat B", status: "pending" },
        ],
      }),
      jobFixture({
        mode: "batch",
        status: "done",
        items: [
          {
            templateId: TEMPLATE_A.id,
            templateLabel: "Rekrutacja — Post na LinkedIn",
            topic: "Temat A",
            status: "done",
            content: "Treść wygenerowana dla tematu A.",
            archiveId: "archive-a",
          },
          {
            templateId: TEMPLATE_A.id,
            templateLabel: "Rekrutacja — Post na LinkedIn",
            topic: "Temat B",
            status: "done",
            content: "Treść wygenerowana dla tematu B.",
            archiveId: "archive-b",
          },
        ],
      }),
    ])

    const generatePage = new ContentGuruGeneratePage(page)
    await generatePage.goto()
    await generatePage.tab("Kilka").click()
    await generatePage.selectTemplate("Post na LinkedIn")
    await generatePage.fillTopics(["Temat A", "Temat B"])

    await expect(generatePage.jobEmptyState).toBeVisible()
    await expect(generatePage.generateButton).toBeEnabled()
    await generatePage.generateButton.click()

    await expect(generatePage.jobSummaryText("Generowanie w toku")).toBeVisible()
    await expect(generatePage.jobEmptyState).not.toBeVisible()

    // Kolejny poll (refetchInterval ~2s) dostarcza "done" bez odświeżania
    // strony — hojny timeout pokrywa jeden cykl pollingu + narzut renderu
    // (wzorem document-parser/upload-flow.spec.ts).
    await expect(generatePage.jobSummaryText("Ukończono — 2/2")).toBeVisible({ timeout: 8_000 })

    await generatePage.batchJobItem("Temat A").click()
    await expect(generatePage.jobItemDialog).toContainText("Treść wygenerowana dla tematu A.")
  })
})

test.describe("Content Guru — tryb Pakiet (package, mock)", () => {
  test("częściowa porażka jest widoczna: done-with-errors, macierz wierszy/kolumn, błąd + gotowe naraz", async ({
    page,
  }) => {
    await mockShellAccess(page, TILE_GRANT)
    await mockContentGuruScreenData(page, { templates: [TEMPLATE_A, TEMPLATE_B] })
    await mockCreateJob(page)

    const labelA = "Rekrutacja — Post na LinkedIn"
    const labelB = "Rekrutacja — Newsletter"
    await mockJobPolling(page, [
      jobFixture({
        mode: "package",
        status: "done-with-errors",
        items: [
          { templateId: TEMPLATE_A.id, templateLabel: labelA, topic: "Temat A", status: "done", content: "OK A/A", archiveId: "a1" },
          { templateId: TEMPLATE_B.id, templateLabel: labelB, topic: "Temat A", status: "error", errorMessage: "Błąd modelu." },
          { templateId: TEMPLATE_A.id, templateLabel: labelA, topic: "Temat B", status: "done", content: "OK A/B", archiveId: "a2" },
          { templateId: TEMPLATE_B.id, templateLabel: labelB, topic: "Temat B", status: "done", content: "OK B/B", archiveId: "a3" },
        ],
      }),
    ])

    const generatePage = new ContentGuruGeneratePage(page)
    await generatePage.goto()
    await generatePage.tab("Pakiet").click()
    await generatePage.packageTemplateCheckbox(labelA).click()
    await generatePage.packageTemplateCheckbox(labelB).click()
    await generatePage.fillTopics(["Temat A", "Temat B"])

    await expect(generatePage.combinationsCount).toContainText("2 tematy × 2 szablony = 4 treści")
    await expect(generatePage.generateButton).toBeEnabled()
    await generatePage.generateButton.click()

    await expect(generatePage.jobSummaryText("Ukończono z błędami — 1 z 4 pozycji się nie powiodło")).toBeVisible({
      timeout: 8_000,
    })

    // Macierz: nagłówki kolumn = szablony, komórki pierwszej kolumny = tematy.
    await expect(generatePage.matrixColumnHeader(labelA)).toBeVisible()
    await expect(generatePage.matrixColumnHeader(labelB)).toBeVisible()
    await expect(generatePage.matrixRowHeader("Temat A")).toBeVisible()
    await expect(generatePage.matrixRowHeader("Temat B")).toBeVisible()

    // Partial-failure widoczny: BŁĄD i GOTOWE naraz na tej samej stronie, nie
    // ukryte za ogólnym statusem sukcesu/porażki (D4 krok 5).
    await expect(page.getByText("Błąd", { exact: true })).toBeVisible()
    await expect(page.getByText("Gotowe", { exact: true }).first()).toBeVisible()
  })

  test("licznik kombinacji blokuje submit po przekroczeniu MAX_COMBINATIONS=30", async ({ page }) => {
    await mockShellAccess(page, TILE_GRANT)
    await mockContentGuruScreenData(page, { templates: [TEMPLATE_A, TEMPLATE_B] })
    const create = await mockCreateJob(page)

    const labelA = "Rekrutacja — Post na LinkedIn"
    const labelB = "Rekrutacja — Newsletter"

    const generatePage = new ContentGuruGeneratePage(page)
    await generatePage.goto()
    await generatePage.tab("Pakiet").click()
    await generatePage.packageTemplateCheckbox(labelA).click()
    await generatePage.packageTemplateCheckbox(labelB).click()

    // 16 tematów × 2 szablony = 32 kombinacje > 30 (job-limits.ts,
    // MAX_COMBINATIONS — design doc §9 p.3, ZAMKNIĘTE).
    await generatePage.fillTopics(Array.from({ length: 16 }, (_, i) => `Temat ${i + 1}`))

    await expect(generatePage.combinationsCount).toContainText("16 tematy × 2 szablony = 32 treści")
    await expect(generatePage.combinationsCount).toContainText("przekroczono limit 30 kombinacji")
    await expect(generatePage.generateButton).toBeDisabled()
    expect(create.calls).toBe(0)
  })
})
