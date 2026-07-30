// POM dla /intrastat/dashboard (app/idp/app/(main)/intrastat/dashboard/page.tsx).
//
// Intrastat NIE ma własnych route'ów w tym repo — cały jego backend to osobna
// aplikacja FastAPI, do której `app/idp/middleware.ts` przepisuje ścieżki
// `/intrastat/api/**` (INTRASTAT_BACKEND_URL). Lokalnie ten backend nie
// istnieje, więc to jest granica "poza modułem" i jedyne miejsce, które w tych
// testach wolno mockować przez `page.route` — patrz e2e/support/mocks/intrastat-backend.ts.

import type { Locator, Page } from "@playwright/test"
import { waitForHydrated } from "../../support/console"
import { BasePage } from "../shared/base-page"

export class IntrastatDashboardPage extends BasePage {
  readonly heading: Locator
  readonly accessDeniedShell: Locator

  constructor(page: Page) {
    super(page)
    this.heading = page.getByRole("heading", { level: 1, name: "Intrastat", exact: true })
    this.accessDeniedShell = page.getByRole("heading", { level: 1, name: "Brak dostępu", exact: true })
  }

  // Patrz komentarz w poms/cortex-config/governance-page.ts.
  async goto(): Promise<void> {
    await this.page.goto("/intrastat/dashboard")
    await waitForHydrated(this.page)
  }

  /** Wiersz tabeli "Recent batches" po nazwie paczki. */
  batchRow(name: string): Locator {
    return this.page.getByRole("row").filter({ hasText: name })
  }

  /** Link do paczki w tabeli — dowód, że dane z backendu doszły do wiersza. */
  batchLink(name: string): Locator {
    return this.page.getByRole("link", { name, exact: true })
  }
}
