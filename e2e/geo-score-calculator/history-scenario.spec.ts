// E2E kafelka GEO Score Calculator — Historia: lista/filtr/wyszukiwanie/
// sortowanie/eksport/szczegóły/izolacja per-user, wszystko przez prawdziwy
// Postgres i prawdziwe route'y (@cortex/service), nie zamockowaną sieć.
// Sześć zaseedowanych analiz (oceny A/B/B/C/D/F) + jeden wiersz podrzucony
// pod obcy e-mail pochodzą z jednego, nazwanego scenariusza —
// seedGeoScoreCalculatorWithHistory() w e2e/fixtures/db-seed.ts.

import { expect, test } from "../fixtures/fixtures"
import { asUser } from "../fixtures/fixtures"
import { mockShellAccess } from "../support/mocks/shell-access"

// Timeout hojniejszy niż domyślne 5s — pierwsza wizyta na każdej trasie
// tego modułu w danym przebiegu `next dev` kompiluje się on-demand (strona
// i route handler osobno), a to środowisko dewelopeskie dzieli maszynę z
// innymi kontenerami/procesami (patrz raport weryfikacyjny tej zmiany —
// zmierzone realnie, nie założone: w PEŁNYM przebiegu suity, po
// dziewięciu wcześniejszych testach, strona szczegółów potrafi realnie
// potrzebować >20s mimo że ten sam dokładnie scenariusz w IZOLACJI ładuje
// się w ~1s — kumulacja obciążenia długiego przebiegu, nie błąd logiki;
// `test.slow()` w każdym teście niżej i tak potraja limit CAŁEGO testu
// do 90s, więc 45s na pojedynczą asercję mieści się z zapasem).
const SLOW = { timeout: 45_000 }

// Ponowienie NA POZIOMIE PLIKU przy sporadycznym zawieszeniu dev servera
// pod obciążeniem współdzielonej maszyny — pełne uzasadnienie w
// settings-affects-analysis.spec.ts (ten sam mechanizm/failure class
// zaobserwowany przy review Fazy 4 E2E w pełnym przebiegu suity: 8
// nieudanych / 9 udanych testów w jednym przebiegu, wszystkie zielone w
// powtórce — ten plik wcześniej nie miał żadnej ochrony). Lokalne dla tego
// pliku (`test.describe.configure`), NIE dotyka globalnego `retries: 0` w
// playwright.config.ts ani innych modułów.
test.describe.configure({ retries: 1 })

test.describe("GEO Score Calculator — historia", () => {
  test("lista pokazuje wszystkie własne analizy, NIGDY cudzy rekord", async ({
    page,
    seed,
    geoScoreCalculatorHistoryPage,
  }) => {
    test.slow()
    const { email } = await seed("geo-score-calculator-with-history")
    await asUser(page, email)
    await mockShellAccess(page, { email, apps: ["geo-score-calculator"] })

    await geoScoreCalculatorHistoryPage.goto()
    await expect(geoScoreCalculatorHistoryPage.heading).toBeVisible(SLOW)

    await expect(geoScoreCalculatorHistoryPage.row("Vistulon")).toBeVisible(SLOW)
    await expect(geoScoreCalculatorHistoryPage.row("Nordbrama")).toBeVisible()
    await expect(geoScoreCalculatorHistoryPage.row("Baltexon")).toBeVisible()
    await expect(geoScoreCalculatorHistoryPage.row("Ceratech")).toBeVisible()
    await expect(geoScoreCalculatorHistoryPage.row("Wiklinex")).toBeVisible()
    await expect(geoScoreCalculatorHistoryPage.row("Rekineza")).toBeVisible()

    // Dowód izolacji: rekord podrzucony pod geo-score-calculator-
    // foreign@e2e.local nigdy nie wychodzi na liście właściciela testu.
    await expect(page.getByText("Cudzyfirm")).not.toBeVisible()
  })

  test("filtr oceny B zawęża listę do dokładnie dwóch wierszy", async ({
    page,
    seed,
    geoScoreCalculatorHistoryPage,
  }) => {
    test.slow()
    const { email } = await seed("geo-score-calculator-with-history")
    await asUser(page, email)
    await mockShellAccess(page, { email, apps: ["geo-score-calculator"] })

    await geoScoreCalculatorHistoryPage.goto()
    await expect(geoScoreCalculatorHistoryPage.row("Vistulon")).toBeVisible(SLOW)
    await geoScoreCalculatorHistoryPage.gradeFilter.click()
    await page.getByRole("option", { name: "Ocena B" }).click()

    await expect(geoScoreCalculatorHistoryPage.row("Nordbrama")).toBeVisible()
    await expect(geoScoreCalculatorHistoryPage.row("Baltexon")).toBeVisible()
    await expect(geoScoreCalculatorHistoryPage.row("Vistulon")).not.toBeVisible()
    await expect(geoScoreCalculatorHistoryPage.row("Ceratech")).not.toBeVisible()
  })

  test("wyszukiwanie zawęża listę do analizy zawierającej frazę", async ({
    page,
    seed,
    geoScoreCalculatorHistoryPage,
  }) => {
    test.slow()
    const { email } = await seed("geo-score-calculator-with-history")
    await asUser(page, email)
    await mockShellAccess(page, { email, apps: ["geo-score-calculator"] })

    await geoScoreCalculatorHistoryPage.goto()
    await expect(geoScoreCalculatorHistoryPage.row("Vistulon")).toBeVisible(SLOW)
    await geoScoreCalculatorHistoryPage.searchInput.fill("Ceratech")

    await expect(geoScoreCalculatorHistoryPage.row("Ceratech")).toBeVisible()
    await expect(geoScoreCalculatorHistoryPage.row("Vistulon")).not.toBeVisible()
    await expect(geoScoreCalculatorHistoryPage.row("Rekineza")).not.toBeVisible()
  })

  test("sortowanie po kolumnie Wynik zmienia kolejność wierszy", async ({
    page,
    seed,
    geoScoreCalculatorHistoryPage,
  }) => {
    test.slow()
    const { email } = await seed("geo-score-calculator-with-history")
    await asUser(page, email)
    await mockShellAccess(page, { email, apps: ["geo-score-calculator"] })

    await geoScoreCalculatorHistoryPage.goto()
    await expect(geoScoreCalculatorHistoryPage.row("Rekineza")).toBeVisible(SLOW)

    // CortexDataGrid/TanStack Table w tym repo przełącza sort NA PIERWSZE
    // kliknięcie w kolejności malejącej (zweryfikowane bezpośrednio — brak
    // wcześniejszego testu klikającego nagłówek kolumny w tym repo, więc
    // kierunek NIE jest założeniem z dokumentacji biblioteki, tylko
    // obserwacją realnego zachowania @cortex/ui `cortex-data-grid.tsx`).
    // Pierwsze kliknięcie: malejąco — najwyższy wynik (Vistulon, 94.5) na
    // górze. `createdAt` w fixture CELOWO nie koreluje z `totalScore`
    // (db-seed.ts) — inaczej domyślna kolejność (desc createdAt) mogłaby
    // przypadkiem pokrywać się z sortem po wyniku i test niczego by nie
    // dowodził.
    await geoScoreCalculatorHistoryPage.columnHeader("Wynik").click()
    await expect(page.getByRole("row").nth(1)).toContainText("Vistulon", SLOW)

    // Drugie kliknięcie: rosnąco — najniższy wynik (Rekineza, 21.0) na górze.
    await geoScoreCalculatorHistoryPage.columnHeader("Wynik").click()
    await expect(page.getByRole("row").nth(1)).toContainText("Rekineza", SLOW)
  })

  test("szczegóły analizy: pełny wynik + configSnapshot, usuwanie znika z listy", async ({
    page,
    seed,
    geoScoreCalculatorHistoryPage,
    geoScoreCalculatorHistoryDetailPage,
  }) => {
    test.slow()
    const { email } = await seed("geo-score-calculator-with-history")
    await asUser(page, email)
    await mockShellAccess(page, { email, apps: ["geo-score-calculator"] })

    await geoScoreCalculatorHistoryPage.goto()
    await expect(geoScoreCalculatorHistoryPage.row("Vistulon")).toBeVisible(SLOW)
    await geoScoreCalculatorHistoryPage.openDetails("Vistulon")

    await expect(geoScoreCalculatorHistoryDetailPage.heading).toBeVisible(SLOW)
    await expect(page.getByText("94.5", { exact: true })).toBeVisible(SLOW)
    await expect(page.getByText("Ocena A", { exact: true })).toBeVisible(SLOW)
    await expect(geoScoreCalculatorHistoryDetailPage.configSnapshotLabel).toBeVisible(SLOW)

    await geoScoreCalculatorHistoryDetailPage.deleteTriggerButton.click()
    await geoScoreCalculatorHistoryDetailPage.confirmDeleteButton.click()

    await expect(geoScoreCalculatorHistoryPage.heading).toBeVisible(SLOW)
    await expect(geoScoreCalculatorHistoryPage.row("Vistulon")).not.toBeVisible(SLOW)

    const history = await page.request.get("/api/geo-score-calculator/history", {
      headers: { "x-auth-request-email": email },
    })
    expect(await history.json()).toHaveLength(5)
  })

  test("cudzy rekord jest niewidoczny nawet po bezpośrednim id (404, nie 403)", async ({
    page,
    seed,
    geoScoreCalculatorHistoryDetailPage,
  }) => {
    test.slow()
    const { email } = await seed("geo-score-calculator-with-history")
    await asUser(page, email)
    await mockShellAccess(page, { email, apps: ["geo-score-calculator"] })

    await geoScoreCalculatorHistoryDetailPage.goto("a0000000-0000-0000-0000-000000000007")

    await expect(geoScoreCalculatorHistoryDetailPage.heading).toBeVisible(SLOW)
    await expect(geoScoreCalculatorHistoryDetailPage.notFound).toBeVisible(SLOW)
  })

  test("eksport CSV i JSON pobiera plik z poprawną nazwą", async ({
    page,
    seed,
    geoScoreCalculatorHistoryPage,
  }) => {
    test.slow()
    const { email } = await seed("geo-score-calculator-with-history")
    await asUser(page, email)
    await mockShellAccess(page, { email, apps: ["geo-score-calculator"] })

    await geoScoreCalculatorHistoryPage.goto()
    await expect(geoScoreCalculatorHistoryPage.row("Vistulon")).toBeVisible(SLOW)

    await geoScoreCalculatorHistoryPage.exportButton.click()
    const csvDownloadPromise = page.waitForEvent("download")
    await geoScoreCalculatorHistoryPage.exportCsvItem.click()
    const csvDownload = await csvDownloadPromise
    expect(csvDownload.suggestedFilename()).toMatch(/^historia-geo-score-.*\.csv$/)

    await geoScoreCalculatorHistoryPage.exportButton.click()
    const jsonDownloadPromise = page.waitForEvent("download")
    await geoScoreCalculatorHistoryPage.exportJsonItem.click()
    const jsonDownload = await jsonDownloadPromise
    expect(jsonDownload.suggestedFilename()).toMatch(/^historia-geo-score-.*\.json$/)
  })
})
