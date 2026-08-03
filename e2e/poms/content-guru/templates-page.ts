// POM ekranu "Szablony" (/content-guru/templates, gated `manage-templates`
// dla mutacji, design doc D6/D9). Jeden plik = jedna strona (code-e2e/SKILL.md).

import type { Locator, Page } from "@playwright/test"
import { BasePage } from "../shared/base-page"
import { rowMatchPattern } from "../shared/row-match"

export class ContentGuruTemplatesPage extends BasePage {
  constructor(page: Page) {
    super(page)
  }

  get heading(): Locator {
    return this.page.getByRole("heading", { name: "Szablony" })
  }

  get newTemplateButton(): Locator {
    return this.page.getByRole("button", { name: "Nowy szablon" })
  }

  /** Pola formularza scoped do dialogu — "Kategoria" jest dwuznaczne na tej
   *  stronie (filtr NAD gridem ma dokładnie tę samą etykietę co pole w
   *  dialogu edycji), więc bez scope'owania `getByLabel("Kategoria")` łapie
   *  oba i wywraca test strict-mode violation. */
  private get dialog(): Locator {
    return this.page.getByRole("dialog")
  }

  get nameInput(): Locator {
    return this.dialog.getByLabel("Nazwa", { exact: true })
  }

  get categoryInput(): Locator {
    return this.dialog.getByLabel("Kategoria", { exact: true })
  }

  get contentInput(): Locator {
    return this.dialog.getByLabel("Treść promptu")
  }

  get saveButton(): Locator {
    return this.page.getByRole("button", { name: "Zapisz szablon" })
  }

  get cancelButton(): Locator {
    return this.page.getByRole("dialog").getByRole("button", { name: "Anuluj" })
  }

  get testTopicInput(): Locator {
    return this.dialog.getByLabel("Temat testowy (opcjonalnie)")
  }

  get testModelSelect(): Locator {
    return this.dialog.getByLabel("Model", { exact: true })
  }

  get testGenerationButton(): Locator {
    return this.dialog.getByRole("button", { name: /^Testuj generację$|^Generowanie…$/ })
  }

  row(name: string): Locator {
    return this.page.getByRole("row", { name: rowMatchPattern(name) })
  }

  editButton(name: string): Locator {
    return this.page.getByRole("button", { name: `Edytuj szablon ${name}`, exact: true })
  }

  moreActionsButton(name: string): Locator {
    return this.page.getByRole("button", { name: `Więcej akcji dla ${name}`, exact: true })
  }

  get duplicateMenuItem(): Locator {
    return this.page.getByRole("menuitem", { name: "Duplikuj" })
  }

  get deleteMenuItem(): Locator {
    return this.page.getByRole("menuitem", { name: "Usuń" })
  }

  get confirmDeleteButton(): Locator {
    return this.page.getByRole("alertdialog").getByRole("button", { name: "Usuń", exact: true })
  }

  async goto(): Promise<void> {
    await this.page.goto("/content-guru/templates", { waitUntil: "domcontentloaded" })
  }
}
