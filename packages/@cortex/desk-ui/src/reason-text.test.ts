// Powód zatrzymania sprawy mówi w języku patrzącego — a nieznanej wartości nie udaje.
//
// DLACZEGO POWSTAŁ. `case_file.reason` trzyma DWA różne rodzaje wartości: kody, które
// Biurko zna i potrafi nazwać w obu językach, oraz zdania złożone z treści awarii.
// Do 03.09.2026 kodów nie było wcale — zatrzymanie zapisywało do bazy polskie zdanie,
// a ekran renderował je dosłownie. Wierszy się nie przepisuje, więc angielski użytkownik
// miał tam polszczyznę na zawsze.
//
// Test pilnuje obu stron tego rozróżnienia, bo pomylenie ich w którąkolwiek stronę jest
// widoczne dopiero u klienta: kod nietłumaczony to surowy `stopped-by-you` na ekranie,
// a zdanie potraktowane jak kod to pusty wiersz zamiast wyjaśnienia.

import { describe, expect, it } from "vitest"
import { makeDeskT } from "./i18n/locale"
import { reasonText } from "./lib"

describe("powód zatrzymania po ludzku", () => {
  it("znany kod mówi w języku patrzącego", () => {
    expect(reasonText(makeDeskT("pl"), "stopped-by-you")).toBe("przerwane przez Ciebie")
    expect(reasonText(makeDeskT("en"), "stopped-by-you")).toBe("you stopped it")
    expect(reasonText(makeDeskT("pl"), "server-restart")).toBe("przerwane restartem serwera")
  })

  it("zdanie awarii wraca bez zmian", () => {
    // `readableFailure` składa je z treści błędu, więc nie ma skończonej listy do
    // przetłumaczenia. Udawanie, że to kod, dałoby na ekranie pusto.
    const sentence = "Nie udało się połączyć z usługą rozpoznawania dokumentów."
    expect(reasonText(makeDeskT("pl"), sentence)).toBe(sentence)
  })

  it("NIEZNANY kod też wraca bez zmian, zamiast znikać", () => {
    // To jest zachowanie na wypadek trzeciego kodu dopisanego w bazie bez wpisu
    // w słowniku: człowiek zobaczy wtedy surowy napis — brzydki, ale prawdziwy —
    // a nie pustkę, po której nie da się zgadnąć, co się stało.
    expect(reasonText(makeDeskT("pl"), "stopped-by-limit")).toBe("stopped-by-limit")
  })

  it("stare sprawy dalej mówią to, co powiedziały", () => {
    // Wiersze zapisane przed wprowadzeniem kodów. Nie przepisujemy ich, więc muszą
    // przechodzić — i to jest powód, dla którego nieznana wartość wraca, a nie znika.
    expect(reasonText(makeDeskT("en"), "przerwane przez Ciebie")).toBe("przerwane przez Ciebie")
  })
})
