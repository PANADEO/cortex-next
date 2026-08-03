// Prompt builder Content Guru (design doc D3/§3) — czysta funkcja, zero
// Drizzle/I/O, testowana samodzielnie (prompt-builder.test.ts). Buduje
// system+user prompt z: głównej instrukcji + typu treści + treści szablonu
// (Round B) + kontekstu klienta/rynku (Round C) + frazy kluczowej/meta
// description (Round D, mini-generatory) + listy zakazanych fraz (Warstwa 1
// z D5 — wstrzyknięcie do promptu, tanie i użyteczne, ale tylko advisory) +
// opcjonalnej eskalacji na retry (Warstwa 2 z D5: route woła tę funkcję
// DRUGI raz z `escalation` ustawionym na frazy złapane po pierwszej próbie).
//
// `template`/`clientContext`/`marketContext`/`keywordPhrase`/`metaDescription`
// są `string | null` już TERAZ, mimo że żaden route w tej rundzie ich
// realnie nie wypełnia (CRUD szablonów/profili to Round B/C, mini-generatory
// to Round D) — kontrakt funkcji ma się NIE zmieniać, gdy tamte rundy
// dowiążą prawdziwy wybór w UI (design doc D7: "Injekcja do promptu zostaje
// 1:1 z legacy", niezależnie od tego skąd bierze się wybrany profil).

export interface ContentGuruPromptEscalation {
  /** Frazy złapane po POPRZEDNIEJ próbie — cytowane wprost w instrukcji
   *  retry, nie ogólne "nie łam zasad" (D5 pkt 2: "konkretne, nie ogólne"). */
  matchedPhrases: readonly string[]
}

export interface BuildContentGuruPromptInput {
  /** Wolny tekst typu treści w tej rundzie (np. "post rekrutacyjny na
   *  LinkedIn") — w Round B zamienia się na etykietę wybranego szablonu
   *  (`templates.category`/`templates.name`), z perspektywy tej funkcji to
   *  zawsze tylko opisowy string, nigdy identyfikator do rozwiązania tutaj. */
  contentType: string
  topic: string
  targetAudience: string
  additionalInfo: string
  /** Treść szablonu (Round B) — dodatkowe instrukcje WEWNĄTRZ typu treści,
   *  niezależne od `contentType`. `null` w tej rundzie (brak CRUD szablonów). */
  template: string | null
  /** Markdown blok kontekstu klienta (Round C, `_profile_to_markdown()` z
   *  legacy). `null` w tej rundzie (brak CRUD profili klienta). */
  clientContext: string | null
  /** Markdown blok kontekstu rynku (Round C). `null` w tej rundzie. */
  marketContext: string | null
  /** Fraza kluczowa SEO (Round D, mini-generator). `null` w tej rundzie. */
  keywordPhrase: string | null
  /** Meta description (Round D). `null` w tej rundzie. */
  metaDescription: string | null
  forbiddenPhrases: readonly string[]
  escalation?: ContentGuruPromptEscalation | null
}

export interface ContentGuruPrompt {
  systemPrompt: string
  userPrompt: string
}

export function buildContentGuruPrompt(input: BuildContentGuruPromptInput): ContentGuruPrompt {
  const sections: string[] = [
    `Jesteś senior copywriterem B2B. Tworzysz treść roboczą, którą można dalej edytować bez przepisywania od zera.

Typ treści: ${input.contentType}
Odbiorca: ${input.targetAudience.trim() || "Nie sprecyzowano — dobierz ton uniwersalny dla B2B."}`,
  ]

  if (input.template) {
    sections.push(`Instrukcje szablonu (przestrzegaj ich ściśle):\n${input.template}`)
  }

  if (input.clientContext) {
    sections.push(`Kontekst klienta:\n${input.clientContext}`)
  }

  if (input.marketContext) {
    sections.push(`Kontekst rynku:\n${input.marketContext}`)
  }

  if (input.keywordPhrase) {
    sections.push(`Fraza kluczowa SEO do naturalnego wplecenia w treść: "${input.keywordPhrase}"`)
  }

  if (input.metaDescription) {
    sections.push(
      `Meta description tej treści (dla kontekstu, nie do powtórzenia dosłownie w treści): "${input.metaDescription}"`,
    )
  }

  if (input.forbiddenPhrases.length > 0) {
    sections.push(
      `Zakazane frazy — BEZWZGLĘDNIE NIE UŻYWAJ żadnej z poniższych, w żadnej odmianie:\n${input.forbiddenPhrases
        .map((phrase) => `- ${phrase}`)
        .join("\n")}`,
    )
  }

  if (input.escalation && input.escalation.matchedPhrases.length > 0) {
    const quoted = input.escalation.matchedPhrases.map((phrase) => `"${phrase}"`).join(", ")
    sections.push(
      `UWAGA — poprzednia wersja tej treści złamała zakaz: użyła frazy ${quoted}, mimo wyraźnego zakazu powyżej. Napisz treść PONOWNIE, całkowicie unikając tej frazy i wszystkich innych zakazanych fraz — to jest niepodlegające negocjacji wymaganie, ważniejsze niż jakikolwiek inny styl czy struktura.`,
    )
  }

  sections.push(
    `Wymagania:
- zacznij od mocnej struktury,
- unikaj generycznych fraz,
- dopisz wariant nagłówka lub hooka,
- zakończ konkretnym CTA, jeśli pasuje do typu treści.`,
  )

  const userPrompt = `Temat: ${input.topic}

Dodatkowe informacje:
${input.additionalInfo.trim() || "Brak."}`

  return { systemPrompt: sections.join("\n\n"), userPrompt }
}
