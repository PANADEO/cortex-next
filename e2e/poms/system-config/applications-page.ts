// POM dla /system-config/applications
// (app/idp/app/(main)/system-config/applications/page.tsx).
//
// Zakres celowo wąski: dziś pokrywa wyłącznie dialog "Dodaj aplikację" w
// wariancie kind=native (D6-rewizja/D10-rewizja d — aktywacja zarejestrowanego
// manifestu, e2e/shell/hub-activation.spec.ts). Rozszerzać w miarę potrzeb
// kolejnych testów tego ekranu, wzorem UsersPage.

import type { Locator, Page } from "@playwright/test"
import { BasePage } from "../shared/base-page"

export class ApplicationsPage extends BasePage {
  readonly heading: Locator
  readonly addButton: Locator

  constructor(page: Page) {
    super(page)
    this.heading = page.getByRole("heading", { name: "Aplikacje" })
    this.addButton = page.getByRole("button", { name: "Dodaj aplikację" })
  }

  async goto(): Promise<void> {
    await this.page.goto("/system-config/applications")
  }

  async openCreateDialog(): Promise<void> {
    await this.addButton.click()
  }

  get dialog(): Locator {
    return this.page.getByRole("dialog")
  }

  /** SELECT "Moduł" (D6-rewizja/D10-rewizja d) — lista kandydatów z
   *  listUnactivatedNativeApplications(), nie wolny tekst. */
  async selectManifest(manifestName: string): Promise<void> {
    await this.dialog.getByLabel("Moduł").click()
    await this.page.getByRole("option", { name: manifestName }).click()
  }

  get noUnactivatedCandidatesLocator(): Locator {
    return this.dialog.getByText("Brak niezaktywowanych modułów")
  }

  get activateButton(): Locator {
    return this.dialog.getByRole("button", { name: "Aktywuj" })
  }

  async row(code: string): Promise<Locator> {
    return this.page.getByRole("row", { name: new RegExp(code) })
  }

  /** Wyłącza aktywną aplikację z listy (przycisk Power/PowerOff, `691da0c`) —
   *  aria-label zależy od bieżącego stanu, więc wywołujący musi wiedzieć, że
   *  wiersz jest dziś aktywny. */
  async deactivate(applicationName: string): Promise<void> {
    await this.page.getByRole("button", { name: `Wyłącz aplikację ${applicationName}` }).click()
  }

  /** Badge statusu ("Aktywna"/"Wyłączona") W KONKRETNYM wierszu — Krok 5
   *  (PROJECT/cortex-frontend-hub-db-driven-projekt.md) sprawdza tym samym
   *  locatorem native i external-link, żeby dowieść, że to ta sama konwencja
   *  wizualna, nie nowy wariant. */
  async statusBadge(code: string): Promise<Locator> {
    const row = await this.row(code)
    return row.getByText(/^(Aktywna|Wyłączona)$/)
  }
}
