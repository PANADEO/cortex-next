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

  test("Limit dzienny da się ustawić jednej osobie i cofnąć do wartości z roli", async ({
    request,
  }) => {
    // Rola opisuje typową sytuację, a wyjątek dotyczy jednej osoby — nie ma powodu,
    // żeby awansować przez niego wszystkich o tej samej roli.
    const czytaj = async () => {
      const { people } = await (await request.get("/api/team", { headers: jako("robert") })).json()
      return people.find((p: { id: string }) => p.id === "anna")
    }
    const zRoli = (await czytaj()).dailyLimitUsd

    await request.post("/api/team", {
      headers: jako("robert"),
      data: { action: "limit", who: "anna", usd: 7.5 },
    })
    expect((await czytaj()).dailyLimitUsd).toBe(7.5)
    expect((await czytaj()).ownLimit).toBe(7.5)

    // `null` to POWRÓT DO ROLI, a nie zero: zero znaczyłoby „nie wolno ci nic".
    await request.post("/api/team", {
      headers: jako("robert"),
      data: { action: "limit", who: "anna", usd: null },
    })
    expect((await czytaj()).dailyLimitUsd).toBe(zRoli)
    expect((await czytaj()).ownLimit).toBeNull()

    const zly = await request.post("/api/team", {
      headers: jako("robert"),
      data: { action: "limit", who: "anna", usd: -3 },
    })
    expect(zly.status()).toBe(400)
  })

  test("Wyłączone konto nie wchodzi, ale jego sprawy zostają", async ({ page, request }) => {
    // Konto ZOSTAJE razem ze swoimi sprawami, dziennikiem i nadaniami — dowodu nie
    // kasuje się razem z odejściem człowieka z firmy. Wyłączone po prostu nie wchodzi.
    const przed = await (await request.get("/api/team", { headers: jako("robert") })).json()
    const ile = przed.people.length

    await request.post("/api/team", {
      headers: jako("robert"),
      data: { action: "active", who: "anna", active: false },
    })
    try {
      // Ekran mówi ZDANIE, a nie pokazuje strony błędu: to decyzja przełożonego,
      // nie awaria narzędzia.
      await as(page, "anna")
      await otworz(page, "/")
      await expect(page.getByText("To konto jest wyłączone.")).toBeVisible()

      const po = await (await request.get("/api/team", { headers: jako("robert") })).json()
      expect(po.people.length).toBe(ile)
      expect(po.people.find((p: { id: string }) => p.id === "anna").active).toBe(false)
    } finally {
      await request.post("/api/team", {
        headers: jako("robert"),
        data: { action: "active", who: "anna", active: true },
      })
    }
    await otworz(page, "/")
    await expect(page.getByText("To konto jest wyłączone.")).toHaveCount(0)
  })

  test("Przełożony nie może wyłączyć własnego konta", async ({ request }) => {
    const r = await request.post("/api/team", {
      headers: jako("robert"),
      data: { action: "active", who: "robert", active: false },
    })
    expect(r.status()).toBe(400)
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

test.describe("Obszar 25 · Wszystkie sprawy dają się przewertować", () => {
  test("Stronicowanie prowadzi do spraw, do których wcześniej nie dało się dojść", async ({
    page,
  }) => {
    // Poprzednie wydanie pokazywało dwieście najnowszych i uczciwie mówiło, ile ich
    // jest naprawdę — tylko że do reszty nie było ŻADNEJ drogi, więc sprawa sprzed
    // dwustu innych była w praktyce skasowana.
    await as(page, "anna")
    await otworz(page, "/cases")
    const pierwsza = await page.locator("main a[href*='/case/']").first().getAttribute("href")

    await page.getByRole("link", { name: /Starsze/ }).click()
    await expect(page.getByText(/Strona 2 z/)).toBeVisible()
    const druga = await page.locator("main a[href*='/case/']").first().getAttribute("href")
    expect(druga).not.toBe(pierwsza)

    // Numer strony siedzi w adresie, więc działa też przycisk wstecz.
    await page.goBack()
    await expect(page.getByText(/Strona 1 z/)).toBeVisible()
  })

  test("Numer strony spoza zakresu pokazuje ostatnią, a nie pustkę", async ({ page }) => {
    await as(page, "anna")
    await otworz(page, "/cases?strona=9999")
    const napis = await page.getByText(/Strona \d+ z \d+/).innerText()
    const [strona, ze] = napis.match(/\d+/g)!.map(Number)
    expect(strona).toBe(ze)
    await expect(page.locator("main a[href*='/case/']").first()).toBeVisible()
  })
})
