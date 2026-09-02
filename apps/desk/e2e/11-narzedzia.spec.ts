import { evidenceFromEvents } from "@cortex/desk-core/evidence"
import { produced } from "@cortex/desk-core/promises"
import { describeFailure, describeStep, pairSteps, summariseGroup } from "@cortex/desk-core/steps"
import { cardFor } from "@cortex/desk-core/tool-cards"
import type { DeskEvent, StepFailure } from "@cortex/desk-core/types"
import { makeDeskT } from "@cortex/desk-ui/i18n/locale"
import { expect, test } from "./osoby"

/**
 * Scenariusze czyta człowiek po polsku, więc zdania budujemy polskim tłumaczem.
 * Przebieg i dowód powstają teraz przy RENDERZE, a nie przy zapisie — funkcje
 * `describeStep`, `summariseGroup` i `evidenceFromEvents` dostają go jawnie.
 */
const pl = makeDeskT("pl")

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
    expect(d.intake).toEqual(["Moje pliki/a.csv — 10 wierszy"])
    expect(d.produced).toEqual([
      "zapisano w.md — 100 znaków",
      "odczytano w.md po zapisie — 0 pustych pól",
      "zapisano arkusz t.csv — 5 wierszy",
      "wygenerowano i.png",
      "policzono — policzone",
      "odłożono do Moich plików: Moje pliki/w.md",
    ])
    // przeglądanie teczki świadomie nie zostawia wiersza — nic nie wnosi i nic nie zmienia
    expect(d.intake.join(" ")).not.toMatch(/pozycji/)
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
    expect(d.external[0]).toContain("nbp")
    expect(d.external[0]).toContain("EUR 4,2841")
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
