// Mock danych "spisu treści" ekranu /content-guru (config modeli + szablony
// + profile klienta/rynku) — WSZYSTKIE cztery ładują się na starcie strony
// niezależnie od aktywnego trybu (page.tsx: useContentGuruConfig/useTemplates/
// useMyClientProfiles/useMyMarketProfiles). Testy Toru B (e2e/content-guru/
// generate-flow.spec.ts, batch-package-flow.spec.ts, mini-generators.spec.ts)
// muszą je zamockować, żeby strona w ogóle się wyrenderowała bez prawdziwego
// Postgresa — wzorem e2e/support/mocks/token-usage.ts: mock WŁASNEGO endpointu
// modułu, nie cortex-proxy (tamten jest wołany server-side, page.route go nie
// dosięgnie, patrz komentarz nagłówkowy tamtego pliku).
//
// Akcja generowania (/generate, /jobs, /mini-generators/*, /templates/
// test-generation) jest mockowana OSOBNO, per test — ten plik odpowiada
// wyłącznie za dane, które muszą istnieć ZANIM formularz stanie się w ogóle
// używalny.

import type { Page } from "@playwright/test"

export interface ContentGuruScreenTemplate {
  id: string
  name: string
  category: string
}

/** Domyślnie jeden szablon w jednej kategorii — wystarcza, żeby oba Select-e
 *  (kategoria/szablon) na ekranie generowania miały dokładnie jedną,
 *  deterministyczną opcję domyślnie zaznaczoną. */
export const DEFAULT_SCREEN_TEMPLATES: ContentGuruScreenTemplate[] = [
  { id: "11111111-0000-0000-0000-000000000001", name: "Post na LinkedIn", category: "Rekrutacja" },
]

export const DEFAULT_SCREEN_MODELS = ["anthropic/claude-sonnet-4.6", "openai/gpt-4o-mini"]

function templateFixture(template: ContentGuruScreenTemplate) {
  const now = new Date().toISOString()
  return {
    id: template.id,
    name: template.name,
    category: template.category,
    content: "Treść promptu szablonu testowego.",
    createdBy: "e2e-mock@cortex.local",
    createdAt: now,
    updatedAt: now,
  }
}

export interface MockContentGuruScreenOptions {
  models?: string[]
  templates?: ContentGuruScreenTemplate[]
}

/** Rejestruje mocki GET /config, /templates, /client-profiles, /market-profiles
 *  — client/market profiles zawsze puste (żaden test Toru B tego modułu nie
 *  testuje wyboru profilu, to pokrycie Toru A, profiles-scenario.spec.ts). */
export async function mockContentGuruScreenData(
  page: Page,
  options: MockContentGuruScreenOptions = {},
): Promise<void> {
  const models = options.models ?? DEFAULT_SCREEN_MODELS
  const templates = (options.templates ?? DEFAULT_SCREEN_TEMPLATES).map(templateFixture)

  await page.route("**/api/content-guru/config", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ models }) })
  })
  await page.route("**/api/content-guru/templates", async (route) => {
    if (route.request().method() !== "GET") return route.fallback()
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(templates) })
  })
  await page.route("**/api/content-guru/client-profiles", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) })
  })
  await page.route("**/api/content-guru/market-profiles", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) })
  })
}
