// POM ekranu "Raportowanie Tokenów" (/token-usage). Jeden plik = jedna strona,
// granica pliku = granica route'a (code-e2e/SKILL.md).
// Selektory role-based, zero data-testid.

import type { Locator, Page } from "@playwright/test"
import { BasePage } from "../shared/base-page"

export class TokenUsagePage extends BasePage {
  constructor(page: Page) {
    super(page)
  }

  async goto(): Promise<void> {
    await this.page.goto("/token-usage")
  }

  get heading(): Locator {
    return this.page.getByRole("heading", { name: "Raportowanie Tokenów" })
  }

  get startDate(): Locator {
    return this.page.getByLabel("Data początkowa")
  }

  get endDate(): Locator {
    return this.page.getByLabel("Data końcowa")
  }

  get showButton(): Locator {
    return this.page.getByRole("button", { name: "Pokaż raport" })
  }

  presetButton(label: string): Locator {
    return this.page.getByRole("button", { name: label, exact: true })
  }

  /** Nota o jakości danych — projekt 1.4, ma być widoczna bez rozwijania. */
  get dataQualityNote(): Locator {
    return this.page.getByText("Jak czytać te liczby")
  }

  get rangeHint(): Locator {
    return this.page.getByText(/Zakres obejmuje obie daty włącznie/)
  }

  get validationError(): Locator {
    return this.page.getByText("Data początkowa nie może być późniejsza niż końcowa.")
  }

  /** Karta metryki po widocznej etykiecie — DataCard renderuje label i wartość
   *  jako zwykły tekst, więc szukamy po najbliższym wspólnym kontenerze. */
  metricCard(label: string): Locator {
    return this.page.locator("div").filter({ hasText: new RegExp(`^${label}`) }).first()
  }

  tab(name: string): Locator {
    return this.page.getByRole("tab", { name })
  }

  get emptyState(): Locator {
    return this.page.getByText("Brak danych w tym okresie")
  }

  get errorTitle(): Locator {
    return this.page.getByText("Raport nie jest skonfigurowany")
  }

  get modelFilter(): Locator {
    return this.page.getByLabel("Model")
  }

  get scopeFilter(): Locator {
    return this.page.getByLabel("Zakres")
  }

  /** Wiersz tabeli po widocznej wartości pierwszej kolumny. */
  row(text: string): Locator {
    return this.page.getByRole("row").filter({ hasText: text })
  }

  get downloadCsvButton(): Locator {
    return this.page.getByRole("button", { name: "Pobierz CSV" }).first()
  }
}
