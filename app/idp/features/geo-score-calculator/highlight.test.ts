import { describe, expect, it } from "vitest"
import { buildHighlightRanges, extractQuotedWord, toTextSegments } from "./highlight"

describe("buildHighlightRanges", () => {
  it("wycina statystykę dokładnie na position..position+value.length", () => {
    const text = "Wzrost wyniósł 30% w tym roku."
    const analysis = {
      statistics: { score: 0, count: 1, per100Words: 0, examples: [{ value: "30%", position: 15 }] },
      objectivity: { score: 0, subjectiveCount: 0, subjectiveRatio: 0, foundWords: [] },
    }

    const ranges = buildHighlightRanges(text, analysis)

    expect(ranges).toEqual([{ start: 15, end: 18, kind: "stat" }])
    expect(text.slice(15, 18)).toBe("30%")
  })

  // Regresja na dokładnie ten przypadek opisany w komentarzu highlight.ts:
  // wzorzec "kwota" ma opcjonalną walutę na końcu (`\s*(?:PLN|...)?`) — bez
  // waluty w tekście regex i tak łapie spację PRZED miejscem, gdzie waluta
  // by się zaczęła, więc `match.group()` = "5 mln " (ZE spacją na końcu),
  // a `.strip()` w Pythonie ją usuwa: `value` = "5 mln" (BEZ spacji).
  // `position` wskazuje始 początek dopasowania niezmiennie — sprawdzamy, że
  // podświetlenie kończy się dokładnie na "mln", nie zjada litery "w" z
  // kolejnego słowa i nie zostawia spacji w środku <mark>.
  it("statystyka ze strip()-owaną końcową spacją (wzorzec 'kwota' bez waluty) nie zjada sąsiedniego słowa", () => {
    const text = "Spółka zainwestowała 5 mln w nowy zakład."
    const position = text.indexOf("5 mln")
    const analysis = {
      statistics: { score: 0, count: 1, per100Words: 0, examples: [{ value: "5 mln", position }] },
      objectivity: { score: 0, subjectiveCount: 0, subjectiveRatio: 0, foundWords: [] },
    }

    const ranges = buildHighlightRanges(text, analysis)

    expect(ranges).toEqual([{ start: position, end: position + 5, kind: "stat" }])
    // Krytyczne: DOKŁADNIE "5 mln" — ani ze spacją na końcu ("5 mln "), ani
    // zjadające sąsiednie słowo ("5 mln w").
    expect(text.slice(ranges[0]!.start, ranges[0]!.end)).toBe("5 mln")
    expect(text[ranges[0]!.end]).toBe(" ")
  })

  // Regresja na dokładnie ten przypadek opisany w komentarzu highlight.ts:
  // token doklejony do polskiego cudzysłowu otwierającego bez spacji — `\S+`
  // (Python) łapie cudzysłów jako pierwszy znak tokenu, normalizacja go
  // usuwa z `value`, więc `value.length` byłby o 1 za krótki i podświetlenie
  // ucięłoby ostatnią literę słowa zamiast pierwszego znaku (cudzysłowu).
  it("obiektywność ze słowem doklejonym do cudzysłowu — podświetla cały token, nie value.length", () => {
    const text = 'Klienci nazwali to rozwiązanie „najlepszym" na rynku.'
    const position = text.indexOf("„najlepszym")
    const analysis = {
      statistics: { score: 0, count: 0, per100Words: 0, examples: [] },
      objectivity: {
        score: 0,
        subjectiveCount: 1,
        subjectiveRatio: 0,
        // Python zwróciłby znormalizowane "najlepszym" (9 znaków krótsze o
        // cudzysłowy), ale surowy token w tekście to „najlepszym" (11 znaków).
        foundWords: [{ value: "najlepszym", position }],
      },
    }

    const ranges = buildHighlightRanges(text, analysis)

    expect(ranges).toHaveLength(1)
    // Token kończy się na najbliższym białym znaku, nie na position+value.length.
    expect(text.slice(ranges[0]!.start, ranges[0]!.end)).toBe('„najlepszym"')
  })

  it("zwykłe słowo otoczone spacjami — token pokrywa się z value", () => {
    const text = "To jest najlepszy produkt na rynku."
    const position = text.indexOf("najlepszy")
    const analysis = {
      statistics: { score: 0, count: 0, per100Words: 0, examples: [] },
      objectivity: {
        score: 0,
        subjectiveCount: 1,
        subjectiveRatio: 0,
        foundWords: [{ value: "najlepszy", position }],
      },
    }

    const ranges = buildHighlightRanges(text, analysis)

    expect(ranges).toEqual([{ start: position, end: position + "najlepszy".length, kind: "subjective" }])
  })

  it("token na samym końcu tekstu (bez trailing whitespace) nie wychodzi poza długość tekstu", () => {
    const text = "Nasz produkt jest wyjątkowy"
    const position = text.indexOf("wyjątkowy")
    const analysis = {
      statistics: { score: 0, count: 0, per100Words: 0, examples: [] },
      objectivity: {
        score: 0,
        subjectiveCount: 1,
        subjectiveRatio: 0,
        foundWords: [{ value: "wyjątkowy", position }],
      },
    }

    const ranges = buildHighlightRanges(text, analysis)

    expect(ranges).toEqual([{ start: position, end: text.length, kind: "subjective" }])
  })

  it("odrzuca nakładające się zakresy, zachowując pierwszy (sortowany po starcie)", () => {
    const text = "najlepszy 30% wynik"
    const analysis = {
      statistics: { score: 0, count: 1, per100Words: 0, examples: [{ value: "30%", position: 10 }] },
      objectivity: {
        score: 0,
        subjectiveCount: 1,
        subjectiveRatio: 0,
        // Sztucznie nachodzący zakres na tę samą pozycję co statystyka.
        foundWords: [{ value: "30", position: 10 }],
      },
    }

    const ranges = buildHighlightRanges(text, analysis)

    expect(ranges).toHaveLength(1)
    expect(ranges[0]!.kind).toBe("stat")
  })

  it("ignoruje position poza zakresem tekstu zamiast rzucać/psuć slice", () => {
    const text = "Krótki tekst."
    const analysis = {
      statistics: { score: 0, count: 1, per100Words: 0, examples: [{ value: "30%", position: 999 }] },
      objectivity: { score: 0, subjectiveCount: 0, subjectiveRatio: 0, foundWords: [] },
    }

    expect(buildHighlightRanges(text, analysis)).toEqual([])
  })
})

describe("toTextSegments", () => {
  it("przeplata zwykłe fragmenty i podświetlenia w poprawnej kolejności", () => {
    const text = "A 30% B najlepszy C"
    const ranges = [
      { start: 2, end: 5, kind: "stat" as const },
      { start: 8, end: 17, kind: "subjective" as const },
    ]

    const segments = toTextSegments(text, ranges)

    expect(segments.map((s) => s.text)).toEqual(["A ", "30%", " B ", "najlepszy", " C"])
    expect(segments.map((s) => s.highlighted)).toEqual([false, true, false, true, false])
  })

  it("bez zakresów zwraca cały tekst jako jeden segment", () => {
    const segments = toTextSegments("Zwykły tekst bez trafień.", [])
    expect(segments).toEqual([
      { highlighted: false, text: "Zwykły tekst bez trafień.", key: "plain-tail" },
    ])
  })
})

describe("extractQuotedWord", () => {
  it("wyciąga słowo z rekomendacji typu \"'słowo' → 'alternatywa'\"", () => {
    expect(extractQuotedWord("'najlepszy' → 'wysoko oceniany'")).toBe("najlepszy")
  })

  it("wyciąga słowo z rekomendacji typu \"Rozważ usunięcie lub uzasadnienie: 'słowo'\"", () => {
    expect(extractQuotedWord("Rozważ usunięcie lub uzasadnienie: 'unikalny'")).toBe("unikalny")
  })

  it("zwraca null dla rekomendacji bez cytowanego słowa (stats/verbs/structure)", () => {
    expect(
      extractQuotedWord("Dodaj więcej danych liczbowych: procenty, kwoty, wyniki, statystyki"),
    ).toBeNull()
  })
})
