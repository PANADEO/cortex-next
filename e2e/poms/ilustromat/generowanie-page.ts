// POM ekranu "Generowanie" (/ilustromat/generowanie). Jeden plik = jedna
// strona, granica pliku = granica route'a (code-e2e/SKILL.md).
// Selektory role-based, zero data-testid.

import type { Locator, Page } from "@playwright/test"
import { BasePage } from "../shared/base-page"

export class IlustromatGenerowaniePage extends BasePage {
  constructor(page: Page) {
    super(page)
  }

  get heading(): Locator {
    return this.page.getByRole("heading", { name: "Ilustromat" })
  }

  get title(): Locator {
    return this.page.getByLabel("Tytuł", { exact: true })
  }

  get subtitle(): Locator {
    return this.page.getByLabel("Podtytuł", { exact: true })
  }

  get idea(): Locator {
    return this.page.getByLabel("Pomysł na ilustrację (opcjonalnie)")
  }

  get generateButton(): Locator {
    return this.page.getByRole("button", { name: "Generuj", exact: true })
  }

  get emptyState(): Locator {
    return this.page.getByText("Brak wygenerowanych kafelków")
  }

  get downloadButton(): Locator {
    return this.page.getByRole("button", { name: "Pobierz PNG" })
  }

  get templateSelect(): Locator {
    return this.page.getByLabel("Szablon marki")
  }

  variant(index: number): Locator {
    return this.page.getByRole("button", { name: `Wariant ${index}` })
  }

  get selectedPreview(): Locator {
    return this.page.getByRole("img", { name: "Wybrany kafelek" })
  }

  /** `domcontentloaded`, nie domyślne `load`: powłoka odpytuje endpointy
   *  proxowane do backendu IDP, którego lokalnie nie ma — te żądania wiszą aż
   *  do timeoutu, więc zdarzenie `load` potrafi nigdy nie paść. Asercje i tak
   *  są web-first (auto-retry), więc nie tracimy na tym nic. */
  async goto(): Promise<void> {
    await this.page.goto("/ilustromat/generowanie", { waitUntil: "domcontentloaded" })
  }
}
