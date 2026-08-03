// E2E kafelka Content Guru — mini-generatory (Tor B, design doc D8, Round D):
// generator tematów (modal), fraza kluczowa SEO, meta description — trzy małe
// narzędzia pomocnicze na ekranie generowania. Automatyzuje to, co Runda D
// zweryfikowała ręcznie przy review: żaden z nich NIE zapisuje do
// content_archive/generation_jobs (to są utility calls produkujące krótki
// tekst pomocniczy, nie finalną treść — dokładnie ta sama zasada co "Testuj
// generację"). Dowód jest NA GRANICY SIECI: rejestrujemy liczniki wywołań na
// /api/content-guru/generate i /api/content-guru/jobs i sprawdzamy, że po
// użyciu mini-generatora oba zostają na zerze — mocniejszy dowód niż
// sprawdzanie samego UI, bo dotyczy realnej granicy przeglądarka<->serwer.
//
// Zero seed()/asUser() — jak w generate-flow.spec.ts/batch-package-flow.spec.ts,
// prawdziwy route handler nigdy się nie wykonuje.

import { expect, test, type Page, type Route } from "@playwright/test"
import { ContentGuruGeneratePage } from "../poms/content-guru/generate-page"
import { mockContentGuruScreenData } from "../support/mocks/content-guru-screen"
import { mockShellAccess } from "../support/mocks/shell-access"

const EMAIL = "demo@cortex.local"
const TILE_GRANT = { apps: ["content-guru"], email: EMAIL }

/** Rejestruje liczniki na OBU endpointach, które faktycznie persystują
 *  (POST /generate zapisuje content_archive synchronicznie, POST /jobs
 *  tworzy generation_jobs) — jeśli którykolwiek mini-generator kiedykolwiek
 *  zacznie wołać jeden z nich, ten test to złapie. */
async function watchPersistingEndpoints(page: Page): Promise<{ generate: number; jobs: number }> {
  const calls = { generate: 0, jobs: 0 }
  await page.route("**/api/content-guru/generate", async (route: Route) => {
    calls.generate += 1
    await route.fulfill({ status: 500, body: "nie powinno być wołane przez mini-generator" })
  })
  await page.route("**/api/content-guru/jobs", async (route: Route) => {
    if (route.request().method() !== "POST") return route.fallback()
    calls.jobs += 1
    await route.fulfill({ status: 500, body: "nie powinno być wołane przez mini-generator" })
  })
  return calls
}

test.describe("Content Guru — mini-generatory (mock)", () => {
  test("generator tematów: wstawia wybrane kandydatury do tabeli tematów (Kilka), nigdy nie persystuje", async ({
    page,
  }) => {
    await mockShellAccess(page, TILE_GRANT)
    await mockContentGuruScreenData(page)
    const persisting = await watchPersistingEndpoints(page)

    let topicsCalls = 0
    await page.route("**/api/content-guru/mini-generators/topics", async (route: Route) => {
      topicsCalls += 1
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ topics: ["Temat wygenerowany 1", "Temat wygenerowany 2"] }),
      })
    })

    const generatePage = new ContentGuruGeneratePage(page)
    await generatePage.goto()
    await generatePage.tab("Kilka").click()
    await generatePage.topicGeneratorButton.click()

    await page.getByLabel("Transkrypcja").fill("Dziś rozmawialiśmy o rekrutacji na 2027 rok.")
    await page.getByRole("button", { name: /^Generuj tematy$|^Generowanie…$/ }).click()

    const candidateOne = page.getByRole("checkbox", { name: "Temat wygenerowany 1" })
    const candidateTwo = page.getByRole("checkbox", { name: "Temat wygenerowany 2" })
    await expect(candidateOne).toBeVisible()
    await candidateOne.click()
    await candidateTwo.click()
    await page.getByRole("button", { name: "Wstaw wybrane (2)" }).click()

    await expect(generatePage.topicRowInput(1)).toHaveValue("Temat wygenerowany 1")
    await expect(generatePage.topicRowInput(2)).toHaveValue("Temat wygenerowany 2")

    expect(topicsCalls).toBe(1)
    expect(persisting.generate).toBe(0)
    expect(persisting.jobs).toBe(0)
  })

  test("fraza kluczowa SEO: wypełnia pole, nigdy nie persystuje", async ({ page }) => {
    await mockShellAccess(page, TILE_GRANT)
    await mockContentGuruScreenData(page)
    const persisting = await watchPersistingEndpoints(page)

    let keywordCalls = 0
    await page.route("**/api/content-guru/mini-generators/keyword", async (route: Route) => {
      keywordCalls += 1
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ keywordPhrase: "automatyzacja procesów HR" }),
      })
    })

    const generatePage = new ContentGuruGeneratePage(page)
    await generatePage.goto()
    await generatePage.topicInput.fill("Rekrutacja Senior .NET Developer")
    await generatePage.generateKeywordButton.click()

    await expect(generatePage.keywordPhraseInput).toHaveValue("automatyzacja procesów HR")
    expect(keywordCalls).toBe(1)
    expect(persisting.generate).toBe(0)
    expect(persisting.jobs).toBe(0)
  })

  test("meta description: wypełnia pole, korzysta z już wygenerowanej frazy kluczowej, nigdy nie persystuje", async ({
    page,
  }) => {
    await mockShellAccess(page, TILE_GRANT)
    await mockContentGuruScreenData(page)
    const persisting = await watchPersistingEndpoints(page)

    const captured: { body: { keywordPhrase?: string } | null } = { body: null }
    await page.route("**/api/content-guru/mini-generators/meta-description", async (route: Route) => {
      captured.body = route.request().postDataJSON()
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ metaDescription: "Poznaj naszą automatyzację procesów HR." }),
      })
    })

    const generatePage = new ContentGuruGeneratePage(page)
    await generatePage.goto()
    await generatePage.topicInput.fill("Rekrutacja Senior .NET Developer")
    await generatePage.keywordPhraseInput.fill("fraza kluczowa testowa")
    await generatePage.generateMetaDescriptionButton.click()

    await expect(generatePage.metaDescriptionInput).toHaveValue("Poznaj naszą automatyzację procesów HR.")
    // D8: "korzysta z już wygenerowanej frazy kluczowej jeśli jest" — dowód
    // wprost na ciele żądania, nie tylko na wyniku.
    expect(captured.body?.keywordPhrase).toBe("fraza kluczowa testowa")
    expect(persisting.generate).toBe(0)
    expect(persisting.jobs).toBe(0)
  })
})
