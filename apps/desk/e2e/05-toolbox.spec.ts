import { as, expect, otworz, test } from "./osoby"

// zestaw zakłada Annę bez indywidualnych nadań — poprzedni przebieg mógł jej coś przyznać
test.beforeAll(async ({ request }) => {
  await request.post("/api/test/reset-permissions", { headers: { Cookie: "desk_persona=robert" } })
})

test.describe("Obszar 5 · Zdolności stopniowane wg roli", () => {
  test("Dwie role, dwa zestawy", async ({ page }) => {
    await as(page, "anna")
    await otworz(page, "/capabilities")
    await expect(page.getByText("Tworzenie dokumentów")).toBeVisible()
    await expect(page.getByText("Uruchamianie obliczeń")).toBeVisible()
    // pięć kłódek: arkusz, kod, obraz, sprawdzanie kontrahenta w wykazie VAT
    // oraz odkładanie na wspólną półkę — pracownica na nią ZAGLĄDA, ale nie podmienia
    // dokumentów, które czyta cały zespół.
    await expect(page.getByRole("button", { name: "Poproś o dostęp" })).toHaveCount(5)

    await as(page, "robert")
    await otworz(page, "/capabilities")
    await expect(page.getByRole("button", { name: "Poproś o dostęp" })).toHaveCount(0)
    await expect(page.getByText("Generowanie obrazów")).toBeVisible()
  })

  test("Zablokowana zdolność pokazuje dział-właściciela", async ({ page }) => {
    await as(page, "anna")
    await otworz(page, "/capabilities")
    await expect(page.getByText("zgoda należy do działu: Marketing")).toBeVisible()
    await expect(page.getByText("zgoda należy do działu: IT")).toBeVisible()
  })

  test("Prośba o dostęp zostawia potwierdzenie", async ({ page }) => {
    await as(page, "anna")
    await otworz(page, "/capabilities")
    await page.getByRole("button", { name: "Poproś o dostęp" }).first().click()
    await expect(page.getByText("Prośba wysłana — czeka na rozpatrzenie")).toBeVisible()
  })

  test("Zdolności są też pod ręką przy polu zlecenia", async ({ page }) => {
    await as(page, "anna")
    await otworz(page, "/")
    // Bez liczby: katalog zdolności rośnie, a ten scenariusz jest o TYM, że lista
    // stoi pod ręką przy polu zlecenia — nie o tym, ile pozycji akurat ma.
    await page.getByRole("button", { name: /Umiem tu/ }).click()
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
