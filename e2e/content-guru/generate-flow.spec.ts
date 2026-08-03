// E2E kafelka Content Guru — Tor B (design doc §7, wzorem
// e2e/visual-guru/generator-flow.spec.ts i e2e/ai-tools/generate-flow.spec.ts):
// mockuje CAŁY endpoint BFF (/api/content-guru/generate) na granicy
// przeglądarka<->serwer — prawdziwy handler Next.js (i jego wywołanie
// cortex-proxy przez lib/content-guru/integration-client.ts) W OGÓLE się nie
// wykonuje. Powód: generacja woła prawdziwy, płatny, niedeterministyczny
// model LLM — ten sam powód, dla którego Ilustromat/Parser Dokumentów/Visual
// Guru E2E tego nie robi. D5 (zakazane frazy, retry eskalowany) jest już
// serwerowo zweryfikowane jednostkowo (run-generation.test.ts,
// forbidden-phrase-check.test.ts, generate/route.test.ts) — tu sprawdzamy
// WYŁĄCZNIE, że UI poprawnie renderuje wynik, który serwer zwrócił.
//
// Zero seed()/asUser() — prawdziwy route handler (i requireTileAccess())
// nigdy się nie wykonuje, więc nie ma czego zasilać prawdziwym Postgresem.

import { expect, test, type Route } from "@playwright/test"
import { ContentGuruGeneratePage } from "../poms/content-guru/generate-page"
import { mockContentGuruScreenData } from "../support/mocks/content-guru-screen"
import { mockShellAccess } from "../support/mocks/shell-access"

const EMAIL = "demo@cortex.local"
const TILE_GRANT = { apps: ["content-guru"], email: EMAIL }
const GENERATE_ENDPOINT = "**/api/content-guru/generate"

interface GenerateResponseOverrides {
  status?: "done" | "done-with-warnings"
  content?: string
  matchedForbiddenPhrases?: string[]
}

function generateResponse(overrides: GenerateResponseOverrides = {}) {
  return {
    id: "mock-archive-1",
    content: overrides.content ?? "Szukamy Senior .NET Developera do naszego zespołu produktowego.",
    status: overrides.status ?? "done",
    matchedForbiddenPhrases: overrides.matchedForbiddenPhrases ?? [],
    model: "anthropic/claude-sonnet-4.6",
    createdAt: new Date().toISOString(),
  }
}

async function mockGenerate(
  page: import("@playwright/test").Page,
  overrides: GenerateResponseOverrides = {},
): Promise<{ calls: number }> {
  const state = { calls: 0 }
  await page.route(GENERATE_ENDPOINT, async (route: Route) => {
    if (route.request().method() !== "POST") return route.fallback()
    state.calls += 1
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(generateResponse(overrides)),
    })
  })
  return state
}

test.describe("Content Guru — generowanie pojedynczej treści (mock)", () => {
  test("happy path: treść renderuje się, status Gotowe, notatka o zapisie w archiwum", async ({
    page,
  }) => {
    await mockShellAccess(page, TILE_GRANT)
    await mockContentGuruScreenData(page)
    const generate = await mockGenerate(page)

    const generatePage = new ContentGuruGeneratePage(page)
    await generatePage.goto()
    await expect(generatePage.heading).toBeVisible()
    await expect(generatePage.emptyResultState).toBeVisible()

    await generatePage.selectTemplate("Post na LinkedIn")
    await generatePage.topicInput.fill("Rekrutacja Senior .NET Developer")
    await expect(generatePage.generateButton).toBeEnabled()
    await generatePage.generateButton.click()

    await expect(generatePage.resultContent).toContainText("Szukamy Senior .NET Developera")
    await expect(generatePage.emptyResultState).not.toBeVisible()
    await expect(generatePage.warningsBanner).not.toBeVisible()
    await expect(generatePage.savedToArchiveNote).toBeVisible()
    expect(generate.calls).toBe(1)
  })

  test("zakazana fraza po eskalowanym retry: banner ostrzegawczy + <mark> na dopasowaniu (D5)", async ({
    page,
  }) => {
    await mockShellAccess(page, TILE_GRANT)
    await mockContentGuruScreenData(page)
    // Reprezentuje wynik PO serwerowej eskalowanej próbie ponowienia (D5) —
    // retry sam w sobie jest już pokryty testami jednostkowymi run-generation
    // .test.ts; tu dowodzimy wyłącznie, że UI poprawnie renderuje status
    // "done-with-warnings" zwrócony przez serwer.
    await mockGenerate(page, {
      status: "done-with-warnings",
      content: "Jesteśmy najlepszy na rynku i dumni z tego.",
      matchedForbiddenPhrases: ["najlepszy na rynku"],
    })

    const generatePage = new ContentGuruGeneratePage(page)
    await generatePage.goto()
    await generatePage.selectTemplate("Post na LinkedIn")
    await generatePage.topicInput.fill("Premiera nowej funkcji")
    await generatePage.generateButton.click()

    await expect(generatePage.warningsBanner).toBeVisible()
    await expect(generatePage.markedPhrase("najlepszy na rynku")).toBeVisible()
    // Treść jest i tak zapisana do archiwum — nigdy nie wyrzucamy płatnego
    // wywołania LLM po cichu (decyzja Alexa 03.08.2026, design doc §9 p.2).
    await expect(generatePage.savedToArchiveNote).toBeVisible()
  })

  test("pusty temat blokuje wysyłkę — zero żądania do serwera", async ({ page }) => {
    await mockShellAccess(page, TILE_GRANT)
    await mockContentGuruScreenData(page)
    const generate = await mockGenerate(page)

    const generatePage = new ContentGuruGeneratePage(page)
    await generatePage.goto()
    await generatePage.selectTemplate("Post na LinkedIn")

    // Temat celowo pusty — canSubmitSingle wymaga templateId+topic+model, więc
    // wybranie samego szablonu bez tematu musi zostawić przycisk zablokowany.
    await expect(generatePage.generateButton).toBeDisabled()
    expect(generate.calls).toBe(0)
  })
})
