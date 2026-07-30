// Intrastat — dashboard renderuje dane z backendu, a eksport uderza we właściwy
// endpoint.
//
// Świadomie NIE sprawdzamy zawartości wygenerowanego XLSX-a: plik powstaje w
// zewnętrznej aplikacji FastAPI, poza tym repo. Z przeglądarki da się uczciwie
// dowieść dwóch rzeczy i tyle jest tu asertowane: (1) dane z backendu docierają
// do widoku, (2) przycisk eksportu wysyła DOKŁADNIE to żądanie, którego
// oczekuje backend — właściwą ścieżkę, metodę i listę id paczek.

import { expect, test } from "@playwright/test"
import { IntrastatBatchesPage } from "../poms/intrastat/batches-page"
import { IntrastatDashboardPage } from "../poms/intrastat/dashboard-page"
import { mockIdpConfig } from "../support/mocks/idp-config"
import { INTRASTAT_BATCH_NAME, mockIntrastatBackend } from "../support/mocks/intrastat-backend"
import { mockShellAccess } from "../support/mocks/shell-access"

const EMAIL = "demo@cortex.local"

async function withIntrastatAccess(page: Parameters<typeof mockIdpConfig>[0]) {
  await mockShellAccess(page, { email: EMAIL, apps: ["intrastat"] })
  await mockIdpConfig(page)
  return mockIntrastatBackend(page)
}

test.describe("Intrastat — dashboard", () => {
  test("liczniki i tabela pokazują dane pobrane z backendu", async ({ page }) => {
    await withIntrastatAccess(page)

    const dashboard = new IntrastatDashboardPage(page)
    await dashboard.goto()

    await expect(dashboard.heading).toBeVisible()
    // Wartości z /stats, /resources/cn/current i /settings — każda z innego
    // endpointu, więc jeden zepsuty hook nie schowa się za pozostałymi.
    await expect(page.getByText("3", { exact: true }).first()).toBeVisible()
    await expect(page.getByText("cn-2026.xlsx")).toBeVisible()
    await expect(page.getByText("/data/intrastat")).toBeVisible()

    // Paczka z /batches, wraz z linkiem do jej przeglądu.
    await expect(dashboard.batchLink(INTRASTAT_BATCH_NAME)).toBeVisible()
    await expect(dashboard.batchRow(INTRASTAT_BATCH_NAME)).toContainText("WNT")
  })
})

test.describe("Intrastat — eksport paczki", () => {
  test('"Export XLSX" wysyła POST /intrastat/api/export/intrastat z id paczki', async ({ page }) => {
    const backend = await withIntrastatAccess(page)

    const batches = new IntrastatBatchesPage(page)
    await batches.goto()
    await expect(batches.batchRow(INTRASTAT_BATCH_NAME)).toBeVisible()

    await batches.exportButton.click()

    await expect.poll(() => backend.exports.length).toBe(1)
    const request = backend.exports[0]
    expect(request?.url).toContain("/intrastat/api/export/intrastat")
    // Kontrakt ciała: backend czyta `batch_ids`, nie `batchIds` — literówka po
    // stronie frontu dałaby pusty eksport zamiast błędu.
    expect(request?.body.batch_ids).toEqual([backend.batch.id])
  })

  test('"Audit XLSX" idzie na osobny endpoint audytu, nie na eksport importowy', async ({
    page,
  }) => {
    const backend = await withIntrastatAccess(page)

    const batches = new IntrastatBatchesPage(page)
    await batches.goto()
    await expect(batches.batchRow(INTRASTAT_BATCH_NAME)).toBeVisible()

    await batches.auditButton.click()

    await expect.poll(() => backend.exports.length).toBe(1)
    // Dwa przyciski obok siebie, dwa różne pliki wynikowe — podmiana handlerów
    // miejscami byłaby dla użytkownika niewidoczna aż do otwarcia arkusza.
    expect(backend.exports[0]?.url).toContain("/intrastat/api/export/audit")
    expect(backend.exports[0]?.url).not.toContain("/export/intrastat")
  })
})
