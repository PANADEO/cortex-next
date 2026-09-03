import { as, expect, test } from "./osoby"

test.use({ viewport: { width: 390, height: 844 } })

test.describe("Obszar 7 · Telefon", () => {
  test("Na telefonie widać sprawy i nie ma paska bocznego", async ({ page }) => {
    await as(page, "anna")
    await page.goto("/")
    await expect(page.getByRole("heading", { name: "Sprawy" })).toBeVisible()
    await expect(page.locator("aside")).toBeHidden()
  })

  test("Dolna nawigacja prowadzi do plików i z powrotem", async ({ page }) => {
    await as(page, "anna")
    await page.goto("/")
    // DOKŁADNA nazwa, nie fragment. Od 03.09.2026 pasek boczny też jest `<nav>` i też
    // zawiera „Sprawy" oraz „Moje pliki", więc dopasowanie po fragmencie „Pliki" trafia
    // w dwa elementy naraz i scenariusz umiera na trybie ścisłym zamiast na treści.
    const nawigacja = page
      .getByRole("navigation")
      .filter({ has: page.getByRole("link", { name: "Pliki", exact: true }) })
    await nawigacja.getByRole("link", { name: "Pliki" }).click()
    await expect(page).toHaveURL(/\/files/)
    await expect(page.getByRole("heading", { name: "Moje pliki" })).toBeVisible()
    await nawigacja.getByRole("link", { name: "Sprawy" }).click()
    await expect(page).toHaveURL("http://localhost:3210/")
  })

  test("Strona nie przewija się w poziomie", async ({ page }) => {
    await as(page, "anna")
    await page.goto("/")
    const przewijaSie = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    )
    expect(przewijaSie).toBe(false)
  })

  test("Dolna nawigacja nie zasłania treści na dole strony", async ({ page }) => {
    await as(page, "anna")
    await page.goto("/files")
    const trash = page.getByRole("button", { name: /^Kosz/ })
    // `scrollIntoViewIfNeeded`, a NIE `window.scrollTo`: strona przewija się w kontenerze
    // wewnętrznym, więc przewijanie okna nie ruszało niczego. Przy krótkiej liście kosz
    // i tak mieścił się na ekranie, więc test przechodził — ale mierzył wtedy „element
    // jest widoczny", a nie „nawigacja go nie zasłania". Przy dłuższej liście `pod` robił
    // się `null`, bo punkt wypadał poza oknem, i test padał, choć nic nikogo nie zasłaniało.
    await trash.scrollIntoViewIfNeeded()
    await expect(trash).toBeVisible()
    const zaslonione = await trash.evaluate((el) => {
      const r = el.getBoundingClientRect()
      const pod = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
      return !el.contains(pod) && pod !== el
    })
    expect(zaslonione).toBe(false)
  })
})
