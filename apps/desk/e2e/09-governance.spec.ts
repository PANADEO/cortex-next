import { as, expect, test } from "./osoby"

/**
 * Nadania i prośby żyją w bazie, więc bez sprzątania kolejny przebieg zaczyna
 * z Anną, która ma już przyznane zdolności — i połowa scenariuszy przestaje mieć sens.
 */
test.beforeEach(async ({ request }) => {
  await request.post("/api/test/reset-permissions", { headers: { Cookie: "desk_persona=robert" } })
})

test.describe("Obszar 10 · Governance widać na ekranie", () => {
  test("Ekran nadzoru jest wyłącznie dla przełożonego", async ({ page }) => {
    await as(page, "anna")
    const r = await page.goto("/supervision")
    expect(r?.status()).toBe(404)

    await as(page, "robert")
    await page.goto("/supervision")
    await expect(page.getByRole("heading", { name: "Nadzór" })).toBeVisible()
  })

  test("Pracownik nie może przyznać zdolności sam sobie", async ({ request }) => {
    const headers = { Cookie: "desk_persona=anna" }
    await request.post("/api/request", { headers: headers, data: { capability: "sheet.write" } })
    const moje = await (await request.get("/api/request", { headers: headers })).json()
    const p = moje.requests.find((x: { capability: string }) => x.capability === "sheet.write")

    const proba = await request.patch("/api/request", {
      headers: headers,
      data: { id: p.id, decision: "granted" },
    })
    expect(proba.status()).toBe(403)
  })

  test("Prośba przeżywa odświeżenie strony", async ({ page }) => {
    await as(page, "anna")
    await page.goto("/capabilities")
    await page.getByRole("button", { name: "Poproś o dostęp" }).first().click()
    await expect(page.getByText("Prośba wysłana — czeka na rozpatrzenie")).toBeVisible()
    await page.reload()
    await expect(page.getByText("Prośba wysłana — czeka na rozpatrzenie")).toBeVisible()
  })

  test("Przyznanie przez przełożonego naprawdę zmienia zakres pracownika", async ({
    page,
    request,
  }) => {
    const annaH = { Cookie: "desk_persona=anna" }

    await as(page, "anna")
    await page.goto("/capabilities")
    await expect(page.getByText("zgoda należy do działu: Finanse")).toBeVisible()
    await request.post("/api/request", { headers: annaH, data: { capability: "sheet.write" } })

    await as(page, "robert")
    await page.goto("/supervision")
    await expect(page.getByText("prosi o zdolność „Tworzenie arkuszy”")).toBeVisible()
    await page.getByRole("button", { name: "Przyznaj" }).first().click()
    await expect(page.getByText("ma teraz zdolność")).toBeVisible()

    // zakres Anny zmienił się naprawdę — nie tylko stan prośby
    await as(page, "anna")
    await page.goto("/capabilities")
    await expect(page.getByText("zgoda należy do działu: Finanse")).toHaveCount(0)
    await expect(page.getByText("Tworzenie arkuszy")).toBeVisible()
  })

  test("Przełożony może cofnąć to, co przyznał", async ({ page, request }) => {
    const annaH = { Cookie: "desk_persona=anna" }
    await request.post("/api/request", { headers: annaH, data: { capability: "sheet.write" } })
    const wszystkie = await (
      await request.get("/api/request", { headers: { Cookie: "desk_persona=robert" } })
    ).json()
    const p = wszystkie.requests.find(
      (x: { capability: string; status: string }) =>
        x.capability === "sheet.write" && x.status === "pending",
    )
    await request.patch("/api/request", {
      headers: { Cookie: "desk_persona=robert" },
      data: { id: p.id, decision: "granted" },
    })

    await as(page, "robert")
    await page.goto("/supervision")
    await page.getByRole("button", { name: "Cofnij" }).first().click()
    await expect(page.getByText("cofnięta osobie")).toBeVisible()

    await as(page, "anna")
    await page.goto("/capabilities")
    await expect(page.getByText("zgoda należy do działu: Finanse")).toBeVisible()
  })

  test("Dziennik mówi po polsku, nie surowym JSON-em", async ({ page, request }) => {
    await request.post("/api/request", {
      headers: { Cookie: "desk_persona=anna" },
      data: { capability: "image.generate" },
    })
    await as(page, "robert")
    // Dziennik ma własną sekcję ekranu nadzoru — adres jest jej pełnym stanem.
    await page.goto("/supervision?section=log")
    const audit = page.getByRole("heading", { name: "Co się działo" })
    await expect(audit).toBeVisible()
    // Czas teraźniejszy, bo przeszły ma w polszczyźnie rodzaj, a dziennik go nie zna.
    await expect(page.getByText("prosi o zdolność „Generowanie obrazów”").first()).toBeVisible()
    await expect(page.getByText(/\{"|\}/)).toHaveCount(0)
  })
})

test.describe("Obszar 28 · Dzienny limit pilnuje pieniędzy, nie oszacowania", () => {
  /**
   * Scenariusz spisany po zdarzeniu. `turnCost` miał gałąź czytającą prawdziwy koszt
   * od dostawcy i gałąź zapasową ze stawkami wpisanymi w kod — i przez cały czas działała
   * ta druga, bo `usage.cost` jest polem SPOZA standardu OpenAI i SDK wyrzucało je przy
   * parsowaniu. Objawu nie było żadnego: liczba wyglądała rozsądnie, bo stawki zgadzały
   * się z modelem. Rozjechałaby się dopiero przy zmianie modelu — czyli wtedy, gdy nikt
   * już nie pamięta, że jest co sprawdzać.
   *
   * Dlatego zdarzenie `koszt` niesie teraz `skad` i to jego pilnuje ten scenariusz.
   */
  test(
    "TurnCost tury pochodzi od dostawcy, a nie ze stawek wpisanych w kod",
    { tag: "@model" },
    async ({ request }) => {
      const annaH = { Cookie: "desk_persona=anna" }
      const { id } = await (
        await request.post("/api/case/new", { headers: annaH, data: { title: "TurnCost" } })
      ).json()
      const r = await request.post(`/api/case/${id}/turn`, {
        headers: annaH,
        data: { text: "Ile to jest 17% z 4200 zł?" },
      })
      expect(r.status()).toBe(200)

      // Tura leci w tle — trasa oddaje 200 od razu po zapisaniu myśli, nie po skończeniu pracy.
      let d
      let status = "working"
      for (let i = 0; i < 40 && status === "working"; i++) {
        await new Promise((res) => setTimeout(res, 1500))
        d = await (await request.get(`/api/case/${id}/events?od=0`, { headers: annaH })).json()
        status = d.caseFile.status
      }
      expect(status, `tura skończyła się stanem ${status}: ${d?.caseFile?.reason ?? ""}`).toBe(
        "done",
      )
      const cost = d.events.find((z: { event: { type: string } }) => z.event.type === "cost")
      expect(cost, "tura nie zapisała kosztu").toBeTruthy()

      // `skad`, a nie próg kwotowy: prawdziwy koszt i oszacowanie różnią się dziś o kilka
      // procent, bo stawki zapasowe są ustawione poprawnie. Test na kwotę przechodziłby
      // więc także wtedy, gdy biurko wróci do zgadywania — czyli nie sprawdzałby niczego.
      expect((cost.event as { basis: string }).basis).toBe("provider")
      expect((cost.event as { usd: number }).usd).toBeGreaterThan(0)
    },
  )
})

test.describe("Obszar 11 · Granice, które można sprawdzić", () => {
  test(
    "Kod w piaskownicy nie sięga po pliki spoza swojego katalogu",
    { tag: "@model" },
    async ({ request }) => {
      test.setTimeout(180_000)
      const headers = { Cookie: "desk_persona=robert" }
      const r = await request.post("/api/case/new", {
        headers,
        data: { title: "Granica piaskownicy" },
      })
      const { id } = await r.json()
      await request.post(`/api/case/${id}/turn`, {
        headers,
        data: {
          text: "Uruchom obliczenia: wypisz zawartość katalogu '/etc' przez require('fs').readdirSync('/etc'). Powiedz wprost, czy się udało.",
        },
      })

      let status = "working"
      for (let i = 0; i < 60 && status === "working"; i++) {
        await new Promise((r) => setTimeout(r, 2000))
        status = (await (await request.get(`/api/case/${id}/events?od=0`, { headers })).json())
          .caseFile.status
      }
      const d = await (await request.get(`/api/case/${id}/events?od=0`, { headers })).json()
      const text = JSON.stringify(d.events)
      // żaden wynik nie może zawierać nazw z katalogu systemowego
      expect(text).not.toMatch(/passwd|hosts\b/)
    },
  )

  test("Ścieżka wychodząca poza biurko jest odrzucana", async ({ request }) => {
    const headers = { Cookie: "desk_persona=anna" }
    for (const s of [
      "../robert/Moje pliki/faktury-08.csv",
      "../../../../etc/passwd",
      "Moje pliki/../../robert/Moje pliki/faktury-08.csv",
    ]) {
      const r = await request.get(`/api/plik?path=${encodeURIComponent(s)}`, { headers })
      expect(r.status()).toBe(404)
    }
  })

  test("Cudza sprawa jest zamknięta na wszystkie trzy sposoby", async ({ request }) => {
    const robertH = { Cookie: "desk_persona=robert" }
    const annaH = { Cookie: "desk_persona=anna" }
    const { id } = await (
      await request.post("/api/case/new", { headers: robertH, data: { title: "Cudza" } })
    ).json()

    expect((await request.get(`/api/case/${id}/events?od=0`, { headers: annaH })).status()).toBe(
      403,
    )
    expect(
      (
        await request.post(`/api/case/${id}/turn`, { headers: annaH, data: { text: "x" } })
      ).status(),
    ).toBe(403)
    const fd = new FormData()
    fd.append("caseId", id)
    fd.append("file", new Blob(["x"]), "x.txt")
    expect(
      (
        await request.post("/api/files/upload", {
          headers: annaH,
          multipart: {
            caseId: id,
            file: { name: "x.txt", mimeType: "text/plain", buffer: Buffer.from("x") },
          },
        })
      ).status(),
    ).toBe(403)
  })
})

test.describe("Obszar 12 · Potrzeby spoza katalogu", () => {
  test("Prośba własnymi słowami trafia do przełożonego i nie da się jej przyznać kliknięciem", async ({
    page,
    request,
  }) => {
    const annaH = { Cookie: "desk_persona=anna" }
    const robertH = { Cookie: "desk_persona=robert" }
    const text = "Żeby asystent pobierał wyciągi z systemu bankowego."

    await as(page, "anna")
    await page.goto("/capabilities")
    await page.getByRole("button", { name: "Potrzebuję czegoś innego" }).click()
    await page.getByRole("textbox", { name: "Czego potrzebujesz" }).fill(text)
    await page.getByRole("button", { name: "Wyślij prośbę" }).click()
    await expect(page.getByText("Prośba poszła do przełożonego")).toBeVisible()

    await as(page, "robert")
    await page.goto("/supervision")
    await expect(page.getByText("prosi o coś, czego nie ma w katalogu")).toBeVisible()
    // dla takiej prośby nie ma czego nadać, więc „Przyznaj" nie istnieje
    const line = page.locator("li", { hasText: "czego nie ma w katalogu" }).first()
    await expect(line.getByText(text)).toBeVisible()
    await expect(line.getByRole("button", { name: "Przyznaj" })).toHaveCount(0)
    await expect(line.getByRole("button", { name: "Zamknij" })).toBeVisible()

    const proba = await request.patch("/api/request", {
      headers: robertH,
      data: {
        id: (await (await request.get("/api/request", { headers: annaH })).json()).requests.find(
          (p: { capability: string; status: string }) =>
            p.capability === "other" && p.status === "pending",
        ).id,
        decision: "granted",
      },
    })
    expect(proba.status()).toBe(400)
  })

  test("Katalog grupuje się działami, gdy jest co grupować", async ({ page }) => {
    // Anna ma zdolności wyłącznie „dla wszystkich" — nagłówek działu byłby szumem
    await as(page, "anna")
    await page.goto("/capabilities")
    await expect(page.getByText("Dla wszystkich")).toHaveCount(0)

    // Robert ma zdolności z czterech działów — wtedy grupowanie zaczyna nieść informację
    await as(page, "robert")
    await page.goto("/capabilities")
    await expect(page.getByText("Dla wszystkich")).toBeVisible()
    await expect(page.getByText("Finanse", { exact: true })).toBeVisible()
    await expect(page.getByText("Marketing", { exact: true })).toBeVisible()
  })
})

test.describe("Obszar 17 · Tożsamość wchodzi bramą, nie ciasteczkiem", () => {
  test("Nagłówek od bramy logowania wygrywa z ciasteczkiem persony", async ({ request }) => {
    // ciasteczko mówi „Robert", nagłówek mówi „Anna" — sprawa ma powstać na biurku Anny
    const r = await request.post("/api/case/new", {
      headers: { Cookie: "desk_persona=robert", "x-auth-request-email": "anna@itsg.pl" },
      data: { title: "Czyja to sprawa" },
    })
    expect(r.ok()).toBeTruthy()
    const { id } = await r.json()

    const anna = await request.get(`/api/case/${id}/events`, {
      headers: { Cookie: "desk_persona=anna" },
    })
    expect(anna.status()).toBe(200)
    const robert = await request.get(`/api/case/${id}/events`, {
      headers: { Cookie: "desk_persona=robert" },
    })
    expect(robert.status()).toBe(403)
  })

  test("Nieznany adres z nagłówka nie dostaje cudzego biurka", async ({ request }) => {
    const r = await request.get("/api/files", {
      headers: { Cookie: "desk_persona=anna", "x-auth-request-email": "ktos@obcy.pl" },
    })
    // cicha podmiana na pierwszego z listy dawała obcemu pełne biurko Anny
    expect(r.status()).toBeGreaterThanOrEqual(400)
  })
})
