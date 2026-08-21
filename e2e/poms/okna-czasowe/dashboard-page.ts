// POM dla /okna-czasowe/dashboard (app/idp/app/(main)/okna-czasowe/dashboard/page.tsx).
//
// Dane przychodzą z GET /api/okna-czasowe/films + /api/okna-czasowe/data, które
// czytają pliki JSON z OKNA_CZASOWE_DATA_DIR — w testach ten katalog seeduje
// e2e/fixtures/json-store.ts, więc łańcuch plik -> route -> hook -> tabela jest
// przechodzony naprawdę, bez mocka `page.route`.

import type { Locator, Page } from "@playwright/test"
import { waitForHydrated } from "../../support/console"
import { BasePage } from "../shared/base-page"

export class OknaCzasoweDashboardPage extends BasePage {
  readonly heading: Locator
  readonly accessDeniedShell: Locator
  readonly scanButton: Locator
  readonly emptyState: Locator

  constructor(page: Page) {
    super(page)
    this.heading = page.getByRole("heading", { level: 1, name: "Dashboard", exact: true })
    this.accessDeniedShell = page.getByRole("heading", { level: 1, name: "Brak dostępu", exact: true })
    this.scanButton = page.getByRole("button", { name: "Skanuj teraz" })
    this.emptyState = page.getByText("Brak filmów w bazie")
  }

  // Patrz komentarz w poms/cortex-config/governance-page.ts.
  async goto(): Promise<void> {
    await this.page.goto("/okna-czasowe/dashboard")
    await waitForHydrated(this.page)
  }

  /** Kafelek licznika (DataCard, @cortex/ui) po jego etykiecie. Etykieta i
   *  wartość to dwa <p> obok siebie w jednym kontenerze i żaden nie ma roli
   *  ARIA, więc jedyny stabilny uchwyt to rodzic elementu z etykietą. */
  dataCard(label: string): Locator {
    return this.page.getByText(label, { exact: true }).locator("..")
  }

  /** Wiersz tabeli dashboardu dla danego filmu. */
  filmRow(title: string): Locator {
    return this.page.getByRole("row").filter({ hasText: title })
  }
}
