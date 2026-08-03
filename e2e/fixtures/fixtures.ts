// Rozszerzenie `test` Playwrighta o: (1) `seed` — manipulację danymi demo
// przez Drizzle, (2) POM-y jako gotowe do wstrzyknięcia fixtures.
//
// UWAGA na nazwę pliku: CELOWO nie `test.ts` — domyślny testMatch Playwrighta
// (`**/*.test.ts`) złapałby ten plik jako spec bez testów. Import zawsze
// jako `import { test, expect } from "../fixtures/fixtures"`, nigdy
// bezpośrednio z "@playwright/test" w plikach, które potrzebują `seed`/POM.

import { test as base } from "@playwright/test"
import type { Page } from "@playwright/test"
import { closeDb, seedScenario, type ScenarioName, type ScenarioResult } from "./db-seed"
import { IlustromatGenerationPage } from "../poms/ilustromat/generation-page"
import { IlustromatTemplatesPage } from "../poms/ilustromat/templates-page"
import { TokenUsagePage } from "../poms/token-usage/token-usage-page"
import { ApplicationsPage } from "../poms/system-config/applications-page"
import { UsersPage } from "../poms/system-config/users-page"
import { DocumentParserUploadPage } from "../poms/document-parser/upload-page"
import { DocumentParserHistoryPage } from "../poms/document-parser/history-page"
import { DocumentParserJobDetailPage } from "../poms/document-parser/job-detail-page"
import { VisualGuruGeneratorPage } from "../poms/visual-guru/generator-page"
import { VisualGuruHistoryPage } from "../poms/visual-guru/history-page"
import { VisualGuruHistoryDetailPage } from "../poms/visual-guru/history-detail-page"
import { GeoScoreCalculatorPage } from "../poms/geo-score-calculator/calculator-page"
import { GeoScoreCalculatorHistoryPage } from "../poms/geo-score-calculator/history-page"
import { GeoScoreCalculatorHistoryDetailPage } from "../poms/geo-score-calculator/history-detail-page"
import { GeoScoreCalculatorSettingsPage } from "../poms/geo-score-calculator/settings-page"

/**
 * Ustawia `x-auth-request-email` na WSZYSTKICH kolejnych żądaniach tej strony
 * — imituje nagłówek wstrzykiwany przez oauth2-proxy na demo-dev/produkcji
 * (patrz @cortex/service/src/rbac.ts `getRequestEmail()`). Działa z każdym
 * API modułu opartym o `requireTileAccess()`, nie tylko system-config.
 * To NIE zastępuje `mockShellAccess()` (e2e/support/mocks/shell-access.ts)
 * — tamto przepuszcza przez AppGate (powłokę), to tutaj przez RBAC modułu.
 * Obu potrzeba naraz, patrz code-e2e/REFERENCE.md.
 */
export async function asUser(page: Page, email: string): Promise<void> {
  await page.context().setExtraHTTPHeaders({ "x-auth-request-email": email })
}

interface TestFixtures {
  seed: (scenario: ScenarioName) => Promise<ScenarioResult>
  usersPage: UsersPage
  applicationsPage: ApplicationsPage
  ilustromatGenerationPage: IlustromatGenerationPage
  ilustromatTemplatesPage: IlustromatTemplatesPage
  tokenUsagePage: TokenUsagePage
  documentParserUploadPage: DocumentParserUploadPage
  documentParserHistoryPage: DocumentParserHistoryPage
  documentParserJobDetailPage: DocumentParserJobDetailPage
  visualGuruGeneratorPage: VisualGuruGeneratorPage
  visualGuruHistoryPage: VisualGuruHistoryPage
  visualGuruHistoryDetailPage: VisualGuruHistoryDetailPage
  geoScoreCalculatorPage: GeoScoreCalculatorPage
  geoScoreCalculatorHistoryPage: GeoScoreCalculatorHistoryPage
  geoScoreCalculatorHistoryDetailPage: GeoScoreCalculatorHistoryDetailPage
  geoScoreCalculatorSettingsPage: GeoScoreCalculatorSettingsPage
}

interface WorkerFixtures {
  dbConnection: void
}

export const test = base.extend<TestFixtures, WorkerFixtures>({
  // Worker-scoped + auto: jedno połączenie Postgres na worker, zamykane po
  // ostatnim teście w tym workerze. Bez tego `postgres.js` trzyma otwarty
  // socket i proces `playwright test` czasem wisi po zielonym raporcie.
  dbConnection: [
    async ({}, use) => {
      await use()
      await closeDb()
    },
    { scope: "worker", auto: true },
  ],

  seed: async ({}, use) => {
    await use(seedScenario)
  },

  usersPage: async ({ page }, use) => {
    await use(new UsersPage(page))
  },

  applicationsPage: async ({ page }, use) => {
    await use(new ApplicationsPage(page))
  },

  ilustromatGenerationPage: async ({ page }, use) => {
    await use(new IlustromatGenerationPage(page))
  },

  ilustromatTemplatesPage: async ({ page }, use) => {
    await use(new IlustromatTemplatesPage(page))
  },

  tokenUsagePage: async ({ page }, use) => {
    await use(new TokenUsagePage(page))
  },

  documentParserUploadPage: async ({ page }, use) => {
    await use(new DocumentParserUploadPage(page))
  },

  documentParserHistoryPage: async ({ page }, use) => {
    await use(new DocumentParserHistoryPage(page))
  },

  documentParserJobDetailPage: async ({ page }, use) => {
    await use(new DocumentParserJobDetailPage(page))
  },

  visualGuruGeneratorPage: async ({ page }, use) => {
    await use(new VisualGuruGeneratorPage(page))
  },

  visualGuruHistoryPage: async ({ page }, use) => {
    await use(new VisualGuruHistoryPage(page))
  },

  visualGuruHistoryDetailPage: async ({ page }, use) => {
    await use(new VisualGuruHistoryDetailPage(page))
  },

  geoScoreCalculatorPage: async ({ page }, use) => {
    await use(new GeoScoreCalculatorPage(page))
  },

  geoScoreCalculatorHistoryPage: async ({ page }, use) => {
    await use(new GeoScoreCalculatorHistoryPage(page))
  },

  geoScoreCalculatorHistoryDetailPage: async ({ page }, use) => {
    await use(new GeoScoreCalculatorHistoryDetailPage(page))
  },

  geoScoreCalculatorSettingsPage: async ({ page }, use) => {
    await use(new GeoScoreCalculatorSettingsPage(page))
  },
})

export { expect } from "@playwright/test"
