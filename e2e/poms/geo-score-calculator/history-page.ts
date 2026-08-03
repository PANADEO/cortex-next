// POM ekranu "Historia" (/geo-score-calculator/history). Jeden plik = jedna
// strona (code-e2e/SKILL.md). Wzorem DocumentParserHistoryPage/
// VisualGuruHistoryPage — `CortexDataGrid` z wyszukiwaniem wbudowanym,
// filtrem oceny jako `Select` nad tabelą, jedną akcją wiersza.

import type { Locator, Page } from "@playwright/test"
import { BasePage } from "../shared/base-page"

export class GeoScoreCalculatorHistoryPage extends BasePage {
  constructor(page: Page) {
    super(page)
  }

  get heading(): Locator {
    return this.page.getByRole("heading", { name: "Historia" })
  }

  get searchInput(): Locator {
    return this.page.getByPlaceholder("Szukaj w tekście…")
  }

  get gradeFilter(): Locator {
    return this.page.getByLabel("Ocena")
  }

  get exportButton(): Locator {
    return this.page.getByRole("button", { name: "Eksportuj" })
  }

  get exportCsvItem(): Locator {
    return this.page.getByRole("menuitem", { name: "Eksportuj CSV" })
  }

  get exportJsonItem(): Locator {
    return this.page.getByRole("menuitem", { name: "Eksportuj JSON" })
  }

  get emptyState(): Locator {
    return this.page.getByText("Brak analiz")
  }

  /** Dopasowanie po fragmencie treści (podgląd tekstu) — jedynej stabilnej,
   *  czytelnej-dla-człowieka kolumnie unikalnej per wiersz w tym module
   *  (wzorem `row(fileName)` w DocumentParserHistoryPage). */
  row(textFragment: string): Locator {
    return this.page.getByRole("row", { name: new RegExp(textFragment) })
  }

  /** Klika JEDYNY przycisk akcji w wierszu dopasowanym po treści — nie
   *  polega na treści aria-label (ta niesie sformatowaną datę, nie tekst),
   *  tylko na tym, że kolumna akcji ma dokładnie jeden button (code-ui
   *  "Listy: row-actions", wariant "jedna akcja"). */
  async openDetails(textFragment: string): Promise<void> {
    await this.row(textFragment).getByRole("button").click()
  }

  /** Nagłówek sortowalnej kolumny ("Data"/"Wynik"/"Ocena"/"Słowa") —
   *  renderowany jako `<button>` (SortableColumnHeader, @cortex/ui
   *  cortex-data-grid.tsx). Kliknięcie przełącza asc→desc→brak sortu. */
  columnHeader(label: "Data" | "Wynik" | "Ocena" | "Słowa"): Locator {
    return this.page.getByRole("button", { name: label, exact: true })
  }

  async goto(): Promise<void> {
    await this.page.goto("/geo-score-calculator/history", { waitUntil: "domcontentloaded" })
  }
}
