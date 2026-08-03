// E2E kafelka GEO Score Calculator — Ustawienia (design doc §4.4): żywy
// pasek sumy wag (aktualizowany na KAŻDĄ zmianę, nie dopiero przy Zapisz),
// zapis persystujący w Postgresie, "Przywróć domyślne" z potwierdzeniem.

import { expect, test } from "../fixtures/fixtures"
import { asUser } from "../fixtures/fixtures"
import { mockShellAccess } from "../support/mocks/shell-access"

// Timeout hojniejszy niż domyślne 5s — pierwsza wizyta na trasie/route
// handlerze w danym przebiegu `next dev` kompiluje się on-demand, a to
// środowisko dzieli maszynę z innymi kontenerami/procesami (patrz raport
// weryfikacyjny tej zmiany — zmierzone realnie, nie założone).
const SLOW = { timeout: 45_000 }

// Ponowienie NA POZIOMIE PLIKU przy sporadycznym zawieszeniu dev servera
// pod obciążeniem współdzielonej maszyny — pełne uzasadnienie w
// settings-affects-analysis.spec.ts (ten sam mechanizm/failure class
// zaobserwowany przy review Fazy 4 E2E w pełnym przebiegu suity: 8
// nieudanych / 9 udanych testów w jednym przebiegu, wszystkie zielone w
// powtórce — ten plik wcześniej nie miał żadnej ochrony). Lokalne dla tego
// pliku (`test.describe.configure`), NIE dotyka globalnego `retries: 0` w
// playwright.config.ts ani innych modułów.
test.describe.configure({ retries: 1 })

test.describe("GEO Score Calculator — ustawienia", () => {
  test("pasek sumy wag reaguje na każdą zmianę i blokuje Zapisz przy sumie ≠ 100%", async ({
    page,
    seed,
    geoScoreCalculatorSettingsPage,
  }) => {
    test.slow()
    const { email } = await seed("geo-score-calculator-user")
    await asUser(page, email)
    await mockShellAccess(page, { email, apps: ["geo-score-calculator"] })

    await geoScoreCalculatorSettingsPage.goto()
    await expect(geoScoreCalculatorSettingsPage.heading).toBeVisible(SLOW)
    await expect(geoScoreCalculatorSettingsPage.weightSumBadge).toHaveText("Suma: 100%", SLOW)
    await expect(geoScoreCalculatorSettingsPage.saveButton).toBeEnabled()

    await geoScoreCalculatorSettingsPage.adjustWeight(geoScoreCalculatorSettingsPage.statisticsWeightSlider, 5)
    await expect(geoScoreCalculatorSettingsPage.weightSumBadge).toHaveText("Suma: 105%")
    await expect(geoScoreCalculatorSettingsPage.saveButton).toBeDisabled()

    await geoScoreCalculatorSettingsPage.adjustWeight(geoScoreCalculatorSettingsPage.statisticsWeightSlider, -5)
    await expect(geoScoreCalculatorSettingsPage.weightSumBadge).toHaveText("Suma: 100%")
    await expect(geoScoreCalculatorSettingsPage.saveButton).toBeEnabled()
  })

  test("zapis persystuje zmienione wagi w Postgresie", async ({
    page,
    seed,
    geoScoreCalculatorSettingsPage,
  }) => {
    test.slow()
    const { email } = await seed("geo-score-calculator-user")
    await asUser(page, email)
    await mockShellAccess(page, { email, apps: ["geo-score-calculator"] })

    await geoScoreCalculatorSettingsPage.goto()
    await expect(geoScoreCalculatorSettingsPage.weightSumBadge).toHaveText("Suma: 100%", SLOW)
    // Suma zostaje 100% — -5 na Statystykach, +5 na Obiektywności.
    await geoScoreCalculatorSettingsPage.adjustWeight(geoScoreCalculatorSettingsPage.statisticsWeightSlider, -5)
    await geoScoreCalculatorSettingsPage.adjustWeight(geoScoreCalculatorSettingsPage.objectivityWeightSlider, 5)
    await expect(geoScoreCalculatorSettingsPage.weightSumBadge).toHaveText("Suma: 100%")

    await geoScoreCalculatorSettingsPage.saveButton.click()

    await expect(page.getByText("Ustawienia zapisane")).toBeVisible(SLOW)
    await expect(geoScoreCalculatorSettingsPage.lastUpdatedText).toContainText(email)

    const config = await page.request.get("/api/geo-score-calculator/config", {
      headers: { "x-auth-request-email": email },
    })
    const body = await config.json()
    expect(body.weightStatistics).toBeCloseTo(0.25, 5)
    expect(body.weightObjectivity).toBeCloseTo(0.3, 5)
  })

  test("Przywróć domyślne resetuje formularz i konfigurację w Postgresie po potwierdzeniu", async ({
    page,
    seed,
    geoScoreCalculatorSettingsPage,
  }) => {
    test.slow()
    const { email } = await seed("geo-score-calculator-user")
    await asUser(page, email)
    await mockShellAccess(page, { email, apps: ["geo-score-calculator"] })

    await geoScoreCalculatorSettingsPage.goto()
    await expect(geoScoreCalculatorSettingsPage.weightSumBadge).toHaveText("Suma: 100%", SLOW)
    await geoScoreCalculatorSettingsPage.adjustWeight(geoScoreCalculatorSettingsPage.statisticsWeightSlider, 10)
    await expect(geoScoreCalculatorSettingsPage.weightSumBadge).toHaveText("Suma: 110%")

    await geoScoreCalculatorSettingsPage.resetTriggerButton.click()
    await geoScoreCalculatorSettingsPage.confirmResetButton.click()

    await expect(page.getByText("Przywrócono domyślną konfigurację")).toBeVisible(SLOW)
    await expect(geoScoreCalculatorSettingsPage.weightSumBadge).toHaveText("Suma: 100%")

    const config = await page.request.get("/api/geo-score-calculator/config", {
      headers: { "x-auth-request-email": email },
    })
    const body = await config.json()
    expect(body.weightStatistics).toBeCloseTo(0.3, 5)
    expect(body.weightActionVerbs).toBeCloseTo(0.25, 5)
    expect(body.weightStructure).toBeCloseTo(0.2, 5)
    expect(body.weightObjectivity).toBeCloseTo(0.25, 5)
  })

  test("anulowanie w dialogu 'Przywróć domyślne' NIE zmienia konfiguracji", async ({
    page,
    seed,
    geoScoreCalculatorSettingsPage,
  }) => {
    test.slow()
    const { email } = await seed("geo-score-calculator-user")
    await asUser(page, email)
    await mockShellAccess(page, { email, apps: ["geo-score-calculator"] })

    await geoScoreCalculatorSettingsPage.goto()
    await expect(geoScoreCalculatorSettingsPage.weightSumBadge).toHaveText("Suma: 100%", SLOW)
    await geoScoreCalculatorSettingsPage.adjustWeight(geoScoreCalculatorSettingsPage.statisticsWeightSlider, 10)

    await geoScoreCalculatorSettingsPage.resetTriggerButton.click()
    await geoScoreCalculatorSettingsPage.cancelResetButton.click()

    // Dialog zamknięty, formularz WCIĄŻ ma niezapisaną zmianę (110%) — Anuluj
    // nie resetuje ani nie zapisuje.
    await expect(geoScoreCalculatorSettingsPage.weightSumBadge).toHaveText("Suma: 110%")

    const config = await page.request.get("/api/geo-score-calculator/config", {
      headers: { "x-auth-request-email": email },
    })
    const body = await config.json()
    expect(body.weightStatistics).toBeCloseTo(0.3, 5)
  })
})
