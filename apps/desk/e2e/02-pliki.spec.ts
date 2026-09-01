import type { Page } from "@playwright/test"
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
