import type { DeskEvent } from "@cortex/desk-core/types"
import { makeDeskT } from "@cortex/desk-ui/i18n/locale"
import type { APIRequestContext } from "@playwright/test"
import { as, expect, otworz, test } from "./osoby"

/** Zlecenie czyta człowiek po polsku — bierzemy je ze słownika, nie z parafrazy. */
const pl = makeDeskT("pl")

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

// Zdolność użyta w tych scenariuszach musi być taka, której rola startowa NIE MA —
// inaczej „przyznanie" i „odebranie" nie mają czego zmienić i test przechodzi na pusto.
// Do 02.09.2026 stały tu arkusze (`sheet.write`); decyzją właściciela produktu weszły
// do roli `member`, bo bez nich pani Basia trafiała na kłódkę w swoim najczęstszym
// zadaniu. `counterparty.verify` zostaje przy przełożonym — patrz `starting-role.test.ts`.
const KONTRAHENCI = "counterparty.verify"
const jako = (who: "anna" | "robert") => ({ Cookie: `desk_persona=${who}` })

/** Stan wyjściowy: Anna nie ma arkuszy z roli, więc każdy ślad po nich jest nasz. */
test.beforeEach(async ({ request }) => {
  await request.post("/api/team", {
    headers: jako("robert"),
    data: { action: "revoke", who: "anna", capability: KONTRAHENCI },
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
    await expect(page.getByText("Sprawdzanie kontrahenta w wykazie VAT")).toBeVisible()
    await expect(page.getByText("Na to nie masz jeszcze zgody:")).toBeVisible()

    const grant = await request.post("/api/team", {
      headers: jako("robert"),
      data: { action: "grant", who: "anna", capability: KONTRAHENCI },
    })
    expect(grant.ok()).toBe(true)

    await page.reload()
    // po nadaniu zdolność stoi wśród tych, które ma — a nie pod kłódką
    const owned = page.locator("li", { hasText: "Sprawdzanie kontrahenta w wykazie VAT" }).first()
    await expect(owned.getByRole("button", { name: /Poproś o dostęp/ })).toHaveCount(0)
  })

  test("Odebranie NAPRAWDĘ odbiera, a nie tylko znika z ekranu przełożonego", async ({
    page,
    request,
  }) => {
    await request.post("/api/team", {
      headers: jako("robert"),
      data: { action: "grant", who: "anna", capability: KONTRAHENCI },
    })
    await request.post("/api/team", {
      headers: jako("robert"),
      data: { action: "revoke", who: "anna", capability: KONTRAHENCI },
    })

    // Sprawdzamy u ANNY, nie u Roberta: odebranie, które zmienia wyłącznie ekran
    // przełożonego, jest teatrem — a zdolność dalej trafiałaby do modelu.
    await as(page, "anna")
    await otworz(page, "/capabilities")
    const locked = page.locator("li", { hasText: "Sprawdzanie kontrahenta w wykazie VAT" }).first()
    await expect(locked.getByRole("button", { name: /Poproś o dostęp/ })).toBeVisible()

    const after = await (await request.get("/api/team", { headers: jako("robert") })).json()
    const anna = after.people.find((p: { id: string }) => p.id === "anna")
    expect(anna.granted).not.toContain(KONTRAHENCI)
    expect(anna.grantedDirectly).not.toContain(KONTRAHENCI)
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
      data: { action: "grant", who: "anna", capability: KONTRAHENCI },
    })
    await request.post("/api/team", {
      headers: jako("robert"),
      data: { action: "revoke", who: "anna", capability: KONTRAHENCI },
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

/**
 * Obszar 25 · ZLECENIE Z PUSTEGO EKRANU MUSI SIĘ UDAĆ ROLĄ STARTOWĄ.
 *
 * DLACZEGO TO STOI OSOBNO OD `starting-role.test.ts`. Tamten test czyta zasiew i sprawdza,
 * czy zlecenie da się złożyć ze zdolności, które rola ma. To jest sprawdzenie NA PAPIERZE
 * i nie umie odpowiedzieć na jedyne pytanie, które naprawdę boli: czy agent, postawiony
 * przed tym zdaniem i pozbawiony `code.run`, dowiezie arkusz — czy zgłosi brak i pani Basia
 * zobaczy w pierwszej minucie kłódkę zamiast wyniku.
 *
 * Odpowiedzi nie da się wyprowadzić z kodu, bo zależy od decyzji modelu w turze. Stąd
 * `@model`: scenariusz kosztuje pieniądze i stoi poza `gate:desk`.
 *
 * ZARZUT, KTÓRY TO ZAMYKA. Zlecenia startowe mówią „policz", a `CAPABILITY_HINTS`
 * w `runtime.ts` mapuje „policz" na `code.run`, którego rola startowa nie ma. Z samego
 * zestawienia tych dwóch miejsc wychodzi, że trzy z pięciu zleceń prowadzą do kłódki —
 * i to była teza do sprawdzenia, a nie fakt: `HINTS` służy NAZWANIU zdolności w chwili
 * zgłoszenia braku, nie jej wymaganiu, a `run_computation` w ogóle nie trafia do modelu
 * bez zdolności (filtr na odkryciu, `runtime.ts`). Sprawdzamy więc zachowanie, nie kod.
 */
test.describe("Obszar 25 · Zlecenie startowe kończy się wynikiem, nie kłódką", () => {
  const ANNA = { Cookie: "desk_persona=anna" }

  /**
   * SUMY POLICZONE NIEZALEŻNIE OD MODELU, z `Moje pliki/faktury-08.csv`, po kategoriach.
   * To jest sedno całego pomiaru: pytanie brzmi „czy pani Basia dostanie POPRAWNE liczby
   * bez piaskownicy", a nie „czy powstanie plik". Pierwsza wersja tego scenariusza
   * sprawdzała samo powstanie pliku i przeszłaby też wtedy, gdyby model policzył źle —
   * czyli w jedynym przypadku, o który tu naprawdę chodzi.
   */
  const KATEGORIE = [
    { nazwa: "Materiały biurowe", netto: 1702.5, brutto: 2094.08 },
    { nazwa: "Podróże służbowe", netto: 2536.9, brutto: 2761.65 },
    { nazwa: "Telekomunikacja", netto: 899, brutto: 1105.77 },
    { nazwa: "Usługi IT", netto: 6100, brutto: 7503 },
    { nazwa: "Usługi prawne", netto: 8500, brutto: 10455 },
    { nazwa: "Paliwo", netto: 712.3, brutto: 876.13 },
  ]

  /**
   * „1 702,50", „1702.5", „1702,50" to ta sama liczba — porównujemy po znormalizowaniu.
   *
   * GRANICA CYFRY jest tu istotna i kosztowała jedno wstrzyknięcie: bez niej zwykłe
   * `includes("712.30")` znajdowało tę liczbę w napisie „1712.30", więc podmieniona suma
   * kategorii przechodziła jako poprawna. Sprawdzian, który daje się oszukać cyfrą
   * dopisaną z przodu, nie sprawdza rachunku.
   */
  const mowiLiczbe = (tekst: string, wartosc: number) => {
    const bezOdstepow = tekst.replace(/[\s\u00a0]/g, "")
    return [wartosc.toFixed(2), String(wartosc)].some((forma) =>
      [forma, forma.replace(".", ",")].some((wariant) =>
        new RegExp(`(?<!\\d)${wariant.replace(/[.]/g, "\\.")}(?!\\d)`).test(bezOdstepow),
      ),
    )
  }

  /** Ta sama droga, którą jedzie tura z ekranu — bez przeglądarki, bo pytamy o zdarzenia. */
  async function tura(request: APIRequestContext, title: string, text: string) {
    const { id } = await (
      await request.post("/api/case/new", { headers: ANNA, data: { title } })
    ).json()
    const start = await request.post(`/api/case/${id}/turn`, { headers: ANNA, data: { text } })
    if (!start.ok())
      throw new Error(`tura odrzucona (${start.status()}): ${(await start.text()).slice(0, 200)}`)
    for (let i = 0; i < 90; i++) {
      await new Promise((r) => setTimeout(r, 2000))
      const d = await (await request.get(`/api/case/${id}/events`, { headers: ANNA })).json()
      if (d.caseFile.status !== "working" && d.caseFile.status !== "new")
        return { id, status: d.caseFile.status as string, events: d.events as { event: DeskEvent }[] }
    }
    throw new Error("tura się nie skończyła")
  }

  /**
   * ZLECENIA Z PUSTEGO EKRANU, KTÓRE MÓWIĄ „POLICZ" — wszystkie trzy, nie jedno.
   *
   * Zarzut dotyczył całej trójki: `CAPABILITY_HINTS` w `runtime.ts` mapuje „policz" na
   * `code.run`, którego rola startowa nie ma. Zmierzenie jednego zlecenia i rozciągnięcie
   * wniosku na pozostałe dwa byłoby dokładnie tym rozumowaniem, które ten scenariusz
   * miał zastąpić pomiarem.
   */
  const ZLECENIA = [
    { id: "expensesSheet", narzedzie: "write_sheet", liczy: true },
    { id: "expensesDocument", narzedzie: "write_document", liczy: true },
    { id: "analysis", narzedzie: "write_document", liczy: true },
  ]

  test.describe("Zlecenia startowe pani Basi", () => {
    test.beforeAll(async ({ request }) => {
      // WARUNEK WSTĘPNY POMIARU: Anna NIE MA `code.run`. Bez tego scenariusz przeszedłby
      // również z przypadkowym nadaniem — czyli mierzyłby coś innego, niż obiecuje.
      const { people } = await (
        await request.get("/api/team", { headers: { Cookie: "desk_persona=robert" } })
      ).json()
      const anna = people.find((x: { id: string }) => x.id === "anna")
      expect(anna.granted, "pomiar ma sens tylko wtedy, gdy Anna NIE MA code.run").not.toContain(
        "code.run",
      )
    })

    for (const zlecenie of ZLECENIA) {
      test(
        `„${zlecenie.id}" kończy się wynikiem, nie prośbą o dostęp`,
        { tag: "@model" },
        async ({ request }) => {
          test.setTimeout(240_000)

          // TEKST ZE SŁOWNIKA, nie z parafrazy: gdyby ktoś przepisał zlecenie na takie,
          // którego rola nie unosi, ten scenariusz ma spaść.
          const tresc = pl(`quickTask.${zlecenie.id}.text`)
          expect(tresc, "to zlecenie miało mówić „policz”").toMatch(/policz/i)

          // Bez pliku z fakturami nie ma czego liczyć — sprawdzamy PRZED wydaniem
          // pieniędzy na turę.
          const { files } = await (await request.get("/api/files", { headers: ANNA })).json()
          expect(
            (files as { path: string }[]).some((f) => f.path.endsWith("faktury-08.csv")),
            "biurko Anny nie ma faktur — nie ma czego liczyć",
          ).toBe(true)

          const { id, status, events } = await tura(request, `Zlecenie ${zlecenie.id}`, tresc)

          // KONTROLA DODATNIA: tura zrobiła cokolwiek.
          const zaczete = events.filter((x) => x.event.type === "tool_start")
          expect(zaczete.length, "agent nie użył żadnego narzędzia").toBeGreaterThan(0)

          // SEDNO: żadnej prośby o dostęp — `blocked` to zdarzenie, z którego bierze się
          // kłódka na ekranie.
          const klodki = events
            .filter((x) => x.event.type === "blocked")
            .map((x) => (x.event as { description: string }).description)
          expect(klodki, `skończyło się prośbą o dostęp: ${klodki.join("; ")}`).toEqual([])

          // WYNIK MA SIĘ UDAĆ, nie tylko zacząć. Sprawdzanie po `tool_start` przepuszczało
          // zapis, który padł — a padnięty zapis jest dla pani Basi tym samym co kłódka.
          const udane = events.filter(
            (x) =>
              x.event.type === "tool_end" &&
              (x.event as { name: string }).name === zlecenie.narzedzie &&
              (x.event as { ok?: boolean }).ok !== false,
          )
          expect(
            udane.length,
            `${zlecenie.narzedzie} nie zakończyło się powodzeniem; użyte: ${zaczete
              .map((x) => (x.event as { name: string }).name)
              .join(", ")}`,
          ).toBeGreaterThan(0)
          expect(status, "sprawa nie skończyła się powodzeniem").toBe("done")

          if (!zlecenie.liczy) return

          // POPRAWNOŚĆ LICZB — bez tego cały scenariusz mierzy powstanie pliku, a pytanie
          // brzmiało, czy bez piaskownicy wychodzą DOBRE sumy.
          const teczka = `Sprawy/${id}`
          const spis = await (
            await request.get(`/api/files?folder=${encodeURIComponent(teczka)}`, { headers: ANNA })
          ).json()
          const wyniki = (spis.files ?? []) as { path: string; name: string }[]
          expect(wyniki.length, "w teczce sprawy nie ma żadnego pliku").toBeGreaterThan(0)

          let tresci = ""
          for (const f of wyniki) {
            const r = await request.get(`/api/file?path=${encodeURIComponent(f.path)}`, {
              headers: ANNA,
            })
            if (r.ok()) tresci += `\n${await r.text()}`
          }

          // REGUŁA BEZ PROGU: wymieniłeś kategorię — masz ją policzyć dobrze.
          //
          // Pierwsza wersja liczyła „ile z sześciu sum się zgadza" i żądała czterech.
          // Sprawdzone wstrzyknięciem: dopisanie faktury na 1000 zł do „Paliwa" psuje
          // jedną sumę, zostaje pięć poprawnych — i próg to przepuszczał. Próg z natury
          // toleruje błędny rachunek, a to jest jedyna rzecz, której ten scenariusz ma
          // nie tolerować. Pytamy więc o to, co model SAM napisał, a nie o to, ile
          // z moich oczekiwań pokrył.
          //
          // Netto albo brutto — obie podstawy są poprawne, model wybiera jedną.
          const wymienione = KATEGORIE.filter((k) => tresci.includes(k.nazwa))
          expect(
            wymienione.length,
            `wynik nie wymienia ani kilku kategorii — nie ma czego sprawdzać:\n${tresci.slice(0, 700)}`,
          ).toBeGreaterThanOrEqual(4)
          const zle = wymienione
            .filter((k) => !mowiLiczbe(tresci, k.netto) && !mowiLiczbe(tresci, k.brutto))
            .map((k) => `${k.nazwa} — miało wyjść ${k.netto} (netto) albo ${k.brutto} (brutto)`)
          expect(
            zle,
            `rachunek się nie zgadza w tych kategoriach.\nw plikach sprawy:\n${tresci.slice(0, 900)}`,
          ).toEqual([])
        },
      )
    }
  })
})
