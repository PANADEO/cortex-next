// POM ekranu "Profile rynku" (/content-guru/market-profiles, PER-USER,
// design doc D7) — kształt bliźniaczy do ContentGuruClientProfilesPage. Jeden
// plik = jedna strona (code-e2e/SKILL.md).

import type { Locator, Page } from "@playwright/test"
import { BasePage } from "../shared/base-page"
import { rowMatchPattern } from "../shared/row-match"

export class ContentGuruMarketProfilesPage extends BasePage {
  constructor(page: Page) {
    super(page)
  }

  get heading(): Locator {
    return this.page.getByRole("heading", { name: "Profile rynku" })
  }

  get newProfileButton(): Locator {
    return this.page.getByRole("button", { name: "Nowy profil" })
  }

  get profileNameInput(): Locator {
    return this.page.getByLabel("Nazwa profilu")
  }

  get descriptionInput(): Locator {
    return this.page.getByLabel("Opis", { exact: true })
  }

  get saveButton(): Locator {
    return this.page.getByRole("button", { name: "Zapisz profil" })
  }

  row(name: string): Locator {
    return this.page.getByRole("row", { name: rowMatchPattern(name) })
  }

  editButton(name: string): Locator {
    return this.page.getByRole("button", { name: `Edytuj profil ${name}`, exact: true })
  }

  deleteButton(name: string): Locator {
    return this.page.getByRole("button", { name: `Usuń profil ${name}`, exact: true })
  }

  get confirmDeleteButton(): Locator {
    return this.page.getByRole("alertdialog").getByRole("button", { name: "Usuń", exact: true })
  }

  get emptyState(): Locator {
    return this.page.getByText("Brak profili rynku")
  }

  async goto(): Promise<void> {
    await this.page.goto("/content-guru/market-profiles", { waitUntil: "domcontentloaded" })
  }
}
