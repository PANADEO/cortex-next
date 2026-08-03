import type { AnalyzeGeoScoreResponseDto } from "./types"

export interface HighlightRange {
  start: number
  end: number
  kind: "stat" | "subjective"
}

/**
 * Buduje rozłączne zakresy podświetleń z odpowiedzi /analyze, gotowe do
 * cięcia oryginalnego tekstu (`text.slice(start, end)`) — CELOWO różną
 * metodą dla obu kategorii, bo to dwa różne kształty danych po stronie
 * Pythona (services/geo-score-calculator/analyzers/{stats,objectivity}.py):
 *
 * - `statistics.examples[].value` to `match.group().strip()`. `.strip()`
 *   usuwa WYŁĄCZNIE końcowe białe znaki — żaden z 9 wzorców w stats.py
 *   dopasowuje wiodącą spację — więc `value` jest zawsze DOKŁADNIE prefiksem
 *   oryginalnego dopasowania w tekście źródłowym. Cięcie
 *   `position..position+value.length` jest bezpieczne i dowiedzione: dla
 *   żadnego wzorca `.strip()` nie może ruszyć nic PRZED `position`.
 * - `objectivity.foundWords[].value` to WYNIK NORMALIZACJI
 *   (`word.lower()` + `re.sub(r"[^\w]", "", ...)`) surowego tokenu spod
 *   `\S+`. Normalizacja może usunąć znaki z DOWOLNEGO miejsca tokenu (np.
 *   token doklejony do cudzysłowu/przecinka bez spacji: „najlepszy" →
 *   value="najlepszy", ale token w tekście jest dłuższy o cudzysłów) — użycie
 *   `value.length` dawałoby czasem przycięty/przesunięty fragment. Zamiast
 *   tego odtwarzamy granicę tokenu NIEZALEŻNIE od `value`: `position` to
 *   zawsze start dopasowania `\S+` (`_iter_words_with_positions` w
 *   objectivity.py), więc koniec to najbliższy biały znak (albo koniec
 *   tekstu) — dokładnie ta sama reguła, którą Python użył żeby wyznaczyć
 *   `position` w pierwszej kolejności.
 */
export function buildHighlightRanges(
  text: string,
  analysis: Pick<AnalyzeGeoScoreResponseDto, "statistics" | "objectivity">,
): HighlightRange[] {
  const raw: HighlightRange[] = []

  for (const example of analysis.statistics.examples) {
    const start = example.position
    const end = start + example.value.length
    if (start >= 0 && end <= text.length && end > start) raw.push({ start, end, kind: "stat" })
  }

  for (const found of analysis.objectivity.foundWords) {
    const start = found.position
    if (start < 0 || start >= text.length) continue
    let end = start
    while (end < text.length && !/\s/.test(text[end]!)) end++
    if (end > start) raw.push({ start, end, kind: "subjective" })
  }

  raw.sort((a, b) => a.start - b.start || a.end - b.end)

  // Rozłączność: przy (rzadkim, teoretycznym) nakładaniu się dwóch
  // kategorii na tym samym fragmencie zachowujemy PIERWSZY zakres —
  // zagnieżdżony/łamany <mark> byłby gorszy niż utrata jednego koloru.
  const merged: HighlightRange[] = []
  let cursor = 0
  for (const range of raw) {
    if (range.start < cursor) continue
    merged.push(range)
    cursor = range.end
  }
  return merged
}

/** Segment tekstu do renderowania: albo zwykły fragment, albo podświetlony. */
export type TextSegment =
  | { highlighted: false; text: string; key: string }
  | { highlighted: true; text: string; key: string; kind: HighlightRange["kind"]; start: number }

export function toTextSegments(text: string, ranges: HighlightRange[]): TextSegment[] {
  const segments: TextSegment[] = []
  let cursor = 0

  ranges.forEach((range, index) => {
    if (range.start > cursor) {
      segments.push({ highlighted: false, text: text.slice(cursor, range.start), key: `plain-${index}` })
    }
    segments.push({
      highlighted: true,
      text: text.slice(range.start, range.end),
      key: `mark-${range.start}`,
      kind: range.kind,
      start: range.start,
    })
    cursor = range.end
  })

  if (cursor < text.length) {
    segments.push({ highlighted: false, text: text.slice(cursor), key: "plain-tail" })
  }

  return segments
}

/** Wyciąga słowo z rekomendacji w formie `'słowo' → '...'` albo
 *  `Rozważ usunięcie lub uzasadnienie: 'słowo'` (jedyne dwa kształty, które
 *  `_generate_recommendations()` w objectivity.py generuje) — to jedyne
 *  rekomendacje niosące odniesienie do KONKRETNEGO fragmentu tekstu, więc
 *  jedyne, które mogą być klikalne (design doc §4.1: "tam gdzie ma sens"). */
export function extractQuotedWord(recommendation: string): string | null {
  const match = recommendation.match(/'([^']+)'/)
  return match ? match[1]! : null
}
