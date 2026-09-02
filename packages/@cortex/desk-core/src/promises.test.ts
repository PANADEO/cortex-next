// Ostrzeżenie „Te pliki nie powstały" ma trafiać w zmyślenie, a nie w rzetelną pracę.
//
// Zgłoszone z ekranu: sprawa, w której agent przeczytał `faktury-2026-08.csv` z „Moich
// plików", policzył zestawienie i wymienił tę nazwę w odpowiedzi, dostawała ostrzeżenie,
// że plik nie powstał. Panel oskarżał asystenta o zmyślanie dokładnie wtedy, gdy zrobił
// to, o co go poproszono — bo liczone były wyłącznie pliki WYTWORZONE, a plik z biurka
// nie leży w teczce sprawy i nie miał jak się obronić.

import { describe, expect, it } from "vitest"
import { unbackedPromises } from "./promises"
import type { DeskEvent, FileMeta } from "./types"

let n = 0
const step = (name: string, args: Record<string, unknown>): DeskEvent[] => {
  const id = `k${n++}`
  return [
    { type: "tool_start", id, name, label: name, args },
    { type: "tool_end", id, name, ok: true, summary: "gotowe", ms: 1 },
  ]
}
const plik = (name: string): FileMeta => ({
  path: name, name, folder: false, size: 10, modifiedAt: "2026-09-02T10:00:00Z",
})

const ODPOWIEDZ =
  "Zestawienie zapisane. Policzyłem je z faktury-2026-08.csv oraz kontrahenci.csv, " +
  "wynik jest w zestawienie-sierpien.csv."

describe("obietnice bez pokrycia", () => {
  it("NIE oskarża o zmyślanie plików, które agent przeczytał z biurka", () => {
    const events = [
      ...step("read_file", { path: "Moje pliki/faktury-2026-08.csv" }),
      ...step("read_file", { path: "Moje pliki/kontrahenci.csv" }),
      ...step("write_sheet", { name: "zestawienie-sierpien.csv" }),
    ].flat()
    expect(unbackedPromises(ODPOWIEDZ, events, [])).toEqual([])
  })

  it("liczy też pliki, które weszły do obliczenia", () => {
    // Piaskownica montuje pliki z biurka pod ich nazwami — to jest ta sama oś `inputs`,
    // na której stoi „Co weszło" w dowodzie.
    const events = [
      ...step("run_computation", {
        description: "sumuję",
        files: ["Moje pliki/faktury-2026-08.csv", "Moje pliki/kontrahenci.csv"],
      }),
      ...step("write_sheet", { name: "zestawienie-sierpien.csv" }),
    ].flat()
    expect(unbackedPromises(ODPOWIEDZ, events, [])).toEqual([])
  })

  it("NADAL łapie plik, którego nikt nie widział na oczy", () => {
    // Kontrola negatywna i najważniejsza asercja w tym pliku: poprawka nie może uciszyć
    // reguły, tylko nauczyć ją prawdy. Zdanie o pliku, którego nie tknęła żadna czynność
    // i którego nie ma w teczce, dalej jest zmyśleniem.
    const events = step("read_file", { path: "Moje pliki/faktury-2026-08.csv" }).flat()
    expect(unbackedPromises("Zapisałem raport-wymyslony.md w teczce.", events, [])).toEqual([
      "raport-wymyslony.md",
    ])
  })

  it("NIE oskarża w turze, która tylko STRESZCZA wcześniejszą pracę", () => {
    // Przypadek ze zrzutu ekranu. Agent czytał faktury w turze pierwszej, a w trzeciej
    // streszcza, co zrobił — tura streszczająca nie ma ANI JEDNEGO zdarzenia. Liczona
    // osobno oskarżała go o zmyślenie nazw, które sama sprawa widziała dwie tury wcześniej.
    const wczesniej = [
      ...step("read_file", { path: "Moje pliki/faktury-2026-08.csv" }),
      ...step("read_file", { path: "Moje pliki/kontrahenci.csv" }),
      ...step("write_sheet", { name: "zestawienie-sierpien.csv" }),
    ].flat()
    const streszczenie =
      "Na samym początku poprosiłeś o policzenie sprzedaży za sierpień z pliku " +
      "faktury-2026-08.csv oraz kontrahenci.csv i zapisanie tego jako arkusz."
    expect(unbackedPromises(streszczenie, wczesniej, [])).toEqual([])
  })

  it("plik leżący w teczce sprawy broni się sam", () => {
    expect(
      unbackedPromises("Zapisałem zestawienie.csv.", [], [plik("zestawienie.csv")]),
    ).toEqual([])
  })

  it("milczy, gdy odpowiedź niczego sobie nie przypisuje", () => {
    // Bez czasownika przypisania nie ma obietnicy — samo wymienienie nazwy pliku
    // w zdaniu „nie znalazłem raport.md" nie jest twierdzeniem, że powstał.
    expect(unbackedPromises("Nie znalazłem pliku raport.md.", [], [])).toEqual([])
  })

  it("nie daje się zmylić czynnością, która się NIE UDAŁA", () => {
    const events = [
      { type: "tool_start", id: "z", name: "read_file", label: "x", args: { path: "tajne.csv" } },
      { type: "tool_end", id: "z", name: "read_file", ok: false, summary: "nie udało się", ms: 1 },
    ] as DeskEvent[]
    expect(unbackedPromises("Zapisałem tajne.csv.", events, [])).toEqual(["tajne.csv"])
  })
})
