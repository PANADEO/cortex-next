// POM dla /cortex-config/governance (app/idp/app/(main)/cortex-config/governance/page.tsx).
//
// Ta strona ma DWIE niezależne bramki nad sobą i test musi je rozróżniać:
//   1. AppGate (powłoka) — brak kodu `cortex-config` w /api/me/access daje
//      pełnoekranowy AccessDeniedScreen ("Brak dostępu", <h1>).
//   2. requireAdmin() (moduł) — powłoka wpuszcza, ale GET /api/cortex-config
//      zwraca 403, więc GovernancePanel renderuje AccessDeniedState
//      ("Brak dostępu do konfiguracji", Alert wewnątrz strony).
// Zlanie ich w jeden lokator ukryłoby regresję "moduł przestał sprawdzać
// admina, powłoka przypadkiem nadal odmawia".

import type { Locator, Page } from "@playwright/test"
import { waitForHydrated } from "../../support/console"
import { BasePage } from "../shared/base-page"

export class GovernancePage extends BasePage {
  /** PageHeader renderuje tytuł jako <h1> (@cortex/ui page-header.tsx). */
  readonly heading: Locator
  /** Bramka POWŁOKI — AccessDeniedScreen z AppGate. */
  readonly accessDeniedShell: Locator
  /** Bramka MODUŁU — AccessDeniedState z features/cortex-config/config-screen.tsx. */
  readonly accessDeniedModule: Locator
  readonly openModeBanner: Locator

  constructor(page: Page) {
    super(page)
    this.heading = page.getByRole("heading", { level: 1, name: "Role i dostęp" })
    this.accessDeniedShell = page.getByRole("heading", { level: 1, name: "Brak dostępu", exact: true })
    this.accessDeniedModule = page.getByText("Panel Cortex Config wymaga uprawnień administratora.")
    this.openModeBanner = page.getByText("Tryb otwarty:")
  }

  // waitForHydrated() jest tu konieczne, nie kosmetyczne: AppGate renderuje
  // `null`, dopóki useMe()/useAuthorizedApps() są pending, więc świeżo
  // skompilowana przez `next dev` strona bywa PUSTA dłużej niż domyślne 5 s
  // asercji — i test przewracał się na "element not found" zamiast na treści.
  // Zweryfikowane na żywo: z 6-sekundowym oczekiwaniem strona renderowała się
  // za każdym razem. To nie zastępuje asercji web-first, tylko domyka
  // pobieranie chunków dev-buildu przed pierwszą z nich.
  async goto(): Promise<void> {
    await this.page.goto("/cortex-config/governance")
    await waitForHydrated(this.page)
  }

  /** Wiersz roli/użytkownika w panelu (EntityRow renderuje nazwę jako tekst). */
  entityRow(name: string): Locator {
    return this.page.getByText(name, { exact: true })
  }
}
