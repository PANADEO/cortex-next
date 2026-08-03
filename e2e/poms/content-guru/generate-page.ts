// POM ekranu "Generowanie" (/content-guru) — jedyna trasa z trzema trybami
// (segmented control Pojedyncza/Kilka/Pakiet, design doc §4.1) na jednej
// stronie. Jeden plik = jedna strona (code-e2e/SKILL.md), mimo że renderuje
// trzy tryby — to WCIĄŻ jedna trasa/jeden route, dokładnie jak GEO Score
// Calculator "dwa tryby tej samej strony, nie osobne strony".

import type { Locator, Page } from "@playwright/test"
import { BasePage } from "../shared/base-page"

export class ContentGuruGeneratePage extends BasePage {
  constructor(page: Page) {
    super(page)
  }

  get heading(): Locator {
    return this.page.getByRole("heading", { name: "Content Guru" })
  }

  tab(name: "Pojedyncza" | "Kilka" | "Pakiet"): Locator {
    return this.page.getByRole("tab", { name })
  }

  // ---- pola wspólne ----

  get templateCategorySelect(): Locator {
    return this.page.getByLabel("Kategoria szablonu")
  }

  get templateSelect(): Locator {
    return this.page.getByLabel("Szablon", { exact: true })
  }

  /** Radix `Select` nie ustawia się przez `.fill()`/`.selectOption()` — trigger
   *  + `role="option"` w otwartej liście, wzorem wzorca już ustalonego w tym
   *  repo (np. `gradeFilter.click()` + `getByRole("option", ...)` w
   *  geo-score-calculator/history-scenario.spec.ts). Kategoria auto-wybiera
   *  się sama (jedna opcja z mocka) — TYLKO nazwa szablonu wymaga jawnego
   *  wyboru, bo page.tsx nie ma efektu auto-selekcji `templateId`. */
  async selectTemplate(name: string): Promise<void> {
    await this.templateSelect.click()
    await this.page.getByRole("option", { name }).click()
  }

  get modelSelect(): Locator {
    return this.page.getByLabel("Model", { exact: true })
  }

  get clientProfileSelect(): Locator {
    return this.page.getByLabel("Profil klienta (opcjonalnie)")
  }

  get marketProfileSelect(): Locator {
    return this.page.getByLabel("Profil rynku (opcjonalnie)")
  }

  get targetAudienceInput(): Locator {
    return this.page.getByLabel("Grupa docelowa")
  }

  get additionalInfoInput(): Locator {
    return this.page.getByLabel("Dodatkowe informacje")
  }

  get keywordPhraseInput(): Locator {
    return this.page.getByLabel("Fraza kluczowa SEO")
  }

  get generateKeywordButton(): Locator {
    return this.page.getByRole("button", { name: "Generuj frazę kluczową" })
  }

  /** `exact: true` jest OBOWIĄZKOWE tutaj — bez niego `getByLabel` (substring,
   *  case-insensitive domyślnie) dopasowuje TAKŻE przycisk
   *  aria-label="Generuj meta description" (zawiera "meta description" jako
   *  podłańcuch), strict-mode violation zweryfikowane na żywo. */
  get metaDescriptionInput(): Locator {
    return this.page.getByLabel("Meta description", { exact: true })
  }

  get generateMetaDescriptionButton(): Locator {
    return this.page.getByRole("button", { name: "Generuj meta description" })
  }

  get topicGeneratorButton(): Locator {
    return this.page.getByRole("button", { name: "Generator tematów" })
  }

  get generateButton(): Locator {
    return this.page.getByRole("button", { name: /^Generuj$|^Generowanie\.\.\.$|^Uruchamianie\.\.\.$/ })
  }

  // ---- tryb "Pojedyncza" ----

  get topicInput(): Locator {
    return this.page.getByLabel("Temat", { exact: true })
  }

  get emptyResultState(): Locator {
    return this.page.getByText("Brak wygenerowanej treści")
  }

  get resultContent(): Locator {
    return this.page.locator(".whitespace-pre-wrap").first()
  }

  get warningsBanner(): Locator {
    return this.page.getByText("Treść zawiera frazy z Twojej listy zakazanych fraz")
  }

  get savedToArchiveNote(): Locator {
    return this.page.getByText("Zapisano w archiwum Content Guru.")
  }

  markedPhrase(phrase: string): Locator {
    return this.page.locator("mark").filter({ hasText: phrase })
  }

  // ---- tryb "Kilka"/"Pakiet" — tabela tematów ----

  get addTopicRowButton(): Locator {
    return this.page.getByRole("button", { name: "Dodaj temat" })
  }

  /** `index` jest 1-based — dokładnie ten sam numer, który TopicTable renderuje
   *  jako placeholder wiersza (`Temat ${index + 1}` licząc od zera wewnątrz
   *  komponentu, ale placeholder widoczny userowi zaczyna się od "Temat 1"). */
  topicRowInput(index: number): Locator {
    return this.page.getByPlaceholder(`Temat ${index}`)
  }

  /** Wypełnia tabelę tematów DOKŁADNIE podaną listą — pierwszy element w już
   *  istniejący (jedyny startowy) wiersz, kolejne przez "Dodaj temat" + nowy
   *  wiersz, po kolei (żeby indeks placeholdera zawsze zgadzał się z liczbą
   *  wierszy dodanych DO TEJ PORY). */
  async fillTopics(topics: string[]): Promise<void> {
    for (let i = 0; i < topics.length; i++) {
      if (i > 0) await this.addTopicRowButton.click()
      await this.topicRowInput(i + 1).fill(topics[i]!)
    }
  }

  // ---- tryb "Pakiet" — multiselect szablonów ----

  packageTemplateCheckbox(label: string): Locator {
    return this.page.getByRole("checkbox", { name: label })
  }

  /** Licznik "N tematów × M szablonów = K treści" (design doc §4.1) —
   *  dopasowanie po "×" zamiast po treningowym sufiksie tekstu, bo ten sam
   *  akapit dostaje DODATKOWY tekst ostrzeżenia na końcu, gdy kombinacje
   *  przekraczają MAX_COMBINATIONS (regex zakotwiczony na końcu string'a nie
   *  złapałby tego wariantu). */
  get combinationsCount(): Locator {
    return this.page.locator("p").filter({ hasText: "×" })
  }

  // ---- karta joba (design doc D4) ----

  get jobEmptyState(): Locator {
    return this.page.getByText("Brak uruchomionego zadania")
  }

  /** Podsumowanie tekstowe joba ("Generowanie w toku — X/Y gotowych." /
   *  "Ukończono — .../ "Ukończono z błędami — ..."), wzorem `statusText()`
   *  w DocumentParserUploadPage — jeden fragment zamiast pełnego zdania,
   *  odporne na dokładną liczbę pozycji. */
  jobSummaryText(fragment: string): Locator {
    return this.page.getByText(fragment, { exact: false })
  }

  /** Wiersz trybu "Kilka" (płaska lista) — jeden `<button>` zawiera i temat,
   *  i badge statusu (generation-job-card.tsx), więc `hasText` na całym
   *  buttonie wystarcza. NIE działa dla trybu "Pakiet" (macierz) — tam temat
   *  i status żyją w osobnych komórkach, patrz `matrixColumnHeader`/
   *  `matrixRowHeader` niżej. */
  batchJobItem(topic: string): Locator {
    return this.page.getByRole("button").filter({ hasText: topic })
  }

  matrixColumnHeader(templateLabel: string): Locator {
    return this.page.getByRole("columnheader", { name: templateLabel })
  }

  matrixRowHeader(topic: string): Locator {
    return this.page.getByRole("cell", { name: topic, exact: true })
  }

  get jobItemDialog(): Locator {
    return this.page.getByRole("dialog")
  }

  async goto(): Promise<void> {
    await this.page.goto("/content-guru", { waitUntil: "domcontentloaded" })
  }
}
