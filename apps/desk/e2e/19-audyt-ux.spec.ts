import type { APIRequestContext } from "@playwright/test"
import { as, expect, otworz, test } from "./osoby"

/**
 * Obszar 28 · CZTERY RZECZY, KTÓRE AUDYTOR ZOBACZY W PIERWSZYCH PIĘCIU MINUTACH.
 *
 * Ten plik nie powstał z projektu, tylko z audytu przeprowadzonego klikaniem po żywej
 * aplikacji. Każdy scenariusz odpowiada jednej rzeczy, która na ekranie WYGLĄDAŁA źle,
 * choć wszystkie dotychczasowe testy były zielone — bo sprawdzały, czy coś się dzieje,
 * a nie, co człowiek przy tym widzi.
 *
 * Wspólny mianownik całej czwórki: żaden z tych błędów nie miał prawa być cichy,
 * a wszystkie były.
 */

const anna = { Cookie: "desk_persona=anna" }
const robert = { Cookie: "desk_persona=robert" }

test.describe("Obszar 28 · Kosz mówi, skąd plik zniknął", () => {
  test("Nazwa folderu, a nie słowo z konsoli programisty", async ({ page, request }) => {
    // Ekran czytał `from`, serwer oddawał `basis` — pole zgubione przy przemianowaniu
    // kodu na angielski. Każdy wiersz kosza pokazywał „z undefined", a nic tego nie
    // złapało, bo JSON z trasy nie ma typu. Dziś typ jest wspólny i `tsc` tego pilnuje;
    // ten scenariusz pilnuje tego, co widać.
    const name = `kosz-${Date.now()}.txt`
    const fd = new FormData()
    fd.append("folder", "Moje pliki")
    fd.append("file", new File(["treść"], name, { type: "text/plain" }))
    await request.post("/api/files/upload", { headers: anna, multipart: fd })
    await request.post("/api/files", {
      headers: anna,
      data: { action: "trash", path: `Moje pliki/${name}` },
    })

    await as(page, "anna")
    await otworz(page, "/files")
    await page.getByRole("button", { name: /Kosz/ }).click()
    const row = page.locator("li", { hasText: name }).first()
    await expect(row).toBeVisible()
    await expect(row).not.toContainText("undefined")
    await expect(row).toContainText("Moje pliki")
  })
})

test.describe("Obszar 28 · Na telefonie nie znika żaden ekran", () => {
  test.use({ viewport: { width: 360, height: 780 } })

  test("Pamięć da się otworzyć bez kolumny po lewej", async ({ page }) => {
    // Poniżej 768 px pasek boczny jest schowany, a dolna nawigacja ma trzy pozycje.
    // Pamięć i Nadzór nie miały wejścia ZNIKĄD — czyli na telefonie znikał cały ekran
    // przełożonego, ten, na którym stoi opowieść o nadzorze.
    await as(page, "anna")
    await otworz(page, "/me")
    await page.getByRole("link", { name: /Pamięć/ }).click()
    await expect(page).toHaveURL(/\/memory$/)
  })

  test("Przełożony ma na telefonie wejście do Nadzoru, pracownica nie", async ({ page }) => {
    await as(page, "robert")
    await otworz(page, "/me")
    await page.getByRole("link", { name: /Nadzór/ }).click()
    await expect(page).toHaveURL(/\/supervision/)

    await as(page, "anna")
    await otworz(page, "/me")
    await expect(page.getByRole("link", { name: /Nadzór/ })).toHaveCount(0)
  })
})

test.describe("Obszar 28 · Awaria nie obwinia pracownicy", () => {
  async function seed(request: APIRequestContext, events: unknown[], title: string) {
    const r = await request.post("/api/test/seed-turn", {
      headers: anna,
      data: { title, status: "failed", events },
    })
    return (await r.json()).id as string
  }

  test("Awaria łącza nie wkleja angielskiego i proponuje POWTÓRZYĆ, nie przepisać", async ({
    page,
    request,
  }) => {
    // Zmierzone na ekranie przed poprawką: „Nie udało się dokończyć: Failed after 3
    // attempts. Last error: Cannot connect to API: bad port", a jedyny przycisk obok
    // brzmiał „Napisz inaczej" — awaria sieci podana jako wina sformułowania zlecenia.
    const id = await seed(
      request,
      [
        { type: "prompt", text: "Policz sumę z faktur za sierpień." },
        { type: "lifecycle", status: "start" },
        {
          type: "lifecycle",
          status: "failed",
          reason: "Nie udało się połączyć z usługą modelu. Sprawdź, czy cortex-proxy działa.",
          kind: "infrastructure",
        },
      ],
      "Awaria łącza",
    )

    await as(page, "anna")
    await otworz(page, `/case/${id}`)
    await expect(page.getByText("Nie udało się połączyć z usługą modelu")).toBeVisible()
    await expect(page.getByRole("button", { name: "Spróbuj jeszcze raz" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Napisz inaczej" })).toHaveCount(0)

    // Powtórzenie wpisuje TO SAMO zlecenie z powrotem w pole — a nie wysyła go samo,
    // bo wysłanie kosztuje i decyduje o nim człowiek.
    await page.getByRole("button", { name: "Spróbuj jeszcze raz" }).click()
    await expect(page.getByRole("textbox", { name: /Co mam zrobić|zlecenie/i }).first()).toHaveValue(
      "Policz sumę z faktur za sierpień.",
    )
  })

  test("Wyczerpanie limitu kroków nie udaje sukcesu", async ({ page, request }) => {
    // Model przestawał pracować w połowie zadania, `finishReason` nie czytał nikt,
    // a sprawa pokazywała się jako gotowa. Człowiek dostawał ciszę.
    const id = await seed(
      request,
      [
        { type: "prompt", text: "Przerób wszystkie 400 faktur." },
        { type: "lifecycle", status: "start" },
        { type: "lifecycle", status: "exhausted" },
      ],
      "Za duże zlecenie",
    )
    await as(page, "anna")
    await otworz(page, `/case/${id}`)
    await expect(page.getByText("nie zmieściła się w jednej turze")).toBeVisible()
  })
})

test.describe("Obszar 28 · Nadzór nie odjeżdża z listą spraw", () => {
  test("Wejście przełożonego zostaje na ekranie przy długiej liście", async ({ page }) => {
    // Trzy stałe miejsca stały w środku `nav` z własnym przewijaniem, razem z listą
    // spraw. Przy dłuższej liście „Nadzór" — jedyne wejście przełożonego — wyjeżdżał
    // poza widok i bywał przycięty w połowie.
    await as(page, "robert")
    await otworz(page, "/")
    const link = page.getByRole("link", { name: /Nadzór/ })
    await expect(link).toBeInViewport()

    // ...także po przewinięciu listy spraw do końca
    await page.locator("nav").first().evaluate((n) => n.scrollTo(0, n.scrollHeight))
    await expect(link).toBeInViewport()
  })
})

/**
 * Obszar 28b · DROBIAZGI — osiem rzeczy, z których każda osobno jest drobna,
 * a razem robią różnicę między „produkt" a „prototyp".
 *
 * Wszystkie z tego samego audytu co wyżej. Trzymam je w jednym pliku, bo mają jedną
 * przyczynę: nikt nigdy nie przeszedł po tych ekranach ręcznie na wąskim oknie.
 */
test.describe("Obszar 28b · Drobiazgi z audytu", () => {
  test("Odmowa dostępu do cudzej sprawy ma wyjście", async ({ page, request }) => {
    const r = await request.post("/api/case/new", {
      headers: { Cookie: "desk_persona=robert" },
      data: { title: "Sprawa Roberta" },
    })
    const { id } = await r.json()
    await as(page, "anna")
    await otworz(page, `/case/${id}`)
    await expect(page.getByText("To nie jest Twoja sprawa")).toBeVisible()
    await page.getByRole("link", { name: /Wróć do spraw/ }).click()
    await expect(page).toHaveURL(/\/$|\/desk$/)
  })

  test("Ekran „Ja” nie powtarza imienia i działu", async ({ page }) => {
    // Na 360 px, bo po to ten ekran istnieje: kolumna po lewej jest wtedy schowana,
    // więc wizytówka ma być DOKŁADNIE JEDNA — ta w nagłówku. Menu osoby jest tu
    // wejściem do ustawień, nie kolejną kopią tożsamości.
    await page.setViewportSize({ width: 360, height: 780 })
    await as(page, "anna")
    await otworz(page, "/me")
    // Zakres to TREŚĆ ekranu, nie cały dokument: pasek boczny zostaje w DOM także
    // wtedy, gdy jest schowany klasą, więc liczenie po całej stronie mierzyłoby
    // co innego, niż widzi człowiek.
    await expect(page.locator("main").getByText("Anna Kowalska", { exact: true })).toHaveCount(1)
    // Wejście do ustawień MUSI tu być bez żadnego warunku: pasek boczny jest na 360 px
    // schowany, więc to jedyna droga do języka. Do 03.09.2026 stało pod `switchable`,
    // czyli u klienta nie było go wcale.
    await expect(page.getByRole("button", { name: "Ustawienia" })).toBeVisible()
  })

  test("Panel wyniku nie zabiera ćwierci ekranu pustej sprawie", async ({ page, request }) => {
    const r = await request.post("/api/case/new", {
      headers: { Cookie: "desk_persona=anna" },
      data: { title: "Pusta sprawa" },
    })
    const { id } = await r.json()
    await as(page, "anna")
    await page.setViewportSize({ width: 1440, height: 900 })
    await otworz(page, `/case/${id}`)
    // `exact`, bo bez niego dopasowuje się też przycisk „Pokaż panel wyniku".
    await expect(page.getByLabel("Panel wyniku", { exact: true })).toHaveCount(0)
  })

  test("Kosz pokazuje najnowsze i daje się opróżnić", async ({ page, request }) => {
    // Ten scenariusz był do 03.09.2026 ZIELONY NA CUDZYCH ŚMIECIACH. Pętla sprzątająca
    // czytała `list.entries`, a `/api/files` zwraca `files` — więc `?? []` robiło z niej
    // cichy no-op: ani jeden plik nie trafiał do kosza. Kosz i tak nie był pusty, bo
    // zostawiały w nim coś inne scenariusze, więc „Opróżnij kosz" się pokazywał i test
    // przechodził, nigdy nie dotknąwszy materiału, który sam założył. Skutkiem ubocznym
    // były trzy porzucone pliki na biurku PER PRZEBIEG — po stu przebiegach biurko Anny
    // miało ich ponad sto trzydzieści i nie nadawało się już do pokazania.
    const anna = { Cookie: "desk_persona=anna" }
    const znak = `kosz-drobiazg-${Date.now()}`
    for (let i = 0; i < 3; i++) {
      const fd = new FormData()
      fd.append("folder", "Moje pliki")
      fd.append("file", new File(["x"], `${znak}-${i}.txt`))
      await request.post("/api/files/upload", { headers: anna, multipart: fd })
    }

    const list = await (await request.get("/api/files?folder=Moje pliki", { headers: anna })).json()
    const moje = (list.files ?? []).filter((x: { name: string }) => x.name.startsWith(znak))
    // KONTROLA DODATNIA na własnym materiale: bez niej literówka w nazwie pola wraca
    // dokładnie tą samą drogą, którą przyszła — po cichu i na zielono.
    expect(moje, "wgrane pliki nie wróciły z listy — sprzątanie znów jest pozorne").toHaveLength(3)
    for (const f of moje) {
      const r = await request.post("/api/files", {
        headers: anna,
        data: { action: "trash", path: f.path },
      })
      expect(r.ok(), `nie udało się wyrzucić ${f.path} do kosza`).toBe(true)
    }

    await as(page, "anna")
    await otworz(page, "/files")
    await page.getByRole("button", { name: /Kosz/ }).click()
    // Kosz pokazuje TO, CO WŁAŚNIE WYRZUCILIŚMY — tego właśnie tytuł tego scenariusza
    // obiecuje, a poprzednia wersja nie sprawdzała wcale.
    await expect(page.getByText(`${znak}-0.txt`)).toBeVisible()
    await expect(page.getByRole("button", { name: "Opróżnij kosz" })).toBeVisible()

    page.on("dialog", (d) => d.accept())
    await page.getByRole("button", { name: "Opróżnij kosz" }).click()
    await expect(page.getByText("Kosz jest pusty.")).toBeVisible()
  })

  test("Nieznana sekcja Nadzoru przekierowuje, a nie udaje domyślnej", async ({ page }) => {
    await as(page, "robert")
    await page.goto("/supervision?section=nieistniejaca")
    await page.waitForLoadState("networkidle")
    // Adres i ekran mają mówić to samo — cicha podmiana sekcji jest gorsza niż błąd.
    await expect(page).toHaveURL(/\/supervision$/)
  })

  test("Dziennik dzieli się na dni, a nie miesza formatów czasu", async ({ page }) => {
    await as(page, "robert")
    await otworz(page, "/supervision?section=log")
    await expect(page.getByText("Dzisiaj", { exact: true }).first()).toBeVisible()
  })

  test("Udostępnianie nie jest surową kontrolką systemu", async ({ page, request }) => {
    const r = await request.post("/api/case/new", {
      headers: { Cookie: "desk_persona=anna" },
      data: { title: "Do udostępnienia" },
    })
    const { id } = await r.json()
    await as(page, "anna")
    await otworz(page, `/case/${id}`)
    await page.getByRole("button", { name: "Udostępnij tę sprawę" }).click()
    await expect(page.getByRole("button", { name: /Robert/ })).toBeVisible()
    await expect(page.locator("select")).toHaveCount(0)
  })

  test("Pasek narzędzi mieści się w jednej linii na 360 px", async ({ page }) => {
    await as(page, "anna")
    await page.setViewportSize({ width: 360, height: 780 })
    await otworz(page, "/")
    const add = page.getByRole("button", { name: /Dodaj plik/ })
    const box = await add.boundingBox()
    // Jedna linia tekstu 13 px to ok. 20 px wysokości plus wyściółka; złamanie
    // w środku wyrazu podwaja tę wartość i tak wyglądał ten pasek przed poprawką.
    expect(box!.height).toBeLessThan(34)
  })
})

/**
 * Obszar 28c · SZAFKA — pasek boczny ma stałą, krótką listę miejsc.
 *
 * DLACZEGO LICZYMY. Do 03.09.2026 pasek pokazywał listę spraw i listę udostępnionych,
 * czyli od ośmiu do dwudziestu jeden klikalnych elementów — a lista spraw była DOKŁADNIE
 * tą samą listą, którą ekran główny rysuje pod polem zlecenia. Kolumna, po której wodzi
 * się wzrokiem w poszukiwaniu czterech stałych miejsc, przestawała działać.
 *
 * Liczba jest tu treścią, nie estetyką, więc pilnuje jej test. Bez niego pierwsza „drobna”
 * pozycja wróci przy najbliższej okazji i nikt nie zauważy, kiedy zrobiło się ich znowu
 * dwadzieścia.
 */
test.describe("Obszar 28c · Szafka", () => {
  /** Wszystko, w co da się kliknąć w kolumnie po lewej. */
  const miejsca = (page: import("@playwright/test").Page) =>
    page.locator("aside").getByRole("link")

  test("Pracownica ma pięć miejsc, przełożony sześć", async ({ page }) => {
    await as(page, "anna")
    await otworz(page, "/")
    // Nowa sprawa · Sprawy · Moje pliki · Pamięć · wizytówka.
    await expect(miejsca(page)).toHaveCount(5)

    await as(page, "robert")
    await otworz(page, "/")
    // …plus Nadzór, który jest wyłącznie jego.
    await expect(miejsca(page)).toHaveCount(6)
    await expect(page.locator("aside").getByRole("link", { name: /Nadzór/ })).toBeVisible()
  })

  test("Pasek nie powtarza listy spraw z ekranu głównego", async ({ page }) => {
    await as(page, "anna")
    await otworz(page, "/")
    // Tytuł pierwszej sprawy stoi na ekranie głównym i NIE MA go w kolumnie po lewej.
    const tytul = await page
      .locator("main")
      .getByRole("link")
      .filter({ hasText: /nowa|gotowe|przerwane/i })
      .first()
      .innerText()
      .catch(() => "")
    const pierwszaLinia = tytul.split("\n")[0]?.trim() ?? ""
    if (pierwszaLinia.length > 3) {
      await expect(page.locator("aside").getByText(pierwszaLinia, { exact: true })).toHaveCount(0)
    }
    // Zamiast listy stoi LICZBA — i to jest cała zmiana.
    await expect(page.locator("aside").getByRole("link", { name: /Sprawy/ })).toBeVisible()
  })

  test("Wizytówka prowadzi do „Ja”, a nie otwiera menu", async ({ page }) => {
    // Menu z trzema różnymi rzeczami pod jedną strzałką w dół nie ma pierwowzoru
    // w Outlooku ani w banku. Wizytówka prowadząca do „mojego ekranu” ma go wszędzie.
    await as(page, "anna")
    await otworz(page, "/")
    await page.locator("aside").getByRole("link", { name: /Anna Kowalska/ }).click()
    await expect(page).toHaveURL(/\/me$/)
    await expect(page.getByRole("button", { name: "Ustawienia" })).toBeVisible()
  })
})
