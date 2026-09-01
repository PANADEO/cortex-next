import { expect, jako, test } from "./osoby"

/**
 * Nadania i prośby żyją w bazie, więc bez sprzątania kolejny przebieg zaczyna
 * z Anną, która ma już przyznane zdolności — i połowa scenariuszy przestaje mieć sens.
 */
test.beforeEach(async ({ request }) => {
  await request.post("/api/test/reset-uprawnien", { headers: { Cookie: "desk_persona=robert" } })
})

test.describe("Obszar 10 · Governance widać na ekranie", () => {
  test("Ekran nadzoru jest wyłącznie dla przełożonego", async ({ page }) => {
    await jako(page, "anna")
    const r = await page.goto("/nadzor")
    expect(r?.status()).toBe(404)

    await jako(page, "robert")
    await page.goto("/nadzor")
    await expect(page.getByRole("heading", { name: "Nadzór" })).toBeVisible()
  })

  test("Pracownik nie może przyznać zdolności sam sobie", async ({ request }) => {
    const naglowki = { Cookie: "desk_persona=anna" }
    await request.post("/api/prosba", { headers: naglowki, data: { zdolnosc: "arkusz.zapisz" } })
    const moje = await (await request.get("/api/prosba", { headers: naglowki })).json()
    const p = moje.prosby.find((x: { zdolnosc: string }) => x.zdolnosc === "arkusz.zapisz")

    const proba = await request.patch("/api/prosba", {
      headers: naglowki,
      data: { id: p.id, decyzja: "przyznana" },
    })
    expect(proba.status()).toBe(403)
  })

  test("Prośba przeżywa odświeżenie strony", async ({ page }) => {
    await jako(page, "anna")
    await page.goto("/co-potrafie")
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

    await jako(page, "anna")
    await page.goto("/co-potrafie")
    await expect(page.getByText("zgoda należy do działu: Finanse")).toBeVisible()
    await request.post("/api/prosba", { headers: annaH, data: { zdolnosc: "arkusz.zapisz" } })

    await jako(page, "robert")
    await page.goto("/nadzor")
    await expect(page.getByText('prosi o zdolność „Tworzenie arkuszy”')).toBeVisible()
    await page.getByRole("button", { name: "Przyznaj" }).first().click()
    await expect(page.getByText("ma teraz zdolność")).toBeVisible()

    // zakres Anny zmienił się naprawdę — nie tylko stan prośby
    await jako(page, "anna")
    await page.goto("/co-potrafie")
    await expect(page.getByText("zgoda należy do działu: Finanse")).toHaveCount(0)
    await expect(page.getByText("Tworzenie arkuszy")).toBeVisible()
  })

  test("Przełożony może cofnąć to, co przyznał", async ({ page, request }) => {
    const annaH = { Cookie: "desk_persona=anna" }
    await request.post("/api/prosba", { headers: annaH, data: { zdolnosc: "arkusz.zapisz" } })
    const wszystkie = await (
      await request.get("/api/prosba", { headers: { Cookie: "desk_persona=robert" } })
    ).json()
    const p = wszystkie.prosby.find(
      (x: { zdolnosc: string; stan: string }) =>
        x.zdolnosc === "arkusz.zapisz" && x.stan === "oczekuje",
    )
    await request.patch("/api/prosba", {
      headers: { Cookie: "desk_persona=robert" },
      data: { id: p.id, decyzja: "przyznana" },
    })

    await jako(page, "robert")
    await page.goto("/nadzor")
    await page.getByRole("button", { name: "Cofnij" }).first().click()
    await expect(page.getByText("cofnięta osobie")).toBeVisible()

    await jako(page, "anna")
    await page.goto("/co-potrafie")
    await expect(page.getByText("zgoda należy do działu: Finanse")).toBeVisible()
  })

  test("Dziennik mówi po polsku, nie surowym JSON-em", async ({ page, request }) => {
    await request.post("/api/prosba", {
      headers: { Cookie: "desk_persona=anna" },
      data: { zdolnosc: "obraz.generuj" },
    })
    await jako(page, "robert")
    await page.goto("/nadzor")
    const dziennik = page.getByRole("heading", { name: "Co się działo" })
    await expect(dziennik).toBeVisible()
    await expect(page.getByText('poprosiła o zdolność „Generowanie obrazów”').first()).toBeVisible()
    await expect(page.getByText(/\{"|\}/)).toHaveCount(0)
  })
})

test.describe("Obszar 28 · Dzienny limit pilnuje pieniędzy, nie oszacowania", () => {
  /**
   * Scenariusz spisany po zdarzeniu. `szacujKoszt` miał gałąź czytającą prawdziwy koszt
   * od dostawcy i gałąź zapasową ze stawkami wpisanymi w kod — i przez cały czas działała
   * ta druga, bo `usage.cost` jest polem SPOZA standardu OpenAI i SDK wyrzucało je przy
   * parsowaniu. Objawu nie było żadnego: liczba wyglądała rozsądnie, bo stawki zgadzały
   * się z modelem. Rozjechałaby się dopiero przy zmianie modelu — czyli wtedy, gdy nikt
   * już nie pamięta, że jest co sprawdzać.
   *
   * Dlatego zdarzenie `koszt` niesie teraz `skad` i to jego pilnuje ten scenariusz.
   */
  test("Koszt tury pochodzi od dostawcy, a nie ze stawek wpisanych w kod", { tag: "@model" }, async ({ request }) => {
    const annaH = { Cookie: "desk_persona=anna" }
    const { id } = await (
      await request.post("/api/sprawa/nowa", { headers: annaH, data: { tytul: "Koszt" } })
    ).json()
    const r = await request.post(`/api/sprawa/${id}/tura`, {
      headers: annaH,
      data: { tresc: "Ile to jest 17% z 4200 zł?" },
    })
    expect(r.status()).toBe(200)

    // Tura leci w tle — trasa oddaje 200 od razu po zapisaniu myśli, nie po skończeniu pracy.
    let d
    let stan = "pracuje"
    for (let i = 0; i < 40 && stan === "pracuje"; i++) {
      await new Promise((res) => setTimeout(res, 1500))
      d = await (await request.get(`/api/sprawa/${id}/zdarzenia?od=0`, { headers: annaH })).json()
      stan = d.sprawa.stan
    }
    expect(stan, `tura skończyła się stanem ${stan}: ${d?.sprawa?.powod ?? ""}`).toBe("gotowe")
    const koszt = d.zdarzenia.find((z: { event: { typ: string } }) => z.event.typ === "koszt")
    expect(koszt, "tura nie zapisała kosztu").toBeTruthy()

    // `skad`, a nie próg kwotowy: prawdziwy koszt i oszacowanie różnią się dziś o kilka
    // procent, bo stawki zapasowe są ustawione poprawnie. Test na kwotę przechodziłby
    // więc także wtedy, gdy biurko wróci do zgadywania — czyli nie sprawdzałby niczego.
    expect((koszt.event as { skad: string }).skad).toBe("dostawca")
    expect((koszt.event as { usd: number }).usd).toBeGreaterThan(0)
  })
})

test.describe("Obszar 11 · Granice, które można sprawdzić", () => {
  test("Kod w piaskownicy nie sięga po pliki spoza swojego katalogu", { tag: "@model" }, async ({ request }) => {
    test.setTimeout(180_000)
    const headers = { Cookie: "desk_persona=robert" }
    const r = await request.post("/api/sprawa/nowa", {
      headers,
      data: { tytul: "Granica piaskownicy" },
    })
    const { id } = await r.json()
    await request.post(`/api/sprawa/${id}/tura`, {
      headers,
      data: {
        tresc:
          "Uruchom obliczenia: wypisz zawartość katalogu '/etc' przez require('fs').readdirSync('/etc'). Powiedz wprost, czy się udało.",
      },
    })

    let stan = "pracuje"
    for (let i = 0; i < 60 && stan === "pracuje"; i++) {
      await new Promise((r) => setTimeout(r, 2000))
      stan = (await (await request.get(`/api/sprawa/${id}/zdarzenia?od=0`, { headers })).json())
        .sprawa.stan
    }
    const d = await (await request.get(`/api/sprawa/${id}/zdarzenia?od=0`, { headers })).json()
    const tekst = JSON.stringify(d.zdarzenia)
    // żaden wynik nie może zawierać nazw z katalogu systemowego
    expect(tekst).not.toMatch(/passwd|hosts\b/)
  })

  test("Ścieżka wychodząca poza biurko jest odrzucana", async ({ request }) => {
    const headers = { Cookie: "desk_persona=anna" }
    for (const s of [
      "../robert/Moje pliki/faktury-08.csv",
      "../../../../etc/passwd",
      "Moje pliki/../../robert/Moje pliki/faktury-08.csv",
    ]) {
      const r = await request.get(`/api/plik?sciezka=${encodeURIComponent(s)}`, { headers })
      expect(r.status()).toBe(404)
    }
  })

  test("Cudza sprawa jest zamknięta na wszystkie trzy sposoby", async ({ request }) => {
    const robertH = { Cookie: "desk_persona=robert" }
    const annaH = { Cookie: "desk_persona=anna" }
    const { id } = await (
      await request.post("/api/sprawa/nowa", { headers: robertH, data: { tytul: "Cudza" } })
    ).json()

    expect(
      (await request.get(`/api/sprawa/${id}/zdarzenia?od=0`, { headers: annaH })).status(),
    ).toBe(403)
    expect(
      (
        await request.post(`/api/sprawa/${id}/tura`, { headers: annaH, data: { tresc: "x" } })
      ).status(),
    ).toBe(403)
    const fd = new FormData()
    fd.append("sprawaId", id)
    fd.append("plik", new Blob(["x"]), "x.txt")
    expect(
      (
        await request.post("/api/pliki/wgraj", {
          headers: annaH,
          multipart: {
            sprawaId: id,
            plik: { name: "x.txt", mimeType: "text/plain", buffer: Buffer.from("x") },
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
    const tresc = "Żeby asystent pobierał wyciągi z systemu bankowego."

    await jako(page, "anna")
    await page.goto("/co-potrafie")
    await page.getByRole("button", { name: "Potrzebuję czegoś innego" }).click()
    await page.getByRole("textbox", { name: "Czego potrzebujesz" }).fill(tresc)
    await page.getByRole("button", { name: "Wyślij prośbę" }).click()
    await expect(page.getByText("Prośba poszła do przełożonego")).toBeVisible()

    await jako(page, "robert")
    await page.goto("/nadzor")
    await expect(page.getByText("prosi o coś, czego nie ma w katalogu")).toBeVisible()
    // dla takiej prośby nie ma czego nadać, więc „Przyznaj" nie istnieje
    const wiersz = page.locator("li", { hasText: "czego nie ma w katalogu" }).first()
    await expect(wiersz.getByText(tresc)).toBeVisible()
    await expect(wiersz.getByRole("button", { name: "Przyznaj" })).toHaveCount(0)
    await expect(wiersz.getByRole("button", { name: "Zamknij" })).toBeVisible()

    const proba = await request.patch("/api/prosba", {
      headers: robertH,
      data: {
        id: (await (await request.get("/api/prosba", { headers: annaH })).json()).prosby.find(
          (p: { zdolnosc: string; stan: string }) => p.zdolnosc === "inne" && p.stan === "oczekuje",
        ).id,
        decyzja: "przyznana",
      },
    })
    expect(proba.status()).toBe(400)
  })

  test("Katalog grupuje się działami, gdy jest co grupować", async ({ page }) => {
    // Anna ma zdolności wyłącznie „dla wszystkich" — nagłówek działu byłby szumem
    await jako(page, "anna")
    await page.goto("/co-potrafie")
    await expect(page.getByText("Dla wszystkich")).toHaveCount(0)

    // Robert ma zdolności z czterech działów — wtedy grupowanie zaczyna nieść informację
    await jako(page, "robert")
    await page.goto("/co-potrafie")
    await expect(page.getByText("Dla wszystkich")).toBeVisible()
    await expect(page.getByText("Finanse", { exact: true })).toBeVisible()
    await expect(page.getByText("Marketing", { exact: true })).toBeVisible()
  })
})

test.describe("Obszar 17 · Tożsamość wchodzi bramą, nie ciasteczkiem", () => {
  test("Nagłówek od bramy logowania wygrywa z ciasteczkiem persony", async ({ request }) => {
    // ciasteczko mówi „Robert", nagłówek mówi „Anna" — sprawa ma powstać na biurku Anny
    const r = await request.post("/api/sprawa/nowa", {
      headers: { Cookie: "desk_persona=robert", "x-auth-request-email": "anna@itsg.pl" },
      data: { tytul: "Czyja to sprawa" },
    })
    expect(r.ok()).toBeTruthy()
    const { id } = await r.json()

    const anna = await request.get(`/api/sprawa/${id}/zdarzenia`, {
      headers: { Cookie: "desk_persona=anna" },
    })
    expect(anna.status()).toBe(200)
    const robert = await request.get(`/api/sprawa/${id}/zdarzenia`, {
      headers: { Cookie: "desk_persona=robert" },
    })
    expect(robert.status()).toBe(403)
  })

  test("Nieznany adres z nagłówka nie dostaje cudzego biurka", async ({ request }) => {
    const r = await request.get("/api/pliki", {
      headers: { Cookie: "desk_persona=anna", "x-auth-request-email": "ktos@obcy.pl" },
    })
    // cicha podmiana na pierwszego z listy dawała obcemu pełne biurko Anny
    expect(r.status()).toBeGreaterThanOrEqual(400)
  })
})
