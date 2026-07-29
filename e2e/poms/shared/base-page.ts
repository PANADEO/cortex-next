// Wspólny shell (main) — sidebar TileMenu + topbar (@cortex/ui AppShell) —
// używany przez WSZYSTKIE kafelki pod `app/idp/app/(main)/**`. POM-y kafelków
// dziedziczą z tej klasy zamiast duplikować nawigację sidebara w każdym
// POM-ie z osobna. Patrz .claude/skills/code-e2e/SKILL.md "Struktura POM".

import type { Locator, Page } from "@playwright/test"

export class BasePage {
  constructor(protected readonly page: Page) {}

  protected get sidebar(): Locator {
    return this.page.getByRole("navigation")
  }

  /** Klika link w sidebarze po WIDOCZNEJ etykiecie (TileMenuItem.label z
   *  app/idp/lib/nav.ts) — role-based, nie data-testid. Działa identycznie
   *  dla każdego kafelka, bo TileMenu (@cortex/ui) renderuje linki tak samo. */
  async gotoSidebarLink(label: string): Promise<void> {
    await this.sidebar.getByRole("link", { name: label, exact: true }).click()
  }
}
