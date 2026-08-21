import { describe, expect, it } from "vitest"
import { LOCALES } from "./config"
import {
  formatClockTime,
  formatDateTime,
  formatDayMonthTime,
  formatNumber,
  formattingLocale,
} from "./formats"

/**
 * Data budowana z SKŁADOWYCH LOKALNYCH, nie z tekstu ISO ze strefą — inaczej
 * wynik zależałby od `TZ` maszyny, na której leci test, i suita byłaby zielona
 * u autora, a czerwona w CI.
 */
const MOMENT = new Date(2026, 7, 21, 10, 38, 0)

describe("formattingLocale", () => {
  it("ma odwzorowanie dla KAŻDEGO języka interfejsu", () => {
    // Trzeci język dokłada się do `LOCALES` i musi się tu wywrócić, a nie
    // po cichu sformatować jako `undefined`.
    for (const locale of LOCALES) {
      expect(formattingLocale(locale)).toMatch(/^[a-z]{2}-[A-Z]{2}$/)
    }
  })

  it("angielski jest BRYTYJSKI, nie amerykański", () => {
    // Klient jest europejski: dzień przed miesiącem, zegar 24-godzinny.
    expect(formattingLocale("en")).toBe("en-GB")
  })
})

/**
 * POLSKI JEST JĘZYKIEM ŹRÓDŁOWYM, więc jego wynik ma zostać identyczny co do
 * znaku z tym sprzed wprowadzenia mapy — na tych literałach stoją asercje
 * testów jednostkowych i e2e (m.in. wzorzec `/^6\s?000$/` w suicie
 * "Raportowanie Tokenów"). Literały poniżej są WPISANE ŚWIADOMIE, nie
 * wyliczone z `toLocaleString("pl-PL")`: test wyliczający oczekiwanie tą samą
 * funkcją, którą sprawdza, przechodzi także wtedy, gdy mapa wskaże zły tag.
 */
describe("formatowanie pod `pl` — parytet z zapisem sprzed zmiany", () => {
  it("liczby: brak grupowania do czterech cyfr, twarda spacja od pięciu", () => {
    expect(formatNumber(6000, "pl")).toBe("6000")
    expect(formatNumber(60000, "pl")).toBe("60 000")
    expect(formatNumber(1234567, "pl")).toBe("1 234 567")
  })

  it("data z godziną: kropki i przecinek", () => {
    expect(formatDateTime(MOMENT, "pl")).toBe("21.08.2026, 10:38:00")
  })

  it("skrót dzień-miesiąc-godzina", () => {
    expect(formatDayMonthTime(MOMENT, "pl")).toBe("21.08, 10:38")
  })

  it("sama godzina, zegar 24-godzinny", () => {
    expect(formatClockTime(MOMENT, "pl")).toBe("10:38")
  })
})

describe("formatowanie pod `en`", () => {
  it("liczby grupuje przecinkiem już od tysiąca", () => {
    expect(formatNumber(6000, "en")).toBe("6,000")
    expect(formatNumber(1234567, "en")).toBe("1,234,567")
  })

  it("data ma kolejność dzień/miesiąc/rok, nie miesiąc/dzień", () => {
    expect(formatDateTime(MOMENT, "en")).toBe("21/08/2026, 10:38:00")
    expect(formatDayMonthTime(MOMENT, "en")).toBe("21/08, 10:38")
  })

  it("godzina zostaje 24-godzinna, bez AM/PM", () => {
    // Sedno wyboru `en-GB`: `en-US` dałoby tu „10:38 AM".
    expect(formatClockTime(MOMENT, "en")).toBe("10:38")
    expect(formatClockTime(new Date(2026, 7, 21, 22, 5), "en")).toBe("22:05")
  })

  it("RÓŻNI SIĘ od polskiego — inaczej cała zmiana byłaby bez skutku", () => {
    expect(formatDayMonthTime(MOMENT, "en")).not.toBe(formatDayMonthTime(MOMENT, "pl"))
    expect(formatNumber(1234567, "en")).not.toBe(formatNumber(1234567, "pl"))
  })
})

describe("formatowanie przyjmuje też tekst ISO i znacznik czasu", () => {
  it("daje ten sam wynik co obiekt Date", () => {
    expect(formatDayMonthTime(MOMENT.toISOString(), "pl")).toBe(formatDayMonthTime(MOMENT, "pl"))
    expect(formatDayMonthTime(MOMENT.getTime(), "pl")).toBe(formatDayMonthTime(MOMENT, "pl"))
  })
})
