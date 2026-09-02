// Nieudane obliczenie mówi, CO się zepsuło — nie tylko, że się zepsuło.
//
// Zmierzone na żywej sprawie przed poprawką: trzy nieudane obliczenia, 96 bajtów treści
// błędu wyprodukowanej przez kod, i ani jednego znaku z tego w dowodzie. Człowiek widział
// „Zobaczyłem: błąd wykonania" i tyle — ani on, ani wsparcie nie mieli z czego zdiagnozować.

import { describe, expect, it } from "vitest"
import { sandboxFailureLine } from "./failure"

describe("powód, dla którego obliczenie padło", () => {
  it("wyciąga linię wyjątku z tracebacku Pythona", () => {
    const traceback = [
      "Traceback (most recent call last):",
      '  File "<string>", line 3, in <module>',
      "    d = pd.read_csv('faktury.csv')",
      "NameError: name 'pd' is not defined",
    ].join("\n")
    expect(sandboxFailureLine(traceback)).toBe("NameError: name 'pd' is not defined")
  })

  it("pomija ramki i puste linie, gdy błąd kończy się nowym wierszem", () => {
    expect(sandboxFailureLine("Traceback (most recent call last):\nKeyError: 'nip'\n\n")).toBe(
      "KeyError: 'nip'",
    )
  })

  it("radzi sobie ze śladem Node, gdzie ramki zaczynają się od `at`", () => {
    const slad = [
      "ReferenceError: pandas is not defined",
      "    at Object.<anonymous> (/work/kod.js:2:1)",
      "    at Module._compile (node:internal/modules/cjs/loader:1234:14)",
    ].join("\n")
    expect(sandboxFailureLine(slad)).toBe("ReferenceError: pandas is not defined")
  })

  it("tnie długi komunikat, bo to diagnoza, a nie kopia danych klienta", () => {
    // Komunikat wyjątku potrafi nieść wartość z pliku klienta. Jedna, ucięta linia
    // wystarcza do rozpoznania błędu i nie robi z dowodu drugiego miejsca na te dane.
    const dlugi = "ValueError: " + "kontrahent-z-pliku ".repeat(40)
    const out = sandboxFailureLine(dlugi)
    expect(out.length).toBeLessThanOrEqual(121)
    expect(out.endsWith("…")).toBe(true)
  })

  it("nie zmyśla powodu, gdy kod nic nie wypisał", () => {
    // Kontrola negatywna: pusty wynik ma dać pustkę, żeby wołający wiedział, że nie ma
    // czego pokazać, zamiast wstawiać w dowód zdanie bez pokrycia.
    expect(sandboxFailureLine("")).toBe("")
    expect(sandboxFailureLine("\n  \n")).toBe("")
  })
})
