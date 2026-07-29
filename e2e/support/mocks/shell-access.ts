// Mockuje DWIE bramki powłoki (AppGate, @/components/shell/app-gate.tsx),
// które muszą przepuścić ZANIM strona danego kafelka w ogóle się wyrenderuje:
//   1. GET /user/me            → useMe()            → { has_access }
//   2. GET /api/me/access      → useAuthorizedApps() → { allowed, apps }
//
// (2) w tym repo dziś idzie do zewnętrznego cortex-admin
// (CORTEX_ADMIN_API_BASE_URL/API_KEY) — patrz code-service/SKILL.md "Ścieżka
// E". Bez tej konfiguracji endpoint fail-closed'uje (`allowed:false`), więc
// KAŻDY test kafelka pod `(main)` musi jawnie mockować (2), inaczej AppGate
// pokaże AccessDeniedScreen niezależnie od tego, co zwraca własne API modułu.
// Zweryfikowane na żywo 29.07.2026 — patrz code-e2e/REFERENCE.md "AppGate a
// requireTileAccess — dwie różne bramki".
//
// To NIE zastępuje seeda w bazie (db-seed.ts) — to tylko przepuszcza przez
// POWŁOKĘ. Właściwe dane modułu (np. system-config: users/roles) nadal idą
// przez prawdziwe API modułu + prawdziwy Postgres, patrz fixtures.ts.

import type { AuthorizedAppsResponse } from "@cortex/api"
import type { UserInfoResponse } from "@cortex/types"
import type { Page } from "@playwright/test"

export interface MockShellAccessOptions {
  email: string
  /** Kody kafelków (application.code) widoczne w powłoce dla tego usera. */
  apps: string[]
  hasAccess?: boolean
}

export async function mockShellAccess(page: Page, opts: MockShellAccessOptions): Promise<void> {
  const hasAccess = opts.hasAccess ?? true

  await page.route("**/user/me", async (route) => {
    const body: UserInfoResponse = { email: opts.email, has_access: hasAccess }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) })
  })

  await page.route("**/api/me/access", async (route) => {
    const body: AuthorizedAppsResponse = {
      allowed: opts.apps.length > 0,
      apps: opts.apps,
      email: opts.email,
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) })
  })
}
