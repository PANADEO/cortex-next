// Przykład ILUSTRACYJNY konwencji z .claude/skills/code-e2e/SKILL.md — nie
// pełne pokrycie modułu Konfiguracja Systemu. Wzorzec do skopiowania przy
// pisaniu kolejnych testów (RolesPage, TilesRegistryPage, kafelki inne niż
// system-config).
//
// Wymaga: DATABASE_URL wskazujący na lokalny Postgres z wgraną migracją
// system_config (patrz packages/@cortex/db `db:migrate`). Testy same
// resetują i seedują dane (seedScenario) — nie zależą od stanu zostawionego
// przez seed-system-config.mjs ani przez innych testów.

import { asUser, expect, test } from "../fixtures/fixtures"
import { mockShellAccess } from "../support/mocks/shell-access"

test.describe("system-config: Użytkownicy", () => {
  test("admin-with-one-tile: administrator widzi siebie z rolą Administrator", async ({
    page,
    seed,
    usersPage,
  }) => {
    const { email } = await seed("admin-with-one-tile")
    await asUser(page, email)
    await mockShellAccess(page, { email, apps: ["system-config"] })

    await usersPage.goto()

    await expect(usersPage.heading).toBeVisible()
    await expect(usersPage.row(email)).toContainText("Administrator")
  })

  test("user-no-roles: użytkownik bez roli dostaje odmowę wewnątrz modułu", async ({
    page,
    seed,
    usersPage,
  }) => {
    const { email } = await seed("user-no-roles")
    await asUser(page, email)
    // Powłoka (AppGate) i tak wpuszcza — "widoczność kafelka" i "uprawnienia
    // w środku" to dwie różne bramki, patrz code-e2e/REFERENCE.md.
    await mockShellAccess(page, { email, apps: ["system-config"] })

    await usersPage.goto()

    // requireTileAccess() (DB-backed) odmawia — realne 403 z prawdziwego
    // Postgresa, nie mock. Asercja auto-retry, bo query ma `retry: 1`.
    await expect(usersPage.accessErrorLocator).toBeVisible()
  })
})
