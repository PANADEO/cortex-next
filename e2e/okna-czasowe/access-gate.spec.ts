// Bramka dostępu do kafelka "Okna czasowe", widziana z przeglądarki.
//
// ⚠️ Dla TEGO kafelka bramka w UI jest JEDYNĄ, jaka istnieje. Route'y pod
// /api/okna-czasowe nie sprawdzają tożsamości w ogóle — udowodnione w
// app/idp/app/api/okna-czasowe/guard-coverage.test.ts i opisane w Obsidianie
// (PROJECT/cortex-frontend-testy-pozostalych-kafelkow.md). Ten plik NIE jest
// dowodem, że moduł jest zabezpieczony; jest dowodem, że warstwa UI zachowuje
// się tak, jak zaprojektowano, i że regresja w niej byłaby widoczna.
//
// UWAGA na zakres tych testów: `mockShellAccess()` podstawia odpowiedź
// /api/me/access, więc dowodzą one wyłącznie tego, co AppGate robi z GOTOWĄ
// listą kodów. Tego, że prawdziwe /api/me/access nigdy nie zwróci kodu
// `okna-czasowe` (brak na allowliście AUTHORIZED_APP_CODES), z przeglądarki
// dowieść się nie da — dowód jest na poziomie route'u, w
// app/idp/app/api/okna-czasowe/guard-coverage.test.ts.

import { expect, test } from "@playwright/test"
import { seedOknaCzasowe } from "../fixtures/json-store"
import { OknaCzasoweDashboardPage } from "../poms/okna-czasowe/dashboard-page"
import { mockIdpConfig } from "../support/mocks/idp-config"
import { mockShellAccess } from "../support/mocks/shell-access"

const EMAIL = "demo@cortex.local"

test.describe("Okna czasowe — bramka dostępu w UI", () => {
  test("użytkownik bez grantu na kafelek nie wchodzi na dashboard", async ({ page }) => {
    await seedOknaCzasowe("two-films-one-available")
    await mockShellAccess(page, { email: EMAIL, apps: ["idp"] })
    await mockIdpConfig(page)

    const dashboard = new OknaCzasoweDashboardPage(page)
    await dashboard.goto()

    await expect(dashboard.accessDeniedShell).toBeVisible()
    // Odmowa musi wyprzedzić render treści — żaden tytuł filmu nie może mignąć.
    await expect(dashboard.heading).toHaveCount(0)
    await expect(dashboard.scanButton).toHaveCount(0)
  })

  test("grant na inny kafelek nie otwiera Okien czasowych", async ({ page }) => {
    await seedOknaCzasowe("two-films-one-available")
    await mockShellAccess(page, { email: EMAIL, apps: ["intrastat", "ilustromat"] })
    await mockIdpConfig(page)

    const dashboard = new OknaCzasoweDashboardPage(page)
    await dashboard.goto()

    await expect(dashboard.accessDeniedShell).toBeVisible()
  })

  test("grant na kafelek okna-czasowe otwiera dashboard", async ({ page }) => {
    await seedOknaCzasowe("two-films-one-available")
    await mockShellAccess(page, { email: EMAIL, apps: ["okna-czasowe"] })
    await mockIdpConfig(page)

    const dashboard = new OknaCzasoweDashboardPage(page)
    await dashboard.goto()

    await expect(dashboard.heading).toBeVisible()
    await expect(dashboard.accessDeniedShell).toHaveCount(0)
  })
})
