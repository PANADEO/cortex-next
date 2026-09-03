// Rachunek, na którym stoi zdanie „czy to działa" i zdanie „czy warto płacić".
//
// DLACZEGO TE DWIE FUNKCJE MAJĄ WŁASNY TEST, skoro reszta modułu to SQL. Bo obie
// odpowiadają na pytanie zadane przez CZŁOWIEKA szefowi, a nie na pytanie o dane:
// jedna decyduje, co wchodzi do mianownika, druga — po której stronie stoją pieniądze
// wydane na pracę, która jeszcze trwa. Pomyłka w żadnej z nich nie wywraca ekranu:
// pokazuje inną liczbę, równie wiarygodną i równie ładnie sformatowaną.
//
// Samych zapytań tu nie ma i nie będzie — pomyłka w `where` jest widoczna wyłącznie
// na bazie, która to zapytanie wykona. Od tego jest `outcomes.integration.test.ts`.

import { describe, expect, it } from "vitest"
import { resultShare, splitCost } from "./outcomes"

describe("ile zleceń kończy się wynikiem", () => {
  it("liczy udział wśród spraw ZAKOŃCZONYCH", () => {
    expect(
      resultShare([
        { status: "done", cases: 7 },
        { status: "failed", cases: 2 },
        { status: "stopped", cases: 1 },
      ]),
    ).toBe(70)
  })

  it("praca w toku nie psuje wyniku samym tym, że trwa", () => {
    // Sprawa w toku nie jest ani sukcesem, ani porażką. Wliczona do mianownika
    // obniżałaby wynik tym mocniej, im więcej pracy dzieje się w chwili patrzenia —
    // czyli liczba spadałaby dokładnie w godzinach największego użycia narzędzia.
    const same = [
      { status: "done", cases: 3 } as const,
      { status: "failed", cases: 1 } as const,
    ]
    expect(resultShare(same)).toBe(75)
    expect(
      resultShare([...same, { status: "working", cases: 12 }, { status: "new", cases: 5 }]),
    ).toBe(75)
  })

  it("brak zakończonych spraw daje „nie wiadomo”, a nie zero", () => {
    // Zero czyta się jako „wszystko pada" — czyli dokładnie odwrotnie niż „nie ma
    // czego mierzyć", i to na ekranie, którym ktoś odpowiada szefowi.
    expect(resultShare([])).toBeNull()
    expect(resultShare([{ status: "working", cases: 4 }])).toBeNull()
    expect(resultShare([{ status: "failed", cases: 4 }])).toBe(0)
  })
})

describe("na co poszły pieniądze", () => {
  it("dzieli koszt na ten z wynikiem, ten bez wyniku i ten jeszcze nierozstrzygnięty", () => {
    expect(
      splitCost([
        { status: "done", usd: 1.5 },
        { status: "failed", usd: 0.75 },
        { status: "stopped", usd: 0.25 },
        { status: "working", usd: 0.4 },
        { status: "new", usd: 0.1 },
      ]),
    ).toEqual({ withResult: 1.5, withoutResult: 1, unfinished: 0.5 })
  })

  it("praca w toku nie jest stratą, dopóki się nie skończy", () => {
    // Doliczenie jej do „bez wyniku" kazałoby ekranowi kłamać tym bardziej, im więcej
    // się właśnie dzieje — a przełożony patrzy na ten ekran najczęściej w środku dnia.
    const { withoutResult, unfinished } = splitCost([{ status: "working", usd: 2 }])
    expect(withoutResult).toBe(0)
    expect(unfinished).toBe(2)
  })

  it("pusty rachunek to trzy zera, a nie brak odpowiedzi", () => {
    expect(splitCost([])).toEqual({ withResult: 0, withoutResult: 0, unfinished: 0 })
  })
})
