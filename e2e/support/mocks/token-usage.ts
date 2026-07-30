// Mock WŁASNEGO endpointu modułu (/api/token-usage), nie cortex-proxy.
//
// DLACZEGO NIE `page.route("**/usage")`: cortex-proxy jest wołany SERVER-SIDE,
// z route handlera Next.js. `page.route` przechwytuje wyłącznie ruch
// PRZEGLĄDARKI, więc do tamtego żądania nigdy nie dosięgnie — dokładnie ta sama
// pułapka jest opisana w e2e/ilustromat/ilustromat-scenario.spec.ts. Mockowanie
// cortex-proxy wymagałoby CORTEX_PROXY_URL wskazującego atrapę w env webServera.
//
// Podział ról w tej suicie, świadomy:
//  - RENDEROWANIE (ten mock)  — dane -> UI, zakładki, eksporty, stany brzegowe.
//  - GRANICA UPRAWNIEŃ        — `page.request` na PRAWDZIWY route, z prawdziwym
//                               Postgresem i prawdziwym requireTileAccess().
//    Tego drugiego mock nie dotyka i nie ma prawa dotknąć.
//
// Ciało odpowiedzi budujemy PRAWDZIWĄ funkcją agregującą modułu, a nie ręcznie
// wpisanym JSON-em: dzięki temu mock nie może rozjechać się z kontraktem, który
// serwer faktycznie produkuje.

import { buildUsageReport, type ProxyUsageRow } from "@/lib/token-usage/aggregate"
import type { Page } from "@playwright/test"

/** Kształt 1:1 z odpowiedzią GET /usage — w tym oba warianty pustych wymiarów
 *  ("" w starych wierszach, "unknown"/"default" w dzisiejszych). */
export const SAMPLE_PROXY_ROWS: ProxyUsageRow[] = [
  {
    user_id: "jan.kowalski@firma.pl",
    source_app: "Cortex360 AI Tools",
    scope: "summarizer",
    model: "anthropic/claude-sonnet-4.6",
    request_tokens: 1200,
    response_tokens: 3400,
    reasoning_tokens: 800,
    cached_tokens: 100,
    total_tokens: 4600,
    request_count: 12,
  },
  {
    user_id: "anna.nowak@firma.pl",
    source_app: "Cortex360 AI Tools",
    scope: "linkedin-generator",
    model: "openai/gpt-4o-mini",
    request_tokens: 300,
    response_tokens: 700,
    reasoning_tokens: 0,
    cached_tokens: 0,
    total_tokens: 1000,
    request_count: 5,
  },
  {
    user_id: "anna.nowak@firma.pl",
    source_app: "unknown",
    scope: "default",
    model: "openai/gpt-4o-mini",
    request_tokens: 100,
    response_tokens: 150,
    reasoning_tokens: 0,
    cached_tokens: 0,
    total_tokens: 250,
    request_count: 2,
  },
  {
    user_id: "serwis-techniczny",
    source_app: "",
    scope: "",
    model: "google/gemini-3.1-flash-lite-image",
    request_tokens: 50,
    response_tokens: 100,
    reasoning_tokens: 0,
    cached_tokens: 0,
    total_tokens: 150,
    request_count: 1,
  },
]

export interface MockTokenUsageOptions {
  /** Puste dane = ekran "brak danych w tym okresie". */
  rows?: ProxyUsageRow[]
  /** Zamiast raportu zwróć błąd o tym kodzie (np. cortex-proxy-not-configured). */
  errorCode?: string
  status?: number
}

export async function mockTokenUsage(
  page: Page,
  options: MockTokenUsageOptions = {},
): Promise<void> {
  await page.route("**/api/token-usage?**", async (route) => {
    if (options.errorCode) {
      await route.fulfill({
        status: options.status ?? 503,
        contentType: "application/json",
        body: JSON.stringify({ error: options.errorCode, message: "Mock błędu" }),
      })
      return
    }

    const url = new URL(route.request().url())
    const body = {
      range: {
        start: url.searchParams.get("start") ?? "",
        end: url.searchParams.get("end") ?? "",
      },
      ...buildUsageReport(options.rows ?? SAMPLE_PROXY_ROWS),
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    })
  })
}
