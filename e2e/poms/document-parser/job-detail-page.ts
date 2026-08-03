// POM ekranu "Szczegóły zadania" (/document-parser/history/[id]). Jeden
// plik = jedna strona (code-e2e/SKILL.md).

import type { Locator, Page } from "@playwright/test"
import { BasePage } from "../shared/base-page"

export class DocumentParserJobDetailPage extends BasePage {
  constructor(page: Page) {
    super(page)
  }

  get heading(): Locator {
    return this.page.getByRole("heading", { name: "Szczegóły zadania" })
  }

  get backLink(): Locator {
    return this.page.getByRole("link", { name: "Historia" })
  }

  get notFound(): Locator {
    return this.page.getByText("Nie znaleziono zadania")
  }

  get promptBlock(): Locator {
    return this.page.getByText("Prompt użyty do ekstrakcji")
  }

  async goto(id: string): Promise<void> {
    await this.page.goto(`/document-parser/history/${id}`, { waitUntil: "domcontentloaded" })
  }
}
