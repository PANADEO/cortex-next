// E2E kafelka Visual Guru — Tor A (design doc §8): realny Postgres + realne
// API modułu, mockowana WYŁĄCZNIE powłoka (AppGate). Dowodzi, że
// lista/szczegóły/izolacja/usuwanie faktycznie chodzą po prawdziwej bazie i
// prawdziwych route'ach (@cortex/service), nie po zamockowanej sieci. Zero
// wywołania cortex-proxy tutaj — sam formularz generacji (i mock POST
// /api/visual-guru/generate) ma osobne pokrycie w generator-flow.spec.ts
// (Tor B), dokładnie ten sam podział co document-parser
// (access-gate/history-scenario vs upload-flow).

import { expect, test } from "../fixtures/fixtures"
import { asUser } from "../fixtures/fixtures"
import { mockShellAccess } from "../support/mocks/shell-access"

// Dev server kompiluje route'y NA ŻĄDANIE — pierwsze trafienie w każdą z
// czterech ścieżek tego modułu (/visual-guru/history,
// /api/visual-guru/history, /visual-guru/history/[id],
// /api/visual-guru/history/[id]) płaci za kompilację na zimno (zmierzone
// wzorem e2e/ilustromat/ilustromat-scenario.spec.ts: rzędu dziesiątek sekund
// na zimno vs pojedynczych na ciepło). Podnosimy limit testu wyłącznie dla
// tego pliku; poszczególne asercje po nawigacji dostają jawny hojny timeout
// niżej (domyślny 5 s dla `expect(locator)` nie jest powiązany z timeoutem
// testu).
test.describe.configure({ timeout: 90_000 })

test.describe("Visual Guru — archiwum", () => {
  test("lista pokazuje obie generacje właściciela, NIGDY cudzy rekord", async ({
    page,
    seed,
    visualGuruHistoryPage,
  }) => {
    const { email } = await seed("visual-guru-with-history")
    await asUser(page, email)
    await mockShellAccess(page, { email, apps: ["visual-guru"] })

    await visualGuruHistoryPage.goto()
    await expect(visualGuruHistoryPage.heading).toBeVisible()

    // Hojny timeout: pierwsze trafienie w GET /api/visual-guru/history w tym
    // przebiegu płaci za kompilację route'a na zimno.
    await expect(visualGuruHistoryPage.row("Minimalistyczna ilustracja lisa")).toBeVisible({
      timeout: 30_000,
    })
    await expect(visualGuruHistoryPage.row("Baner produktowy w stylu logo firmy")).toBeVisible()

    // Dowód izolacji: rekord podrzucony pod visual-guru-foreign@e2e.local
    // nigdy nie wychodzi na liście właściciela testu.
    await expect(page.getByText("Cudzy prompt niewidoczny")).not.toBeVisible()
  })

  test("wyszukiwanie zawęża listę do promptu pasującego do frazy", async ({
    page,
    seed,
    visualGuruHistoryPage,
  }) => {
    const { email } = await seed("visual-guru-with-history")
    await asUser(page, email)
    await mockShellAccess(page, { email, apps: ["visual-guru"] })

    await visualGuruHistoryPage.goto()
    await visualGuruHistoryPage.searchInput.fill("baner produktowy")

    await expect(visualGuruHistoryPage.row("Baner produktowy w stylu logo firmy")).toBeVisible()
    await expect(visualGuruHistoryPage.row("Minimalistyczna ilustracja lisa")).not.toBeVisible()
  })

  test("szczegóły generacji BEZ obrazu referencyjnego: pełny prompt, kontekst, 4 warianty", async ({
    page,
    seed,
    visualGuruHistoryPage,
    visualGuruHistoryDetailPage,
  }) => {
    const { email } = await seed("visual-guru-with-history")
    await asUser(page, email)
    await mockShellAccess(page, { email, apps: ["visual-guru"] })

    await visualGuruHistoryPage.goto()
    await visualGuruHistoryPage.openDetails("Minimalistyczna ilustracja lisa")

    await expect(visualGuruHistoryDetailPage.heading).toBeVisible()
    // Hojny timeout na TĘ konkretną asercję: nagłówek renderuje się od razu
    // (statyczny PageHeader), ale ta treść czeka na dane z
    // GET /api/visual-guru/history/[id] — pierwsze trafienie w ten route w
    // przebiegu płaci za kompilację na zimno (LoadingState widoczny do tego
    // momentu, patrz komentarz pliku wyżej).
    await expect(page.getByText("Minimalistyczna ilustracja lisa na tle gór")).toBeVisible({
      timeout: 30_000,
    })
    await expect(page.getByText("Płaski styl wektorowy, ciepła paleta")).toBeVisible()
    await expect(page.getByText("Brak — generacja z samego promptu.")).toBeVisible()
    for (let i = 1; i <= 4; i++) {
      await expect(visualGuruHistoryDetailPage.variant(i)).toBeVisible()
    }
  })

  test("szczegóły generacji Z obrazem referencyjnym: pokazuje TYLKO nazwę pliku, nigdy same bajty (D5)", async ({
    page,
    seed,
    visualGuruHistoryPage,
    visualGuruHistoryDetailPage,
  }) => {
    const { email } = await seed("visual-guru-with-history")
    await asUser(page, email)
    await mockShellAccess(page, { email, apps: ["visual-guru"] })

    await visualGuruHistoryPage.goto()
    await visualGuruHistoryPage.openDetails("Baner produktowy w stylu logo firmy")

    await expect(visualGuruHistoryDetailPage.heading).toBeVisible()
    // Ślad, nie bajty: nazwa pliku jest tekstem, nie ma dla niej żadnego <img>.
    await expect(page.getByText("logo-firmy.png")).toBeVisible()

    // Dowód D5 wprost: oba warianty WYNIKOWE się renderują, a WHILE żaden
    // obraz na stronie nie niesie accessible name sugerującej "referencję" —
    // strona nigdy nie tworzy <img> dla obrazu referencyjnego, tylko dla
    // wariantów (alt="Wariant N", patrz variant-grid.tsx). Celowo NIE liczymy
    // WSZYSTKICH <img> na stronie: ikony chrome'u (sidebar/topbar/PageHeader)
    // renderują się jako role="img" też, więc globalny count byłby kruchy i
    // nie dowodziłby niczego o D5 specyficznie.
    await expect(visualGuruHistoryDetailPage.variant(1)).toBeVisible()
    await expect(visualGuruHistoryDetailPage.variant(2)).toBeVisible()
    await expect(page.getByRole("img", { name: /referenc/i })).toHaveCount(0)
  })

  test("cudzy rekord jest niewidoczny nawet po bezpośrednim id (404, nie 403)", async ({
    page,
    seed,
    visualGuruHistoryDetailPage,
  }) => {
    const { email } = await seed("visual-guru-with-history")
    await asUser(page, email)
    await mockShellAccess(page, { email, apps: ["visual-guru"] })

    // "33333333-..." to REALNY, istniejący w bazie rekord — należący do
    // VISUAL_GURU_FOREIGN_EMAIL, nie do właściciela testu (db-seed.ts). Route
    // musi odróżnić "cudze" od "nie istnieje" identycznie — oba 404, nigdy 403
    // (403 zdradzałby, że rekord o tym id w ogóle istnieje).
    await visualGuruHistoryDetailPage.goto("33333333-3333-3333-3333-333333333333")
    await expect(visualGuruHistoryDetailPage.notFound).toBeVisible()

    // Kontrola dopełniająca: id, które NIE istnieje w ogóle, daje ten sam wynik.
    await visualGuruHistoryDetailPage.goto("00000000-0000-0000-0000-000000000000")
    await expect(visualGuruHistoryDetailPage.notFound).toBeVisible()
  })

  test("usuwanie: potwierdzenie AlertDialog, przekierowanie, generacja znika z listy", async ({
    page,
    seed,
    visualGuruHistoryPage,
    visualGuruHistoryDetailPage,
  }) => {
    const { email } = await seed("visual-guru-with-history")
    await asUser(page, email)
    await mockShellAccess(page, { email, apps: ["visual-guru"] })

    await visualGuruHistoryPage.goto()
    await visualGuruHistoryPage.openDetails("Baner produktowy w stylu logo firmy")
    await expect(visualGuruHistoryDetailPage.heading).toBeVisible()

    // Anuluj najpierw — dowód, że dialog samo w sobie NIC nie usuwa.
    await visualGuruHistoryDetailPage.deleteButton.click()
    await visualGuruHistoryDetailPage.cancelDeleteButton.click()
    await expect(page.getByRole("alertdialog")).not.toBeVisible()

    await visualGuruHistoryDetailPage.deleteButton.click()
    await visualGuruHistoryDetailPage.confirmDeleteButton.click()

    await expect(visualGuruHistoryPage.heading).toBeVisible()
    await expect(visualGuruHistoryPage.row("Baner produktowy w stylu logo firmy")).not.toBeVisible()
    // Druga generacja właściciela zostaje nietknięta.
    await expect(visualGuruHistoryPage.row("Minimalistyczna ilustracja lisa")).toBeVisible()
  })
})

test.describe("Visual Guru — warstwa dostępu modułu", () => {
  test("użytkownik bez grantu do kafelka nie dostaje danych archiwum", async ({ page, seed }) => {
    await seed("visual-guru-with-history")
    const intruder = "ktos-obcy-visual-guru@e2e.local"
    await asUser(page, intruder)
    // Powłoka celowo PRZEPUSZCZA — chcemy zobaczyć, że odcina moduł, nie shell.
    await mockShellAccess(page, { email: intruder, apps: ["visual-guru"] })

    const response = await page.request.get("/api/visual-guru/history", {
      headers: { "x-auth-request-email": intruder },
    })

    expect(response.status()).toBe(403)
  })
})
