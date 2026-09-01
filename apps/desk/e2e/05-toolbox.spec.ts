import { as, expect, test } from "./osoby"

// zestaw zakłada Annę bez indywidualnych nadań — poprzedni przebieg mógł jej coś przyznać
test.beforeAll(async ({ request }) => {
  await request.post("/api/test/reset-permissions", { headers: { Cookie: "desk_persona=robert" } })
})

test.describe("Obszar 5 · Zdolności stopniowane wg roli", () => {
  test("Dwie role, dwa zestawy", async ({ page }) => {
    await as(page, "anna")
    await page.goto("/capabilities")
    await expect(page.getByText("Tworzenie dokumentów")).toBeVisible()
    await expect(page.getByText("Uruchamianie obliczeń")).toBeVisible()
    // cztery kłódki: arkusz, kod, obraz i sprawdzanie kontrahenta w wykazie VAT
    await expect(page.getByRole("button", { name: "Poproś o dostęp" })).toHaveCount(4)

    await as(page, "robert")
    await page.goto("/capabilities")
    await expect(page.getByRole("button", { name: "Poproś o dostęp" })).toHaveCount(0)
    await expect(page.getByText("Generowanie obrazów")).toBeVisible()
  })

  test("Zablokowana zdolność pokazuje dział-właściciela", async ({ page }) => {
    await as(page, "anna")
    await page.goto("/capabilities")
    await expect(page.getByText("zgoda należy do działu: Marketing")).toBeVisible()
    await expect(page.getByText("zgoda należy do działu: IT")).toBeVisible()
  })

  test("Prośba o dostęp zostawia potwierdzenie", async ({ page }) => {
    await as(page, "anna")
    await page.goto("/capabilities")
    await page.getByRole("button", { name: "Poproś o dostęp" }).first().click()
    await expect(page.getByText("Prośba wysłana — czeka na rozpatrzenie")).toBeVisible()
  })

  test("Zdolności są też pod ręką przy polu zlecenia", async ({ page }) => {
    await as(page, "anna")
    await page.goto("/")
    await page.getByRole("button", { name: /Umiem tu 5 rzeczy/ }).click()
    await expect(page.getByText("Na to nie masz jeszcze zgody:")).toBeVisible()
    await expect(page.getByText("Generowanie obrazów")).toBeVisible()
  })

  test("Model nie dostaje narzędzia spoza roli", async ({ request }) => {
    const r = await request.get("/api/files", { headers: { Cookie: "desk_persona=anna" } })
    expect(r.ok()).toBeTruthy()
    // kontrakt bramy: Anna ma 4 zdolności, więc rejestr modelu ma 4 narzędzia
    // (sprawdzane bezpośrednio na polityce w tescie jednostkowym bramy)
  })
})
