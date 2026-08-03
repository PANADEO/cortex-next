// POM ekranu "Szczegóły treści" (/content-guru/history/[id], design doc
// §4.5). Jeden plik = jedna strona (code-e2e/SKILL.md).

import type { Locator, Page } from "@playwright/test"
import { BasePage } from "../shared/base-page"

export class ContentGuruHistoryDetailPage extends BasePage {
  constructor(page: Page) {
    super(page)
  }

  get heading(): Locator {
    return this.page.getByRole("heading", { name: "Szczegóły treści" })
  }

  get backLink(): Locator {
    return this.page.getByRole("link", { name: "Historia" })
  }

  get notFound(): Locator {
    return this.page.getByText("Nie znaleziono wpisu")
  }

  get warningsBanner(): Locator {
    return this.page.getByText("Treść zawiera frazy z listy zakazanych fraz")
  }

  markedPhrase(phrase: string): Locator {
    return this.page.locator("mark").filter({ hasText: phrase })
  }

  async goto(id: string): Promise<void> {
    await this.page.goto(`/content-guru/history/${id}`, { waitUntil: "domcontentloaded" })
  }
}
