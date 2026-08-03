import { describe, expect, it } from "vitest"
import {
  buildKeywordPhrasePrompt,
  buildMetaDescriptionPrompt,
  buildTopicsPrompt,
  parseJsonStringArray,
  stripWrappingQuotes,
} from "./mini-generators"

describe("buildTopicsPrompt", () => {
  it("zawiera transkrypcję w user prompcie i orientacyjną liczbę tematów w system prompcie", () => {
    const { systemPrompt, userPrompt } = buildTopicsPrompt({
      transcript: "Rozmawialiśmy o nowej funkcji produktu i planach rekrutacyjnych.",
      topicCount: 8,
    })
    expect(systemPrompt).toContain("8")
    expect(systemPrompt).toContain("WYŁĄCZNIE tablicą JSON")
    expect(userPrompt).toContain("Rozmawialiśmy o nowej funkcji produktu")
  })
})

describe("buildKeywordPhrasePrompt", () => {
  it("zawiera temat w user prompcie i instrukcję pojedynczej frazy w system prompcie", () => {
    const { systemPrompt, userPrompt } = buildKeywordPhrasePrompt({
      topic: "Automatyzacja procesów finansowych",
      targetAudience: "Dyrektorzy finansowi",
      additionalInfo: "",
    })
    expect(systemPrompt).toContain("frazę kluczową")
    expect(userPrompt).toContain("Automatyzacja procesów finansowych")
    expect(userPrompt).toContain("Dyrektorzy finansowi")
  })

  it("odbiorca/dodatkowe informacje puste -> fallback tekst, nie pusty string", () => {
    const { userPrompt } = buildKeywordPhrasePrompt({ topic: "Temat", targetAudience: "  ", additionalInfo: "  " })
    expect(userPrompt).toContain("Nie sprecyzowano.")
    expect(userPrompt).toContain("Brak.")
  })
})

describe("buildMetaDescriptionPrompt", () => {
  it("bez frazy kluczowej -> brak instrukcji wplecenia frazy", () => {
    const { systemPrompt } = buildMetaDescriptionPrompt({
      topic: "Temat",
      keywordPhrase: null,
      targetAudience: "",
      additionalInfo: "",
    })
    expect(systemPrompt).not.toContain("Naturalnie wpleć frazę kluczową")
  })

  it("z frazą kluczową -> cytuje ją wprost w instrukcji (design doc §1.4: 'korzysta z już wygenerowanej frazy')", () => {
    const { systemPrompt } = buildMetaDescriptionPrompt({
      topic: "Temat",
      keywordPhrase: "automatyzacja finansów",
      targetAudience: "",
      additionalInfo: "",
    })
    expect(systemPrompt).toContain('"automatyzacja finansów"')
  })

  it("wspomina limit 160 znaków", () => {
    const { systemPrompt } = buildMetaDescriptionPrompt({
      topic: "Temat",
      keywordPhrase: null,
      targetAudience: "",
      additionalInfo: "",
    })
    expect(systemPrompt).toContain("160")
  })
})

describe("parseJsonStringArray", () => {
  it("parsuje czystą tablicę JSON", () => {
    expect(parseJsonStringArray('["Temat A", "Temat B"]')).toEqual(["Temat A", "Temat B"])
  })

  it("fallback: wyciąga tablicę spośród code fence + tekstu wokół", () => {
    const raw = 'Oto tematy:\n```json\n["Temat A", "Temat B", "Temat C"]\n```\nMam nadzieję, że pomoże.'
    expect(parseJsonStringArray(raw)).toEqual(["Temat A", "Temat B", "Temat C"])
  })

  it("przycina białe znaki i odrzuca puste stringi w wyniku", () => {
    expect(parseJsonStringArray('[" Temat A ", "", "Temat B"]')).toEqual(["Temat A", "Temat B"])
  })

  it("tablica z elementem nie-stringiem -> [] (nie próbuje zgadywać)", () => {
    expect(parseJsonStringArray('["Temat A", 42]')).toEqual([])
  })

  it("kompletnie nie-JSON tekst bez żadnego bloku [...] -> []", () => {
    expect(parseJsonStringArray("Przepraszam, nie mogę tego zrobić.")).toEqual([])
  })

  it("pusty string wejściowy -> []", () => {
    expect(parseJsonStringArray("")).toEqual([])
  })

  it("pusta tablica JSON -> [] (nie traktowana jak sukces z zerem tematów)", () => {
    expect(parseJsonStringArray("[]")).toEqual([])
  })
})

describe("stripWrappingQuotes", () => {
  it("usuwa parę cudzysłowów otaczających cały string", () => {
    expect(stripWrappingQuotes('"najlepsza fraza"')).toBe("najlepsza fraza")
  })

  it("usuwa parę pojedynczych cudzysłowów otaczających cały string", () => {
    expect(stripWrappingQuotes("'najlepsza fraza'")).toBe("najlepsza fraza")
  })

  it("nie rusza cudzysłowu, który nie otacza całego stringa", () => {
    expect(stripWrappingQuotes('Klient powiedział "nie" wprost.')).toBe('Klient powiedział "nie" wprost.')
  })

  it("przycina otaczające białe znaki niezależnie od cudzysłowów", () => {
    expect(stripWrappingQuotes("  fraza bez cudzysłowów  ")).toBe("fraza bez cudzysłowów")
  })
})
