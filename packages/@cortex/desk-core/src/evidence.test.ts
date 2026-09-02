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
const sheet = (name: string) => step("write_sheet", { name, rows: 3 })

const evidence = (...events: DeskEvent[][]) => evidenceFromEvents(events.flat(), t)

describe("Dowód sprawy liczonej w piaskownicy", () => {
  it("nie twierdzi, że nikt nie zajrzał do plików, skoro weszły do obliczeń", () => {
    const e = evidence(computed(["Moje pliki/faktury-08.csv"]), sheet("zestawienie.csv"))
    expect(e.unverified).not.toContain(t("evidence.noIntake"))
  })

  it("wymienia w „Co weszło” każdy plik, który wszedł do piaskownicy", () => {
    const e = evidence(computed(["Moje pliki/f1.csv", "Moje pliki/f2.csv"]))
    expect(e.intake).toEqual([
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
    expect(e.intake).toEqual(["Moje pliki/f1.csv — 12 wierszy"])
  })

  it("pomija pozycje, które nie są nazwą pliku", () => {
    // Argumenty narzędzia pisze MODEL, więc lista może przyjść w każdym kształcie.
    const e = evidence(computed(["", "Moje pliki/f1.csv"] as string[]))
    expect(e.intake).toEqual(["wzięto do obliczeń: Moje pliki/f1.csv"])
  })

  it("nie przewraca się, gdy zamiast listy przyjdzie napis", () => {
    const events = [
      { type: "tool_start", id: "z", name: "run_computation", label: "x", args: { files: "nie-lista" } },
      { type: "tool_end", id: "z", name: "run_computation", ok: true, summary: "gotowe", ms: 1 },
    ] as DeskEvent[]
    expect(() => evidenceFromEvents(events, t)).not.toThrow()
    expect(evidenceFromEvents(events, t).intake).toEqual([])
  })
})
