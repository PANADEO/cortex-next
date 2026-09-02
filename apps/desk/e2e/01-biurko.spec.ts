import { as, expect, test } from "./osoby"

/**
 * Gotowe zlecenia mają JEDNĄ postać: trzy kafle, zawsze widoczne. Wcześniej były trzy
 * postacie zależne od liczby spraw (karty, chipy, zwinięta lista „Podpowiedzi”) i test
 * musiał zgadywać, którą akurat zobaczy — czyli sam potwierdzał defekt, zamiast go łapać.
 */
const POLE = "Napisz, co mam zrobić"

test.describe("Obszar 1 · To jest MOJE biurko", () => {
  test("Pierwsze wejście wita po imieniu i nie zostawia pustego pola", async ({ page }) => {
    await as(page, "anna")
    await page.goto("/")
    await expect(page.getByRole("heading", { name: /Dzień dobry, Anna/ })).toBeVisible()
    await expect(page.getByText("Nikt inny go nie widzi")).toBeVisible()
    await expect(page.getByLabel(POLE)).toBeVisible()
  })

  test("Gotowe zlecenia stoją na wierzchu — bez rozwijania, przy każdej liczbie spraw", async ({
    page,
    request,
  }) => {
    // Sprawdzamy PRZY SPRAWACH, bo to ten stan chował kafle pod „Podpowiedzi”: pani Basia,
    // która pracuje tu codziennie, traciła je pierwsza.
    await as(page, "anna")
    for (const title of ["Sprawa jedna", "Sprawa druga", "Sprawa trzecia"]) {
      await request.post("/api/case/new", {
        headers: { Cookie: "desk_persona=anna" },
        data: { title },
      })
    }
    await page.goto("/")
    await expect(page.getByRole("button", { name: "Podpowiedzi", exact: true })).toHaveCount(0)
    const karty = page.locator("button", {
      hasText: /Zestawienie kosztów|Notatka ze spotkania|brakuje w dokumencie/,
    })
    expect(await karty.count()).toBeGreaterThanOrEqual(3)
  })

  test("Kliknięcie gotowego zlecenia wstawia treść do pola, ale nie wysyła", async ({ page }) => {
    await as(page, "anna")
    await page.goto("/")
    await page
      .locator("button", { hasText: /Zestawienie kosztów/ })
      .first()
      .click()
    await expect(page.getByLabel(POLE)).not.toBeEmpty()
    await expect(page).toHaveURL("http://localhost:3210/")
  })

  test("Sprawy są prywatne — Robert nie widzi spraw Anny", async ({ page, request }) => {
    await as(page, "anna")
    const r = await request.post("/api/case/new", {
      headers: { Cookie: "desk_persona=anna" },
      data: { title: "Prywatna sprawa Anny" },
    })
    expect(r.ok()).toBeTruthy()
    await as(page, "robert")
    await page.goto("/")
    await expect(page.getByText("Prywatna sprawa Anny")).toHaveCount(0)
  })

  test("Cudzej sprawy nie da się otworzyć z adresu", async ({ page, request }) => {
    const r = await request.post("/api/case/new", {
      headers: { Cookie: "desk_persona=anna" },
      data: { title: "Case do podejrzenia" },
    })
    const { id } = await r.json()
    await as(page, "robert")
    await page.goto(`/case/${id}`)
    await expect(page.getByText("To nie jest Twoja sprawa")).toBeVisible()
  })
})
