export interface PromptPair {
  systemPrompt: string
  userPrompt: string
}

export interface HighlightPromptInput {
  text: string
  target: string
  style: string
  maxHighlights: number
  contextWords: number
}

export interface TransformPromptInput {
  text: string
  transformation: string
  audience: string
  complexity: string
  tone: string
  preserveMeaning: boolean
  fixGrammar: boolean
  improveStructure: boolean
}

export interface AnalyzePromptInput {
  text: string
  areas: readonly string[]
}

export interface SummarizePromptInput {
  text: string
  summaryType: string
  length: string
  focus: string
  audience: string
  tone: string
}

export interface ContentPromptInput {
  contentType: string
  topic: string
  audience: string
  tone: string
  language: string
  details: string
}

export interface LinkedinPromptInput {
  topic: string
  postType: string
  tone: string
  length: string
  audience: string
  keywords: string
  context: string
  includeHashtags: boolean
  includeCta: boolean
}

export interface PresentationPromptInput {
  topic: string
  sourceText: string
  slideCount: number
  presentationType: string
  visualStyle: string
  includeCharts: boolean
}

export interface InvoicePromptInput {
  analysisType: string
  includeJson: boolean
  includeRisks: boolean
  sourceNote?: string
}

export function buildHighlightPrompt(input: HighlightPromptInput): PromptPair {
  return {
    systemPrompt: `Jesteś analitykiem tekstu. Zaznaczasz tylko fragmenty, które realnie pomagają użytkownikowi podjąć decyzję.

Cel analizy: ${input.target}
Styl prezentacji: ${input.style}
Maksymalna liczba fragmentów: ${input.maxHighlights}
Słów kontekstu wokół fragmentu: ${input.contextWords}

Zwróć:
1. Krótki werdykt, co w tekście jest najważniejsze.
2. Listę fragmentów z kategorią, cytatem i uzasadnieniem.
3. Wersję tekstu z oznaczeniami [[...]] tylko dla najważniejszych miejsc.
Nie koloruj HTML-em. Nie wymyślaj fragmentów spoza tekstu.`,
    userPrompt: input.text,
  }
}

export function buildTransformPrompt(input: TransformPromptInput): PromptPair {
  return {
    systemPrompt: `Jesteś redaktorem. Przepisz tekst tak, aby był gotowy do użycia, nie tylko "ładniejszy".

Typ transformacji: ${input.transformation}
Odbiorca: ${input.audience}
Poziom języka: ${input.complexity}
Ton: ${input.tone}
Zachowaj znaczenie: ${input.preserveMeaning ? "tak" : "nie"}
Popraw gramatykę: ${input.fixGrammar ? "tak" : "nie"}
Popraw strukturę: ${input.improveStructure ? "tak" : "nie"}

Zwróć:
1. Gotowy tekst.
2. Krótką listę najważniejszych zmian redakcyjnych.
Nie dodawaj pustych deklaracji ani metakomentarzy.`,
    userPrompt: input.text,
  }
}

export function buildAnalyzePrompt(input: AnalyzePromptInput): PromptPair {
  return {
    systemPrompt: `Jesteś analitykiem komunikacji. Przeanalizuj tekst w wybranych obszarach: ${input.areas.join(", ")}.

Zwróć wynik w sekcjach:
- Werdykt
- Sygnały w tekście
- Ryzyka lub słabe miejsca
- Rekomendacje poprawek
- Metryki jakościowe

Bądź konkretny i cytuj krótkie fragmenty jako dowód.`,
    userPrompt: input.text,
  }
}

export function buildSummarizePrompt(input: SummarizePromptInput): PromptPair {
  return {
    systemPrompt: `Jesteś specjalistą od syntez. Stwórz streszczenie, które jest użyteczne operacyjnie.

Typ: ${input.summaryType}
Długość: ${input.length}
Priorytet: ${input.focus}
Odbiorca: ${input.audience}
Ton: ${input.tone}

Zwróć:
1. Streszczenie.
2. Decyzje / działania, jeśli wynikają z tekstu.
3. Rzeczy niepewne lub wymagające sprawdzenia.
Nie pomijaj ograniczeń źródła.`,
    userPrompt: input.text,
  }
}

export function buildContentPrompt(input: ContentPromptInput): PromptPair {
  return {
    systemPrompt: `Jesteś senior copywriterem B2B. Tworzysz treść roboczą, którą można dalej edytować bez przepisywania od zera.

Typ treści: ${input.contentType}
Odbiorca: ${input.audience}
Ton: ${input.tone}
Język: ${input.language}

Wymagania:
- zacznij od mocnej struktury,
- unikaj generycznych fraz,
- dopisz wariant nagłówka lub hooka,
- zakończ konkretnym CTA, jeśli pasuje do typu treści.`,
    userPrompt: `Temat: ${input.topic}

Dodatkowe informacje:
${input.details || "Brak."}`,
  }
}

export function buildLinkedinPrompt(input: LinkedinPromptInput): PromptPair {
  return {
    systemPrompt: `Jesteś redaktorem LinkedIn dla ekspertów B2B. Pisz naturalnie, bez marketingowego nadęcia.

Typ posta: ${input.postType}
Ton: ${input.tone}
Długość: ${input.length}
Odbiorcy: ${input.audience}
Hashtagi: ${input.includeHashtags ? "tak" : "nie"}
CTA: ${input.includeCta ? "tak" : "nie"}

Zwróć:
1. Gotowy post.
2. Dwa alternatywne pierwsze zdania.
3. Krótką uwagę, co można doprecyzować przed publikacją.`,
    userPrompt: `Temat: ${input.topic}
Słowa kluczowe: ${input.keywords || "brak"}
Kontekst: ${input.context || "brak"}`,
  }
}

export function buildPresentationPrompt(input: PresentationPromptInput): PromptPair {
  return {
    systemPrompt: `Jesteś projektantem prezentacji. Zbuduj prezentację w formie czytelnego planu slajdów, a nie ściany tekstu.

Typ prezentacji: ${input.presentationType}
Liczba slajdów: ${input.slideCount}
Styl wizualny: ${input.visualStyle}
Wykresy: ${input.includeCharts ? "dodaj 1-2 propozycje wykresów" : "bez wykresów"}

Zwróć:
1. Tytuł prezentacji.
2. Listę slajdów: tytuł, cel slajdu, 3-5 punktów, sugestia wizualna.
3. Slajd końcowy z rekomendacją lub CTA.
4. Eksport HTML: prosty, semantyczny szkielet całej prezentacji w jednym bloku kodu.`,
    userPrompt: `Temat: ${input.topic}

Materiał źródłowy:
${input.sourceText || "Brak. Wygeneruj strukturę na podstawie tematu."}`,
  }
}

export function buildInvoicePrompt(input: InvoicePromptInput): PromptPair {
  return {
    systemPrompt: `Jesteś analitykiem dokumentów finansowych. Odczytujesz fakturę z obrazu i rozdzielasz fakty od niepewności.

Typ analizy: ${input.analysisType}
Dane JSON: ${input.includeJson ? "tak" : "nie"}
Ryzyka formalne: ${input.includeRisks ? "tak" : "nie"}

Zwróć:
1. Najważniejsze dane faktury.
2. Pozycje i kwoty.
3. Daty, NIP/VAT ID, waluty, terminy płatności.
4. Niepewności odczytu.
${input.includeJson ? "5. JSON z polami seller, buyer, invoice, line_items, totals, payment, warnings." : ""}
${input.includeRisks ? "6. Kontrolę ryzyk: braki, niespójności VAT, sumy, dane kontrahentów." : ""}

Jeśli obraz jest nieczytelny, powiedz dokładnie czego nie da się potwierdzić.`,
    userPrompt: `Przeanalizuj załączony obraz faktury.${input.sourceNote ? `\n\nŹródło: ${input.sourceNote}` : ""}`,
  }
}
