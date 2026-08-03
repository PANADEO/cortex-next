// POM ekranu "Szczegóły generacji" (/visual-guru/history/[id]). Jeden plik =
// jedna strona (code-e2e/SKILL.md).

import type { Locator, Page } from "@playwright/test"
import { BasePage } from "../shared/base-page"

export class VisualGuruHistoryDetailPage extends BasePage {
  constructor(page: Page) {
    super(page)
  }

  get heading(): Locator {
    return this.page.getByRole("heading", { name: "Szczegóły generacji" })
  }

  get backLink(): Locator {
    return this.page.getByRole("link", { name: "Archiwum" })
  }

  get notFound(): Locator {
    return this.page.getByText("Nie znaleziono generacji")
  }

  get deleteButton(): Locator {
    return this.page.getByRole("button", { name: "Usuń", exact: true })
  }

  get confirmDeleteButton(): Locator {
    return this.page.getByRole("alertdialog").getByRole("button", { name: "Usuń", exact: true })
  }

  get cancelDeleteButton(): Locator {
    return this.page.getByRole("button", { name: "Anuluj" })
  }

  variant(index: number): Locator {
    return this.page.getByRole("img", { name: `Wariant ${index}` })
  }

  async goto(id: string): Promise<void> {
    await this.page.goto(`/visual-guru/history/${id}`, { waitUntil: "domcontentloaded" })
  }
}
