// Mockuje DWA sygnały, których AppGate używa, zanim strona kafelka w ogóle
// się wyrenderuje:
//   1. GET /user/me            → useMe()             → { has_access }
//   2. GET /api/me/access      → useAuthorizedApps() → { allowed, apps }
//
// STAN PO UNIFIKACJI BRAMEK (30.07.2026):
//   (1) to nadal ZEWNĘTRZNY backend IDP (osobne repo), lokalnie nieobecny —
//       middleware przepisuje tę ścieżkę na IDP_BACKEND_URL, którego w testach
//       nie ma. Mockowanie go pozostaje potrzebne, ale po zwężeniu
//       `hasAccessIsRelevant` sygnał ten bramkuje WYŁĄCZNIE kafelek `idp`.
//   (2) to już WŁASNY endpoint czytający własnego Postgresa. Jego mockowanie
//       stało się OPCJONALNE: wystarczy zseedować granty w bazie i wysłać
//       nagłówek tożsamości (asUser()).
//
// > UWAGA DLA PISZĄCYCH NOWE TESTY BRAMKI
// > mockShellAccess() zaślepia dokładnie ten endpoint, którego poprawność
// > testujesz. Suita pozostanie ZIELONA nawet przy kompletnie zepsutym
// > /api/me/access. Test regresji samej bramki MUSI iść realną ścieżką
// > (seed → prawdziwy route → AppGate) — patrz e2e/shell/access-gate.spec.ts,
// > który celowo NIE woła tej funkcji.
//
// To NIE zastępuje seeda w bazie (db-seed.ts) — dane modułu nadal idą przez
// prawdziwe API modułu + prawdziwy Postgres, patrz fixtures.ts.

import type { AuthorizedAppsResponse } from "@cortex/api"
import type { UserInfoResponse } from "@cortex/types"
import type { Page } from "@playwright/test"

export interface MockShellAccessOptions {
  email: string
  /** Kody kafelków (application.code) widoczne w powłoce dla tego usera. */
  apps: string[]
  hasAccess?: boolean
}

/**
 * Zaślepia WYŁĄCZNIE zewnętrzny sygnał `/user/me`. Do testów, które chcą
 * sprawdzić prawdziwy `/api/me/access`, ale nie mają stojącego backendu IDP.
 */
export async function mockIdpIdentity(
  page: Page,
  opts: { email: string; hasAccess?: boolean },
): Promise<void> {
  await page.route("**/user/me", async (route) => {
    const body: UserInfoResponse = { email: opts.email, has_access: opts.hasAccess ?? true }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) })
  })
}

export async function mockShellAccess(page: Page, opts: MockShellAccessOptions): Promise<void> {
  await mockIdpIdentity(page, { email: opts.email, hasAccess: opts.hasAccess ?? true })

  await page.route("**/api/me/access", async (route) => {
    const body: AuthorizedAppsResponse = {
      allowed: opts.apps.length > 0,
      apps: opts.apps,
      email: opts.email,
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) })
  })
}
