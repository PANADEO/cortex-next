import { as, expect, otworz, test } from "./osoby"

/**
 * Obszar 33 · SPISANE ZASADY FIRMY — pracownik je CZYTA, przełożony je WYDAJE.
 *
 * Ten obszar pilnuje trzech rzeczy, których nie widać w żadnym teście jednostkowym:
 *
 *  1. że pracownik widzi na ekranie dokładnie te zasady, które wchodzą do JEGO tury,
 *     i że nie ma stąd żadnej drogi do ich zmiany;
 *  2. że wydanie zostawia PODPIS — wydanie, nazwisko i datę — a zasiew uczciwie mówi,
 *     że go nie ma, zamiast podstawiać czyjekolwiek nazwisko;
 *  3. że wydatek trybu „przy każdym poleceniu" jest widoczny W CHWILI WYBORU, bo to
 *     jedyne miejsce w produkcie, w którym ten rachunek w ogóle widać.
 *
 * SCENARIUSZ PRACUJE NA PROCEDURZE Z ZASIEWU i świadomie nie zakłada nowej: nowa
 * zostawałaby w bazie po każdym przebiegu (procedury się nie kasuje — sprawy się na nią
 * powołują), więc po dziesiątej bramce ekran przełożonego byłby ścianą śmieci z testów.
 * Kolejne wydanie tej samej jest za to idempotentne: przybywa wiersz w historii, nie rzecz.
 */

const ROBERT = { Cookie: "desk_persona=robert" }
const ANNA = { Cookie: "desk_persona=anna" }

const VAT = "Zestawienie VAT"

test.describe("Obszar 33 · Jak to robimy — zasady firmy na ekranie", () => {
  test.afterAll(async ({ request }) => {
    // Przebieg przerwany w połowie zostawiłby procedurę wycofaną, a następny przebieg
    // szukałby jej na ekranie pracownika i nie znalazł — czyli czerwień nie o tym, o czym
    // ten plik jest. Przywrócenie idzie trasą, bo ma się udać także wtedy, gdy ekran padł.
    await request.post("/api/procedures/supervision", {
      headers: ROBERT,
      data: { action: "restore", name: "zestawienie-vat" },
    })
  })

  test("Pracownik widzi zasady swojego działu i ani jednej cudzej", async ({ page, request }) => {
    await as(page, "anna")
    await otworz(page, "/procedures")

    await expect(page.getByRole("heading", { name: "Jak to robimy" })).toBeVisible()
    await expect(page.getByText("Zasady naszej firmy")).toBeVisible()
    await expect(page.getByText(VAT, { exact: true })).toBeVisible()

    // Ta sama prawda po stronie trasy, nie tylko w rysunku: zasięg liczy serwer.
    const mine = await (await request.get("/api/procedures", { headers: ANNA })).json()
    const names: string[] = mine.procedures.map((p: { name: string }) => p.name)
    expect(names).toContain("zestawienie-vat")
    expect(names).toContain("zasady-firmy")

    // Robert jest z zarządu, więc procedura księgowości NIE wchodzi do jego tury —
    // i ekran ma to odzwierciedlać, bo mówi „według czego pracuję JA".
    const his = await (await request.get("/api/procedures", { headers: ROBERT })).json()
    expect(his.procedures.map((p: { name: string }) => p.name)).not.toContain("zestawienie-vat")
  })

  test("Zasada z zasiewu mówi wprost, że nikt jej nie podpisał", async ({ request }) => {
    const mine = await (await request.get("/api/procedures", { headers: ANNA })).json()
    const seeded = mine.procedures.find((p: { name: string }) => p.name === "zasady-firmy")
    expect(seeded.signedBy).toBeNull()
  })

  test("Pracownik nie wyda ani nie wycofa procedury, choćby zawołał trasę z palca", async ({
    request,
  }) => {
    expect((await request.get("/api/procedures/supervision", { headers: ANNA })).status()).toBe(403)

    const wydanie = await request.post("/api/procedures/supervision", {
      headers: ANNA,
      data: {
        action: "publish",
        title: "Zasada podrzucona przez pracownika",
        description: "Nie powinna powstać.",
        loading: "always",
        paths: "",
        scope: [],
        body: "Cokolwiek.",
      },
    })
    expect(wydanie.status()).toBe(403)

    const wycofanie = await request.post("/api/procedures/supervision", {
      headers: ANNA,
      data: { action: "withdraw", name: "zestawienie-vat" },
    })
    expect(wycofanie.status()).toBe(403)

    // Odmowa PO zapisie wygląda tak samo jak odmowa przed nim — sprawdzamy skutek.
    const dalej = await (await request.get("/api/procedures", { headers: ANNA })).json()
    expect(dalej.procedures.map((p: { name: string }) => p.name)).toContain("zestawienie-vat")
  })

  test("Przełożony wydaje nowe wydanie, a pracownik widzi je z nazwiskiem i datą", async ({
    page,
    request,
  }) => {
    await as(page, "robert")
    await otworz(page, "/supervision?section=procedures")

    // Trzecia karta to „Zestawienie VAT" — lista jest ułożona po tytule, a kolejność
    // trzymają procedury z zasiewu, nie ten scenariusz.
    await page.getByRole("button", { name: "Wydaj nowe wydanie" }).nth(2).click()
    await expect(page.getByText(`Nowe wydanie: ${VAT}`)).toBeVisible()

    const tresc = page.getByRole("textbox").last()
    await tresc.fill(
      "1. Bierzemy WSZYSTKIE faktury z miesiąca.\n2. Sumujemy osobno w każdej stawce.\n3. Brak NIP wypisujemy osobno, nie zgadujemy.",
    )
    await page.getByRole("button", { name: "Wydaj", exact: true }).click()
    await expect(page.getByText(/Wydane: Zestawienie VAT · wydanie \d+/)).toBeVisible()

    // Podpis widzi PRACOWNIK — to jego ekran jest dowodem należytej staranności.
    await as(page, "anna")
    await otworz(page, "/procedures")
    await expect(
      page.getByText(/wydanie \d+ · wydał Robert Nowak · \d{2}\.\d{2}\.\d{4}/),
    ).toBeVisible()

    // Historia wydań: po tym przebiegu jest ich co najmniej dwa.
    const wszystkie = await (
      await request.get("/api/procedures/supervision", { headers: ROBERT })
    ).json()
    const vat = wszystkie.procedures.find((p: { name: string }) => p.name === "zestawienie-vat")
    expect(vat.editions.length).toBeGreaterThan(1)
    expect(vat.editions[0].signedBy).toBe("Robert Nowak")
  })

  test("Wycofanie zabiera zasadę z ekranu pracownika, przywrócenie ją oddaje", async ({
    page,
    request,
  }) => {
    await as(page, "robert")
    await otworz(page, "/supervision?section=procedures")
    await page.getByRole("button", { name: "Wycofaj" }).nth(2).click()
    await expect(page.getByText(/Wycofane: Zestawienie VAT/)).toBeVisible()

    const bez = await (await request.get("/api/procedures", { headers: ANNA })).json()
    expect(bez.procedures.map((p: { name: string }) => p.name)).not.toContain("zestawienie-vat")

    // Wycofana ZOSTAJE u przełożonego — sprawy sprzed wycofania powołują się na nią.
    await expect(page.getByText("wycofana")).toBeVisible()

    await page.getByRole("button", { name: "Przywróć" }).click()
    await expect(page.getByText(/Przywrócone: Zestawienie VAT/)).toBeVisible()
    const znowu = await (await request.get("/api/procedures", { headers: ANNA })).json()
    expect(znowu.procedures.map((p: { name: string }) => p.name)).toContain("zestawienie-vat")
  })

  test("Wybór „przy każdym poleceniu” pokazuje, ile znaków to dokłada", async ({ page }) => {
    await as(page, "robert")
    await otworz(page, "/supervision?section=procedures")

    // Sekcja niesie rachunek per dział, zanim ktokolwiek cokolwiek napisze.
    await expect(page.getByText("Ile to dokłada do każdego polecenia")).toBeVisible()
    await expect(page.getByText(/\d+ znaków/).first()).toBeVisible()

    await page.getByRole("button", { name: "Napisz nową procedurę" }).click()
    await page.getByRole("radio").nth(1).check()
    await page.getByRole("textbox").first().fill("Zasada na próbę")
    await page.getByRole("textbox").last().fill("Kwoty zapisujemy po polsku, z przecinkiem.")

    // Liczba pada W CHWILI WYBORU, nie po wydaniu — decyzja o wydatku ma być podjęta
    // przed jego poniesieniem, a nie po fakturze za miesiąc.
    await expect(page.getByText(/Ta zasada dołoży \d+ znak/)).toBeVisible()

    // Nic nie wydajemy: ten scenariusz sprawdza licznik, nie zapis.
    await page.getByRole("button", { name: "Anuluj" }).click()
  })

  test("Żadna sekcja nadzoru nie chowa się poza kadrem listwy", async ({ page }) => {
    /**
     * Dołożenie zakładki „Procedury" przesunęło listwę do 719 px przy 680 px szerokości
     * strumienia, więc OSTATNIA sekcja („Dziennik") wypadała poza kadr — i to na KAŻDEJ
     * szerokości okna, także na 1600 px, bo strona jest zaklejona na szerokości czytania.
     * Listwa miała `overflow-x-auto`, czyli dawała się przewinąć, ale nie mówiła o tym
     * ani jednym znakiem. Dla tej persony sekcja, której nie widać, po prostu nie istnieje.
     *
     * Strażnik mierzy KRAWĘDZIE, nie liczbę zakładek: reguła ma przeżyć ósmą i dziesiątą.
     */
    await as(page, "robert")
    await otworz(page, "/supervision?section=procedures")
    const listwa = page.getByRole("navigation", { name: "Sekcje nadzoru" })
    await expect(listwa).toBeVisible()

    for (const width of [1440, 1024, 390]) {
      await page.setViewportSize({ width, height: 900 })
      const outside = await listwa.evaluate((nav) => {
        const box = nav.getBoundingClientRect()
        return [...nav.children]
          .filter((one) => {
            const r = one.getBoundingClientRect()
            // Jeden piksel luzu na zaokrąglenia układu.
            return r.right > box.right + 1 || r.left < box.left - 1
          })
          .map((one) => one.textContent?.trim() ?? "")
      })
      expect(outside, `przy ${width} px sekcja wypada poza listwę`).toEqual([])
    }

    // Kontrola dodatnia: strażnik mierzy prawdziwą listwę, a nie pusty element.
    await expect(listwa.getByRole("link")).toHaveCount(7)
  })
})
