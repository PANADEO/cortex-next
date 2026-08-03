// E2E kafelka Parser Dokumentów — Tor A (sekcja 6.3 design docu, wzorem
// e2e/ilustromat/ilustromat-scenario.spec.ts): realny Postgres + realne
// requireTileAccess(), mockowana WYŁĄCZNIE powłoka (AppGate). Backend Python
// i unoserver świadomie POZA zakresem (node-to-node, niewidoczne dla
// page.route — dokładnie ten sam argument co w Ilustromacie dla cortex-proxy).

import { expect, test } from "../fixtures/fixtures"
import { asUser } from "../fixtures/fixtures"
import { mockShellAccess } from "../support/mocks/shell-access"

test.describe("Parser Dokumentów — bramka dostępu", () => {
  test("użytkownik z grantem widzi ekran uploadu i historii", async ({
    page,
    seed,
    documentParserUploadPage,
    documentParserHistoryPage,
  }) => {
    const { email } = await seed("document-parser-with-history")
    await asUser(page, email)
    await mockShellAccess(page, { email, apps: ["document-parser"] })

    await documentParserUploadPage.goto()
    await expect(documentParserUploadPage.heading).toBeVisible()

    await documentParserHistoryPage.goto()
    await expect(documentParserHistoryPage.heading).toBeVisible()
  })

  test("użytkownik bez grantu do kafelka nie dostaje danych modułu", async ({ page, seed }) => {
    await seed("document-parser-with-history")
    const intruder = "ktos-obcy@e2e.local"
    await asUser(page, intruder)
    // Powłoka celowo PRZEPUSZCZA — chcemy zobaczyć, że odcina moduł, nie shell.
    await mockShellAccess(page, { email: intruder, apps: ["document-parser"] })

    const list = await page.request.get("/api/document-parser/jobs", {
      headers: { "x-auth-request-email": intruder },
    })
    expect(list.status()).toBe(403)

    const detail = await page.request.get("/api/document-parser/jobs/job-done-1", {
      headers: { "x-auth-request-email": intruder },
    })
    expect(detail.status()).toBe(403)
  })

  test("brak nagłówka tożsamości: 401, nie 403", async ({ page, seed }) => {
    await seed("document-parser-with-history")

    const response = await page.request.get("/api/document-parser/jobs")
    expect(response.status()).toBe(401)
  })
})
