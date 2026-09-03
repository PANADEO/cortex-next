// PROCEDURA W DOWODZIE — „Wg czego", czyli podstawa, a nie kolejny odczyt pliku.
//
// Ta lista jest jedyną rzeczą, której nie ma żaden z dziewięciu zbadanych systemów, i w
// biurze rachunkowym jest gotowym dowodem należytej staranności. Ma więc dwie właściwości
// i obie da się zepsuć jedną linijką, której nikt nie zauważy:
//
//   · procedura NIE JEST treścią wniesioną do sprawy — sprawa zrobiona wyłącznie po
//     przeczytaniu zasady firmy nadal jest sprawą BEZ wejścia i ma tak zostać opisana;
//   · procedura w trybie `always` wchodzi do promptu BEZ zdarzenia, więc do dowodu
//     NIE TRAFIA — i to jest świadome, bo dowód powstaje wyłącznie ze zdarzeń.
//
// Drugi punkt jest tym, który ktoś kiedyś „naprawi" w dobrej wierze: zobaczy, że zasady
// firmy wpłynęły na turę, i dopisze je do dowodu z bazy. Wtedy dowód przestanie pochodzić
// ze zdarzeń, a to jest jedyna teza tego produktu.

import { makeDeskT } from "@cortex/desk-ui/i18n/locale"
import { describe, expect, it } from "vitest"
import { evidenceFromEvents } from "../evidence"
import type { DeskEvent } from "../types"

const t = makeDeskT("pl")

let next = 0
const opened = (name: string, summary: string, ok = true): DeskEvent[] => {
  const id = `p${next++}`
  return [
    { type: "tool_start", id, name: "open_procedure", label: name, args: { name } },
    { type: "tool_end", id, name: "open_procedure", ok, summary, ms: 3 },
  ]
}
const readFile = (path: string): DeskEvent[] => {
  const id = `r${next++}`
  return [
    { type: "tool_start", id, name: "read_file", label: path, args: { path } },
    { type: "tool_end", id, name: "read_file", ok: true, summary: "10 wierszy", ms: 2 },
  ]
}
const wroteSheet = (name: string): DeskEvent[] => {
  const id = `w${next++}`
  return [
    { type: "tool_start", id, name: "write_sheet", label: name, args: { name, rows: 3 } },
    { type: "tool_end", id, name: "write_sheet", ok: true, summary: "3 wiersze", ms: 2 },
  ]
}

const signature = "«Zestawienie VAT», wydanie 3 · wydał Robert Nowak · 12.09.2026"

describe("«Wg czego» w dowodzie", () => {
  it("otwarta procedura daje wiersz z wydaniem i podpisem", () => {
    const d = evidenceFromEvents(opened("zestawienie-vat", signature), t)
    expect(d.basis.map((w) => w.text)).toEqual([`wg procedury ${signature}`])
    // Wydanie i nazwisko to CAŁA wartość tej listy. Wiersz bez nich mówiłby tylko,
    // że jakaś zasada istniała.
    expect(d.basis[0]?.text).toContain("wydanie 3")
    expect(d.basis[0]?.text).toContain("Robert Nowak")
  })

  it("procedura NIE trafia do «Co weszło» ani do «Co powstało»", () => {
    const d = evidenceFromEvents(opened("zestawienie-vat", signature), t)
    expect(d.intake).toEqual([])
    expect(d.produced).toEqual([])
  })

  it("sprawa zrobiona WYŁĄCZNIE według procedury nadal jest sprawą bez wejścia", () => {
    // Klasa `consults`, a nie `reads`, i to jest cała różnica. Gdyby procedura karmiła
    // zbiór „co weszło z biurka", zdanie o dokumencie powstałym bez zajrzenia do
    // czegokolwiek przestałoby się pojawiać tam, gdzie jest prawdziwe.
    const d = evidenceFromEvents([...opened("zasady", signature), ...wroteSheet("z.csv")], t)
    expect(d.unverified).toContain(t("evidence.noIntake"))
  })

  it("ale gdy plik NAPRAWDĘ wszedł, zdania o braku wejścia nie ma", () => {
    // Kontrola ujemna do testu wyżej.
    const d = evidenceFromEvents(
      [...opened("zasady", signature), ...readFile("Moje pliki/f.csv"), ...wroteSheet("z.csv")],
      t,
    )
    expect(d.unverified).not.toContain(t("evidence.noIntake"))
    expect(d.basis).toHaveLength(1)
    expect(d.intake).toHaveLength(1)
  })

  it("PROCEDURA `always` NIE ZOSTAWIA WIERSZA — bo nie zostawia zdarzenia", () => {
    // Najważniejszy test w tym pliku, i jedyny, który wygląda na pusty.
    //
    // Tryb `always` wkłada treść do promptu każdej tury i NAPRAWDĘ wpływa na wynik.
    // Kusi więc, żeby dopisać go do dowodu z bazy — „przecież wpłynął". Nie wolno:
    // dowód powstaje WYŁĄCZNIE ze zdarzeń, a tekst w prompcie nie jest czynnością.
    // Kto zechce to zmienić, ma najpierw zrobić z tego czynność.
    const d = evidenceFromEvents([...readFile("Moje pliki/f.csv"), ...wroteSheet("z.csv")], t)
    expect(d.basis).toEqual([])
  })

  it("NIEUDANE otwarcie nie dopisuje podstawy, której nie było", () => {
    // Model podał nazwę spoza zasięgu. Krok jest w przebiegu z krzyżykiem, ale sprawa
    // NIE została zrobiona według tej procedury — wiersz w «Wg czego» byłby nieprawdą
    // w liście, która ma być dowodem.
    const d = evidenceFromEvents(opened("premie-zarzadu", "nie ma procedury", false), t)
    expect(d.basis).toEqual([])
  })
})
