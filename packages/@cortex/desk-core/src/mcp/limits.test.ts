// Dwa sufity wywołania MCP: czas i długość odpowiedzi.
//
// DLACZEGO POWSTAŁ. Wywołanie narzędzia MCP nie miało ANI JEDNEGO z nich.
//
//  — Bez zegara zawieszony serwer wiesza całą turę, a człowiek patrzy na krok „w toku"
//    bez końca. Biblioteka tego nie ratuje: `@ai-sdk/mcp` rozwiązuje żądanie dopiero,
//    gdy przyjdzie odpowiedź, a `signal` sprawdza wyłącznie w chwili jej przyjścia —
//    czyli sygnałem nie da się odwiesić zawieszonego wywołania. Zegar musi być nasz.
//  — Bez sufitu odpowiedź szła do modelu w całości. Serwer oddający dziesięć megabajtów
//    zjada okno kontekstu i pieniądze.
//
// Sufit ma jednak drugą połowę, ważniejszą od samego cięcia: OBCIĘCIE MUSI BYĆ WIDOCZNE.
// W tym produkcie ciche obcięcie zdarzyło się już kilka razy (`read_file`, stdout ścieżki
// zastępczej piaskownicy, `document-parser`) i jest uznane za klasę błędu. Dlatego asercje
// niżej sprawdzają nie tylko długość, ale i to, że obciętego wyniku NIE DA SIĘ pomylić
// z pełnym.

import { describe, expect, it, vi } from "vitest"
import {
  CALL_DEADLINE_MS,
  clipResult,
  INSPECT_DEADLINE_MS,
  RESULT_CEILING,
  withDeadline,
} from "./limits"

describe("sufit długości odpowiedzi", () => {
  it("odpowiedź mieszcząca się w sufitcie wraca NIETKNIĘTA", () => {
    // Kontrola negatywna: sufit nie ma prawa przepisywać kształtu poprawnego wyniku,
    // bo wtedy każde narzędzie MCP wygląda inaczej niż to, co wystawia serwer.
    const answer = { content: [{ type: "text", text: "czynny podatnik VAT" }] }
    const short = clipResult(answer)
    expect(short.clipped).toBe(false)
    expect(short.value).toBe(answer)
  })

  it("odpowiedź ponad sufit jest obcięta", () => {
    const huge = { content: [{ type: "text", text: "x".repeat(RESULT_CEILING * 3) }] }
    const cut = clipResult(huge)
    expect(cut.clipped).toBe(true)
    expect(JSON.stringify(cut.value).length).toBeLessThan(RESULT_CEILING * 2)
  })

  it("obcięty wynik NIE JEST nieodróżnialny od kompletnego", () => {
    // TO JEST TA ASERCJA — cała reszta tego opisu to tylko dojście do niej. Ciche
    // obcięcie zdarzyło się w tym produkcie kilka razy i za każdym razem objawiało się
    // tak samo: wynik niepełny wyglądał dokładnie jak pełny.
    const huge = { content: [{ type: "text", text: "x".repeat(RESULT_CEILING * 3) }] }
    const cut = clipResult(huge)
    const seen = cut.value as Record<string, unknown>
    // widoczne JAKO DANE — model może o to zapytać warunkiem, nie dopasowaniem napisu
    expect(seen.incomplete).toBe(true)
    expect(seen.limit).toBe(RESULT_CEILING)
    expect(seen.length).toBe(JSON.stringify(huge).length)
    // …i widoczne JAKO ZDANIE, bo to zdanie model przeczyta i powtórzy człowiekowi
    expect(String(seen.note)).toMatch(/NIE jest cała odpowiedź/)
    // pełna długość zostaje policzona, a nie zgubiona razem z uciętym ogonem
    expect(cut.length).toBeGreaterThan(RESULT_CEILING)
  })

  it("odpowiedź, której nie da się zserializować, nie kłamie o swojej długości", () => {
    expect(clipResult(undefined)).toEqual({ clipped: false, length: 0, value: undefined })
  })
})

describe("zegar po naszej stronie", () => {
  it("praca, która zdąży, oddaje swój wynik", async () => {
    const raced = await withDeadline(CALL_DEADLINE_MS, Promise.resolve("odpowiedź"))
    expect(raced).toEqual({ late: false, value: "odpowiedź" })
  })

  it("praca, która nigdy nie wraca, kończy się po terminie zamiast wisieć", async () => {
    vi.useFakeTimers()
    try {
      // Serwer, który przyjął żądanie i zamilkł. Bez zegara ta obietnica nie rozwiąże
      // się nigdy — i to jest dokładnie ten stan, w którym tura wisiała.
      const silent = new Promise<string>(() => {})
      const raced = withDeadline(CALL_DEADLINE_MS, silent)
      await vi.advanceTimersByTimeAsync(CALL_DEADLINE_MS + 1)
      expect(await raced).toEqual({ late: true })
    } finally {
      vi.useRealTimers()
    }
  })

  it("odrzucenie pracy dociera do wołającego, a nie ginie w wyścigu", async () => {
    await expect(
      withDeadline(CALL_DEADLINE_MS, Promise.reject(new Error("padło"))),
    ).rejects.toThrow("padło")
  })

  it("spóźniona praca nie zostawia nieobsłużonego odrzucenia", async () => {
    vi.useFakeTimers()
    try {
      let blow: (e: Error) => void = () => {}
      const late = new Promise<string>((_ok, no) => {
        blow = no
      })
      const raced = withDeadline(1000, late)
      await vi.advanceTimersByTimeAsync(1001)
      expect(await raced).toEqual({ late: true })
      // Serwer odzywa się PO terminie i to odezwanie jest błędem. `Promise.race` podpiął
      // do niego obsługę, więc proces Node nie dostaje `unhandledRejection`.
      blow(new Error("spóźniona awaria"))
      await vi.advanceTimersByTimeAsync(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it("na ekran przełożonego czeka się krócej niż na model w środku tury", () => {
    // Różnica jest w ODBIORCY, nie w technice: tam czeka model, tutaj stoi człowiek
    // przed formularzem. Gdyby te dwie liczby się zrównały, jedna z nich byłaby zła.
    expect(INSPECT_DEADLINE_MS).toBeLessThan(CALL_DEADLINE_MS)
  })
})
