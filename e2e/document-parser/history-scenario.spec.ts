// E2E kafelka Parser Dokumentów — Tor A, ciąg dalszy access-gate.spec.ts:
// dowodzi, że lista/szczegóły/izolacja per-user faktycznie chodzą po
// prawdziwej bazie i prawdziwych route'ach (@cortex/service), nie po
// zamockowanej sieci. Cztery stany joba (queued/processing/done/error) i
// jeden podrzucony rekord obcego usera pochodzą z jednego, nazwanego
// scenariusza — seedDocumentParserWithHistory() w e2e/fixtures/db-seed.ts.

import { expect, test } from "../fixtures/fixtures"
import { asUser } from "../fixtures/fixtures"
import { mockShellAccess } from "../support/mocks/shell-access"

test.describe("Parser Dokumentów — historia", () => {
  test("lista pokazuje wszystkie stany joba właściciela, NIGDY cudzy rekord", async ({
    page,
    seed,
    documentParserHistoryPage,
  }) => {
    const { email } = await seed("document-parser-with-history")
    await asUser(page, email)
    await mockShellAccess(page, { email, apps: ["document-parser"] })

    await documentParserHistoryPage.goto()
    await expect(documentParserHistoryPage.heading).toBeVisible()

    await expect(documentParserHistoryPage.row("raport-kwartalny.pdf")).toBeVisible()
    await expect(documentParserHistoryPage.row("umowa-uszkodzona.docx")).toBeVisible()
    await expect(documentParserHistoryPage.row("prezentacja.pptx")).toBeVisible()
    await expect(documentParserHistoryPage.row("notatka.txt")).toBeVisible()

    // Dowód izolacji: rekord podrzucony pod document-parser-foreign@e2e.local
    // nigdy nie wychodzi na liście właściciela testu.
    await expect(page.getByText("cudzy-dokument.pdf")).not.toBeVisible()
  })

  test("filtr statusu zawęża listę do wybranego stanu", async ({
    page,
    seed,
    documentParserHistoryPage,
  }) => {
    const { email } = await seed("document-parser-with-history")
    await asUser(page, email)
    await mockShellAccess(page, { email, apps: ["document-parser"] })

    await documentParserHistoryPage.goto()
    await documentParserHistoryPage.statusFilter.click()
    await page.getByRole("option", { name: "Gotowe" }).click()

    await expect(documentParserHistoryPage.row("raport-kwartalny.pdf")).toBeVisible()
    await expect(documentParserHistoryPage.row("umowa-uszkodzona.docx")).not.toBeVisible()
  })

  test("szczegóły zadania done: pełny Markdown, metadane, pobranie", async ({
    page,
    seed,
    documentParserHistoryPage,
    documentParserJobDetailPage,
  }) => {
    const { email } = await seed("document-parser-with-history")
    await asUser(page, email)
    await mockShellAccess(page, { email, apps: ["document-parser"] })

    await documentParserHistoryPage.goto()
    await documentParserHistoryPage.detailsButton("raport-kwartalny.pdf").click()

    await expect(documentParserJobDetailPage.heading).toBeVisible()
    await expect(page.getByRole("heading", { name: "Raport kwartalny", level: 1 })).toBeVisible()
    await expect(page.getByText("openai/gpt-4o-mini")).toBeVisible()
    await expect(documentParserJobDetailPage.promptBlock).toBeVisible()
  })

  test("szczegóły zadania error: komunikat rozróżnialny per errorCode, nie ogólny", async ({
    page,
    seed,
    documentParserJobDetailPage,
  }) => {
    const { email } = await seed("document-parser-with-history")
    await asUser(page, email)
    await mockShellAccess(page, { email, apps: ["document-parser"] })

    await documentParserJobDetailPage.goto("job-error-1")

    await expect(documentParserJobDetailPage.heading).toBeVisible()
    // errorCode "conversion-failed" -> ten konkretny tytuł (status.ts), NIE
    // ogólne "processing failed" ani generyczne "Przetwarzanie nie powiodło się".
    await expect(page.getByText("Nie udało się przetworzyć dokumentu")).toBeVisible()
  })

  test("cudzy rekord jest niewidoczny nawet po bezpośrednim id (404, nie 403)", async ({
    page,
    seed,
    documentParserJobDetailPage,
  }) => {
    const { email } = await seed("document-parser-with-history")
    await asUser(page, email)
    await mockShellAccess(page, { email, apps: ["document-parser"] })

    await documentParserJobDetailPage.goto("job-foreign-1")

    await expect(documentParserJobDetailPage.notFound).toBeVisible()
  })
})
