// Mini-generatory (design doc D8, Round D) — trzy małe narzędzia pomocnicze
// widoczne na ekranie generowania (§1.4/§4.1): generator tematów z
// transkrypcji (modal "Generator tematów"), fraza kluczowa SEO, meta
// description. Współdzielą adapter cortex-proxy (integration-client.ts) i
// temperaturę 0.3 (D3: "bardziej deterministyczne, skupione wyjście" — 1:1 z
// legacy `temperature=0.3` dla mini-generatorów, kontrastowo z 0.7 dla
// generacji właściwej treści w run-generation.ts).
//
// Celowo NIE przechodzą przez run-generation.ts (D5 — skan zakazanych fraz/
// eskalowany retry/zapis do content_archive): to są utility calls
// produkujące krótki tekst pomocniczy (temat/fraza/meta), nie finalną treść
// zapisywaną w archiwum — dokładnie ta sama zasada co "Testuj generację"
// (templates/test-generation/route.ts, Round B).
//
// Czyste funkcje budujące prompty + parser JSON-tablicy dla generatora
// tematów — zero I/O, testowane samodzielnie (mini-generators.test.ts).

export const MINI_GENERATOR_TEMPERATURE = 0.3
// Krótkie wyjścia (fraza/meta description/lista kilkunastu tematów) — nie
// potrzeba GENERATION_MAX_TOKENS (8000) z run-generation.ts.
export const MINI_GENERATOR_MAX_TOKENS = 600

export const TOPIC_COUNT_MIN = 5
export const TOPIC_COUNT_MAX = 20
export const TOPIC_COUNT_DEFAULT = 10

export const META_DESCRIPTION_MAX_CHARS = 160

export interface MiniGeneratorPrompt {
  systemPrompt: string
  userPrompt: string
}

// ---- generator tematów z transkrypcji ----

export interface BuildTopicsPromptInput {
  transcript: string
  /** Orientacyjna liczba tematów (legacy: slider 5-20) — instrukcja dla
   *  modelu, nie twardy kontrakt (`parseJsonStringArray()` przyjmuje
   *  dowolną długość tablicy, którą model realnie zwróci). */
  topicCount: number
}

export function buildTopicsPrompt(input: BuildTopicsPromptInput): MiniGeneratorPrompt {
  return {
    systemPrompt: `Jesteś asystentem wyciągającym tematy treści marketingowych, produktowych, rekrutacyjnych i PR z transkrypcji rozmowy lub notatki. Wypisz orientacyjnie ${input.topicCount} konkretnych, różnorodnych tematów, z których każdy da się rozwinąć w osobną, samodzielną treść.

Odpowiedz WYŁĄCZNIE tablicą JSON stringów, bez żadnego dodatkowego tekstu ani code fence, np.:
["Temat pierwszy", "Temat drugi", "Temat trzeci"]`,
    userPrompt: `Transkrypcja:\n${input.transcript}`,
  }
}

/**
 * Port `_parse_json_string_array()` z legacy (design doc §1.3/§1.5) —
 * parsuje odpowiedź modelu jako tablicę JSON stringów. Model czasem owija
 * odpowiedź w code fence (` ```json ... ``` `) albo dopisuje zdanie wstępu
 * mimo instrukcji "WYŁĄCZNIE tablicą JSON" — fallback bierze pierwszy blok
 * `[...]` znaleziony w tekście, zamiast twardo odrzucać całą odpowiedź.
 * Zwraca `[]` (nigdy nie rzuca) gdy nic sensownego się nie da wyciągnąć —
 * wołający (route) mapuje pustą tablicę na 502 czytelny dla użytkownika.
 */
export function parseJsonStringArray(raw: string): string[] {
  function tryParse(text: string): string[] | null {
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      return null
    }
    if (!Array.isArray(parsed)) return null
    const strings = parsed.filter((item): item is string => typeof item === "string")
    if (strings.length !== parsed.length) return null
    return strings.map((item) => item.trim()).filter(Boolean)
  }

  const direct = tryParse(raw.trim())
  if (direct && direct.length > 0) return direct

  const match = raw.match(/\[[\s\S]*\]/)
  if (match) {
    const fromMatch = tryParse(match[0])
    if (fromMatch && fromMatch.length > 0) return fromMatch
  }

  return []
}

// ---- fraza kluczowa SEO ----

export interface BuildKeywordPhrasePromptInput {
  topic: string
  targetAudience: string
  additionalInfo: string
}

export function buildKeywordPhrasePrompt(
  input: BuildKeywordPhrasePromptInput,
): MiniGeneratorPrompt {
  return {
    systemPrompt: `Jesteś specjalistą SEO. Na podstawie tematu treści zaproponuj JEDNĄ, krótką frazę kluczową (2-5 słów), naturalnie pasującą do treści i wartościową pod kątem wyszukiwarek.

Odpowiedz WYŁĄCZNIE samą frazą kluczową, bez cudzysłowów i bez żadnego dodatkowego tekstu.`,
    userPrompt: `Temat: ${input.topic}
Odbiorca: ${input.targetAudience.trim() || "Nie sprecyzowano."}
Dodatkowe informacje: ${input.additionalInfo.trim() || "Brak."}`,
  }
}

// ---- meta description ----

export interface BuildMetaDescriptionPromptInput {
  topic: string
  /** Fraza kluczowa wygenerowana wcześniej (design doc §1.4: "korzysta z już
   *  wygenerowanej frazy kluczowej jeśli jest") — opcjonalna, meta
   *  description da się wygenerować samodzielnie. */
  keywordPhrase: string | null
  targetAudience: string
  additionalInfo: string
}

export function buildMetaDescriptionPrompt(
  input: BuildMetaDescriptionPromptInput,
): MiniGeneratorPrompt {
  const sections = [
    `Jesteś specjalistą SEO. Napisz meta description (maksymalnie ${META_DESCRIPTION_MAX_CHARS} znaków) dla treści na podany temat — zachęcającą do kliknięcia, zgodną z tematem.`,
  ]
  if (input.keywordPhrase) {
    sections.push(`Naturalnie wpleć frazę kluczową: "${input.keywordPhrase}".`)
  }
  sections.push(
    `Odpowiedz WYŁĄCZNIE treścią meta description, bez cudzysłowów i bez żadnego dodatkowego tekstu.`,
  )

  return {
    systemPrompt: sections.join("\n\n"),
    userPrompt: `Temat: ${input.topic}
Odbiorca: ${input.targetAudience.trim() || "Nie sprecyzowano."}
Dodatkowe informacje: ${input.additionalInfo.trim() || "Brak."}`,
  }
}

/**
 * Modele czasem ignorują "bez cudzysłowów" i owijają krótką odpowiedź w parę
 * cudzysłowów — usuwamy TYLKO gdy otaczają CAŁY string (nie w środku
 * zdania), więc "najlepsza fraza" -> najlepsza fraza, ale
 * `powiedział "nie"` zostaje bez zmian.
 */
export function stripWrappingQuotes(value: string): string {
  const trimmed = value.trim()
  const pairs: [string, string][] = [
    ['"', '"'],
    ["'", "'"],
  ]
  for (const [open, close] of pairs) {
    if (trimmed.length >= 2 && trimmed.startsWith(open) && trimmed.endsWith(close)) {
      return trimmed.slice(open.length, trimmed.length - close.length).trim()
    }
  }
  return trimmed
}
