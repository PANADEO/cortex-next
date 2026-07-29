// POM dla /intrastat/batches (app/idp/app/(main)/intrastat/batches/page.tsx).
//
// Osobny plik od dashboard-page.ts, bo osobny route — granica pliku POM = granica
// route'a (.claude/skills/code-e2e/SKILL.md "POM per kafelek, nie per moduł").

import type { Locator, Page } from "@playwright/test"
import { waitForHydrated } from "../../support/console"
import { BasePage } from "../shared/base-page"

export class IntrastatBatchesPage extends BasePage {
  readonly heading: Locator
  readonly accessDeniedShell: Locator
  /** Pierwszy "Export XLSX" na stronie — ten z wiersza tabeli (IntrastatExportButtons). */
  readonly exportButton: Locator
  readonly auditButton: Locator

  constructor(page: Page) {
    super(page)
    this.heading = page.getByRole("heading", { level: 1, name: "Intrastat Batches" })
    this.accessDeniedShell = page.getByRole("heading", { level: 1, name: "Brak dostępu", exact: true })
    this.exportButton = page.getByRole("button", { name: "Export XLSX" }).first()
    this.auditButton = page.getByRole("button", { name: "Audit XLSX" }).first()
  }

  // Patrz komentarz w poms/cortex-config/governance-page.ts.
  async goto(): Promise<void> {
    await this.page.goto("/intrastat/batches")
    await waitForHydrated(this.page)
  }

  batchRow(name: string): Locator {
    return this.page.getByRole("row").filter({ hasText: name })
  }
}
