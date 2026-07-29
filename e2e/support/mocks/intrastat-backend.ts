// Granica "poza modułem" dla Intrastatu.
//
// Intrastat jako JEDYNY z trzech modułów objętych tymi testami nie ma w tym
// repo ANI JEDNEGO route'a — `app/idp/app/api/` nie zawiera katalogu
// `intrastat`. Cały backend to osobna aplikacja FastAPI pod
// INTRASTAT_BACKEND_URL, do której `app/idp/middleware.ts`
// (`tryIntrastatRewrite`) przepisuje ścieżki `/intrastat/api/**`. Lokalnie ta
// aplikacja nie działa, a middleware i tak nie robi po drodze żadnej
// autoryzacji — przepisuje 1:1.
//
// Konsekwencja dla zakresu testów: RBAC Intrastatu, którego można dowieść z
// TEGO repo, to bramka powłoki (AppGate + `apps` z /api/me/access) i granularne
// bramki widoczności w UI (`intrastat-cn-editor`, `intrastat-config-editor`).
// Bramka na ścieżce żądania żyje w cudzym repo — dlatego dla Intrastatu nie ma
// odpowiednika `guard-coverage.test.ts` i nie da się go tu napisać uczciwie.
//
// Mock zbiera żądania, żeby test mógł dowieść nie tylko "przycisk się kliknął",
// ale i "poleciało dokładnie to żądanie, z dokładnie tym ciałem".

import type { Page, Route } from "@playwright/test"
import type {
  IntrastatBatchSummary,
  IntrastatResourceInfo,
  IntrastatSettings,
  IntrastatStats,
} from "../../../app/idp/lib/intrastat/types"

export const INTRASTAT_BATCH_NAME = "WNT-2026-07-paczka"

export interface CapturedExport {
  url: string
  body: { batch_ids?: string[] }
}

export interface IntrastatBackendMock {
  /** Eksporty, które faktycznie wyszły z przeglądarki, w kolejności wysyłki. */
  readonly exports: CapturedExport[]
  readonly batch: IntrastatBatchSummary
}

const STATS: IntrastatStats = {
  batches_total: 3,
  queued: 0,
  processing: 1,
  ready: 2,
  needs_review: 1,
  failed: 0,
  invoices_total: 12,
  lines_total: 47,
  current_resource_rows: 900,
}

const SETTINGS: IntrastatSettings = {
  filesystem_configured: true,
  filesystem_enabled: true,
  intrastat_watch_dir: "/data/intrastat",
  filesystem_poll_interval_seconds: 60,
  worker_enabled: true,
  gemini_configured: true,
  gemini_model: "gemini-2.5-pro",
  gemini_embedding_model: "text-embedding-004",
  cn_embedding_enabled: true,
}

const CN_RESOURCE: IntrastatResourceInfo = {
  id: "res-1",
  file_name: "cn-2026.xlsx",
  row_count: 900,
  embedding_count: 900,
  embedding_model: "text-embedding-004",
  created_at: "2026-07-01T10:00:00Z",
}

const BATCH: IntrastatBatchSummary = {
  id: "batch-1",
  transaction_kind: "WNT",
  source_type: "manual_zip",
  name: INTRASTAT_BATCH_NAME,
  client_name: "Klient Testowy",
  period_month: "2026-07",
  status: "ready",
  invoice_count: 4,
  line_count: 17,
  alert_count: 0,
  error_message: null,
  created_at: "2026-07-10T08:00:00Z",
  updated_at: "2026-07-10T09:00:00Z",
}

async function json(route: Route, body: unknown): Promise<void> {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body),
  })
}

export async function mockIntrastatBackend(page: Page): Promise<IntrastatBackendMock> {
  const exports: CapturedExport[] = []

  // VersionLabel w stopce sidebara woła `versionEndpoint` kafelka
  // (lib/tiles.ts: "/intrastat/version"). Middleware przepisuje to na
  // INTRASTAT_BACKEND_URL, którego lokalnie nie ma — bez tego mocka dev server
  // zasypuje log komunikatami "Failed to proxy http://localhost:8020/version
  // ECONNREFUSED". To czysty szum powłoki, nic tu nie jest przedmiotem asercji
  // (ta sama rola, co e2e/support/mocks/idp-config.ts).
  await page.route("**/intrastat/version", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ version: "e2e" }),
    })
  })

  // KOLEJNOŚĆ REJESTRACJI JEST ISTOTNA. Playwright dopasowuje handlery
  // `page.route` w kolejności ODWROTNEJ do rejestracji — wygrywa zarejestrowany
  // NAJPÓŹNIEJ. Oba wzorce niżej pasują do ścieżek eksportu, więc catch-all
  // musi iść PIERWSZY, a wyspecjalizowany eksport DRUGI.
  // Zweryfikowane na żywo: przy odwrotnej kolejności catch-all przechwytywał
  // POST /export/*, odpowiadał pustym `{}` ze statusem 200 (czyli klient nie
  // widział błędu), a `exports` zostawało puste — test padał na "0 zamiast 1",
  // choć przycisk działał poprawnie.
  await page.route("**/intrastat/api/**", async (route: Route) => {
    const path = new URL(route.request().url()).pathname

    if (path.endsWith("/stats")) return json(route, STATS)
    if (path.endsWith("/settings")) return json(route, SETTINGS)
    if (path.endsWith("/resources/cn/current")) return json(route, CN_RESOURCE)
    if (path.endsWith("/batches/filter-options")) {
      return json(route, { clients: ["Klient Testowy"], months: ["2026-07"] })
    }
    if (path.endsWith("/batches")) {
      return json(route, { items: [BATCH], total: 1, limit: 8, offset: 0 })
    }

    return json(route, {})
  })

  await page.route("**/intrastat/api/export/*", async (route: Route) => {
    exports.push({
      url: route.request().url(),
      body: route.request().postDataJSON() as { batch_ids?: string[] },
    })
    await route.fulfill({
      status: 200,
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      headers: { "Content-Disposition": 'attachment; filename="intrastat.xlsx"' },
      body: "PK",
    })
  })

  return { exports, batch: BATCH }
}
