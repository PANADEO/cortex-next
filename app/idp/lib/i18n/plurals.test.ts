import { describe, expect, it } from "vitest"
import i18n from "./index"

/**
 * Polski ma CZTERY formy liczby mnogiej, angielski dwie — a test parzystości
 * wymaga identycznych zestawów kluczy w obu językach. Przez to pierwsze
 * kafelki obeszły plurale obejściem `…One` / `…Many`, które dla 2–4 daje
 * „2 ostrzeżeń" zamiast „2 ostrzeżenia".
 *
 * Rozwiązanie, które przechodzi obie bramki naraz: zadeklarować WSZYSTKIE
 * cztery przyrostki w OBU językach — angielski po prostu powtarza swoją formę
 * mnogą. Ten test sprawdza, że i18next realnie wybiera formę przez
 * `Intl.PluralRules`, a nie spada po cichu na `_other`; bez niego „działa"
 * opierałoby się na tym, że nikt nie sprawdził akurat dwójki.
 */
describe("liczba mnoga", () => {
  const cases: Array<[number, string]> = [
    [1, "1 zdarzenie"],
    [2, "2 zdarzenia"],
    [3, "3 zdarzenia"],
    [4, "4 zdarzenia"],
    [5, "5 zdarzeń"],
    [12, "12 zdarzeń"],
    [22, "22 zdarzenia"],
  ]

  it.each(cases)("po polsku %i daje „%s”", (count, expected) => {
    expect(i18n.getFixedT("pl", "ui")("actionLog.eventCount", { count })).toBe(expected)
  })

  it("po angielsku rozróżnia tylko pojedynczą i mnogą", () => {
    const t = i18n.getFixedT("en", "ui")
    expect(t("actionLog.eventCount", { count: 1 })).toBe("1 event")
    expect(t("actionLog.eventCount", { count: 2 })).toBe("2 events")
    expect(t("actionLog.eventCount", { count: 5 })).toBe("5 events")
  })
})

/**
 * Forma `_other` odpala się w polskim WYŁĄCZNIE dla ułamków — i tam polski
 * wymaga dopełniacza liczby POJEDYNCZEJ („1,5 zdarzenia"), a nie mnogiej.
 * Cztery rodziny w `ui` kopiowały do `_other` formę z `_many`, więc ułamek
 * dawał „1,5 zdarzeń". Nie widać tego w żadnym z siedmiu przypadków wyżej,
 * bo wszystkie są całkowite.
 */
describe("forma zapasowa dla ułamków", () => {
  const t = i18n.getFixedT("pl", "ui")

  it.each([
    ["actionLog.eventCount", "1.5 zdarzenia"],
    ["actionLog.moreFields", "+1.5 pola więcej"],
    ["actionLog.moreChanges", "+1.5 zmiany więcej"],
  ])("%s bierze dopełniacz liczby pojedynczej", (key, expected) => {
    expect(t(key, { count: 1.5 })).toBe(expected)
  })

  it("documentViewer.matched też, mimo dwóch podstawień", () => {
    expect(t("documentViewer.matched", { count: 1.5, row: 3 })).toBe(
      "Dopasowano 1.5 pola w wierszu 3.",
    )
  })
})

/**
 * Rodziny wyciągnięte z obejść `…One`/`…Many` (chip-input) i z polskiej reguły
 * odmiany zaszytej w KODZIE (kalkulator GEO Score). Wcześniej 2–4 dawało
 * „3 elementów"; tu przechodzi przez `Intl.PluralRules` jak wszystko inne.
 */
describe("liczba mnoga poza `ui:actionLog`", () => {
  it.each([
    [1, "element"],
    [3, "elementy"],
    [5, "elementów"],
    [22, "elementy"],
  ])("ui:chipInput.count dla %i daje „%s”", (count, expected) => {
    expect(i18n.getFixedT("pl", "ui")("chipInput.count", { count })).toBe(expected)
  })

  it.each([
    [1, "słowo"],
    [3, "słowa"],
    [5, "słów"],
    [0, "słów"],
  ])("geo-score-calculator:calculator.words dla %i daje „%s”", (count, expected) => {
    expect(i18n.getFixedT("pl", "geo-score-calculator")("calculator.words", { count })).toBe(
      expected,
    )
  })

  it.each([
    [1, "1 słowo w tekście"],
    [3, "3 słowa w tekście"],
    [5, "5 słów w tekście"],
  ])("geo-score-calculator:result.wordsInText dla %i daje „%s”", (count, expected) => {
    expect(i18n.getFixedT("pl", "geo-score-calculator")("result.wordsInText", { count })).toBe(
      expected,
    )
  })

  it("po angielsku obie rodziny mają tylko dwie formy", () => {
    const tUi = i18n.getFixedT("en", "ui")
    expect(tUi("chipInput.count", { count: 1 })).toBe("item")
    expect(tUi("chipInput.count", { count: 3 })).toBe("items")

    const tGeo = i18n.getFixedT("en", "geo-score-calculator")
    expect(tGeo("result.wordsInText", { count: 1 })).toBe("1 word in the text")
    expect(tGeo("result.wordsInText", { count: 3 })).toBe("3 words in the text")
  })
})
