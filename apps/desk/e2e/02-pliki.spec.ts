import type { APIRequestContext, Page } from "@playwright/test"
import { as, expect, test } from "./osoby"

/** Nazwa pliku pojawia się też w tostach, więc asercje celują w samą listę. */
const list = (page: Page) => page.getByRole("list", { name: "Pliki w tym folderze" })

/**
 * Wgranie nie nadpisuje plików, więc bez sprzątania każdy kolejny przebieg zostawiałby
 * „test-wgrany (2).txt", „(3)" i tak dalej — a zestaw, który zaśmieca stan, prędzej czy
 * później zaczyna migotać.
 */
test.beforeAll(async ({ request }) => {
  const headers = { Cookie: "desk_persona=anna" }
  const d = await (await request.get("/api/files", { headers })).json()
  for (const p of d.files ?? []) {
    if (p.name.startsWith("test-wgrany")) {
      await request.post("/api/files", { headers, data: { action: "trash", path: p.path } })
    }
  }
})

test.describe("Obszar 2 · Moje pliki — teczka, która przeżywa sprawę", () => {
  test("Wgrany plik zostaje na biurku i przeżywa przeładowanie", async ({ page }) => {
    await as(page, "anna")
    await page.goto("/files")
    await page
      .locator("input[type=file]")
      .first()
      .setInputFiles({
        name: "test-wgrany.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("treść testowa"),
      })
    await expect(list(page).getByText("test-wgrany.txt")).toBeVisible()
    await page.reload()
    await expect(list(page).getByText("test-wgrany.txt")).toBeVisible()
  })

  test("Kasowanie jest odwracalne od razu — bez pytania, z przyciskiem Cofnij", async ({
    page,
  }) => {
    await as(page, "anna")
    await page.goto("/files")
    await page.getByRole("button", { name: "Więcej opcji dla test-wgrany.txt" }).first().click()
    await page.getByRole("menuitem", { name: /Usuń/ }).click()
    await expect(list(page).getByText("test-wgrany.txt")).toHaveCount(0)
    await expect(page.getByText("Przeniesione do kosza: test-wgrany.txt")).toBeVisible()
    await page.getByRole("button", { name: "Cofnij" }).click()
    await expect(list(page).getByText("test-wgrany.txt")).toBeVisible()
  })

  test("Skasowany plik można też odzyskać z kosza", async ({ page }) => {
    await as(page, "anna")
    await page.goto("/files")
    await page.getByRole("button", { name: "Więcej opcji dla test-wgrany.txt" }).first().click()
    await page.getByRole("menuitem", { name: /Usuń/ }).click()
    await expect(list(page).getByText("test-wgrany.txt")).toHaveCount(0)
    await page.getByRole("button", { name: /^Kosz/ }).click()
    await page
      .locator("li", { hasText: "test-wgrany.txt" })
      .getByRole("button", { name: "Przywróć" })
      .first()
      .click()
    await expect(list(page).getByText("test-wgrany.txt")).toBeVisible()
  })

  test("Zmiana nazwy dzieje się w wierszu, nie w okienku systemowym", async ({ page }) => {
    await as(page, "anna")
    await page.goto("/files")
    await page.getByRole("button", { name: "Więcej opcji dla test-wgrany.txt" }).first().click()
    await page.getByRole("menuitem", { name: /Zmień nazwę/ }).click()
    const field = page.getByRole("textbox", { name: "Nowa nazwa pliku" })
    await expect(field).toBeVisible()
    await field.fill("test-przemianowany.txt")
    await field.press("Enter")
    await expect(list(page).getByText("test-przemianowany.txt")).toBeVisible()
    // sprzątamy po sobie, żeby kolejne uruchomienie zastało to samo biurko
    await page
      .getByRole("button", { name: "Więcej opcji dla test-przemianowany.txt" })
      .first()
      .click()
    await page.getByRole("menuitem", { name: /Zmień nazwę/ }).click()
    const pole2 = page.getByRole("textbox", { name: "Nowa nazwa pliku" })
    await pole2.fill("test-wgrany.txt")
    await pole2.press("Enter")
    await expect(list(page).getByText("test-wgrany.txt")).toBeVisible()
  })

  test("Nazwa zajęta nie kasuje cudzego pliku — zmiana jest odrzucana", async ({ page }) => {
    await as(page, "anna")
    await page.goto("/files")
    await page.getByRole("button", { name: "Więcej opcji dla test-wgrany.txt" }).first().click()
    await page.getByRole("menuitem", { name: /Zmień nazwę/ }).click()
    const field = page.getByRole("textbox", { name: "Nowa nazwa pliku" })
    await field.fill("faktury-08.csv")
    await field.press("Enter")
    await expect(page.getByText("Taki plik już tu jest. Wybierz inną nazwę.")).toBeVisible()
    await expect(list(page).getByText("test-wgrany.txt")).toHaveCount(0)
    await field.press("Escape")
    // oryginał ocalał
    await page.reload()
    await expect(list(page).getByText("faktury-08.csv")).toBeVisible()
    await expect(list(page).getByText("test-wgrany.txt")).toBeVisible()
  })

  test("Pliki są prywatne", async ({ page }) => {
    await as(page, "robert")
    await page.goto("/files")
    await expect(list(page).getByText("test-wgrany.txt")).toHaveCount(0)
  })
})

test.describe("Skróty klawiszowe z menu naprawdę działają", () => {
  test("F2 na wierszu otwiera edycję nazwy", async ({ page }) => {
    await as(page, "anna")
    await page.goto("/files")
    await list(page).getByText("test-wgrany.txt").click()
    await page.keyboard.press("Escape")
    await list(page)
      .getByRole("button", { name: /test-wgrany/ })
      .first()
      .focus()
    await page.keyboard.press("F2")
    await expect(page.getByRole("textbox", { name: "Nowa nazwa pliku" })).toBeVisible()
    await page.keyboard.press("Escape")
  })
})

test.describe("Obszar 2 · Skąd przyszedł plik — i dlaczego tylko czasem", () => {
  const SPRAWA = "Faktury sierpień (scenariusz)"
  const PLIK = "test-wgrany-ze-sprawy.txt"

  test("Plik odłożony ze sprawy nazywa ją i prowadzi do niej", async ({ page, request }) => {
    await as(page, "anna")
    await page.goto("/files")
    await page
      .locator("input[type=file]")
      .first()
      .setInputFiles({ name: PLIK, mimeType: "text/plain", buffer: Buffer.from("wynik pracy") })
    await expect(list(page).getByText(PLIK)).toBeVisible()

    // Zdarzenie zasiewamy trasą testową, bo prawdziwe odłożenie wymaga przebiegu modelu.
    // Złączenie ze sprawą i to, co widać na ekranie, sprawdzamy już naprawdę.
    await request.post("/api/test/saved-file", {
      headers: { Cookie: "desk_persona=anna" },
      data: { title: SPRAWA, path: `Moje pliki/${PLIK}` },
    })
    await page.reload()

    const wiersz = list(page).locator("li", { hasText: PLIK })
    const link = wiersz.getByRole("link", { name: `Ze sprawy: ${SPRAWA}` })
    await expect(link).toBeVisible()
    await link.click()
    await expect(page).toHaveURL(/\/case\//)
    await expect(page.getByText(SPRAWA).first()).toBeVisible()

    await request.post("/api/files", {
      headers: { Cookie: "desk_persona=anna" },
      data: { action: "trash", path: `Moje pliki/${PLIK}` },
    })
  })

  test("Plik wgrany ręcznie NIE dostaje plakietki pochodzenia", async ({ page }) => {
    // Najważniejszy scenariusz tej rundy, choć wygląda na najnudniejszy: pilnuje, żeby
    // ekran nie zaczął zgadywać. „Wgrany przez Ciebie" byłoby domysłem — a produkt,
    // który raz zgadnie pochodzenie, przestaje być dowodem na cokolwiek.
    await as(page, "anna")
    await page.goto("/files")
    const wiersz = list(page).locator("li", { hasText: "test-wgrany.txt" })
    await expect(wiersz).toHaveCount(1)
    await expect(wiersz.getByRole("link", { name: /Ze sprawy/ })).toHaveCount(0)
  })
})

test.describe("Obszar 2 · Znalezienie jednego pliku wśród wielu", () => {
  const KATALOG = "Moje pliki/test-szukanie"
  const trzon = (n: string) => ({
    name: n,
    mimeType: "text/plain",
    buffer: Buffer.from(`treść ${n}`),
  })

  /** Katalog zakładamy i sprzątamy sami — scenariusz nie może zależeć od cudzego stanu. */
  const sprzataj = async (request: APIRequestContext) => {
    await request.post("/api/files", {
      headers: { Cookie: "desk_persona=anna" },
      data: { action: "trash", path: KATALOG },
    })
  }

  test.beforeAll(async ({ request }) => {
    await sprzataj(request)
    await request.post("/api/files", {
      headers: { Cookie: "desk_persona=anna" },
      data: { action: "folder", path: KATALOG },
    })
  })

  test.afterAll(async ({ request }) => {
    await sprzataj(request)
  })

  test("Pole zawężania zostawia trafienia i tylko trafienia", async ({ page }) => {
    await as(page, "anna")
    await page.goto(`/files?k=${encodeURIComponent(KATALOG)}`)
    await page
      .locator("input[type=file]")
      .first()
      .setInputFiles([
        trzon("raport-jeden.txt"),
        trzon("raport-dwa.txt"),
        trzon("raport-trzy.txt"),
        trzon("raport-cztery.txt"),
        trzon("raport-piec.txt"),
        trzon("raport-szesc.txt"),
        trzon("raport-siedem.txt"),
        trzon("faktura-marzec.txt"),
      ])
    await expect(list(page).locator("li")).toHaveCount(8)

    await page.getByRole("searchbox", { name: "Znajdź w tym katalogu" }).fill("faktur")
    await expect(list(page).locator("li")).toHaveCount(1)
    await expect(list(page).getByText("faktura-marzec.txt")).toBeVisible()
  })

  test("Zawężenie bez trafień mówi wprost, że nic nie pasuje", async ({ page }) => {
    await as(page, "anna")
    await page.goto(`/files?k=${encodeURIComponent(KATALOG)}`)
    await page
      .getByRole("searchbox", { name: "Znajdź w tym katalogu" })
      .fill("czegoś takiego nie ma")
    await expect(page.getByText(/Nic nie pasuje do/)).toBeVisible()
    await page.getByRole("button", { name: "Wyczyść zawężenie" }).click()
    await expect(list(page).locator("li")).toHaveCount(8)
  })

  test("Porządek „Najnowsze” stawia świeżo wgrany plik na górze", async ({ page }) => {
    await as(page, "anna")
    await page.goto(`/files?k=${encodeURIComponent(KATALOG)}`)
    // Po nazwie ten plik stoi w środku stawki, po dacie — pierwszy. Różnica jest dowodem.
    await page
      .locator("input[type=file]")
      .first()
      .setInputFiles([trzon("zzz-ostatni.txt")])
    await expect(list(page).locator("li").first()).toContainText("faktura-marzec.txt")

    await page.getByRole("button", { name: "Po nazwie" }).click()
    await page.getByRole("menuitem", { name: "Najnowsze" }).click()
    await expect(list(page).locator("li").first()).toContainText("zzz-ostatni.txt")
  })
})
