import { expect, jako, test } from "./osoby"

test.use({ viewport: { width: 390, height: 844 } })

test.describe("Obszar 7 · Telefon", () => {
  test("Na telefonie widać sprawy i nie ma paska bocznego", async ({ page }) => {
    await jako(page, "anna")
    await page.goto("/")
    await expect(page.getByRole("heading", { name: "Sprawy" })).toBeVisible()
    await expect(page.locator("aside")).toBeHidden()
  })

  test("Dolna nawigacja prowadzi do plików i z powrotem", async ({ page }) => {
    await jako(page, "anna")
    await page.goto("/")
    const nawigacja = page.locator("nav").filter({ hasText: "Sprawy" }).filter({ hasText: "Pliki" })
    await nawigacja.getByRole("link", { name: "Pliki" }).click()
    await expect(page).toHaveURL(/\/pliki/)
    await expect(page.getByRole("heading", { name: "Moje pliki" })).toBeVisible()
    await nawigacja.getByRole("link", { name: "Sprawy" }).click()
    await expect(page).toHaveURL("http://localhost:3210/")
  })

  test("Strona nie przewija się w poziomie", async ({ page }) => {
    await jako(page, "anna")
    await page.goto("/")
    const przewijaSie = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    )
    expect(przewijaSie).toBe(false)
  })

  test("Dolna nawigacja nie zasłania treści na dole strony", async ({ page }) => {
    await jako(page, "anna")
    await page.goto("/pliki")
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    const kosz = page.getByRole("button", { name: /^Kosz/ })
    await expect(kosz).toBeVisible()
    const zaslonione = await kosz.evaluate((el) => {
      const r = el.getBoundingClientRect()
      const pod = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
      return !el.contains(pod) && pod !== el
    })
    expect(zaslonione).toBe(false)
  })
})
