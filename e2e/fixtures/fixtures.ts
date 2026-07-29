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
import { UsersPage } from "../poms/system-config/users-page"

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
})

export { expect } from "@playwright/test"
