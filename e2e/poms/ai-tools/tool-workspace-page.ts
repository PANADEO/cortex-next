// POM dla /ai-tools/[tool] (app/idp/app/(main)/ai-tools/[tool]/page.tsx).
//
// JEDEN POM na wszystkie narzędzia, parametryzowany `toolId` — bo wszystkie
// dziewięć renderuje ten sam komponent (AiToolWorkspace). Różni się wyłącznie
// ciało formularza (renderToolForm), a to jest różnica konfiguracji pól, nie
// różnica strony. Kopiowanie tego pliku 9× byłoby duplikacją bez treści.
//
// Świadomie NIE dziedziczy z BasePage: layout `(main)` renderuje strony AI Tools
// z `sidebar={null}` (patrz app/idp/app/(main)/layout.tsx, `isAiToolPage`), więc
// nawigacja sidebara — jedyne, co daje BasePage — na tych stronach nie istnieje.

import type { Locator, Page } from "@playwright/test"

export class AiToolWorkspacePage {
  readonly heading: Locator
  readonly generateButton: Locator
  readonly resultPlaceholder: Locator
  readonly accessDeniedShell: Locator
  readonly accessDeniedTool: Locator
  readonly unknownTool: Locator

  constructor(
    private readonly page: Page,
    private readonly toolId: string,
  ) {
    // PageHeader renderuje tytuł jako <h1> (packages/@cortex/ui/src/components/page-header.tsx).
    this.heading = page.getByRole("heading", { level: 1 })
    this.generateButton = page.getByRole("button", { name: "Generuj" })
    this.resultPlaceholder = page.getByText("Wynik pojawi się tutaj po wygenerowaniu.")
    // AccessDeniedScreen z AppGate (layout `(main)`) — to jest bramka, która
    // faktycznie odrzuca użytkownika bez grantu, ZANIM wyrenderuje się cokolwiek
    // z AiToolWorkspace.
    this.accessDeniedShell = page.getByRole("heading", { level: 1, name: "Brak dostępu" })
    // EmptyState z AiToolGate — druga, wewnątrzmodułowa bramka na tym samym
    // predykacie (canAccessAiTool). Defense-in-depth: dziś nieosiągalna dla
    // route'u /ai-tools/[tool], bo AppGate odrzuca wcześniej. Lokator zostaje,
    // żeby regresja "AppGate przestał pilnować" była widoczna jako zmiana
    // TEGO tekstu, a nie jako cichy brak asercji.
    this.accessDeniedTool = page.getByText("Brak dostępu do AI Tools")
    this.unknownTool = page.getByText("Nieznane narzędzie")
  }

  async goto(): Promise<void> {
    await this.page.goto(`/ai-tools/${this.toolId}`)
  }

  /** Treść wyniku. ResultPanel renderuje ją w jedynym <pre> na stronie —
   *  element bez roli ARIA, więc tu wyjątkowo lokator CSS zamiast role-based. */
  get resultContent(): Locator {
    return this.page.locator("pre")
  }

  /** Pole tekstowe/input po WIDOCZNEJ etykiecie. `exact`, bo etykiety się
   *  zawierają ("Tekst" ⊂ "Tekst do analizy", "Tekst źródłowy"). */
  async fillField(label: string, value: string): Promise<void> {
    await this.page.getByLabel(label, { exact: true }).fill(value)
  }

  async uploadFile(label: string, file: { name: string; mimeType: string; buffer: Buffer }): Promise<void> {
    await this.page.getByLabel(label, { exact: true }).setInputFiles(file)
  }

  async generate(): Promise<void> {
    await this.generateButton.click()
  }
}
