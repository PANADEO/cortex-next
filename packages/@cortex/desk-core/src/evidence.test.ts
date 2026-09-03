// Sprawa policzona w piaskownicy nie jest sprawą zrobioną bez zaglądania do plików.
//
// `run_computation` montuje pliki z biurka pod ich nazwami i liczy na nich — ale jest klasy
// „computes", a `fromDesk` karmiły wyłącznie klasy „reads". Sprawa wykonana w piaskownicy
// w całości, czyli dokładnie ta, do której piaskownica służy, dostawała więc w panelu wyniku
// zdanie „dokument powstał bez odczytania choćby jednego pliku z biurka". Nieprawda, wypisana
// z powagą, w jedynym miejscu tego produktu, które nie ma prawa się mylić.

import { makeDeskT } from "@cortex/desk-ui/i18n/locale"
import { describe, expect, it } from "vitest"
import { evidenceFromEvents } from "./evidence"
import type { DeskEvent } from "./types"

const t = makeDeskT("pl")

let next = 0
const step = (name: string, args: Record<string, unknown>, summary = "gotowe"): DeskEvent[] => {
  const id = `k${next++}`
  return [
    { type: "tool_start", id, name, label: name, args },
    { type: "tool_end", id, name, ok: true, summary, ms: 1 },
  ]
}

const computed = (files: string[]) =>
  step("run_computation", { description: "sumuję faktury", files })

/**
 * Obliczenie, które COŚ WYTWORZYŁO. Nazwy wchodzą przez `discovered`, bo czynność poznaje
 * je dopiero po wykonaniu kodu — tak samo jak szukanie poznaje listę trafień.
 */
const madeFiles = (files: string[], mounted: string[] = []): DeskEvent[] => {
  const id = `k${next++}`
  return [
    {
      type: "tool_start",
      id,
      name: "run_computation",
      label: "składam dokument",
      args: { description: "składam dokument", files: mounted },
    },
    {
      type: "tool_end",
      id,
      name: "run_computation",
      ok: true,
      summary: `policzone, plików: ${files.length}`,
      ms: 1,
      discovered: { made: files },
    },
  ]
}
const sheet = (name: string) => step("write_sheet", { name, rows: 3 })

const evidence = (...events: DeskEvent[][]) => evidenceFromEvents(events.flat(), t)

/**
 * Dowód jest listą WIERSZY, nie napisów: wiersz niesie jeszcze słowo statusu, plik do
 * kliknięcia i indeks, po którym ekran bierze godzinę. Ten plik pyta o same ZDANIA,
 * bo pilnuje treści dowodu, a nie jego układu na ekranie.
 */
const sentences = (rows: { text: string }[]) => rows.map((w) => w.text)

describe("Dowód sprawy liczonej w piaskownicy", () => {
  it("nie twierdzi, że nikt nie zajrzał do plików, skoro weszły do obliczeń", () => {
    const e = evidence(computed(["Moje pliki/faktury-08.csv"]), sheet("zestawienie.csv"))
    expect(e.unverified).not.toContain(t("evidence.noIntake"))
  })

  it("wymienia w „Co weszło” każdy plik, który wszedł do piaskownicy", () => {
    const e = evidence(computed(["Moje pliki/f1.csv", "Moje pliki/f2.csv"]))
    expect(sentences(e.intake)).toEqual([
      "wzięto do obliczeń: Moje pliki/f1.csv",
      "wzięto do obliczeń: Moje pliki/f2.csv",
    ])
  })

  it("NADAL mówi o braku wejścia, gdy obliczenie było bez plików", () => {
    // Kontrola negatywna — bez niej poprawka mogłaby po prostu uciszyć regułę zamiast
    // nauczyć ją prawdy. Kod policzony bez danych z biurka to sprawa BEZ wejścia i tak
    // ma być opisana.
    const e = evidence(computed([]), sheet("zestawienie.csv"))
    expect(e.unverified).toContain(t("evidence.noIntake"))
  })

  it("nie wypisuje tej samej faktury dwa razy, gdy liczono na niej dwukrotnie", () => {
    const e = evidence(computed(["Moje pliki/f1.csv"]), computed(["Moje pliki/f1.csv"]))
    expect(e.intake).toHaveLength(1)
  })

  it("nie dubluje pliku, który agent najpierw przeczytał, a potem policzył", () => {
    const e = evidence(
      step("read_file", { path: "Moje pliki/f1.csv" }, "12 wierszy"),
      computed(["Moje pliki/f1.csv"]),
    )
    expect(sentences(e.intake)).toEqual(["Moje pliki/f1.csv — 12 wierszy"])
  })

  it("pomija pozycje, które nie są nazwą pliku", () => {
    // Argumenty narzędzia pisze MODEL, więc lista może przyjść w każdym kształcie.
    const e = evidence(computed(["", "Moje pliki/f1.csv"] as string[]))
    expect(sentences(e.intake)).toEqual(["wzięto do obliczeń: Moje pliki/f1.csv"])
  })

  /**
   * WYTWORZONY PLIK MA STANĄĆ W DOWODZIE POD WŁASNĄ NAZWĄ.
   *
   * Do 03.09.2026 `run_computation` oddawało nazwy pól `produced`, które NIE JEST polem
   * `StepResult` — rozsypanie omija sprawdzanie nadmiarowych pól, więc `tsc` milczał
   * i linia nie publikowała niczego. W „Co powstało" stał jeden wiersz „policzone,
   * plików: 4": liczba bez nazw, w którą nie da się kliknąć. Nazwy docierały wyłącznie
   * do modelu. Klasy tego błędu pilnuje osobno `step-result-shape.test.ts`.
   */
  it("wymienia w „Co powstało” każdy plik, który powstał w piaskownicy", () => {
    const e = evidence(madeFiles(["zestawienie.docx", "wykres.png"]))
    expect(sentences(e.produced)).toEqual([
      "powstało w teczce sprawy: zestawienie.docx",
      "powstało w teczce sprawy: wykres.png",
    ])
  })

  it("wiersz wytworzonego pliku niesie plik do kliknięcia, nie sam napis", () => {
    // Bez tego test wyżej byłby zielony także wtedy, gdyby wiersz był gołym zdaniem —
    // a plakietka pliku jest tu jedyną drogą do otwarcia tego, co powstało.
    const e = evidence(madeFiles(["zestawienie.docx"]))
    expect(e.produced[0]?.file).toBe("zestawienie.docx")
    expect(e.produced[0]?.word).toBe(t("tools.evidence.madeWord"))
  })

  it("nie wypisuje tego samego wytworzonego pliku dwa razy", () => {
    const e = evidence(madeFiles(["wykres.png"]), madeFiles(["wykres.png"]))
    expect(e.produced.filter((w) => w.file === "wykres.png")).toHaveLength(1)
  })

  it("plik policzony NA WEJŚCIU i wytworzony to dwie różne rzeczy", () => {
    // Kontrola, że odsiew duplikatów nie poszedł za daleko: `dane.csv` weszło jako dane
    // i osobno powstało na nowo. Obie rzeczy naprawdę się wydarzyły i obie mają być widoczne.
    const e = evidence(madeFiles(["dane.csv"], ["Moje pliki/dane.csv"]))
    expect(sentences(e.intake)).toContain("wzięto do obliczeń: Moje pliki/dane.csv")
    expect(sentences(e.produced)).toContain("powstało w teczce sprawy: dane.csv")
  })

  it("gdy pliki są wypisane, zdanie podsumowujące krok NIE dubluje ich liczby", () => {
    // Nagłówek karty mówi już „Policzyłem"; wiersz „policzono — policzone, plików: 2"
    // powtarzałby to po raz trzeci, i to akurat liczbą, którą ta zmiana zastąpiła nazwami.
    const e = evidence(madeFiles(["a.csv", "b.csv"]))
    expect(e.produced).toHaveLength(2)
    expect(sentences(e.produced).some((z) => z.includes("plików: 2"))).toBe(false)
  })

  it("ale gdy NIC nie powstało, zdanie o obliczeniu zostaje", () => {
    // Kontrola ujemna: bez niej poprawka mogła uciszyć krok także wtedy, gdy jest on
    // jedynym śladem, że obliczenie w ogóle się odbyło.
    const e = evidence(computed(["Moje pliki/f1.csv"]))
    expect(sentences(e.produced)).toEqual(["policzono — gotowe"])
  })

  it("obliczenie bez wytworzonych plików nie dokłada ani jednego wiersza", () => {
    // Kontrola ujemna: bez niej strażnik byłby zielony także dla reguły, która wypisuje
    // wiersz zawsze — a większość obliczeń niczego nie zapisuje.
    const e = evidence(computed(["Moje pliki/f1.csv"]))
    expect(e.produced.filter((w) => w.word === t("tools.evidence.madeWord"))).toEqual([])
  })

  it("plik ocalony z NIEUDANEGO obliczenia też stoi w „Co powstało”", () => {
    // `run_computation` zabiera pliki także po błędzie i mówi wprost dlaczego: skrypt, który
    // zapisał trzy arkusze z pięciu i przewrócił się na czwartym, zostawił trzy PRAWDZIWE
    // pliki. Do 03.09.2026 `evidence.ts` ucinało cały nieudany krok, więc te pliki leżały
    // w teczce, model o nich mówił, a dowód milczał — cicha strata dokładnie tam, gdzie
    // piaskownica włożyła wysiłek, żeby jej nie było.
    const id = `k${next++}`
    const e = evidenceFromEvents(
      [
        { type: "tool_start", id, name: "run_computation", label: "składam", args: { files: [] } },
        {
          type: "tool_end",
          id,
          name: "run_computation",
          ok: false,
          summary: "błąd wykonania",
          ms: 1,
          discovered: { made: ["polowa.xlsx"] },
        },
      ] as DeskEvent[],
      t,
    )
    expect(sentences(e.produced)).toEqual(["powstało w teczce sprawy: polowa.xlsx"])
  })

  it("ale ZDANIE nieudanego kroku do dowodu NIE wchodzi", () => {
    // Druga połowa tej samej reguły. Krok, który padł, nic nie „policzył" — wiersz mówiący,
    // że policzył, byłby nieprawdą. Bez tej kontroli poprzednia poprawka mogła wpuścić
    // do dowodu całe zdanie porażki razem z plikami.
    const id = `k${next++}`
    const e = evidenceFromEvents(
      [
        { type: "tool_start", id, name: "run_computation", label: "składam", args: { files: [] } },
        {
          type: "tool_end",
          id,
          name: "run_computation",
          ok: false,
          summary: "błąd wykonania",
          ms: 1,
        },
      ] as DeskEvent[],
      t,
    )
    expect(e.produced).toEqual([])
    expect(e.intake).toEqual([])
  })

  it("nie przewraca się, gdy zamiast listy przyjdzie napis", () => {
    const events = [
      {
        type: "tool_start",
        id: "z",
        name: "run_computation",
        label: "x",
        args: { files: "nie-lista" },
      },
      { type: "tool_end", id: "z", name: "run_computation", ok: true, summary: "gotowe", ms: 1 },
    ] as DeskEvent[]
    expect(() => evidenceFromEvents(events, t)).not.toThrow()
    expect(evidenceFromEvents(events, t).intake).toEqual([])
  })
})
