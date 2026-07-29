// Endpointy backendu IDP, które powłoka `(main)` pobiera na KAŻDEJ stronie,
// także na kafelkach, które ich nie używają — AI Tools do nich należy.
// Lokalnie te ścieżki są przez middleware przepisywane na IDP_BACKEND_URL,
// który w testach nie istnieje: dev server loguje ECONNREFUSED/ENOTFOUND,
// a przeglądarka dostaje 500 i wypisuje błąd do konsoli. Bez tych mocków
// `expectNoConsoleErrors()` bywa czerwone losowo — w zależności od tego, czy
// żądanie zdążyło się rozstrzygnąć przed asercją, i od tego, które dokładnie
// endpointy powłoka akurat woła (`/config`, `/user/preferences`,
// `/config/feature-flags` — potwierdzone na żywo, że wszystkie trzy potrafią
// wystrzelić na stronach AI Tools).
//
// Mockujemy tu WYŁĄCZNIE szum powłoki. Nic, co ten plik zwraca, nie jest
// przedmiotem asercji w testach AI Tools.

import type { Page, Route } from "@playwright/test"

const SILENT_OK = async (route: Route) =>
  route.fulfill({ status: 200, contentType: "application/json", body: "{}" })

export async function mockIdpConfig(page: Page): Promise<void> {
  await page.route("**/config", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ enable_classification: false }),
    })
  })
  await page.route("**/user/preferences", SILENT_OK)
  await page.route("**/config/feature-flags", SILENT_OK)
}
