// E2E kafelka Content Guru — Szablony (Tor A, design doc §4.2/D6): realny
// Postgres + realne API modułu, mockowana WYŁĄCZNIE powłoka. CRUD szablonów
// (zasobu WSPÓLNEGO) nie woła cortex-proxy, więc idzie w pełni przez Tor A —
// jedyny wyjątek jest "Testuj generację", które WOŁA cortex-proxy server-side
// (nieosiągalne dla page.route, ten sam powód co Ilustromat) — ten JEDEN
// przycisk jest mockowany na granicy page.route (Tor B), a "nigdy nie zapisuje
// do archiwum" jest zweryfikowane jako PRAWDZIWY row-count check przez realne
// GET /api/content-guru/archive (Tor A) przed i po kliknięciu.

import type { Route } from "@playwright/test"
import { expect, test } from "../fixtures/fixtures"
import { asUser } from "../fixtures/fixtures"
import { mockShellAccess } from "../support/mocks/shell-access"

test.describe.configure({ timeout: 90_000 })

test.describe("Content Guru — cykl życia szablonu (manage-templates)", () => {
  test(
    "utwórz -> edytuj -> duplikuj -> usuń, wszystko na prawdziwym Postgresie",
    async ({ page, seed, contentGuruTemplatesPage }) => {
      const { email } = await seed("content-guru-manage-templates")
      await asUser(page, email)
      await mockShellAccess(page, { email, apps: ["content-guru"] })

      await contentGuruTemplatesPage.goto()
      await expect(contentGuruTemplatesPage.heading).toBeVisible({ timeout: 30_000 })
      // Szablon z seeda widoczny od startu. Hojny timeout: nagłówek renderuje
      // się od razu, ale wiersz czeka na GET /api/content-guru/templates —
      // pierwsze trafienie w ten route+stronę w przebiegu płaci za
      // kompilację na zimno.
      await expect(contentGuruTemplatesPage.row("Post na LinkedIn")).toBeVisible({ timeout: 30_000 })

      // --- utwórz ---
      await contentGuruTemplatesPage.newTemplateButton.click()
      await contentGuruTemplatesPage.nameInput.fill("Wpis blogowy E2E")
      await contentGuruTemplatesPage.categoryInput.fill("Marketing")
      await contentGuruTemplatesPage.contentInput.fill("Napisz wpis blogowy na podany temat.")
      await contentGuruTemplatesPage.saveButton.click()
      await expect(contentGuruTemplatesPage.row("Wpis blogowy E2E")).toBeVisible()

      // --- edytuj ---
      await contentGuruTemplatesPage.editButton("Wpis blogowy E2E").click()
      await expect(contentGuruTemplatesPage.nameInput).toHaveValue("Wpis blogowy E2E")
      await contentGuruTemplatesPage.nameInput.fill("Wpis blogowy E2E (zmieniony)")
      await contentGuruTemplatesPage.saveButton.click()
      await expect(contentGuruTemplatesPage.row("Wpis blogowy E2E (zmieniony)")).toBeVisible()
      // Zmiana PRZETRWAŁA zamknięcie edytora — otwórz ponownie i sprawdź.
      await contentGuruTemplatesPage.editButton("Wpis blogowy E2E (zmieniony)").click()
      await expect(contentGuruTemplatesPage.nameInput).toHaveValue("Wpis blogowy E2E (zmieniony)")
      await contentGuruTemplatesPage.cancelButton.click()

      // --- duplikuj ---
      await contentGuruTemplatesPage.moreActionsButton("Wpis blogowy E2E (zmieniony)").click()
      await contentGuruTemplatesPage.duplicateMenuItem.click()
      await expect(contentGuruTemplatesPage.row("Wpis blogowy E2E (zmieniony) (kopia)")).toBeVisible()

      // --- usuń oryginał, kopia zostaje ---
      await contentGuruTemplatesPage.moreActionsButton("Wpis blogowy E2E (zmieniony)").click()
      await contentGuruTemplatesPage.deleteMenuItem.click()
      await contentGuruTemplatesPage.confirmDeleteButton.click()
      await expect(contentGuruTemplatesPage.row("Wpis blogowy E2E (zmieniony)")).not.toBeVisible()
      await expect(contentGuruTemplatesPage.row("Wpis blogowy E2E (zmieniony) (kopia)")).toBeVisible()
    },
  )
})

test.describe("Content Guru — szablony bez scope'u manage-templates", () => {
  test(
    "użytkownik z samym dostępem do kafelka NIE może zapisać nowego szablonu (403 surowany przez UI)",
    async ({ page, seed, contentGuruTemplatesPage }) => {
      const { email } = await seed("content-guru-user")
      await asUser(page, email)
      await mockShellAccess(page, { email, apps: ["content-guru"] })

      await contentGuruTemplatesPage.goto()
      // GET listy jest za samą bramką kafelka — strona się renderuje.
      await expect(contentGuruTemplatesPage.heading).toBeVisible({ timeout: 30_000 })
      await expect(contentGuruTemplatesPage.row("Post na LinkedIn")).toBeVisible()

      await contentGuruTemplatesPage.newTemplateButton.click()
      await contentGuruTemplatesPage.nameInput.fill("Powinien się nie zapisać")
      await contentGuruTemplatesPage.categoryInput.fill("Główne")
      await contentGuruTemplatesPage.contentInput.fill("Treść.")
      await contentGuruTemplatesPage.saveButton.click()

      // 403 z API -> editor NIE zamyka się (closeEditor() woła się tylko po
      // sukcesie) — dialog zostaje otwarty, nic nowego nie trafia do listy.
      await expect(contentGuruTemplatesPage.saveButton).toBeVisible()
      await contentGuruTemplatesPage.cancelButton.click()
      await expect(contentGuruTemplatesPage.row("Powinien się nie zapisać")).not.toBeVisible()
    },
  )
})

test.describe("Content Guru — Testuj generację (mock cortex-proxy boundary)", () => {
  // "Testuj generację" WOŁA cortex-proxy server-side (route ->
  // runContentGeneration() -> integration-client.ts), więc jak w
  // Ilustromacie/Visual Guru/Document Parser to konkretne żądanie jest
  // mockowane na granicy page.route (Tor B) — reszta testu (seed, real
  // Postgres, GET /archive przed/po) zostaje Tor A, żeby row-count check był
  // PRAWDZIWY, nie tylko UI-owy.
  test("nigdy nie zapisuje do content_archive — potwierdzone realnym row-count na /api/content-guru/archive", async ({
    page,
    seed,
    contentGuruTemplatesPage,
  }) => {
    const { email } = await seed("content-guru-manage-templates")
    await asUser(page, email)
    await mockShellAccess(page, { email, apps: ["content-guru"] })

    let testGenerationCalls = 0
    await page.route("**/api/content-guru/templates/test-generation", async (route: Route) => {
      testGenerationCalls += 1
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          content: "Oto testowa treść wygenerowana z Twojego szablonu.",
          status: "done",
          matchedForbiddenPhrases: [],
          model: "anthropic/claude-sonnet-4.6",
        }),
      })
    })

    await contentGuruTemplatesPage.goto()
    await expect(contentGuruTemplatesPage.heading).toBeVisible({ timeout: 30_000 })

    // Punkt odniesienia "PRZED": dwa wpisy zaseedowane przez
    // content-guru-manage-templates (db-seed.ts).
    const before = await page.request.get("/api/content-guru/archive", {
      headers: { "x-auth-request-email": email },
    })
    expect(await before.json()).toHaveLength(2)

    await contentGuruTemplatesPage.newTemplateButton.click()
    await contentGuruTemplatesPage.nameInput.fill("Szablon testowany")
    await contentGuruTemplatesPage.categoryInput.fill("Główne")
    await contentGuruTemplatesPage.contentInput.fill("INSTRUKCJA: pisz krótko.")
    await contentGuruTemplatesPage.testGenerationButton.click()

    await expect(page.getByText("Oto testowa treść wygenerowana z Twojego szablonu.")).toBeVisible()
    expect(testGenerationCalls).toBe(1)

    // Punkt odniesienia "PO": DOKŁADNIE te same dwa wpisy, żaden trzeci nie
    // doszedł — realne zapytanie do prawdziwego Postgresa, nie zamockowane.
    const after = await page.request.get("/api/content-guru/archive", {
      headers: { "x-auth-request-email": email },
    })
    expect(await after.json()).toHaveLength(2)
  })
})
