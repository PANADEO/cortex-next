// POM ekranu "Wgraj dokument" (/document-parser/upload). Jeden plik = jedna
// strona (code-e2e/SKILL.md).

import type { Locator, Page } from "@playwright/test"
import { BasePage } from "../shared/base-page"

export class DocumentParserUploadPage extends BasePage {
  constructor(page: Page) {
    super(page)
  }

  get heading(): Locator {
    return this.page.getByRole("heading", { name: "Parser Dokumentów" })
  }

  /** `FileUploader` (@cortex/ui) ukrywa natywny `<input type="file">` bez
   *  własnej accessible-name/label — jedyny świadomy wyjątek od "role-based"
   *  w tym module, zgodny z zalecanym wzorcem Playwrighta dla plikowych
   *  inputów bez etykiety (nie `data-testid`, wprost zabronione regułą). */
  get fileInput(): Locator {
    return this.page.locator('input[type="file"]')
  }

  get fileError(): Locator {
    return this.page.getByText("Nieobsługiwany format pliku", { exact: false })
  }

  get submitButton(): Locator {
    return this.page.getByRole("button", { name: "Wgraj i przetwórz" })
  }

  get resetButton(): Locator {
    return this.page.getByRole("button", { name: "Wgraj kolejny dokument" })
  }

  get downloadButton(): Locator {
    return this.page.getByRole("button", { name: "Pobierz Markdown" })
  }

  get detailsLink(): Locator {
    return this.page.getByRole("link", { name: "Zobacz pełny wynik" })
  }

  statusText(label: string): Locator {
    return this.page.getByText(label, { exact: true })
  }

  errorTitle(title: string): Locator {
    return this.page.getByText(title, { exact: true })
  }

  /** `domcontentloaded`, nie domyślne `load` — wzorem innych POM-ów tego
   *  repo (np. IlustromatGenerationPage), powłoka odpytuje endpointy IDP
   *  proxowane do backendu, którego lokalnie nie ma. */
  async goto(): Promise<void> {
    await this.page.goto("/document-parser/upload", { waitUntil: "domcontentloaded" })
  }

  async uploadFile(path: string): Promise<void> {
    await this.fileInput.setInputFiles(path)
  }
}
