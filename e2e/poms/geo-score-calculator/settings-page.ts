// POM ekranu "Ustawienia" (/geo-score-calculator/settings). Jeden plik =
// jedna strona (code-e2e/SKILL.md).
//
// Suwaki wag (`@radix-ui/react-slider` przez `@cortex/ui` Slider,
// packages/@cortex/ui/src/components/ui/slider.tsx) NIE mają realnej
// asocjacji `<label for>` z widocznym `role="slider"` — komponent
// przekazuje `id` na `SliderPrimitive.Root` (kontener), nie na
// `SliderPrimitive.Thumb` (element z `role="slider"`), więc `getByLabel()`
// go nie znajdzie. Lokalizacja pozycyjna (`getByRole("slider").nth(index)`,
// kolejność zgodna z `WEIGHT_FIELDS` w settings-form.tsx) + sterowanie
// klawiaturą (Radix Slider: ArrowUp/ArrowDown zmienia wartość o `step`) —
// jedyny niezawodny sposób bez przeciągania myszą (offset w pikselach).

import type { Locator, Page } from "@playwright/test"
import { BasePage } from "../shared/base-page"

export class GeoScoreCalculatorSettingsPage extends BasePage {
  constructor(page: Page) {
    super(page)
  }

  get heading(): Locator {
    return this.page.getByRole("heading", { name: "Ustawienia" })
  }

  /** Kolejność 1:1 z `WEIGHT_FIELDS` (settings-form.tsx): Statystyki,
   *  Czasowniki akcji, Struktura, Obiektywność. */
  get statisticsWeightSlider(): Locator {
    return this.page.getByRole("slider").nth(0)
  }

  get actionVerbsWeightSlider(): Locator {
    return this.page.getByRole("slider").nth(1)
  }

  get structureWeightSlider(): Locator {
    return this.page.getByRole("slider").nth(2)
  }

  get objectivityWeightSlider(): Locator {
    return this.page.getByRole("slider").nth(3)
  }

  /** "Suma: 100%" — zielony gdy ok, czerwony gdy ≠100% (design doc §4.4,
   *  "żywy" pasek — aktualizowany na KAŻDĄ zmianę, nie dopiero przy Zapisz). */
  get weightSumBadge(): Locator {
    return this.page.getByText(/^Suma: \d+%$/)
  }

  get saveButton(): Locator {
    return this.page.getByRole("button", { name: "Zapisz", exact: true })
  }

  get resetTriggerButton(): Locator {
    return this.page.getByRole("button", { name: "Przywróć domyślne", exact: true })
  }

  get confirmResetButton(): Locator {
    return this.page.getByRole("alertdialog").getByRole("button", { name: "Przywróć domyślne", exact: true })
  }

  get cancelResetButton(): Locator {
    return this.page.getByRole("alertdialog").getByRole("button", { name: "Anuluj" })
  }

  get lastUpdatedText(): Locator {
    return this.page.getByText(/Ostatnia zmiana:/)
  }

  /** Fokusuje suwak i przesuwa go o `steps` kroków (dodatnie = ArrowUp,
   *  ujemne = ArrowDown) — Radix Slider zmienia wartość o `step={1}` na
   *  jedno naciśnięcie, więc `steps` to wprost delta wartości. */
  async adjustWeight(slider: Locator, steps: number): Promise<void> {
    await slider.focus()
    const key = steps >= 0 ? "ArrowUp" : "ArrowDown"
    for (let i = 0; i < Math.abs(steps); i++) {
      await slider.press(key)
    }
  }

  async goto(): Promise<void> {
    await this.page.goto("/geo-score-calculator/settings", { waitUntil: "domcontentloaded" })
  }
}
