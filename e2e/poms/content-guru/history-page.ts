// POM ekranu "Historia" (/content-guru/history, design doc §4.5). Jeden
// plik = jedna strona (code-e2e/SKILL.md).

import type { Locator, Page } from "@playwright/test"
import { BasePage } from "../shared/base-page"
import { rowMatchPattern } from "../shared/row-match"

export class ContentGuruHistoryPage extends BasePage {
  constructor(page: Page) {
    super(page)
  }

  get heading(): Locator {
    return this.page.getByRole("heading", { name: "Historia" })
  }

  get statusFilter(): Locator {
    return this.page.getByLabel("Status", { exact: true })
  }

  get contentTypeFilter(): Locator {
    return this.page.getByLabel("Typ treści")
  }

  get searchInput(): Locator {
    return this.page.getByPlaceholder("Szukaj po temacie, typie lub modelu…")
  }

  get emptyState(): Locator {
    return this.page.getByText("Brak wpisów w archiwum")
  }

  /** Dopasowanie po fragmencie tematu — jedynej stabilnej, czytelnej-dla-
   *  człowieka kolumnie unikalnej per wiersz w tym seedzie (wzorem
   *  `row(promptSubstring)` w VisualGuruHistoryPage). */
  row(topicSubstring: string): Locator {
    return this.page.getByRole("row", { name: rowMatchPattern(topicSubstring) })
  }

  async openDetails(topicSubstring: string): Promise<void> {
    await this.row(topicSubstring).getByRole("button").click()
  }

  async goto(): Promise<void> {
    await this.page.goto("/content-guru/history", { waitUntil: "domcontentloaded" })
  }
}
