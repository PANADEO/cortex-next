import type { Page } from "@playwright/test"
import { expect, jako, test } from "./osoby"

/**
 * Podpowiedzi mają trzy postacie zależnie od tego, ile jest spraw: karty, chipy, zwinięta lista.
 * Test interesuje jedno — że da się do nich dojść — więc czeka na dowolną z nich, zamiast
 * zgadywać, którą akurat zobaczy.
 */
async function odslonPodpowiedzi(page: Page) {
  await page.waitForSelector(
    'button:has-text("Podpowiedzi"), button:has-text("Zestawienie kosztów")',
  )
  const rozwin = page.getByRole("button", { name: "Podpowiedzi", exact: true })
  if (await rozwin.count()) await rozwin.click()
}

test.describe("Obszar 1 · To jest MOJE biurko", () => {
  test("Pierwsze wejście wita po imieniu i nie zostawia pustego pola", async ({ page }) => {
    await jako(page, "anna")
    await page.goto("/")
    await expect(page.getByRole("heading", { name: /Dzień dobry, Anna/ })).toBeVisible()
    await expect(page.getByText("Nikt inny go nie widzi")).toBeVisible()
    await expect(page.getByPlaceholder("Co mam dla Ciebie zrobić?")).toBeVisible()
  })

  test("Podpowiedzi są zawsze osiągalne — na pustym biurku wprost, później po rozwinięciu", async ({
    page,
  }) => {
    await jako(page, "anna")
    await page.goto("/")
    await odslonPodpowiedzi(page)
    const karty = page.locator("button", {
      hasText: /Zestawienie kosztów|Notatka ze spotkania|brakuje w dokumencie/,
    })
    expect(await karty.count()).toBeGreaterThanOrEqual(3)
  })

  test("Kliknięcie podpowiedzi wstawia treść do pola, ale nie wysyła", async ({ page }) => {
    await jako(page, "anna")
    await page.goto("/")
    await odslonPodpowiedzi(page)
    await page
      .locator("button", { hasText: /Zestawienie kosztów/ })
      .first()
      .click()
    await expect(page.getByPlaceholder("Co mam dla Ciebie zrobić?")).not.toBeEmpty()
    await expect(page).toHaveURL("http://localhost:3210/")
  })

  test("Sprawy są prywatne — Robert nie widzi spraw Anny", async ({ page, request }) => {
    await jako(page, "anna")
    const r = await request.post("/api/sprawa/nowa", {
      headers: { Cookie: "desk_persona=anna" },
      data: { tytul: "Prywatna sprawa Anny" },
    })
    expect(r.ok()).toBeTruthy()
    await jako(page, "robert")
    await page.goto("/")
    await expect(page.getByText("Prywatna sprawa Anny")).toHaveCount(0)
  })

  test("Cudzej sprawy nie da się otworzyć z adresu", async ({ page, request }) => {
    const r = await request.post("/api/sprawa/nowa", {
      headers: { Cookie: "desk_persona=anna" },
      data: { tytul: "Sprawa do podejrzenia" },
    })
    const { id } = await r.json()
    await jako(page, "robert")
    await page.goto(`/sprawa/${id}`)
    await expect(page.getByText("To nie jest Twoja sprawa")).toBeVisible()
  })
})
