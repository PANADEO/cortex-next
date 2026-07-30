// Bramka dostępu do kafelka "Okna czasowe", widziana z przeglądarki.
//
// Ten kafelek ma DWIE niezależne bramki i ten plik rozróżnia je celowo:
//   1. POWŁOKA — AppGate czyta kody z /api/me/access i decyduje, czy strona w
//      ogóle się wyrenderuje. Tu podstawiana przez `mockShellAccess()`.
//   2. RBAC MODUŁU — `requireTileAccess()` na własnych route'ach /api/okna-czasowe
//      (dodane 30.07.2026, app/idp/app/api/okna-czasowe/_lib/guard.ts). Czyta
//      granty z Postgresa i mock powłoki go NIE dotyczy.
//
// Do 30.07.2026 istniała wyłącznie pierwsza z nich, a API modułu było otwarte
// dla wszystkich. Ostatni test niżej pilnuje, żeby te dwie warstwy nie zlały
// się z powrotem w jedną: zamockowana powłoka wpuszcza na stronę, ale bez
// grantu w bazie żadne dane nie mają prawa się pojawić.
//
// Pełne pokrycie odmów na poziomie żądania (401 bez tożsamości, 403 bez grantu,
// zero zapisów i zero ruchu do JustWatch) jest w
// app/idp/app/api/okna-czasowe/guard-coverage.test.ts — z przeglądarki nie da
// się tego pokazać w rozsądny sposób.

import { asUser, expect, test } from "../fixtures/fixtures"
import { OKNA_AVAILABLE_FILM, seedOknaCzasowe } from "../fixtures/json-store"
import { OknaCzasoweDashboardPage } from "../poms/okna-czasowe/dashboard-page"
import { mockIdpConfig } from "../support/mocks/idp-config"
import { mockShellAccess } from "../support/mocks/shell-access"

test.describe.configure({ timeout: 90_000 })

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

  // Dwie bramki, dwie różne odpowiedzi na to samo żądanie. Gdyby ktoś usunął
  // `requireTileAccess()` z route'ów modułu, ten test zapali się jako jedyny w
  // pliku — pozostałe trzy dotyczą wyłącznie powłoki i zostałyby zielone.
  test("zamockowana powłoka nie zastępuje RBAC modułu: bez grantu w bazie nie ma danych", async ({
    page,
    seed,
  }) => {
    // Użytkownik istnieje, ale nie ma żadnej roli ani grantu — /api/okna-czasowe
    // odpowie 403 mimo że AppGate go wpuści.
    const { email } = await seed("user-no-roles")
    await seedOknaCzasowe("two-films-one-available")
    await asUser(page, email)
    await mockShellAccess(page, { email, apps: ["okna-czasowe"] })
    await mockIdpConfig(page)

    const dashboard = new OknaCzasoweDashboardPage(page)
    await dashboard.goto()

    // Strona się renderuje (odmowa NIE pochodzi z powłoki)...
    await expect(dashboard.heading).toBeVisible()
    await expect(dashboard.accessDeniedShell).toHaveCount(0)
    // ...ale dane z API nie przyszły: pusty stan zamiast dwóch wierszy.
    await expect(dashboard.emptyState).toBeVisible()
    await expect(dashboard.filmRow(OKNA_AVAILABLE_FILM)).toHaveCount(0)
  })
})
