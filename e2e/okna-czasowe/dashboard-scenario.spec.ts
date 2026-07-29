// Dashboard "Okna czasowe" — łańcuch plik JSON -> route -> hook -> tabela.
//
// Dane pochodzą z prawdziwych plików w OKNA_CZASOWE_DATA_DIR (seed w
// e2e/fixtures/json-store.ts), a nie z `page.route`. To jedyny sposób, żeby
// test wykrył regresję w store'ze albo w route'cie — zamockowana odpowiedź
// sprawdzałaby wyłącznie, czy React umie wyrenderować tablicę.
//
// docs/data-locations.md: ten moduł ŚWIADOMIE nie jest migrowany do Postgresa,
// więc pliki JSON są tu docelowym nośnikiem, nie stanem przejściowym.

import { expect, test } from "@playwright/test"
import {
  OKNA_AVAILABLE_FILM,
  OKNA_UNAVAILABLE_FILM,
  seedOknaCzasowe,
} from "../fixtures/json-store"
import { OknaCzasoweDashboardPage } from "../poms/okna-czasowe/dashboard-page"
import { mockIdpConfig } from "../support/mocks/idp-config"
import { mockShellAccess } from "../support/mocks/shell-access"

const EMAIL = "demo@cortex.local"

async function openDashboard(page: Parameters<typeof mockIdpConfig>[0]) {
  await mockShellAccess(page, { email: EMAIL, apps: ["okna-czasowe"] })
  await mockIdpConfig(page)
  const dashboard = new OknaCzasoweDashboardPage(page)
  await dashboard.goto()
  return dashboard
}

test.describe("Okna czasowe — dashboard", () => {
  test("pusty stan: brak plików danych daje komunikat zamiast pustej tabeli", async ({ page }) => {
    await seedOknaCzasowe("empty")

    const dashboard = await openDashboard(page)

    await expect(dashboard.heading).toBeVisible()
    await expect(dashboard.emptyState).toBeVisible()
  })

  test("dane z plików JSON trafiają do liczników i do tabeli", async ({ page }) => {
    await seedOknaCzasowe("two-films-one-available")

    const dashboard = await openDashboard(page)

    await expect(dashboard.emptyState).toHaveCount(0)
    // Dwa filmy w films.json, jeden ze snapshotem available:true.
    await expect(dashboard.dataCard("Filmy śledzone")).toContainText("2")
    await expect(dashboard.dataCard("Dostępne teraz (Rakuten PL)")).toContainText("1")
    // scannedAt z snapshots.json, sformatowane przez formatDateTime().
    await expect(dashboard.dataCard("Ostatni skan")).toContainText("20.07.2026")

    await expect(dashboard.filmRow(OKNA_AVAILABLE_FILM)).toBeVisible()
    await expect(dashboard.filmRow(OKNA_UNAVAILABLE_FILM)).toBeVisible()
  })

  test("wiersz filmu pokazuje dostępność, typ oferty i cenę z ostatniego snapshotu", async ({
    page,
  }) => {
    await seedOknaCzasowe("two-films-one-available")

    const dashboard = await openDashboard(page)

    const available = dashboard.filmRow(OKNA_AVAILABLE_FILM)
    await expect(available).toContainText("Dostępny")
    await expect(available).toContainText("RENT")
    await expect(available).toContainText("9,99 zl")
    // firstSeenAvailable z films.json — to jest odpowiedź na pytanie "od kiedy",
    // czyli sens całego kafelka.
    await expect(available).toContainText("18.07.2026")

    // Film bez oferty ma odwrotny zestaw: brak dostępności, myślniki zamiast
    // ceny. Bez tej asercji test przechodziłby też, gdyby wszystkie wiersze
    // renderowały się jednakowo.
    const unavailable = dashboard.filmRow(OKNA_UNAVAILABLE_FILM)
    await expect(unavailable).toContainText("Brak")
    await expect(unavailable).not.toContainText("RENT")
  })

  test('"Skanuj teraz" uderza w POST /api/okna-czasowe/scan', async ({ page }) => {
    await seedOknaCzasowe("two-films-one-available")

    // Skan wychodzi do publicznego API JustWatch, więc w teście przechwytujemy
    // go na granicy własnego route'u — sprawdzamy, że przycisk woła WŁAŚCIWY
    // endpoint właściwą metodą, nie że JustWatch odpowiada.
    const scanRequests: string[] = []
    await page.route("**/api/okna-czasowe/scan", async (route) => {
      scanRequests.push(route.request().method())
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          log: {
            id: "log-e2e",
            startedAt: "2026-07-21T09:00:00.000Z",
            finishedAt: "2026-07-21T09:01:00.000Z",
            filmsScanned: 2,
            newAvailabilities: 0,
            changesDetected: 0,
            errors: [],
          },
          snapshots: [],
        }),
      })
    })

    const dashboard = await openDashboard(page)
    await dashboard.scanButton.click()

    await expect(page.getByText("Skan zakończony: 2 filmów")).toBeVisible()
    expect(scanRequests).toEqual(["POST"])
  })
})
