// Warstwa 2 walidacji zakazanych fraz (design doc D5) — post-generacyjny
// skan WYNIKU. Czysta funkcja, zero I/O/Drizzle: case-insensitive skan
// podłańcuchowy wygenerowanej treści przeciw liście zakazanych fraz usera —
// dokładnie ten sam prosty match, jaki legacy stosował przy polu frazy
// kluczowej (nie NLP, nie fuzzy, nie granice słów — podłańcuch wystarczy,
// bo to samo dotyczy fraz wielowyrazowych z myślnikami/odmianą).
//
// Orkiestracja retry (jedna automatyczna próba z eskalowaną instrukcją, D5
// pkt 2) żyje w route'cie (app/idp/app/api/content-guru/generate/route.ts) —
// woła LLM, więc nie jest "czysta" i nie należy tutaj. Ten plik odpowiada
// wyłącznie na dwa pytania: "które frazy są w tekście" i "jaki to daje status".

export type ContentGuruGenerationStatus = "done" | "done-with-warnings"

/**
 * Zwraca zakazane frazy znalezione w treści, w DOSŁOWNYM zapisie z listy
 * usera (nie w formie, w jakiej wystąpiły w treści) — UI podświetla `<mark>`
 * po tym tekście, route zapisuje go do `content_archive.matched_forbidden_
 * phrases`. Case-insensitive, substring, bez duplikatów (frazy różniące się
 * tylko wielkością liter liczą się jako jedno trafienie), kolejność =
 * kolejność pierwszego wystąpienia na liście usera.
 */
export function findMatchedForbiddenPhrases(
  content: string,
  forbiddenPhrases: readonly string[],
): string[] {
  if (!content || forbiddenPhrases.length === 0) return []

  const lowerContent = content.toLowerCase()
  const matched: string[] = []
  const seen = new Set<string>()

  for (const raw of forbiddenPhrases) {
    const phrase = raw.trim()
    if (!phrase) continue
    const key = phrase.toLowerCase()
    if (seen.has(key)) continue
    if (lowerContent.includes(key)) {
      matched.push(phrase)
      seen.add(key)
    }
  }

  return matched
}

/**
 * `"done-with-warnings"` jeśli po (ewentualnym) retry treść dalej zawiera
 * którąś zakazaną frazę. Treść jest i tak zapisywana — status jest WYŁĄCZNIE
 * widocznym ostrzeżeniem (banner + `<mark>`), nie blokadą eksportu/pobrania
 * (decyzja Alexa 03.08.2026, design doc §9 p.2 — zamknięta, nie do rewizji
 * w tej rundzie).
 */
export function resolveGenerationStatus(
  matchedPhrases: readonly string[],
): ContentGuruGenerationStatus {
  return matchedPhrases.length > 0 ? "done-with-warnings" : "done"
}
