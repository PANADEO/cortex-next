// E2E kafelka Parser Dokumentów — Tor B (sekcja 6.3 design docu, wzorem
// e2e/ai-tools/generate-flow.spec.ts): mockuje CAŁY endpoint BFF
// (/api/document-parser/jobs**) na granicy przeglądarka<->serwer —
// prawdziwy handler Next.js W OGÓLE się nie wykonuje, co pozwala
// deterministycznie sterować kolejnymi odpowiedziami. Silniejsze uzasadnienie
// niż w ai-tools: ten moduł ma wieloetapowy stan async z pollingiem
// (queued->processing->done/error, D4) — niemożliwe do wiarygodnego
// przetestowania przeciw prawdziwemu backendowi bez płacenia za realne
// wywołania LLM w CI albo akceptowania nondeterministycznego czasu trwania.
//
// Zero seed()/asUser() — w przeciwieństwie do Toru A (access-gate.spec.ts,
// history-scenario.spec.ts), tu prawdziwy route handler (i jego
// requireTileAccess()) nigdy się nie wykonuje, więc nie ma czego zasilać
// prawdziwym Postgresem (wzorem ai-tools/generate-flow.spec.ts, który też
// nie sieje danych).

import { expect, test, type Page, type Route } from "@playwright/test"
import { DocumentParserUploadPage } from "../poms/document-parser/upload-page"
import { expectNoConsoleErrors, installConsoleErrorTracker } from "../support/console"
import { mockShellAccess } from "../support/mocks/shell-access"

const EMAIL = "demo@cortex.local"
const TILE_GRANT = { apps: ["document-parser"], email: EMAIL }
const JOBS_ENDPOINT = "**/api/document-parser/jobs"
const JOB_ID = "mock-job-1"

interface JobFixtureOverrides {
  status?: "queued" | "processing" | "done" | "error"
  fileName?: string
  markdown?: string | null
  model?: string | null
  errorMessage?: string | null
  errorCode?: string | null
  pageCount?: number
  imageCount?: number
}

function jobFixture(overrides: JobFixtureOverrides = {}) {
  const now = new Date().toISOString()
  return {
    id: JOB_ID,
    backendJobId: "backend-mock-1",
    userEmail: EMAIL,
    status: "processing",
    fileName: "raport.pdf",
    fileSizeBytes: 12_345,
    mimeType: "application/pdf",
    model: null,
    markdown: null,
    errorMessage: null,
    errorCode: null,
    pageCount: 0,
    imageCount: 0,
    truncated: false,
    elapsedSeconds: null,
    createdAt: now,
    updatedAt: now,
    startedAt: now,
    completedAt: null,
    ...overrides,
  }
}

/** POST /api/document-parser/jobs -> 202 {jobId, status: "processing"}, zero
 *  czekania na pipeline (D4) — dokładnie ten kontrakt, który route.ts
 *  faktycznie realizuje. */
async function mockCreateJob(page: Page): Promise<{ calls: number }> {
  const state = { calls: 0 }
  await page.route(JOBS_ENDPOINT, async (route: Route) => {
    if (route.request().method() !== "POST") return route.fallback()
    state.calls += 1
    await route.fulfill({
      status: 202,
      contentType: "application/json",
      body: JSON.stringify({ jobId: JOB_ID, status: "processing" }),
    })
  })
  return state
}

/** GET /api/document-parser/jobs/:id -> zaprogramowana sekwencja odpowiedzi,
 *  jedna per wywołanie (ostatnia powtarzana, gdyby test odpytał więcej razy
 *  niż długość sekwencji) — symuluje D4 krok 5-6 (kolejne polle TanStack
 *  Query, refetchInterval) bez dotykania prawdziwego backendu Pythona. */
async function mockJobPolling(page: Page, sequence: ReturnType<typeof jobFixture>[]): Promise<void> {
  let index = 0
  await page.route(`${JOBS_ENDPOINT}/${JOB_ID}`, async (route: Route) => {
    const body = sequence[Math.min(index, sequence.length - 1)]
    if (index < sequence.length - 1) index += 1
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) })
  })
}

function pdfBuffer(): { name: string; mimeType: string; buffer: Buffer } {
  return { name: "raport.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 test") }
}

test.describe("Parser Dokumentów — przepływ uploadu (mock)", () => {
  test("waliduje nieobsługiwany format PRZED wysyłką — zero żądania do serwera", async ({ page }) => {
    await mockShellAccess(page, TILE_GRANT)
    const create = await mockCreateJob(page)

    const uploadPage = new DocumentParserUploadPage(page)
    await uploadPage.goto()
    await expect(uploadPage.heading).toBeVisible()

    await uploadPage.fileInput.setInputFiles({
      name: "zloczynca.exe",
      mimeType: "application/octet-stream",
      buffer: Buffer.from("MZ"),
    })

    await expect(uploadPage.fileError).toBeVisible()
    await expect(uploadPage.submitButton).toBeDisabled()
    expect(create.calls).toBe(0)
  })

  test("karta joba aktualizuje się między pollami: processing -> done, bez ręcznego odświeżania", async ({
    page,
  }) => {
    const tracker = installConsoleErrorTracker(page)
    await mockShellAccess(page, TILE_GRANT)
    await mockCreateJob(page)
    await mockJobPolling(page, [
      jobFixture({ status: "processing" }),
      jobFixture({
        status: "done",
        model: "openai/gpt-4o-mini",
        markdown: "# Wynik testowy\n\nTreść wyekstrahowana przez mock.",
        pageCount: 2,
        imageCount: 2,
      }),
    ])

    const uploadPage = new DocumentParserUploadPage(page)
    await uploadPage.goto()
    await uploadPage.fileInput.setInputFiles(pdfBuffer())
    await expect(uploadPage.submitButton).toBeEnabled()
    await uploadPage.submitButton.click()

    await expect(uploadPage.statusText("Przetwarzanie")).toBeVisible()
    // Wynik + przycisk pobrania pojawiają się DOPIERO po "done" (D1) — przed
    // tym momentem nie mają prawa być widoczne.
    await expect(uploadPage.downloadButton).not.toBeVisible()

    // Kolejny poll (refetchInterval ~2s) dostarcza "done" bez odświeżania
    // strony — hojny timeout pokrywa jeden cykl pollingu + narzut renderu.
    await expect(uploadPage.statusText("Gotowe")).toBeVisible({ timeout: 8_000 })
    await expect(page.getByRole("heading", { name: "Wynik testowy", level: 1 })).toBeVisible()
    await expect(uploadPage.downloadButton).toBeVisible()
    await expect(uploadPage.detailsLink).toBeVisible()

    expectNoConsoleErrors(tracker)
  })

  test("stan błędu: vision-call-failed pokazuje SWÓJ komunikat", async ({ page }) => {
    await mockShellAccess(page, TILE_GRANT)
    await mockCreateJob(page)
    await mockJobPolling(page, [
      jobFixture({
        status: "error",
        errorCode: "vision-call-failed",
        errorMessage: "OpenAI request failed: 500",
      }),
    ])

    const uploadPage = new DocumentParserUploadPage(page)
    await uploadPage.goto()
    await uploadPage.fileInput.setInputFiles(pdfBuffer())
    await uploadPage.submitButton.click()

    await expect(uploadPage.errorTitle("Błąd modelu wizyjnego")).toBeVisible()
  })

  test("stan błędu: conversion-failed pokazuje INNY komunikat niż vision-call-failed", async ({
    page,
  }) => {
    await mockShellAccess(page, TILE_GRANT)
    await mockCreateJob(page)
    await mockJobPolling(page, [
      jobFixture({
        status: "error",
        errorCode: "conversion-failed",
        errorMessage: "unoconvert failed (exit 1): corrupted input",
      }),
    ])

    const uploadPage = new DocumentParserUploadPage(page)
    await uploadPage.goto()
    await uploadPage.fileInput.setInputFiles(pdfBuffer())
    await uploadPage.submitButton.click()

    await expect(uploadPage.errorTitle("Nie udało się przetworzyć dokumentu")).toBeVisible()
    // Rozróżnienie jest sednem D1 — dowód NEGATYWNY dopełnia poprzedni test.
    await expect(uploadPage.errorTitle("Błąd modelu wizyjnego")).not.toBeVisible()
  })

  test("po błędzie: 'Wgraj kolejny dokument' resetuje ekran do stanu uploadu", async ({ page }) => {
    await mockShellAccess(page, TILE_GRANT)
    await mockCreateJob(page)
    await mockJobPolling(page, [jobFixture({ status: "error", errorCode: "conversion-failed" })])

    const uploadPage = new DocumentParserUploadPage(page)
    await uploadPage.goto()
    await uploadPage.fileInput.setInputFiles(pdfBuffer())
    await uploadPage.submitButton.click()
    await expect(uploadPage.resetButton).toBeVisible()

    await uploadPage.resetButton.click()

    // Natywny <input type="file"> jest CELOWO ukryty (FileUploader z
    // @cortex/ui, wyzwalany kliknięciem strefy dropzone) — dowodem powrotu do
    // ekranu uploadu jest sama strefa + wyłączony przycisk wysyłki, nie
    // widoczność inputu.
    await expect(uploadPage.fileInput).toBeAttached()
    await expect(uploadPage.submitButton).toBeDisabled()
  })
})
