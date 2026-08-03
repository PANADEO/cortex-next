// POM ekranu "Kalkulator" (/geo-score-calculator). Jeden plik = jedna strona
// (code-e2e/SKILL.md). Dwa tryby tego samego ekranu (design doc §4.1) —
// edycji (textarea) i wyniku (hero score + podświetlenia) — żyją w JEDNYM
// POM-ie, bo to JEDNA strona/route, nie dwie.

import type { Locator, Page } from "@playwright/test"
import { BasePage } from "../shared/base-page"

export class GeoScoreCalculatorPage extends BasePage {
  constructor(page: Page) {
    super(page)
  }

  get heading(): Locator {
    return this.page.getByRole("heading", { name: "Kalkulator GEO Score" })
  }

  get textInput(): Locator {
    return this.page.getByLabel("Tekst do analizy")
  }

  get analyzeButton(): Locator {
    return this.page.getByRole("button", { name: "Analizuj", exact: true })
  }

  get loadExampleButton(): Locator {
    return this.page.getByRole("button", { name: "Wczytaj przykład" })
  }

  get editAgainButton(): Locator {
    return this.page.getByRole("button", { name: "Edytuj ponownie" })
  }

  /** Duży wynik liczbowy (hero score) — zawsze `toFixed(1)`, np. "80.0". */
  scoreText(value: string): Locator {
    return this.page.getByText(value, { exact: true })
  }

  gradeText(grade: "A" | "B" | "C" | "D" | "F"): Locator {
    return this.page.getByText(`Ocena ${grade}`, { exact: true })
  }

  get deltaBadge(): Locator {
    return this.page.getByText(/od poprzedniej analizy/)
  }

  /** Fragmenty podświetlone `<mark>` (dane liczbowe/słowa subiektywne) —
   *  design doc §4.1, zastępuje płaskie listy tagów z legacy Streamlita. */
  get highlightMarks(): Locator {
    return this.page.locator("mark")
  }

  actionVerbsMethod(method: "spaCy" | "heurystyka"): Locator {
    return this.page.getByText(new RegExp(`metoda: ${method}`))
  }

  get recommendationsLabel(): Locator {
    return this.page.getByText("Rekomendacje", { exact: true })
  }

  async goto(): Promise<void> {
    await this.page.goto("/geo-score-calculator", { waitUntil: "domcontentloaded" })
  }

  async analyzeText(text: string): Promise<void> {
    await this.textInput.fill(text)
    await this.analyzeButton.click()
  }
}
