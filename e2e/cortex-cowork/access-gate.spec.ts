// Bramka dostępu do panelu governance Cortex Cowork, widziana z przeglądarki.
//
// Ta strona ma DWIE niezależne bramki i cała wartość tego pliku polega na tym,
// że je ROZRÓŻNIA:
//   1. Powłoka (AppGate) — brak kodu `cortex-config` w /api/me/access.
//      Zmockowana przez mockShellAccess(), bo to zewnętrzny cortex-admin.
//   2. Moduł (requireAdmin() w app/idp/lib/cortex-governance/admin-gate.ts) —
//      PRAWDZIWY: prawdziwy handler, prawdziwy governance.json z seeda.
// Gdyby test sprawdzał tylko "widzę ekran odmowy", przeszedłby także wtedy, gdy
// moduł przestał pilnować admina, a odmowę wystawiała sama powłoka.
//
// Dowód na ścieżkę ŻĄDANIA (że handlery odmawiają niezależnie od UI) żyje w
// app/idp/app/api/cortex-config/guard-coverage.test.ts — jedno bez drugiego nie
// wystarcza.

import { expect, test } from "@playwright/test"
import { asUser } from "../fixtures/fixtures"
import {
  COWORK_ADMIN_EMAIL,
  COWORK_ANALYST_EMAIL,
  seedCowork,
} from "../fixtures/json-store"
import { GovernancePage } from "../poms/cortex-config/governance-page"
import { mockIdpConfig } from "../support/mocks/idp-config"
import { mockShellAccess } from "../support/mocks/shell-access"

test.describe("Cortex Cowork — bramka panelu governance", () => {
  test("bez grantu na kafelek cortex-config powłoka nie wpuszcza na stronę", async ({ page }) => {
    await seedCowork("roles-assigned")
    await mockShellAccess(page, { email: COWORK_ADMIN_EMAIL, apps: ["idp"] })
    await mockIdpConfig(page)
    await asUser(page, COWORK_ADMIN_EMAIL)

    const governance = new GovernancePage(page)
    await governance.goto()

    await expect(governance.accessDeniedShell).toBeVisible()
    // Powłoka odcina ZANIM moduł zdąży cokolwiek powiedzieć — panel modułu
    // (i jego własny ekran odmowy) w ogóle się nie renderuje.
    await expect(governance.heading).toHaveCount(0)
    await expect(governance.accessDeniedModule).toHaveCount(0)
  })

  test("grant na kafelek nie wystarcza — użytkownik bez roli admina dostaje odmowę z MODUŁU", async ({
    page,
  }) => {
    await seedCowork("roles-assigned")
    await mockShellAccess(page, { email: COWORK_ANALYST_EMAIL, apps: ["cortex-config"] })
    await mockIdpConfig(page)
    await asUser(page, COWORK_ANALYST_EMAIL)

    const governance = new GovernancePage(page)
    await governance.goto()

    // Powłoka wpuściła (nagłówek strony jest), odmówił dopiero requireAdmin().
    await expect(governance.heading).toBeVisible()
    await expect(governance.accessDeniedModule).toBeVisible()
    await expect(governance.accessDeniedShell).toHaveCount(0)
  })

  test("jawny admin widzi zawartość panelu", async ({ page }) => {
    await seedCowork("roles-assigned")
    await mockShellAccess(page, { email: COWORK_ADMIN_EMAIL, apps: ["cortex-config"] })
    await mockIdpConfig(page)
    await asUser(page, COWORK_ADMIN_EMAIL)

    const governance = new GovernancePage(page)
    await governance.goto()

    await expect(governance.heading).toBeVisible()
    await expect(governance.accessDeniedModule).toHaveCount(0)
    // Role z zaseedowanego governance.json, czyli dane przeszły całą drogę
    // plik -> requireAdmin() -> GET /api/cortex-config -> panel.
    await expect(governance.entityRow("Analityk")).toBeVisible()
    await expect(governance.entityRow("Manager")).toBeVisible()
  })

  test("tryb otwarty: dopóki nikt nie ma przypisanej roli, panel wpuszcza każdego i mówi o tym wprost", async ({
    page,
  }) => {
    // isAdmin() ma semantykę bootstrapu: pusta lista adminEmails oznacza, że
    // każdy może administrować — inaczej nikt nie mógłby dodać pierwszego admina.
    await seedCowork("open-mode")
    await mockShellAccess(page, { email: COWORK_ANALYST_EMAIL, apps: ["cortex-config"] })
    await mockIdpConfig(page)
    await asUser(page, COWORK_ANALYST_EMAIL)

    const governance = new GovernancePage(page)
    await governance.goto()

    await expect(governance.heading).toBeVisible()
    await expect(governance.accessDeniedModule).toHaveCount(0)
    await expect(governance.openModeBanner).toBeVisible()
  })
})
