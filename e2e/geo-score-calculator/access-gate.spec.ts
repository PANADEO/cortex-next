// E2E kafelka GEO Score Calculator — bramka dostępu (design doc §6, "Dwie
// bramki"): mockowana WYŁĄCZNIE powłoka (AppGate, mockShellAccess()), moduł
// idzie realną ścieżką (seedScenario() → prawdziwy Postgres →
// requireTileAccess()). Wzorem e2e/document-parser/access-gate.spec.ts.

import { expect, test } from "../fixtures/fixtures"
import { asUser } from "../fixtures/fixtures"
import { mockShellAccess } from "../support/mocks/shell-access"

// Timeout hojniejszy niż domyśle 5s dla WSZYSTKICH pierwszych odwiedzin
// tras tego modułu w danym przebiegu `next dev` — każda kompiluje się
// on-demand (strona I route handler osobno), a to środowisko dodatkowo
// dzieli maszynę z innymi kontenerami/agentami (patrz raport weryfikacyjny
// tej zmiany). Patrz też analogiczny komentarz w history-scenario.spec.ts.
const SLOW = { timeout: 45_000 }

test.describe("GEO Score Calculator — bramka dostępu", () => {
  test("użytkownik z grantem widzi Kalkulator, Historię i Ustawienia", async ({
    page,
    seed,
    geoScoreCalculatorPage,
    geoScoreCalculatorHistoryPage,
    geoScoreCalculatorSettingsPage,
  }) => {
    test.slow()
    const { email } = await seed("geo-score-calculator-user")
    await asUser(page, email)
    await mockShellAccess(page, { email, apps: ["geo-score-calculator"] })

    await geoScoreCalculatorPage.goto()
    await expect(geoScoreCalculatorPage.heading).toBeVisible(SLOW)

    await geoScoreCalculatorHistoryPage.goto()
    await expect(geoScoreCalculatorHistoryPage.heading).toBeVisible(SLOW)
    await expect(geoScoreCalculatorHistoryPage.emptyState).toBeVisible(SLOW)

    await geoScoreCalculatorSettingsPage.goto()
    await expect(geoScoreCalculatorSettingsPage.heading).toBeVisible(SLOW)
  })

  test("użytkownik bez grantu do kafelka nie dostaje danych modułu (403, nie tylko 401)", async ({
    page,
    seed,
  }) => {
    await seed("geo-score-calculator-user")
    const intruder = "ktos-obcy-geo-score@e2e.local"
    await asUser(page, intruder)
    // Powłoka celowo PRZEPUSZCZA — chcemy zobaczyć, że odcina moduł, nie shell.
    await mockShellAccess(page, { email: intruder, apps: ["geo-score-calculator"] })

    const history = await page.request.get("/api/geo-score-calculator/history", {
      headers: { "x-auth-request-email": intruder },
    })
    expect(history.status()).toBe(403)

    const config = await page.request.get("/api/geo-score-calculator/config", {
      headers: { "x-auth-request-email": intruder },
    })
    expect(config.status()).toBe(403)
  })

  test("brak nagłówka tożsamości: 401, nie 403", async ({ page, seed }) => {
    await seed("geo-score-calculator-user")

    const response = await page.request.get("/api/geo-score-calculator/history")
    expect(response.status()).toBe(401)
  })
})
