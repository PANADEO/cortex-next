// Krok, który się nie udał, PRZESTAJE KŁAMAĆ — w tytule i w trzech zdaniach pod nim.
//
// DLACZEGO POWSTAŁ. `describeStep` budowało tytuł jako `w toku ? running : ok`, czyli
// dwa zdania na trzy stany. Krok, który PADŁ, dostawał zdanie sukcesu: nad czynnością,
// po której arkusza nie ma, stało „Zapisałem arkusz”. To było JEDYNE miejsce w produkcie,
// w którym ekran mówił nieprawdę — a produkt, którego całym argumentem jest dowód,
// nie ma prawa mieć takiego miejsca ani jednego.
//
// CZEGO TEN PLIK PILNUJE, w kolejności ważności:
//   1. tytuł zależy od STATUSU, a nie od dwóch stanów z trzech;
//   2. trzy zdania stoją w stałej kolejności i żadne nie jest samym kluczem słownika;
//   3. środkowe zdanie NIE zapewnia, że nic się nie stało, gdy tego nie wiemy;
//   4. żadne zdanie nie niesie nazwy naszej infrastruktury ani roli bez zadania.

import { makeDeskT } from "@cortex/desk-ui/i18n/locale"
import { describe, expect, it } from "vitest"
import { describeFailure, describeStep, pairSteps, STEP_FAILURES, type Step } from "./steps"
import { cardFor, TOOL_CARDS } from "./tool-cards"
import type { DeskEvent, StepFailure } from "./types"

const pl = makeDeskT("pl")
const en = makeDeskT("en")

/** Para start/koniec jednego narzędzia — tak, jak zapisuje ją `runtime.ts`. */
const pair = (
  name: string,
  ok: boolean,
  reason?: StepFailure,
  args: Record<string, unknown> = {},
): DeskEvent[] => [
  { type: "tool_start", id: "k1", name, label: `etykieta ${name}`, args },
  {
    type: "tool_end",
    id: "k1",
    name,
    ok,
    summary: ok ? "gotowe" : "nie udało się",
    ms: 5,
    ...(reason === undefined ? {} : { reason }),
  },
]

const one = (events: DeskEvent[]): Step => {
  const [k] = pairSteps(events)
  if (!k) throw new Error("brak kroku")
  return k
}

describe("tytuł kroku zależy od statusu", () => {
  it("to samo narzędzie ma trzy różne tytuły w trzech stanach", () => {
    const running = one([
      { type: "tool_start", id: "k1", name: "write_sheet", label: "x", args: {} },
    ])
    const ok = one(pair("write_sheet", true))
    const failed = one(pair("write_sheet", false, "cannot-save"))

    const titles = [running, ok, failed].map((k) => describeStep(k, pl).title)
    expect(new Set(titles).size, `tytuły się powtarzają: ${titles.join(" · ")}`).toBe(3)
  })

  it.each(Object.keys(TOOL_CARDS))("%s: krok nieudany NIE dostaje zdania sukcesu", (name) => {
    const card = cardFor(name)
    const failed = describeStep(one(pair(name, false, "unknown")), pl).title
    const succeeded = describeStep(one(pair(name, true)), pl).title
    // TO JEST TA ASERCJA. Bez niej nad czynnością, która padła, stoi „Zapisałem arkusz”.
    expect(failed, `${name}: tytuł porażki jest tytułem sukcesu`).not.toBe(succeeded)
    // Zdanie, a nie surowy klucz: brakujący wpis w słowniku oddaje sam klucz.
    expect(failed, `${name}: brak zdania porażki w słowniku`).not.toBe(card.failed)
  })

  it("narzędzie z obcego serwera też ma zdanie porażki, a nie klucz", () => {
    // Karta obcego serwera powstaje w locie. Gdyby ominęła zdanie porażki, PIERWSZY
    // serwer MCP wróciłby do stanu sprzed zmiany — i to po cichu, bo nic by nie pękło.
    const foreign = describeStep(one(pair("mcp_nbp_kurs_waluty", false, "unknown")), pl).title
    expect(foreign).toBe("Nie odpytałem nbp")
    expect(foreign).not.toContain("mcp_")

    const noServer = describeStep(one(pair("cos_zupelnie_innego", false)), pl).title
    expect(noServer).toBe("Nie wykonałem czynności spoza katalogu")
  })

  it("krok udany i krok w toku dalej mówią to, co mówiły", () => {
    // Kontrola negatywna: poprawka nie może po prostu wszędzie wpisać porażki.
    expect(describeStep(one(pair("read_file", true, undefined, { path: "a.csv" })), pl).title).toBe(
      "Przeczytałem",
    )
    expect(
      describeStep(
        one([{ type: "tool_start", id: "k1", name: "read_file", label: "x", args: {} }]),
        pl,
      ).title,
    ).toBe("Czytam")
  })
})

describe("trzy zdania kroku, który się nie udał", () => {
  it("są wyłącznie przy porażce", () => {
    expect(describeFailure(one(pair("write_sheet", true)), pl)).toBeNull()
    expect(
      describeFailure(
        one([{ type: "tool_start", id: "k1", name: "write_sheet", label: "x", args: {} }]),
        pl,
      ),
    ).toBeNull()
  })

  it.each(STEP_FAILURES)("powód %s ma komplet zdań w obu językach", (reason) => {
    for (const [locale, translate] of [
      ["pl", pl],
      ["en", en],
    ] as const) {
      const text = describeFailure(one(pair("write_sheet", false, reason)), translate)
      expect(text, `${locale}/${reason}: brak zdań`).not.toBeNull()
      for (const [which, sentence] of Object.entries(text!)) {
        expect(sentence.length, `${locale}/${reason}/${which}: puste zdanie`).toBeGreaterThan(10)
        // Brakujący klucz oddaje SAM KLUCZ — kropka na końcu zdania go odróżnia.
        expect(sentence, `${locale}/${reason}/${which}: to jest klucz, nie zdanie`).not.toMatch(
          /^trail\.failure\./,
        )
      }
    }
  })

  it("każda klasa czynności ma własne zdanie o tym, czy coś się zmieniło", () => {
    // Zdanie środkowe bierze się z KLASY, więc każda klasa musi je mieć. Klasa bez zdania
    // pokazałaby na ekranie `trail.failure.changed.stores` — i to tylko przy tej jednej.
    const perClass = new Map<string, string>()
    for (const name of [...Object.keys(TOOL_CARDS), "mcp_nbp_kurs_waluty"]) {
      const card = cardFor(name)
      const text = describeFailure(one(pair(name, false, "unknown")), pl)
      expect(text, `${name}: brak zdań`).not.toBeNull()
      expect(text!.changed).not.toMatch(/^trail\./)
      perClass.set(card.kind, text!.changed)
    }
    // Klasy naprawdę się różnią — inaczej mielibyśmy jedno zdanie w siedmiu kopiach.
    expect(new Set(perClass.values()).size).toBeGreaterThan(3)
  })

  it("przy obcym serwerze zdanie środkowe NIE zapewnia, że nic się nie stało", () => {
    // Poprawka krytyka wpisana wprost: my nie wiemy, czy tamta strona zdążyła coś zrobić,
    // a zapewnienie bez pokrycia jest tym samym grzechem, co tytuł sukcesu nad porażką.
    const text = describeFailure(one(pair("mcp_nbp_kurs_waluty", false, "outside-service")), pl)
    expect(text!.changed).toMatch(/nie wiem/i)
    expect(text!.changed).toMatch(/dwa razy/)
  })

  it("przy czynności przerwanej w połowie też nie zapewniamy, że nic się nie stało", () => {
    const text = describeFailure(one(pair("write_sheet", false, "interrupted")), pl)
    expect(text!.changed).toMatch(/nie wiem/i)
  })

  it("krok bez zapisanego powodu dostaje bezpieczne zdanie, a nie pustkę", () => {
    // Sprawy sprzed wprowadzenia pola `reason` oraz narzędzia MCP, które go nie wpisują.
    const withoutReason = describeFailure(one(pair("write_document", false)), pl)
    const withUnknown = describeFailure(one(pair("write_document", false, "unknown")), pl)
    expect(withoutReason).toEqual(withUnknown)
    expect(withoutReason!.next).toMatch(/jeszcze raz/)
  })

  it("odmowa NIE jest nieudanym krokiem", () => {
    // `report_gap` nie przechodzi przez opakowywacz `step()` — emituje osobne zdarzenie
    // `blocked` i dostaje własną kartę (kłódkę). Gdyby kiedyś przeszło tamtą drogą, brak
    // zgody wyglądałby na ekranie jak awaria narzędzia: krzyżyk, słowo „nie udało się"
    // i rada „spróbuj jeszcze raz" pod czynnością, której powtórzenie nic nie zmieni.
    const refusal: DeskEvent[] = [
      { type: "blocked", description: "sprawdzić kontrahenta w wykazie VAT" },
    ]
    expect(pairSteps(refusal), "odmowa zrobiła się krokiem narzędzia").toHaveLength(0)
  })

  it("imię przełożonego wchodzi do zdania, gdy jest KOMU powiedzieć", () => {
    // Bez imienia zdanie kończy się adresatem bez twarzy albo obietnicą bez adresata;
    // to jest cały powód, dla którego `approver` w ogóle tu wchodzi.
    const k = one(pair("write_sheet", false, "cannot-save"))
    expect(describeFailure(k, pl, { approver: "Robert Nowak" })!.next).toContain("Robert Nowak")
  })

  it("nie odsyła przełożonego do niego samego", () => {
    // TO JEST TA ASERCJA. Na własnej sprawie Robert czytał „powiedz o tym swojemu
    // przełożonemu: Robert Nowak" — odesłanie do samego siebie, na koncie, na którym
    // jako jedyny mógł z tym cokolwiek zrobić. Ta sama usterka, którą `lock.tsx` zamknął
    // zdaniem `lock.youDecide`, tyle że o jeden ekran dalej.
    const k = one(pair("write_sheet", false, "cannot-save"))
    const mine = describeFailure(k, pl, { approver: "Robert Nowak", iAmTheApprover: true })!
    expect(mine.next, "zdanie odsyła przełożonego do niego samego").not.toContain("Robert Nowak")
    // Kontrola z drugiej strony: zdanie ma ZOSTAĆ radą, a nie zniknąć razem z imieniem.
    expect(mine.next).toBe(describeFailure(k, pl)!.next)
    expect(mine.next.length).toBeGreaterThan(10)
  })

  it("żadne zdanie nie niesie nazwy kontenera ani roli bez zadania", () => {
    for (const reason of STEP_FAILURES) {
      for (const name of Object.keys(TOOL_CARDS)) {
        const text = describeFailure(one(pair(name, false, reason)), pl)!
        const all = `${text.happened} ${text.changed} ${text.next}`
        for (const infra of ["cortex-proxy", "docker", "kontener", "localhost", "http"]) {
          expect(all.toLowerCase(), `${name}/${reason} niesie „${infra}”`).not.toContain(infra)
        }
        // Administrator wolno wymienić, ale nie jako całą radę na końcu zdania.
        expect(text.next, `${name}/${reason}: rola bez zadania`).not.toMatch(
          /^zgłoś to administratorowi\.?$/i,
        )
      }
    }
  })
})
