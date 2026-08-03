// POM ekranu "Generator" (/visual-guru). Jeden plik = jedna strona
// (code-e2e/SKILL.md). Selektory role-based, zero data-testid — jedyny
// wyjątek `input[type="file"]` (FileUploader ukrywa natywny input bez
// własnej accessible-name), wzorem DocumentParserUploadPage.

import type { Locator, Page } from "@playwright/test"
import { BasePage } from "../shared/base-page"

export class VisualGuruGeneratorPage extends BasePage {
  constructor(page: Page) {
    super(page)
  }

  get heading(): Locator {
    return this.page.getByRole("heading", { name: "Visual Guru" })
  }

  get promptInput(): Locator {
    return this.page.getByLabel("Opis obrazu")
  }

  get additionalContextInput(): Locator {
    return this.page.getByLabel("Dodatkowy kontekst (opcjonalnie)")
  }

  get fileInput(): Locator {
    return this.page.locator('input[type="file"]')
  }

  get fidelityHigh(): Locator {
    return this.page.getByLabel("Wysoka", { exact: true })
  }

  get fidelityLoose(): Locator {
    return this.page.getByLabel("Swobodna", { exact: true })
  }

  get generateButton(): Locator {
    return this.page.getByRole("button", { name: "Generuj", exact: true })
  }

  get emptyState(): Locator {
    return this.page.getByText("Brak wygenerowanych obrazów")
  }

  variant(index: number): Locator {
    return this.page.getByRole("img", { name: `Wariant ${index}` })
  }

  get downloadAllButton(): Locator {
    return this.page.getByRole("button", { name: "Pobierz wszystkie (ZIP)" })
  }

  /** `domcontentloaded`, nie domyślne `load` — wzorem innych POM-ów tego repo
   *  (powłoka odpytuje endpointy proxowane do backendu IDP, którego lokalnie
   *  nie ma). */
  async goto(): Promise<void> {
    await this.page.goto("/visual-guru", { waitUntil: "domcontentloaded" })
  }
}
