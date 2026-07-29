// POM ekranu "Szablony marki" (/ilustromat/szablony).

import type { Locator, Page } from "@playwright/test"
import { BasePage } from "../shared/base-page"

export class IlustromatSzablonyPage extends BasePage {
  constructor(page: Page) {
    super(page)
  }

  get heading(): Locator {
    return this.page.getByRole("heading", { name: "Szablony marki" })
  }

  get nameInput(): Locator {
    return this.page.getByLabel("Nazwa", { exact: true })
  }

  get colorBg(): Locator {
    return this.page.getByLabel("Kolor tła", { exact: true })
  }

  get colorText(): Locator {
    return this.page.getByLabel("Kolor tekstu", { exact: true })
  }

  get saveButton(): Locator {
    return this.page.getByRole("button", { name: "Zapisz szablon" })
  }

  get preview(): Locator {
    return this.page.getByRole("img", { name: "Podgląd szablonu" })
  }

  get contrastWarning(): Locator {
    return this.page.getByText("Niski kontrast")
  }

  templateRow(name: string): Locator {
    return this.page.getByRole("listitem").filter({ hasText: name })
  }

  /** `domcontentloaded` z tego samego powodu co w generowanie-page.ts:
   *  żądania powłoki do nieobecnego lokalnie backendu IDP potrafią nie pozwolić
   *  paść zdarzeniu `load`. */
  async goto(): Promise<void> {
    await this.page.goto("/ilustromat/szablony", { waitUntil: "domcontentloaded" })
  }
}
