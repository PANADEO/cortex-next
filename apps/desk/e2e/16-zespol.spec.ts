import { as, expect, otworz, test } from "./osoby"

/**
 * Obszar 25 · ZESPÓŁ — governance przestaje być jednostronne.
 *
 * Do tej pory przełożony widział wyłącznie prośby: to, o co ktoś sam się upomniał.
 * Odebrać dało się tylko to, o co ktoś wcześniej poprosił, bo odebranie szło przez
 * wiersz prośby — czyli zdolności nadanej z własnej woli nie dało się cofnąć w ogóle.
 *
 * Najważniejszy scenariusz tego pliku to ten o ODEBRANIU. Pytanie „a da się to cofnąć?"
 * pada na każdej rozmowie o AI w firmie, zaraz po „a skąd wiem, co on zrobił?".
 */

const ARKUSZE = "sheet.write"
const jako = (who: "anna" | "robert") => ({ Cookie: `desk_persona=${who}` })

/** Stan wyjściowy: Anna nie ma arkuszy z roli, więc każdy ślad po nich jest nasz. */
test.beforeEach(async ({ request }) => {
  await request.post("/api/team", {
    headers: jako("robert"),
    data: { action: "revoke", who: "anna", capability: ARKUSZE },
  })
})

test.describe("Obszar 25 · Zespół widziany przez przełożonego", () => {
  test("Przełożony widzi ludzi, ich role i to, ile każdy może", async ({ request }) => {
    const r = await request.get("/api/team", { headers: jako("robert") })
    expect(r.status()).toBe(200)
    const { people } = await r.json()
    const anna = people.find((p: { id: string }) => p.id === "anna")
    expect(anna.role).toBe("member")
    expect(anna.department).toBe("accounting")
    expect(anna.granted.length + anna.blocked.length).toBeGreaterThan(5)
  })

  test("Pracownik nie widzi zespołu — i to jest odmowa, nie pusta lista", async ({ request }) => {
    const r = await request.get("/api/team", { headers: jako("anna") })
    expect(r.status()).toBe(403)
  })

  test("Nadanie zmienia to, co pracownik widzi u siebie", async ({ page, request }) => {
    await as(page, "anna")
    await otworz(page, "/capabilities")
    await expect(page.getByText("Tworzenie arkuszy")).toBeVisible()
    await expect(page.getByText("Na to nie masz jeszcze zgody:")).toBeVisible()

    const grant = await request.post("/api/team", {
      headers: jako("robert"),
      data: { action: "grant", who: "anna", capability: ARKUSZE },
    })
    expect(grant.ok()).toBe(true)

    await page.reload()
    // po nadaniu zdolność stoi wśród tych, które ma — a nie pod kłódką
    const owned = page.locator("li", { hasText: "Tworzenie arkuszy" }).first()
    await expect(owned.getByRole("button", { name: /Poproś o dostęp/ })).toHaveCount(0)
  })

  test("Odebranie NAPRAWDĘ odbiera, a nie tylko znika z ekranu przełożonego", async ({
    page,
    request,
  }) => {
    await request.post("/api/team", {
      headers: jako("robert"),
      data: { action: "grant", who: "anna", capability: ARKUSZE },
    })
    await request.post("/api/team", {
      headers: jako("robert"),
      data: { action: "revoke", who: "anna", capability: ARKUSZE },
    })

    // Sprawdzamy u ANNY, nie u Roberta: odebranie, które zmienia wyłącznie ekran
    // przełożonego, jest teatrem — a zdolność dalej trafiałaby do modelu.
    await as(page, "anna")
    await otworz(page, "/capabilities")
    const locked = page.locator("li", { hasText: "Tworzenie arkuszy" }).first()
    await expect(locked.getByRole("button", { name: /Poproś o dostęp/ })).toBeVisible()

    const after = await (await request.get("/api/team", { headers: jako("robert") })).json()
    const anna = after.people.find((p: { id: string }) => p.id === "anna")
    expect(anna.granted).not.toContain(ARKUSZE)
    expect(anna.grantedDirectly).not.toContain(ARKUSZE)
  })

  test("Zdolności z roli nie da się odebrać po jednej", async ({ request }) => {
    const { people } = await (await request.get("/api/team", { headers: jako("robert") })).json()
    const anna = people.find((p: { id: string }) => p.id === "anna")
    // `files.read` Anna ma z roli, więc jest w `granted`, ale nie w `grantedDirectly`.
    // Ekran pokazuje przy takiej pozycji „z roli" zamiast przycisku, bo odebranie
    // skasowałoby wiersz, którego nie ma, a zdolność wróciłaby przy następnym odczycie.
    expect(anna.granted).toContain("files.read")
    expect(anna.grantedDirectly).not.toContain("files.read")
  })

  test("Przełożony nie może odebrać roli sam sobie", async ({ request }) => {
    // Jedyny przełożony, który zdegraduje sam siebie, zamyka ten ekran przed wszystkimi
    // — łącznie z sobą, więc nie ma już jak tego cofnąć.
    const r = await request.post("/api/team", {
      headers: jako("robert"),
      data: { action: "role", who: "robert", role: "member" },
    })
    expect(r.status()).toBe(400)
    const { people } = await (await request.get("/api/team", { headers: jako("robert") })).json()
    expect(people.find((p: { id: string }) => p.id === "robert").role).toBe("management")
  })

  test("Obie decyzje zostawiają ślad w dzienniku, z autorem", async ({ page, request }) => {
    await request.post("/api/team", {
      headers: jako("robert"),
      data: { action: "grant", who: "anna", capability: ARKUSZE },
    })
    await request.post("/api/team", {
      headers: jako("robert"),
      data: { action: "revoke", who: "anna", capability: ARKUSZE },
    })
    await as(page, "robert")
    await otworz(page, "/supervision?section=log")
    // Bez zawężenia do listy: pasek boczny też jest listą i stoi w dokumencie pierwszy.
    await expect(page.getByText(/nadaje zdolność .* osobie Anna Kowalska/).first()).toBeVisible()
    await expect(page.getByText(/cofa zdolność .* osobie Anna Kowalska/).first()).toBeVisible()
    // autor decyzji stoi przy wpisie — dziennik bez autora nie jest dowodem
    await expect(page.getByText("Robert Nowak").first()).toBeVisible()
  })
})
