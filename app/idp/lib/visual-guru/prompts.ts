// Budowanie promptu wysyłanego DO MODELU — code-integration, nie dotyka
// Drizzle, więc żyje tutaj (lib/), nie w @cortex/service (code-service/SKILL.md
// "Kiedy coś jest code-service, a kiedy nie").
//
// D3 (design doc sekcja 2): brak kroku "N opisów kandydatów" legacy — user
// wpisuje docelowy prompt wprost. D4 (Ścieżka B): "wierność" względem obrazu
// referencyjnego NIE jest parametrem API (`input_fidelity` legacy nie ma tu
// odpowiednika), tylko dopiskiem do TREŚCI promptu.
//
// WAŻNE: prompt zwrócony przez buildModelPrompt() to WYŁĄCZNIE to, co leci do
// cortex-proxy — NIE to, co trafia do kolumny generations.prompt (route
// zapisuje surowy prompt usera osobno, żeby archiwum/historia — Faza 2 — nie
// pokazywały dopisków o wierności jako część "tego, co user napisał").

export const FIDELITY_KEYS = ["high", "loose"] as const
export type FidelityKey = (typeof FIDELITY_KEYS)[number]

const FIDELITY_HINTS: Record<FidelityKey, string> = {
  high: "Zachowaj wysoką wierność względem załączonego obrazu (obrazów) referencyjnego — trzymaj się jego kompozycji, kolorystyki i głównych elementów tak ściśle, jak to możliwe.",
  loose:
    "Potraktuj załączony obraz (obrazy) referencyjny wyłącznie jako luźną inspirację — możesz swobodnie odejść od jego kompozycji i szczegółów.",
}

export interface BuildModelPromptInput {
  prompt: string
  additionalContext?: string | undefined
  fidelity?: FidelityKey | undefined
  hasReferenceImages: boolean
}

/** Konkatenacja prompt + kontekst + (opcjonalny) dopisek o wierności — wzorem
 *  legacy `visual_guru.py`. Dopisek o wierności pojawia się TYLKO, gdy jest
 *  co najmniej jeden obraz referencyjny — bez obrazu "wierność" nie ma sensu. */
export function buildModelPrompt(input: BuildModelPromptInput): string {
  const parts = [input.prompt.trim()]
  if (input.additionalContext?.trim()) parts.push(input.additionalContext.trim())
  if (input.hasReferenceImages && input.fidelity) parts.push(FIDELITY_HINTS[input.fidelity])
  return parts.join("\n\n")
}
