// Utility wspólne dla ekranu generowania (page.tsx, wszystkie trzy tryby) —
// wydzielone z page.tsx w Round C, bo tryb "Kilka"/"Pakiet"
// (generation-job-card.tsx) potrzebuje DOKŁADNIE tego samego podświetlania,
// co tryb "Pojedyncza" (drugi konsument uzasadnia ekstrakcję,
// architecture_rules.md §3).

import { Fragment, type ReactNode } from "react"

/**
 * Podświetla dopasowane zakazane frazy w wygenerowanej treści (`<mark>`,
 * case-insensitive) — design doc D5 pkt 2: user MUSI świadomie zobaczyć
 * trafienie, nie dostaje cichego sukcesu. Paleta amber spójna z resztą repo
 * (packages/@cortex/ui/src/components/status-badge.tsx: amber = ostrzeżenie).
 */
export function renderHighlightedContent(content: string, matchedPhrases: readonly string[]): ReactNode {
  if (matchedPhrases.length === 0) return content

  const escaped = matchedPhrases.map((phrase) => phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  const pattern = new RegExp(`(${escaped.join("|")})`, "gi")
  const parts = content.split(pattern)
  const lowerPhrases = matchedPhrases.map((phrase) => phrase.toLowerCase())

  return parts.map((part, index) =>
    lowerPhrases.includes(part.toLowerCase()) ? (
      <mark
        key={index}
        className="rounded-sm bg-amber-200 px-0.5 text-amber-950 dark:bg-amber-900/60 dark:text-amber-100"
      >
        {part}
      </mark>
    ) : (
      <Fragment key={index}>{part}</Fragment>
    ),
  )
}
