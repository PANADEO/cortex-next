// POM ekranu "Historia" (/document-parser/history). Jeden plik = jedna
// strona (code-e2e/SKILL.md).

import type { Locator, Page } from "@playwright/test"
import { BasePage } from "../shared/base-page"

export class DocumentParserHistoryPage extends BasePage {
  constructor(page: Page) {
    super(page)
  }

  get heading(): Locator {
    return this.page.getByRole("heading", { name: "Historia" })
  }

  get searchInput(): Locator {
    return this.page.getByPlaceholder("Szukaj po nazwie pliku…")
  }

  get statusFilter(): Locator {
    return this.page.getByLabel("Status")
  }

  row(fileName: string): Locator {
    return this.page.getByRole("row", { name: new RegExp(fileName) })
  }

  detailsButton(fileName: string): Locator {
    return this.page.getByRole("button", { name: `Zobacz szczegóły: ${fileName}` })
  }

  get emptyState(): Locator {
    return this.page.getByText("Brak zadań")
  }

  async goto(): Promise<void> {
    await this.page.goto("/document-parser/history", { waitUntil: "domcontentloaded" })
  }
}
