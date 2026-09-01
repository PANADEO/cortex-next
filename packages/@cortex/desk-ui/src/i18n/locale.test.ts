// Most między językiem Biurka a językiem powłoki — sama decyzja, bez przeglądarki.
//
// DLACZEGO POWSTAŁ. Biurko trzyma język w ciasteczku (czyta je serwer przy renderze),
// powłoka w `localStorage` (serwer go nie widzi). Dwa niezależne przełączniki dawały
// stan, w którym Biurko mówi po angielsku, a katalog aplikacji wita po polsku.
// Most naprawia to w efekcie, który PRZESTAWIA JĘZYK — a przestawienie języka
// przerysowuje ekran, co uruchamia efekt jeszcze raz. Cała ochrona przed pętlą siedzi
// w tej jednej funkcji: „równe" i „nieznane" muszą znaczyć „nie rób nic".

import { describe, expect, it } from "vitest"
import { adoptableShellLocale, DEFAULT_DESK_LOCALE } from "./locale"

describe("przejęcie języka powłoki", () => {
  it("różny język powłoki wygrywa — bo rozjazd może powstać tylko w hubie", () => {
    // Zmiana po stronie Biurka ustawia od razu obie strony, więc różnica znaczy,
    // że ktoś przestawił język tam, gdzie Biurka nie ma.
    expect(adoptableShellLocale("en", "pl")).toBe("en")
    expect(adoptableShellLocale("pl", "en")).toBe("pl")
  })

  it("ten sam język nie robi nic — inaczej efekt wołałby sam siebie w kółko", () => {
    expect(adoptableShellLocale("pl", "pl")).toBeNull()
    expect(adoptableShellLocale("en", "en")).toBeNull()
  })

  it("brak powłoki nie robi nic — Biurko stoi też jako aplikacja samodzielna", () => {
    expect(adoptableShellLocale(undefined, DEFAULT_DESK_LOCALE)).toBeNull()
    expect(adoptableShellLocale(null, DEFAULT_DESK_LOCALE)).toBeNull()
  })

  it("język, którego Biurko nie zna, nie robi nic", () => {
    // Powłoka może dorzucić język, którego słownik Biurka jeszcze nie ma. Przejęcie
    // go dałoby ekran złożony z samych kluczy — i to bez jednego błędu w konsoli.
    expect(adoptableShellLocale("de", "pl")).toBeNull()
    expect(adoptableShellLocale("", "pl")).toBeNull()
    expect(adoptableShellLocale(7, "pl")).toBeNull()
  })
})
