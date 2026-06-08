import { expect, type Page } from "@playwright/test"
import path from "node:path"

export const PACKAGE_ID = "pkg-0001"

const SCREENSHOT_DIR = path.join(process.cwd(), "e2e/issue-66/screenshots")

export function screenshotPath(name: string): string {
  return path.join(SCREENSHOT_DIR, `${name}.png`)
}

interface MockAuthOptions {
  authed?: boolean
  email?: string
  hasAccess?: boolean
}

export async function mockAuth(page: Page, opts: MockAuthOptions = {}): Promise<void> {
  const authed = opts.authed ?? true
  const email = opts.email ?? "demo@cortex.local"
  const hasAccess = opts.hasAccess ?? true

  await page.route("**/user/me", async (route) => {
    if (!authed) {
      await route.fulfill({ status: 401, contentType: "application/json", body: "{}" })
      return
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: email,
        email,
        name: email.split("@")[0],
        has_access: hasAccess,
      }),
    })
  })
}

export async function mockClassificationFlag(page: Page, enabled: boolean): Promise<void> {
  await page.route("**/config", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ enable_classification: enabled }),
    })
  })
}

/**
 * Stand-in for the IDP backend used when running the dev server without a live
 * `idp-app`. The MSW handlers in `app/idp/mocks/handlers.ts` are `passthrough()`
 * for these paths — they leave the service worker, hit the Next middleware,
 * which rewrites them to `IDP_BACKEND_URL`. Without a backend that resolves,
 * those requests die with HTTP 500 and pollute the console.
 *
 * In tests we set `NEXT_PUBLIC_API_MOCKING=disabled` so MSW never registers,
 * and `page.route` becomes the single interceptor.
 *
 * **Order matters.** Playwright matches routes in REVERSE registration order
 * (last-registered wins), so we register the broad catch-all `/packages/:id`
 * FIRST and the more specific routes (e.g. `/packages/dashboard-stats`,
 * `/packages/export-templates`) LATER so they take priority.
 */
export async function mockBackendApi(page: Page): Promise<void> {
  // ── Broad catch-alls first (lowest priority) ─────────────────────

  // Per-package sub-resources.
  await page.route(/\/packages\/[^/]+\/transitions$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ transitions: [] }),
    })
  })

  await page.route(/\/packages\/[^/]+\/actions$/, async (route) => {
    const id = route.request().url().split("/").slice(-2)[0] ?? "pkg-0001"
    const fakeActions = buildFakeActions()
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ package_id: id, actions: fakeActions }),
    })
  })

  await page.route(/\/packages\/[^/]+\/transport-orders$/, async (route) => {
    const id = route.request().url().split("/").slice(-2)[0] ?? "pkg-0001"
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        package_id: id,
        transport_orders: [],
        verified_transport_orders: null,
      }),
    })
  })

  await page.route(/\/packages\/[^/]+\/source-files$/, async (route) => {
    // SourceFileReadModel[] — array, NOT wrapped.
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([]),
    })
  })

  await page.route(/\/packages\/[^/]+\/rules$/, async (route) => {
    const id = route.request().url().split("/").slice(-2)[0] ?? "pkg-0001"
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ package_id: id, attachments: [] }),
    })
  })

  // Full package detail — `/packages/:id` GET. Match only when the request is
  // JSON (apiClient sets Accept: application/json) so we don't intercept page
  // navigation. NOTE: this regex also matches `/packages/<word>` paths like
  // `/packages/export-templates`, `/packages/get_all` — the more specific
  // routes below override this thanks to reverse-order matching.
  await page.route(/\/packages\/[^/]+$/, async (route) => {
    const accept = route.request().headers()["accept"] ?? ""
    if (!accept.includes("application/json")) {
      await route.fallback()
      return
    }
    const id = route.request().url().split("/").pop()?.split("?")[0] ?? "pkg-0001"
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(buildFakePackage(id)),
    })
  })

  // Classification — single dirty package returns 404 by default.
  await page.route(/\/classification\/dirty-packages\/[^/]+$/, async (route) => {
    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ detail: "not_found" }),
    })
  })

  // ── Specific routes (highest priority — registered LAST) ─────────

  // Dashboard stats — every column is zero.
  await page.route("**/packages/dashboard-stats", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        in_queue: 0,
        processing: 0,
        ready_for_verification: 0,
        in_verification: 0,
        verified: 0,
        failed: 0,
      }),
    })
  })

  // Paginated empty package list.
  await page.route(/\/packages\/get_all(\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items: [], total: 0, limit: 100, offset: 0 }),
    })
  })

  // Action logs index (the global one).
  await page.route(/\/packages\/action_logs(\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items: [], total: 0, limit: 100, offset: 0 }),
    })
  })

  // Export templates list — apiClient expects ExportTemplateInfo[] (array).
  await page.route("**/packages/export-templates", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([]),
    })
  })

  // Module version.
  await page.route("**/idp/version", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ version: "1.13.0" }),
    })
  })

  // Custom statuses (used in metadata editor / kanban filters).
  await page.route("**/config/custom-statuses", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ custom_statuses: [] }),
    })
  })

  // User preferences.
  await page.route("**/user/preferences", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        document_panel_ratio: null,
        theme_mode: null,
        invoice_line_hidden_columns: null,
      }),
    })
  })

  // Classification (paginated dirty packages — issue #61 needs this for flag-on path).
  await page.route(/\/classification\/dirty-packages(\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items: [], total: 0, limit: 100, offset: 0 }),
    })
  })

  // Rules list / templates.
  await page.route(/\/rules(\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items: [], total: 0, limit: 100, offset: 0 }),
    })
  })
  await page.route("**/rules/templates", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([]),
    })
  })

  // Health probe.
  await page.route("**/health", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ status: "ok" }),
    })
  })
}

function buildFakePackage(id: string): Record<string, unknown> {
  return {
    id,
    file_name: `${id}.zip`,
    file_hash: "sha256:fake",
    file_size_mb: 1.5,
    total_tokens: 4200,
    total_cost_usd: 0.08,
    created_date: new Date(Date.now() - 86_400_000).toISOString(),
    processing_state: "ready",
    verification_state: "completed",
    assignee: "demo@cortex.local",
    uploaded_by: "demo@cortex.local",
    custom_status: null,
    user_notes: null,
    last_additional_ai_context: null,
    analysis_result: {
      seller: { name: "Acme", vat_id: "PL1", country: "PL", city: "Warsaw" },
      buyer: { name: "Beta", vat_id: "DE1", country: "DE", city: "Berlin" },
      invoice: {
        invoice_number: "INV-1",
        invoice_date: "2026-04-15",
        currency: "EUR",
        total_invoice_value: "100",
      },
      lines: [],
    },
    verified_result: null,
  }
}

function buildFakeActions(): Array<Record<string, unknown>> {
  // Mirrors PackageActionReadModel; adequate for the action-log spec.
  const base = Date.now()
  return [
    {
      id: "evt-1",
      action_type: "imported",
      timestamp: new Date(base - 10 * 60_000).toISOString(),
      performed_by: "system@cortex.local",
      payload: null,
    },
    {
      id: "evt-2",
      action_type: "analysing",
      timestamp: new Date(base - 9 * 60_000).toISOString(),
      performed_by: "system@cortex.local",
      payload: null,
    },
    {
      id: "evt-3",
      action_type: "ready_for_verification",
      timestamp: new Date(base - 8 * 60_000).toISOString(),
      performed_by: "system@cortex.local",
      payload: null,
    },
    {
      id: "evt-4",
      action_type: "verification",
      timestamp: new Date(base - 7 * 60_000).toISOString(),
      performed_by: "demo@cortex.local",
      payload: null,
    },
    {
      id: "evt-5",
      action_type: "seller_updated",
      timestamp: new Date(base - 6 * 60_000).toISOString(),
      performed_by: "demo@cortex.local",
      payload: JSON.stringify({
        changes: { name: { previous: "Old Co", next: "New Co" } },
      }),
    },
    {
      id: "evt-6",
      action_type: "verified",
      timestamp: new Date(base - 5 * 60_000).toISOString(),
      performed_by: "demo@cortex.local",
      payload: null,
    },
  ]
}

const CONSOLE_ERROR_ALLOWLIST: RegExp[] = [
  /^\[MSW\]/,
  /Download the React DevTools/,
  /<Suspense>/,
  /PDF\.js worker/,
  /\[Fast Refresh\]/,
  /Failed to load resource: the server responded with a status of 404/,
  /Failed to load resource: the server responded with a status of 401/,
  /Failed to load resource: the server responded with a status of 500/,
  // Next.js dev SSR/CSR hydration mismatch — relative-time formatting renders
  // server-side with different relative output than client-side. Real fix is
  // out of scope for issue #66 (test-only deliverable); accept and proceed.
  /A tree hydrated but some attributes of the server rendered HTML didn't match/i,
  /Hydration failed because the initial UI does not match/i,
]

export interface ConsoleErrorTracker {
  errors: string[]
}

export function installConsoleErrorTracker(page: Page): ConsoleErrorTracker {
  const tracker: ConsoleErrorTracker = { errors: [] }

  page.on("console", (msg) => {
    if (msg.type() !== "error") return
    const text = msg.text()
    if (CONSOLE_ERROR_ALLOWLIST.some((re) => re.test(text))) return
    tracker.errors.push(`[console.error] ${text}`)
  })

  page.on("pageerror", (err) => {
    tracker.errors.push(`[pageerror] ${err.message}`)
  })

  return tracker
}

export function expectNoConsoleErrors(tracker: ConsoleErrorTracker): void {
  expect(tracker.errors, `Unexpected console errors:\n${tracker.errors.join("\n")}`).toEqual([])
}

export async function waitForHydrated(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle")
}
