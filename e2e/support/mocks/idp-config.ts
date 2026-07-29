// Feature flags backendu IDP (`GET /config`, `@cortex/api` endpoints.featureFlags).
//
// Powłoka `(main)` pobiera je na KAŻDEJ stronie, także na kafelkach, które ich
// nie używają — AI Tools do nich należy. Lokalnie `/config` jest przez
// middleware przepisywane na IDP_BACKEND_URL (domyślnie http://idp-app), który
// w testach nie istnieje: dev server loguje `ENOTFOUND idp-app`, a przeglądarka
// dostaje 500 i wypisuje błąd do konsoli. Bez tego mocka
// `expectNoConsoleErrors()` bywa czerwone losowo — w zależności od tego, czy
// żądanie zdążyło się rozstrzygnąć przed asercją. Zweryfikowane na żywo.
//
// Mockujemy tu WYŁĄCZNIE szum powłoki. Nic, co ten plik zwraca, nie jest
// przedmiotem asercji w testach AI Tools.

import type { Page, Route } from "@playwright/test"

export async function mockIdpConfig(page: Page): Promise<void> {
  await page.route("**/config", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ enable_classification: false }),
    })
  })
}
