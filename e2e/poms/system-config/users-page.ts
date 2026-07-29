// POM dla /system-config/uzytkownicy
// (app/idp/app/(main)/system-config/uzytkownicy/page.tsx).
//
// Przykład wzorcowy dla code-e2e/SKILL.md — kolejne POM-y modułu
// (RolesPage → /system-config/role, TilesRegistryPage → /system-config/kafelki)
// piszemy analogicznie: jeden plik per strona, dziedziczy BasePage, lokatory
// jako properties/gettery, akcje jako async metody.

import type { Locator, Page } from "@playwright/test"
import { BasePage } from "../shared/base-page"

export class UsersPage extends BasePage {
  readonly heading: Locator

  constructor(page: Page) {
    super(page)
    this.heading = page.getByRole("heading", { name: "Użytkownicy" })
  }

  async goto(): Promise<void> {
    await this.page.goto("/system-config/uzytkownicy")
  }

  /** Wiersz tabeli po e-mailu — accessible name wiersza to konkatenacja
   *  tekstu jego komórek, więc dopasowanie częściowe (RegExp) wystarcza. */
  row(email: string): Locator {
    return this.page.getByRole("row", { name: new RegExp(email) })
  }

  async openRoleDialog(email: string): Promise<void> {
    await this.row(email).getByRole("button", { name: "Zmień role" }).click()
  }

  roleCheckbox(roleName: string): Locator {
    return this.page.getByRole("dialog").getByLabel(roleName)
  }

  async saveRoleDialog(): Promise<void> {
    await this.page.getByRole("dialog").getByRole("button", { name: "Zapisz" }).click()
  }

  /** EmptyState "Brak użytkowników" — baza pusta, ale request się powiódł. */
  get emptyStateLocator(): Locator {
    return this.page.getByText("Brak użytkowników")
  }

  /** EmptyState "Nie udało się wczytać..." — request zwrócił błąd (typowo
   *  403 z requireTileAccess(), gdy seedScenario("user-no-roles")). Query ma
   *  `retry: 1` (patrz @cortex/api/src/provider.tsx) — użyj asercji
   *  auto-retry (`expect(...).toBeVisible()`), nie `waitForTimeout`. */
  get accessErrorLocator(): Locator {
    return this.page.getByText("Nie udało się wczytać użytkowników")
  }
}
