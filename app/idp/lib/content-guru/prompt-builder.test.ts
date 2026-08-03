import { describe, expect, it } from "vitest"
import { buildContentGuruPrompt, type BuildContentGuruPromptInput } from "./prompt-builder"

const BASE_INPUT: BuildContentGuruPromptInput = {
  contentType: "post rekrutacyjny na LinkedIn",
  topic: "otwieramy rekrutację na Senior .NET Developer",
  targetAudience: "kandydaci z doświadczeniem w fintech",
  additionalInfo: "podkreśl elastyczne godziny pracy",
  template: null,
  clientContext: null,
  marketContext: null,
  keywordPhrase: null,
  metaDescription: null,
  forbiddenPhrases: [],
}

describe("buildContentGuruPrompt", () => {
  it("zawiera typ treści i odbiorcę w system prompcie", () => {
    const { systemPrompt } = buildContentGuruPrompt(BASE_INPUT)
    expect(systemPrompt).toContain("post rekrutacyjny na LinkedIn")
    expect(systemPrompt).toContain("kandydaci z doświadczeniem w fintech")
  })

  it("zawiera temat i dodatkowe informacje w user prompcie", () => {
    const { userPrompt } = buildContentGuruPrompt(BASE_INPUT)
    expect(userPrompt).toContain("otwieramy rekrutację na Senior .NET Developer")
    expect(userPrompt).toContain("podkreśl elastyczne godziny pracy")
  })

  it("odbiorca pusty -> fallback na uniwersalny ton, nie pusty string w prompcie", () => {
    const { systemPrompt } = buildContentGuruPrompt({ ...BASE_INPUT, targetAudience: "  " })
    expect(systemPrompt).toContain("Nie sprecyzowano")
  })

  it("dodatkowe informacje puste -> user prompt mówi 'Brak.'", () => {
    const { userPrompt } = buildContentGuruPrompt({ ...BASE_INPUT, additionalInfo: "   " })
    expect(userPrompt).toContain("Brak.")
  })

  it("template=null (ta runda, brak CRUD szablonów) -> brak sekcji 'Instrukcje szablonu'", () => {
    const { systemPrompt } = buildContentGuruPrompt(BASE_INPUT)
    expect(systemPrompt).not.toContain("Instrukcje szablonu")
  })

  it("template ustawiony -> jego treść trafia do system promptu (gotowość pod Round B)", () => {
    const { systemPrompt } = buildContentGuruPrompt({
      ...BASE_INPUT,
      template: "Zawsze zaczynaj od pytania retorycznego.",
    })
    expect(systemPrompt).toContain("Instrukcje szablonu")
    expect(systemPrompt).toContain("Zawsze zaczynaj od pytania retorycznego.")
  })

  it("clientContext/marketContext ustawione -> oba trafiają do promptu (gotowość pod Round C)", () => {
    const { systemPrompt } = buildContentGuruPrompt({
      ...BASE_INPUT,
      clientContext: "Klient: Acme Sp. z o.o., branża fintech.",
      marketContext: "Rynek: rosnący popyt na automatyzację.",
    })
    expect(systemPrompt).toContain("Kontekst klienta")
    expect(systemPrompt).toContain("Acme Sp. z o.o.")
    expect(systemPrompt).toContain("Kontekst rynku")
    expect(systemPrompt).toContain("rosnący popyt")
  })

  it("keywordPhrase/metaDescription ustawione -> oba trafiają do promptu (gotowość pod Round D)", () => {
    const { systemPrompt } = buildContentGuruPrompt({
      ...BASE_INPUT,
      keywordPhrase: "automatyzacja procesów finansowych",
      metaDescription: "Poznaj automatyzację procesów finansowych w Twojej firmie.",
    })
    expect(systemPrompt).toContain("automatyzacja procesów finansowych")
    expect(systemPrompt).toContain("Poznaj automatyzację")
  })

  it("forbiddenPhrases puste -> brak sekcji zakazanych fraz (Warstwa 1 z D5 wyłączona)", () => {
    const { systemPrompt } = buildContentGuruPrompt(BASE_INPUT)
    expect(systemPrompt).not.toContain("Zakazane frazy")
  })

  it("forbiddenPhrases niepuste -> wymienia każdą frazę w sekcji zakazów (Warstwa 1 z D5)", () => {
    const { systemPrompt } = buildContentGuruPrompt({
      ...BASE_INPUT,
      forbiddenPhrases: ["najlepszy na rynku", "gwarancja sukcesu"],
    })
    expect(systemPrompt).toContain("Zakazane frazy")
    expect(systemPrompt).toContain("najlepszy na rynku")
    expect(systemPrompt).toContain("gwarancja sukcesu")
  })

  it("bez escalation -> brak instrukcji retry w prompcie", () => {
    const { systemPrompt } = buildContentGuruPrompt({
      ...BASE_INPUT,
      forbiddenPhrases: ["najlepszy na rynku"],
    })
    expect(systemPrompt).not.toContain("złamała zakaz")
  })

  it("z escalation -> cytuje wprost złapaną frazę, nie ogólnikową instrukcję (D5 pkt 2)", () => {
    const { systemPrompt } = buildContentGuruPrompt({
      ...BASE_INPUT,
      forbiddenPhrases: ["najlepszy na rynku"],
      escalation: { matchedPhrases: ["najlepszy na rynku"] },
    })
    expect(systemPrompt).toContain("złamała zakaz")
    expect(systemPrompt).toContain('"najlepszy na rynku"')
  })

  it("escalation z pustą listą matchedPhrases -> traktowana jak brak eskalacji", () => {
    const withEmpty = buildContentGuruPrompt({
      ...BASE_INPUT,
      escalation: { matchedPhrases: [] },
    })
    expect(withEmpty.systemPrompt).not.toContain("złamała zakaz")
  })

  it("jest deterministyczna — te same argumenty dają identyczny wynik", () => {
    const first = buildContentGuruPrompt(BASE_INPUT)
    const second = buildContentGuruPrompt(BASE_INPUT)
    expect(first).toEqual(second)
  })
})
