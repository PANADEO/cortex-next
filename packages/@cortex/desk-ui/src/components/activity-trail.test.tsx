// @vitest-environment jsdom
// PRACA AGENTA JEST DO OBEJRZENIA NA ŻĄDANIE, A NIE PIERWSZĄ RZECZĄ, KTÓRĄ WIDAĆ.
//
// DLACZEGO POWSTAŁ. Zmierzone na prawdziwej sprawie: agent pomylił ścieżkę pliku, poprawił
// ją i dokończył zadanie. Ekran mówił „⚠ Zrobione z potknięciem", przebieg stał rozwinięty
// na stałe, a wiersz nieudanego kroku był otwarty od wejścia i pokazywał
// `FileNotFoundError: [Errno 2] No such file or directory`. Osoba, dla której to jest
// zbudowane, dostawała ostrzeżenie o zdarzeniu, które jej nie dotyczy, i ślad stosu pod nim.
//
// Objazd to nie awaria. Człowiek, który otworzył nie ten segregator i sięgnął po właściwy,
// nie zgłasza tego jako potknięcia. Rozstrzyga KROK OSTATNI, nie jakikolwiek.
//
// Trzy rzeczy psują się tu osobno i po cichu, więc każda ma osobną asercję Z KONTROLĄ
// UJEMNĄ: nagłówek, samo-zwinięcie i rozwinięcie wiersza. Ostatnia jest najgroźniejsza,
// bo `useState(k.status === "failed")` wygląda niewinnie i czyta się jak wygoda.

import type { DeskEvent } from "@cortex/desk-core/types"
import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { DeskLocaleProvider } from "../i18n/client"
import { makeDeskT } from "../i18n/locale"
import { ActivityTrail } from "./activity-trail"

const t = makeDeskT("pl")

let seq = 0
const entry = (event: DeskEvent) => ({ seq: seq++, at: "2026-09-04T07:40:00.000Z", event })

/** Para zdarzeń jednego kroku — dokładnie taka, jaka leży w bazie po turze. */
const step = (name: string, ok: boolean, summary: string, args: Record<string, unknown>) => {
  const id = `k${seq}`
  return [
    entry({ type: "tool_start", id, name, label: String(args.path ?? name), args }),
    entry({
      type: "tool_end",
      id,
      name,
      ok,
      summary,
      ms: 500,
      ...(ok ? {} : { reason: "computation-error" as const }),
    }),
  ]
}

const BOOM = "błąd wykonania — FileNotFoundError: [Errno 2] No such file or directory: 'hhh.xlsx'"

/** Przebieg ze sprawy 477f6c09: potknięcie w środku, udany krok na końcu. */
const detour = [
  ...step("read_document", true, "20 z 56 stron", { path: "Sprawy/c1/hhh.xlsx" }),
  ...step("run_computation", false, BOOM, { files: ["hhh.xlsx"], description: "policz" }),
  ...step("run_computation", true, "policzone, plików: 1", { files: ["Sprawy/c1/hhh.xlsx"] }),
]

/** Ten sam przebieg, ale ostatnia próba padła — tura naprawdę skończyła się źle. */
const ruined = [
  ...step("read_document", true, "20 z 56 stron", { path: "Sprawy/c1/hhh.xlsx" }),
  ...step("run_computation", false, BOOM, { files: ["hhh.xlsx"], description: "policz" }),
]

/** Samo drzewo — potrzebne osobno, bo `rerender` przyjmuje element, nie propsy. */
const trail = (entries: ReturnType<typeof entry>[], isWorking: boolean) => (
  <DeskLocaleProvider locale="pl">
    <ActivityTrail
      entries={entries}
      isWorking={isWorking}
      now={Date.parse("2026-09-04T07:41:00Z")}
    />
  </DeskLocaleProvider>
)

function show(entries: ReturnType<typeof entry>[], isWorking = false) {
  return render(
    <DeskLocaleProvider locale="pl">
      <ActivityTrail
        entries={entries}
        isWorking={isWorking}
        now={Date.parse("2026-09-04T07:41:00Z")}
      />
    </DeskLocaleProvider>,
  )
}

describe("nagłówek przebiegu", () => {
  it("tura z objazdem, ale udanym końcem, NIE straszy ostrzeżeniem", () => {
    show(detour)
    expect(screen.queryByText(/Zrobione z potknięciem/)).toBeNull()
    // Nagłówek mówi, co powstało — czyli to, po co człowiek tu przyszedł.
    expect(screen.getByRole("button", { name: /policzyłem/ })).toBeTruthy()
  })

  it("KONTROLA UJEMNA: tura, której ostatnia próba padła, ostrzega dalej", () => {
    // Bez tej asercji „ukryjmy potknięcia" zamieniłoby się w „ukryjmy porażki",
    // a to jest dokładnie ta zmiana, której w tym produkcie zrobić nie wolno.
    show(ruined)
    expect(screen.getByText(/Zrobione z potknięciem/)).toBeTruthy()
  })
})

describe("czy przebieg jest rozwinięty po wejściu na sprawę", () => {
  it("sprawa zrobiona — lista kroków jest SCHOWANA, nagłówek zostaje", () => {
    show(detour)
    expect(screen.queryByRole("list", { name: t("trail.steps") })).toBeNull()
  })

  it("KONTROLA UJEMNA: gdy tura padła, lista stoi otwarta", () => {
    show(ruined)
    expect(screen.getByRole("list", { name: t("trail.steps") })).toBeTruthy()
  })

  it("KONTROLA UJEMNA: w trakcie pracy widać, co się dzieje", () => {
    // Zwijanie w trakcie tury zabrałoby jedyną informację o tym, że coś się w ogóle dzieje.
    show(detour, true)
    expect(screen.getByRole("list", { name: t("trail.steps") })).toBeTruthy()
  })
})

describe("wiersz kroku, który padł", () => {
  it("NIE pokazuje śladu błędu sam z siebie, gdy tura się udała", () => {
    // Sprawa oglądana PO fakcie: cała tura naraz, ostatni krok udany. Wiersz, który
    // padł, zostaje w przebiegu z krzyżykiem — znika wyłącznie SAMO ROZWINIĘCIE.
    // Kto chce zobaczyć, klika; nic nie jest usunięte ani przemilczane.
    show(detour, true)
    expect(screen.queryByText(new RegExp("FileNotFoundError"))).toBeNull()
    const list = screen.getByRole("list", { name: t("trail.steps") })
    expect(within(list).getAllByRole("listitem")).toHaveLength(3)
  })

  it("ZAMYKA SIĘ SAM, gdy agent naprawi to w następnym kroku — NA ŻYWO", () => {
    // NAJWAŻNIEJSZY test w tym pliku i jedyny, który sprawdza tę rzecz W RUCHU.
    //
    // Test wyżej renderuje całą turę naraz, czyli scenariusz „wracam na sprawę sprzed
    // godziny". Na żywo jest inaczej: krok, który padł, przez chwilę JEST krokiem
    // ostatnim, więc wiersz słusznie się otwiera. Pytanie brzmi, co się dzieje POTEM.
    //
    // Zmierzone przed poprawką: nic. `useState` zamrażał decyzję w chwili montowania
    // wiersza, więc zostawał on otwarty do końca tury i człowiek patrzył na ślad
    // `FileNotFoundError` przez resztę pracy agenta — mimo że agent poprawił ścieżkę
    // i wszystko dokończył. Prop się zmieniał, stan nie.
    const view = render(trail(detour.slice(0, 4), true)) // odczyt ✓ + obliczenie ✕
    expect(screen.getByText(new RegExp("FileNotFoundError"))).toBeTruthy()

    view.rerender(trail(detour, true)) // przyszedł udany krok
    expect(screen.queryByText(new RegExp("FileNotFoundError"))).toBeNull()
  })

  it("ale RĘKI CZŁOWIEKA nie cofa — raz rozwinięty wiersz zostaje rozwinięty", () => {
    // Kontrola ujemna do poprawki wyżej. Bez niej „samo się zamyka" zatrzaskiwałoby
    // wiersz pod palcami osobie, która właśnie go czyta.
    const view = render(trail(detour.slice(0, 4), true))
    const failed = screen
      .getAllByRole("button")
      .find((b) => /Nie policzyłem/.test(b.textContent ?? ""))
    fireEvent.click(failed!) // zwija ręką
    expect(screen.queryByText(new RegExp("FileNotFoundError"))).toBeNull()
    fireEvent.click(failed!) // i rozwija z powrotem
    view.rerender(trail(detour, true))
    expect(screen.getByText(new RegExp("FileNotFoundError"))).toBeTruthy()
  })

  it("KONTROLA UJEMNA: gdy tura padła, powód i «co teraz» są widoczne od razu", () => {
    // Przy porażce zdanie o tym, co dalej, jest najważniejszą rzeczą na ekranie.
    show(ruined)
    expect(screen.getByText(new RegExp("FileNotFoundError"))).toBeTruthy()
  })
})
