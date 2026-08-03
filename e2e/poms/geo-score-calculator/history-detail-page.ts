// POM ekranu "Szczegóły analizy" (/geo-score-calculator/history/[id]).
// Jeden plik = jedna strona (code-e2e/SKILL.md). Wzorem
// VisualGuruHistoryDetailPage — przycisk usuwania istnieje DWA razy w DOM
// (trigger + akcja w otwartym `AlertDialog`, oba z tą samą etykietą "Usuń"),
// stąd `confirmDeleteButton` scoped do `getByRole("alertdialog")`.

import type { Locator, Page } from "@playwright/test"
import { BasePage } from "../shared/base-page"

export class GeoScoreCalculatorHistoryDetailPage extends BasePage {
  constructor(page: Page) {
    super(page)
  }

  get heading(): Locator {
    return this.page.getByRole("heading", { name: "Szczegóły analizy" })
  }

  get backLink(): Locator {
    return this.page.getByRole("link", { name: "Historia" })
  }

  get notFound(): Locator {
    return this.page.getByText("Nie znaleziono analizy")
  }

  get configSnapshotLabel(): Locator {
    return this.page.getByText("Konfiguracja użyta do tego wyniku")
  }

  get deleteTriggerButton(): Locator {
    return this.page.getByRole("button", { name: "Usuń", exact: true })
  }

  get confirmDeleteButton(): Locator {
    return this.page.getByRole("alertdialog").getByRole("button", { name: "Usuń", exact: true })
  }

  get cancelDeleteButton(): Locator {
    return this.page.getByRole("alertdialog").getByRole("button", { name: "Anuluj" })
  }

  async goto(id: string): Promise<void> {
    await this.page.goto(`/geo-score-calculator/history/${id}`, { waitUntil: "domcontentloaded" })
  }
}
