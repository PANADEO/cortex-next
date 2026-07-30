// POM dla huba Cortex360 — strona `/` (app/idp/app/(shell)/page.tsx -> TileGrid).
//
// Nie dziedziczy z BasePage: hub żyje w grupie `(shell)`, bez AppShell/TileMenu,
// więc jedyna rzecz, którą BasePage daje (nawigacja sidebara), tu nie istnieje.
//
// Hub to jedyne miejsce, gdzie widać RAZEM oba źródła kafelków:
//   - kafelki code-backed z lib/tiles.ts, filtrowane przez `apps` z /api/me/access,
//   - kafelki task-chat (Cortex Cowork), które przychodzą z
//     GET /api/cortex-cowork/projects, przefiltrowane per rola PO STRONIE SERWERA.
// Dlatego asercje o widoczności projektów agentowych robimy właśnie tutaj.

import type { Locator, Page } from "@playwright/test"
import { waitForHydrated } from "../../support/console"

export class HubPage {
  readonly accessDenied: Locator

  constructor(private readonly page: Page) {
    this.accessDenied = page.getByRole("heading", { level: 1, name: "Brak dostępu", exact: true })
  }

  // Patrz komentarz w poms/cortex-config/governance-page.ts — AppGate renderuje
  // `null` do czasu rozstrzygnięcia zapytań powłoki, więc bez tego pierwsza
  // asercja trafia w pustą stronę na świeżo kompilowanym dev buildzie.
  async goto(): Promise<void> {
    await this.page.goto("/")
    await waitForHydrated(this.page)
  }

  /** Kafelek renderuje się jako <a> (TileCard), którego nazwa dostępna zawiera
   *  etykietę kafelka — role-based, bez data-testid. */
  tile(label: string): Locator {
    return this.page.getByRole("link", { name: label })
  }
}
