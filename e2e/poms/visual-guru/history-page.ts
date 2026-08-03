// POM ekranu "Archiwum" (/visual-guru/history). Jeden plik = jedna strona
// (code-e2e/SKILL.md).

import type { Locator, Page } from "@playwright/test"
import { BasePage } from "../shared/base-page"

export class VisualGuruHistoryPage extends BasePage {
  constructor(page: Page) {
    super(page)
  }

  get heading(): Locator {
    return this.page.getByRole("heading", { name: "Archiwum" })
  }

  get searchInput(): Locator {
    return this.page.getByPlaceholder("Szukaj po treści promptu…")
  }

  get emptyState(): Locator {
    return this.page.getByText("Brak generacji")
  }

  /** Dopasowanie po fragmencie treści promptu — jedynej stabilnej,
   *  czytelnej-dla-człowieka kolumnie unikalnej per wiersz w tym module
   *  (wzorem `row(fileName)` w DocumentParserHistoryPage). */
  row(promptSubstring: string): Locator {
    return this.page.getByRole("row", { name: new RegExp(promptSubstring) })
  }

  /** Klika JEDYNY przycisk akcji w wierszu dopasowanym po promptcie — nie
   *  polega na treści aria-label (ta niesie sformatowaną datę, nie prompt),
   *  tylko na tym, że kolumna akcji ma dokładnie jeden button (code-ui
   *  "Listy: row-actions", wariant "jedna akcja"). */
  async openDetails(promptSubstring: string): Promise<void> {
    await this.row(promptSubstring).getByRole("button").click()
  }

  async goto(): Promise<void> {
    await this.page.goto("/visual-guru/history", { waitUntil: "domcontentloaded" })
  }
}
