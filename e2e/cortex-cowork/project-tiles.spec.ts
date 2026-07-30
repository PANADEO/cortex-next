// Kafelki projektów agentowych (task-chat) na hubie Cortex360.
//
// To jest mechanizm opisany w CLAUDE.md jako wyjątek od reguły "kafelki są
// hardcoded w tiles.ts": kafelki task-chat NIE są w rejestrze kodu, hub dociąga
// je per user z GET /api/cortex-cowork/projects, a filtr ról działa PO STRONIE
// SERWERA (visibleProjectsFor() w lib/cortex-governance/store.ts). UI tego
// filtra nie powtarza — renderuje to, co dostanie. Dlatego test celowo NIE
// mockuje tego endpointu: mock zamieniłby go w sprawdzanie, czy React umie
// wyrenderować tablicę.
//
// Mockowana jest wyłącznie POWŁOKA (mockShellAccess). Od unifikacji bramek
// (30.07.2026) /api/me/access to własny endpoint nad własnym Postgresem, więc
// mock nie jest już koniecznością techniczną — jest wyborem: ustawia dokładnie
// ten zestaw grantów, którego ten plik potrzebuje, bez seedowania bazy.
//
// GRANT `cortex-cowork` W MOCKU JEST CZĘŚCIĄ SCENARIUSZA, nie ozdobnikiem.
// Hub bramkuje CAŁĄ sekcję kafelków task-chat tym grantem (tile-grid.tsx),
// więc bez niego wszystkie asercje niżej sprawdzałyby pustą listę i milczały
// o tym, co ten plik ma testować — filtr RÓL per projekt. Że sam grant działa
// (ma go → widzi sekcję, nie ma → nie widzi), dowodzi realną ścieżką
// e2e/shell/access-gate.spec.ts "kafelki task-chat na hubie widzi wyłącznie
// user z grantem cortex-cowork"; tutaj nie duplikujemy tego na mocku.

import { asUser, expect, test } from "../fixtures/fixtures"
import {
  COWORK_ADMIN_EMAIL,
  COWORK_ANALYST_EMAIL,
  COWORK_ANALYST_PROJECT,
  COWORK_DISABLED_PROJECT,
  COWORK_MANAGER_EMAIL,
  COWORK_MANAGER_PROJECT,
  COWORK_STRANGER_EMAIL,
  seedCowork,
} from "../fixtures/json-store"
import { HubPage } from "../poms/shell/hub-page"
import { mockIdpConfig } from "../support/mocks/idp-config"
import { mockShellAccess } from "../support/mocks/shell-access"

/** COWORK_APP_CODE z app/idp/lib/tiles.ts. Powtórzony literałem, a nie
 *  zaimportowany: tiles.ts ładuje w runtime lucide-react, którego proces
 *  `playwright test` nie ma po co wciągać (tak samo robi access-gate.spec.ts). */
const COWORK_APP_CODE = "cortex-cowork"

/** Hub renderuje kafelki code-backed razem z projektowymi. `idp` daje minimalny,
 *  stały zestaw tych pierwszych (punkt odniesienia "kafelki nadal są"),
 *  `cortex-cowork` odblokowuje SEKCJĘ projektową — po czym o zawartości tej
 *  sekcji decyduje już wyłącznie filtr ról w governance store, czyli to, co
 *  ten plik testuje. */
async function openHubAs(page: Parameters<typeof mockShellAccess>[0], email: string) {
  await mockShellAccess(page, { email, apps: ["idp", COWORK_APP_CODE] })
  await mockIdpConfig(page)
  await asUser(page, email)
  const hub = new HubPage(page)
  await hub.goto()
  return hub
}

test.describe("Cortex Cowork — kafelki projektów na hubie", () => {
  test("analityk widzi kafelek swojego projektu, a nie cudzego", async ({ page }) => {
    await seedCowork("roles-assigned")

    const hub = await openHubAs(page, COWORK_ANALYST_EMAIL)

    await expect(hub.tile(COWORK_ANALYST_PROJECT)).toBeVisible()
    await expect(hub.tile(COWORK_MANAGER_PROJECT)).toHaveCount(0)
  })

  test("manager widzi kafelek swojego projektu, a nie cudzego", async ({ page }) => {
    await seedCowork("roles-assigned")

    const hub = await openHubAs(page, COWORK_MANAGER_EMAIL)

    await expect(hub.tile(COWORK_MANAGER_PROJECT)).toBeVisible()
    await expect(hub.tile(COWORK_ANALYST_PROJECT)).toHaveCount(0)
  })

  test("użytkownik bez żadnej roli nie widzi żadnego projektu agentowego", async ({ page }) => {
    await seedCowork("roles-assigned")

    const hub = await openHubAs(page, COWORK_STRANGER_EMAIL)

    // Kafelki code-backed nadal są — to nie jest globalna odmowa, tylko pusty
    // wynik filtra ról.
    await expect(hub.tile("IDP")).toBeVisible()
    await expect(hub.tile(COWORK_ANALYST_PROJECT)).toHaveCount(0)
    await expect(hub.tile(COWORK_MANAGER_PROJECT)).toHaveCount(0)
  })

  test("jawny admin widzi oba projekty, ale wyłączony nie pojawia się nikomu", async ({ page }) => {
    await seedCowork("roles-assigned")

    const hub = await openHubAs(page, COWORK_ADMIN_EMAIL)

    await expect(hub.tile(COWORK_ANALYST_PROJECT)).toBeVisible()
    await expect(hub.tile(COWORK_MANAGER_PROJECT)).toBeVisible()
    await expect(hub.tile(COWORK_DISABLED_PROJECT)).toHaveCount(0)
  })

  test("tryb otwarty: przed pierwszym przypisaniem roli każdy widzi wszystkie włączone projekty", async ({
    page,
    seed,
  }) => {
    await seedCowork("open-mode")
    // Naprawa 30.07.2026 (zamknięcie otwartego panelu governance):
    // bootstrapTrusts() wymaga REALNEGO grantu `cortex-cowork` z Postgresa
    // nawet w trybie otwartym governance.json — sam mock powłoki (poniżej)
    // już nie wystarcza dla GET /api/cortex-cowork/projects w tym trybie.
    await seed("cowork-open-mode-stranger")

    const hub = await openHubAs(page, COWORK_STRANGER_EMAIL)

    await expect(hub.tile(COWORK_ANALYST_PROJECT)).toBeVisible()
    await expect(hub.tile(COWORK_MANAGER_PROJECT)).toBeVisible()
    await expect(hub.tile(COWORK_DISABLED_PROJECT)).toHaveCount(0)
  })

  test("kafelek projektu prowadzi do czatu tego projektu", async ({ page }) => {
    await seedCowork("roles-assigned")

    const hub = await openHubAs(page, COWORK_ANALYST_EMAIL)

    // href niesie id projektu — to on decyduje, którą konfigurację agenta
    // załaduje CoworkShell po wejściu.
    await expect(hub.tile(COWORK_ANALYST_PROJECT)).toHaveAttribute(
      "href",
      "/cortex-cowork/chat?project=proj-analiza",
    )
  })
})
