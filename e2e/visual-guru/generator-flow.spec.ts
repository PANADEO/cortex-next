// E2E kafelka Visual Guru — Tor B (design doc §8, wzorem
// e2e/document-parser/upload-flow.spec.ts): mockuje CAŁY endpoint BFF
// (/api/visual-guru/generate) na granicy przeglądarka<->serwer — prawdziwy
// handler Next.js (i jego wywołanie cortex-proxy przez
// lib/visual-guru/integration-client.ts) W OGÓLE się nie wykonuje. Powód:
// generacja woła prawdziwy, płatny, niedeterministyczny model LLM — dokładnie
// ten sam powód, dla którego Ilustromat E2E tego nie robi
// (e2e/ilustromat/ilustromat-scenario.spec.ts). Sam formularz/UX generatora
// (upload, widoczność presetu wierności, renderowanie wyniku, pobranie) ma
// pełne pokrycie tutaj, deterministycznie, bez płacenia za realny model.
//
// Zero seed()/asUser() — prawdziwy route handler (i requireTileAccess())
// nigdy się nie wykonuje, więc nie ma czego zasilać prawdziwym Postgresem
// (wzorem document-parser/upload-flow.spec.ts).

import { expect, test, type Page, type Route } from "@playwright/test"
import { VisualGuruGeneratorPage } from "../poms/visual-guru/generator-page"
import { mockShellAccess } from "../support/mocks/shell-access"

const EMAIL = "demo@cortex.local"
const TILE_GRANT = { apps: ["visual-guru"], email: EMAIL }
const GENERATE_ENDPOINT = "**/api/visual-guru/generate"

// 1x1 przezroczysty PNG jako data URI — jedyne, co testom UX potrzeba jako
// "wynik" generacji; treść bajtów jest bez znaczenia dla żadnej asercji.
const FIXTURE_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="

function generateResponse(variantCount: 2 | 4) {
  return {
    id: "mock-generation-1",
    prompt: "Minimalistyczna ilustracja lisa na tle gór",
    additionalContext: null,
    model: "google/gemini-3.1-flash-lite-image",
    variantCount,
    hadReferenceImage: false,
    createdAt: new Date().toISOString(),
    variants: Array.from({ length: variantCount }, (_, variantIndex) => ({
      variantIndex,
      dataUrl: FIXTURE_DATA_URL,
    })),
  }
}

/** Rejestruje mock POST /api/visual-guru/generate i zwraca licznik wywołań —
 *  pozwala dowieść, że handler realnie zawołał SIEĆ zmockowaną, nie prawdziwy
 *  route (który zawołałby cortex-proxy, płatnie i niedeterministycznie). */
async function mockGenerate(page: Page, variantCount: 2 | 4 = 2): Promise<{ calls: number }> {
  const state = { calls: 0 }
  await page.route(GENERATE_ENDPOINT, async (route: Route) => {
    if (route.request().method() !== "POST") return route.fallback()
    state.calls += 1
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(generateResponse(variantCount)),
    })
  })
  return state
}

function pngFile(name = "referencja.png") {
  return { name, mimeType: "image/png", buffer: Buffer.from(FIXTURE_DATA_URL.split(",")[1]!, "base64") }
}

test.describe("Visual Guru — generator (mock)", () => {
  test("preset wierności jest ukryty bez obrazu referencyjnego, widoczny po wgraniu", async ({ page }) => {
    await mockShellAccess(page, TILE_GRANT)
    const generatorPage = new VisualGuruGeneratorPage(page)
    await generatorPage.goto()
    await expect(generatorPage.heading).toBeVisible()

    await expect(generatorPage.fidelityHigh).toBeHidden()

    await generatorPage.fileInput.setInputFiles(pngFile())

    await expect(generatorPage.fidelityHigh).toBeVisible()
    await expect(generatorPage.fidelityLoose).toBeVisible()
  })

  test("wgranie więcej niż limitu obrazów referencyjnych: ostrzeżenie, ucięcie do limitu — zero żądania do serwera", async ({
    page,
  }) => {
    await mockShellAccess(page, TILE_GRANT)
    const generate = await mockGenerate(page)
    const generatorPage = new VisualGuruGeneratorPage(page)
    await generatorPage.goto()

    await generatorPage.fileInput.setInputFiles([
      pngFile("ref-1.png"),
      pngFile("ref-2.png"),
      pngFile("ref-3.png"),
      pngFile("ref-4.png"),
    ])

    await expect(page.getByText("Maksymalnie 3 obrazy referencyjne")).toBeVisible()
    // Preset wierności jest wciąż widoczny (referencje zostały, tylko ucięte) —
    // dowód, że to ograniczenie liczby plików, nie wyczyszczenie wyboru.
    await expect(generatorPage.fidelityHigh).toBeVisible()
    expect(generate.calls).toBe(0)
  })

  test("generacja: renderuje warianty ze zmockowanej odpowiedzi, pozwala pobrać", async ({ page }) => {
    await mockShellAccess(page, TILE_GRANT)
    const generate = await mockGenerate(page, 2)
    const generatorPage = new VisualGuruGeneratorPage(page)
    await generatorPage.goto()

    await expect(generatorPage.emptyState).toBeVisible()

    await generatorPage.promptInput.fill("Minimalistyczna ilustracja lisa na tle gór")
    await generatorPage.generateButton.click()

    await expect(generatorPage.variant(1)).toBeVisible()
    await expect(generatorPage.variant(2)).toBeVisible()
    await expect(generatorPage.emptyState).not.toBeVisible()
    expect(generate.calls).toBe(1)

    const downloadPromise = page.waitForEvent("download")
    await generatorPage.downloadAllButton.click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toContain(".zip")
  })

  test("prompt pusty: walidacja klienta blokuje wysyłkę — zero żądania do serwera", async ({ page }) => {
    await mockShellAccess(page, TILE_GRANT)
    const generate = await mockGenerate(page)
    const generatorPage = new VisualGuruGeneratorPage(page)
    await generatorPage.goto()

    await generatorPage.generateButton.click()

    await expect(page.getByText("Opis obrazu jest wymagany")).toBeVisible()
    expect(generate.calls).toBe(0)
  })
})
