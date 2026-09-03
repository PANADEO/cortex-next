import { evidenceFromEvents } from "@cortex/desk-core/evidence"
import { produced } from "@cortex/desk-core/promises"
import { describeFailure, describeStep, pairSteps, summariseGroup } from "@cortex/desk-core/steps"
import { cardFor } from "@cortex/desk-core/tool-cards"
import type { DeskEvent, StepFailure } from "@cortex/desk-core/types"
import { makeDeskT } from "@cortex/desk-ui/i18n/locale"
import type { APIRequestContext } from "@playwright/test"
import { as, expect, test } from "./osoby"

/**
 * Scenariusze czyta człowiek po polsku, więc zdania budujemy polskim tłumaczem.
 * Przebieg i dowód powstają teraz przy RENDERZE, a nie przy zapisie — funkcje
 * `describeStep`, `summariseGroup` i `evidenceFromEvents` dostają go jawnie.
 */
const pl = makeDeskT("pl")

/**
 * Dowód jest listą WIERSZY, nie napisów: wiersz niesie jeszcze słowo statusu, plik do
 * kliknięcia i indeks zdarzenia, po którym ekran bierze godzinę. Tam, gdzie sprawdzamy
 * TREŚĆ dowodu, a nie jego układ na ekranie, pytamy o same zdania.
 */
const tresc = (rows: { text: string }[]) => rows.map((w) => w.text)

/** Para start/koniec jednego narzędzia — tak, jak zapisuje ją runtime. */
const para = (
  id: string,
  name: string,
  args: Record<string, unknown>,
  summary: string,
  ok = true,
  powod?: StepFailure,
): DeskEvent[] => [
  { type: "tool_start", id, name, label: `etykieta ${name}`, args },
  {
    type: "tool_end",
    id,
    name,
    ok,
    summary,
    ms: 5,
    ...(powod === undefined ? {} : { reason: powod }),
  },
]

test.describe("Obszar 19 · Opis i dowód pochodzą z kart, nie z listy nazw w kodzie", () => {
  test("Wbudowane czynności dają dokładnie te same zdania dowodu co przed zmianą", () => {
    const d = evidenceFromEvents(
      [
        ...para("a", "list_files", { folder: "Moje pliki" }, "3 pozycji"),
        ...para("b", "read_file", { path: "Moje pliki/a.csv" }, "10 wierszy"),
        ...para("c", "write_document", { name: "w.md" }, "100 znaków"),
        ...para("d", "verify_document", { name: "w.md" }, "0 pustych pól"),
        ...para("e", "write_sheet", { name: "t.csv" }, "5 wierszy"),
        ...para("f", "generate_image", { name: "i.png", description: "kot" }, "zapisano i.png"),
        ...para("g", "run_computation", { description: "suma" }, "policzone"),
        ...para(
          "h",
          "save_to_my_files",
          { name: "w.md", target: "Moje pliki/w.md" },
          "Moje pliki/w.md",
        ),
      ],
      pl,
    )
    expect(tresc(d.intake)).toEqual(["Moje pliki/a.csv — 10 wierszy"])
    expect(tresc(d.produced)).toEqual([
      "zapisano w.md — 100 znaków",
      "odczytano w.md po zapisie — 0 pustych pól",
      "zapisano arkusz t.csv — 5 wierszy",
      "wygenerowano i.png",
      "policzono — policzone",
      "odłożono do Moich plików: Moje pliki/w.md",
    ])
    // przeglądanie teczki świadomie nie zostawia wiersza — nic nie wnosi i nic nie zmienia
    expect(tresc(d.intake).join(" ")).not.toMatch(/pozycji/)
  })

  test("Obraz nadal nie podlega regule sprawdzenia, arkusz nadal podlega", () => {
    const isImage = evidenceFromEvents(
      [
        ...para("a", "read_file", { path: "x.csv" }, "1 wiersz"),
        ...para("b", "generate_image", { name: "i.png" }, "zapisano i.png"),
      ],
      pl,
    )
    expect(isImage.unverified).toHaveLength(0)

    const sheet = evidenceFromEvents(
      [
        ...para("a", "read_file", { path: "x.csv" }, "1 wiersz"),
        ...para("b", "write_sheet", { name: "t.csv" }, "5 wierszy"),
      ],
      pl,
    )
    expect(sheet.unverified).toContain("zawartość pliku t.csv po zapisie")
  })

  test("Zdanie podsumowania grupy brzmi tak samo jak przed zmianą", () => {
    const k = pairSteps([
      ...para("a", "list_files", {}, "3 pozycji"),
      ...para("b", "read_file", { path: "a.csv" }, "10 wierszy"),
      ...para("c", "write_document", { name: "w.md" }, "100 znaków"),
      ...para("d", "verify_document", { name: "w.md" }, "0 pustych pól"),
    ])
    expect(summariseGroup(k, pl)).toBe(
      "Przejrzałem teczkę, przeczytałem 1 plik i zapisałem 1 dokument",
    )
  })

  test("Dokument i arkusz sumują się w jeden człon, bo dla człowieka to ta sama rzecz", () => {
    const k = pairSteps([
      ...para("a", "write_document", { name: "w.md" }, "100 znaków"),
      ...para("b", "write_sheet", { name: "t.csv" }, "5 wierszy"),
    ])
    expect(summariseGroup(k, pl)).toBe("Zapisałem 2 dokumenty")
  })
})

test.describe("Obszar 20 · Narzędzie, którego nikt nie zna, nie znika po cichu", () => {
  const obce = para("x", "mcp_nbp_kurs_waluty", { data: "2026-08-31" }, "EUR 4,2841")

  test("Nieznane narzędzie zostawia wiersz dowodu — inaczej sprawa udaje, że nic się nie stało", () => {
    const d = evidenceFromEvents(obce, pl)
    expect(d.intake.length + d.produced.length + d.external.length).toBeGreaterThan(0)
  })

  test("Wiersz idzie na osobną listę i nazywa serwer, z którego pochodzi", () => {
    const d = evidenceFromEvents(obce, pl)
    expect(d.external).toHaveLength(1)
    expect(d.external[0]!.text).toContain("nbp")
    expect(d.external[0]!.text).toContain("EUR 4,2841")
    // „odpowiedział 200" to nie to samo co „rzecz się wydarzyła" — ani do zrobionych,
    // ani do tego, co weszło z biurka
    expect(d.produced).toHaveLength(0)
    expect(d.intake).toHaveLength(0)
  })

  test("Przebieg mówi o nim po polsku, nie surowym kluczem narzędzia", () => {
    const [step] = pairSteps(obce)
    const o = describeStep(step!, pl)
    expect(o.title).toBe("Odpytałem nbp")
    expect(o.title).not.toContain("mcp_")
  })

  test("Nieznane narzędzie wchodzi do zdania podsumowania", () => {
    expect(summariseGroup(pairSteps(obce), pl)).toBe("Odpytałem nbp 1 raz")
  })

  test("Nieznana czynność nie udaje, że wytworzyła plik", () => {
    expect(produced(obce)).toHaveLength(0)
    expect(cardFor("mcp_nbp_kurs_waluty").kind).toBe("external")
  })

  test("Narzędzie bez rozpoznawalnego serwera też dostaje kartę, a nie wyjątek", () => {
    const k = cardFor("cos_zupelnie_innego")
    expect(k.kind).toBe("external")
    // `ok` to KLUCZ słownika — zdanie powstaje dopiero przy renderze
    expect(pl(k.ok, k.vars)).toBe("Wykonałem czynność spoza katalogu")
  })
})

test.describe("Obszar 30 · Krok, który się nie udał, przestaje kłamać", () => {
  const nieudanyArkusz = para(
    "s",
    "write_sheet",
    { name: "zestawienie.csv" },
    "nie udało się otworzyć",
    false,
    "cannot-open",
  )

  test("Tytuł kroku, który padł, nie jest zdaniem sukcesu", () => {
    // To było JEDYNE miejsce w produkcie, w którym ekran mówił nieprawdę: nad czynnością,
    // po której arkusza nie ma, stało „Zapisałem arkusz”.
    const [krok] = pairSteps(nieudanyArkusz)
    const opis = describeStep(krok!, pl)
    expect(opis.title).toBe("Nie zapisałem arkusza")
    expect(opis.title).not.toBe("Zapisałem arkusz")
  })

  test("Pod krokiem stoją trzy zdania w stałej kolejności", () => {
    const [krok] = pairSteps(nieudanyArkusz)
    const zdania = describeFailure(krok!, pl)
    expect(zdania).not.toBeNull()
    // 1. CO SIĘ STAŁO — z powodu zapisanego w zdarzeniu, nie z nazwy narzędzia.
    expect(zdania!.happened).toBe("Nie udało się otworzyć pliku.")
    // 2. CZY COŚ SIĘ ZMIENIŁO — najważniejsze z trójki.
    expect(zdania!.changed).toContain("Plik nie powstał")
    // 3. CO TERAZ — ruch, który ta osoba może wykonać.
    expect(zdania!.next).toMatch(/jeszcze raz/)
  })

  test("Zdanie „co teraz” bierze się z POWODU, a nie z nazwy narzędzia", () => {
    // To samo narzędzie, dwa powody, dwie różne rady. Rada wyprowadzona z nazwy
    // narzędzia byłaby przy obu ta sama — i przy jednym z nich fałszywa.
    const brakZgody = pairSteps(
      para("a", "write_sheet", { name: "x.csv" }, "brak zgody", false, "no-access"),
    )[0]!
    const awariaDysku = pairSteps(
      para("b", "write_sheet", { name: "x.csv" }, "nie udało się zapisać", false, "cannot-save"),
    )[0]!
    expect(describeFailure(brakZgody, pl)!.next).not.toBe(describeFailure(awariaDysku, pl)!.next)
    expect(describeFailure(brakZgody, pl)!.next).toMatch(/dostęp/)
  })

  test("Przy obcym serwerze ekran mówi „nie wiem”, a nie „nic się nie stało”", () => {
    const obce = pairSteps(
      para("c", "mcp_nbp_kurs_waluty", {}, "serwer nie odpowiedział", false, "outside-service"),
    )[0]!
    const zdania = describeFailure(obce, pl)!
    expect(describeStep(obce, pl).title).toBe("Nie odpytałem nbp")
    expect(zdania.changed).toMatch(/Nie wiem/)
    expect(zdania.changed).toMatch(/dwa razy/)
  })

  test("Grupa, z której nie wyszła ani jedna czynność, nie mówi „zrobione”", () => {
    // Nagłówek brzmiał „Zrobione z potknięciem: nic nie zostało zrobione” — zdanie
    // sprzeczne samo ze sobą. Tu pilnujemy samego podsumowania, którym się karmił.
    const same = pairSteps([
      ...para("a", "read_file", { path: "x.csv" }, "nie udało się otworzyć", false, "cannot-open"),
      ...para("b", "write_sheet", { name: "y.csv" }, "nie udało się zapisać", false, "cannot-save"),
    ])
    expect(same.every((k) => k.status === "failed")).toBe(true)
    expect(summariseGroup(same, pl)).toBe("Nic nie zostało zrobione")
    expect(pl("trail.allFailed")).toBe("Nie udało się")
  })
})

/**
 * Obszar 31 · DOWÓD CZYTA SIĘ JAK POTWIERDZENIE, NIE JAK SKLEJKA.
 *
 * Dowód stał pod jednym słowem „Sprawdzone:" jako `intake` i `produced` sklejone
 * kropkami w jeden akapit trzynastką, w którym nic nie było klikalne. „Co wziąłem"
 * i „co zrobiłem" to dla człowieka dwie różne rzeczy — pierwsza jest lekturą, druga
 * wynikiem — a pod wspólnym słowem obie wyglądały jak zasługa.
 *
 * Scenariusze idą przez EKRAN, a nie przez samą funkcję, bo rozdzielenie i klikalność
 * są własnością ekranu: `evidenceFromEvents` może oddawać dwie listy i dalej dać się
 * skleić w jeden akapit, tak jak dawało przez cały czas.
 */
test.describe("Obszar 31 · Dowód czyta się jak potwierdzenie", () => {
  const ANNA = { Cookie: "desk_persona=anna" }
  const ARKUSZ = "zestawienie-dowod.csv"

  /** Zdarzenia zasiewamy, ekran sprawdzamy naprawdę — bez płacenia za turę modelu. */
  async function zasiej(request: APIRequestContext, title: string, events: DeskEvent[]) {
    const r = await request.post("/api/test/seed-turn", {
      headers: ANNA,
      data: { title, status: "done", events },
    })
    expect(r.ok(), `nie udało się zasiać sprawy „${title}”`).toBe(true)
    return (await r.json()).id as string
  }

  test("Co weszło i co powstało to dwie osobne listy, nie jeden akapit", async ({
    page,
    request,
  }) => {
    const id = await zasiej(request, "Dowód rozdzielony", [
      ...para("a", "read_file", { path: "Moje pliki/faktury-08.csv" }, "10 wierszy"),
      ...para("b", "write_sheet", { name: ARKUSZ }, "5 wierszy"),
    ])
    await as(page, "anna")
    await page.goto(`/case/${id}`)

    const weszlo = page.getByRole("list", { name: "Co weszło" })
    const powstalo = page.getByRole("list", { name: "Co powstało" })
    await expect(weszlo).toBeVisible()
    await expect(powstalo).toBeVisible()

    // Każda lista mówi o SWOICH rzeczach — inaczej rozdzielenie jest samą kreską.
    await expect(weszlo).toContainText("Przeczytałem")
    await expect(weszlo).not.toContainText("Zapisałem arkusz")
    await expect(powstalo).toContainText("Zapisałem arkusz")
    await expect(powstalo).not.toContainText("Przeczytałem")

    // Jeden wiersz to jedno zdarzenie, a nie człon zdania sklejonego kropkami.
    await expect(weszlo.getByRole("listitem")).toHaveCount(1)
    await expect(powstalo.getByRole("listitem")).toHaveCount(1)
  })

  test("Wiersz dowodu niesie godzinę zdarzenia, tak jak potwierdzenie z banku", async ({
    page,
    request,
  }) => {
    const id = await zasiej(request, "Dowód z godziną", [
      ...para("a", "read_file", { path: "Moje pliki/faktury-08.csv" }, "10 wierszy"),
    ])
    await as(page, "anna")
    await page.goto(`/case/${id}`)

    const wiersz = page.getByRole("list", { name: "Co weszło" }).getByRole("listitem").first()
    await expect(wiersz).toHaveText(/\d{2}:\d{2}:\d{2}/)
  })

  test("Plik z dowodu jest rzeczą do kliknięcia i prowadzi do tego pliku", async ({
    page,
    request,
  }) => {
    const id = await zasiej(request, "Dowód z plikiem", [
      ...para("b", "write_sheet", { name: ARKUSZ }, "5 wierszy"),
    ])
    // Plik musi NAPRAWDĘ leżeć w teczce sprawy — inaczej sprawdzalibyśmy sam przycisk,
    // a nie to, że prowadzi on do czegokolwiek.
    const wgranie = await request.post("/api/files/upload", {
      headers: ANNA,
      multipart: {
        caseId: id,
        file: { name: ARKUSZ, mimeType: "text/csv", buffer: Buffer.from("a,b\n1,2\n") },
      },
    })
    expect(wgranie.ok()).toBe(true)

    await as(page, "anna")
    await page.goto(`/case/${id}`)

    const plik = page.getByRole("button", { name: `Otwórz plik ${ARKUSZ}` })
    await expect(plik).toBeVisible()
    await plik.click()

    // Ta sama droga, co z karty artefaktu: panel obok, nie nowa karta przeglądarki.
    await expect(
      page.getByRole("complementary", { name: "Panel wyniku" }).getByText(ARKUSZ).first(),
    ).toBeVisible()
  })

  test("Plik, którego ten ekran nie umie otworzyć, NIE udaje przycisku", async ({
    page,
    request,
  }) => {
    /**
     * Widok sprawy szuka pliku wyłącznie w TECZCE SPRAWY (`byName` po listingu teczki),
     * a „Co weszło" wymienia pliki z biurka. Plakietka wejściowa była więc `<button>`
     * z etykietą „Otwórz plik…", po którym kliknięciu nie działo się NIC. Zmierzone
     * na ekranie 03.09.2026: „zestawienie.docx" otwierało panel, „faktury-08.csv" milczał.
     *
     * Ekran, którego cała teza brzmi „nie twierdzę rzeczy, których nie było", nie może
     * obiecywać czynności, której nie wykonuje. Nazwa zostaje widoczna — znika sama obietnica.
     */
    const id = await zasiej(request, "Dowód z plikiem z biurka", [
      ...para("a", "read_file", { path: "Moje pliki/faktury-08.csv" }, "10 wierszy"),
      ...para("b", "write_sheet", { name: ARKUSZ }, "5 wierszy"),
    ])
    const wgranie = await request.post("/api/files/upload", {
      headers: ANNA,
      multipart: {
        caseId: id,
        file: { name: ARKUSZ, mimeType: "text/csv", buffer: Buffer.from("a,b\n1,2\n") },
      },
    })
    expect(wgranie.ok()).toBe(true)

    await as(page, "anna")
    await page.goto(`/case/${id}`)

    // Plik z biurka: widoczny, ale nie jest przyciskiem.
    await expect(page.getByRole("list", { name: "Co weszło" })).toContainText("faktury-08.csv")
    await expect(page.getByRole("button", { name: "Otwórz plik faktury-08.csv" })).toHaveCount(0)

    // KONTROLA DODATNIA w tym samym przebiegu: plik leżący w teczce sprawy przyciskiem
    // ZOSTAJE. Bez niej reguła „nigdy nie rób przycisku" byłaby tak samo zielona.
    await expect(page.getByRole("button", { name: `Otwórz plik ${ARKUSZ}` })).toBeVisible()
  })
})
