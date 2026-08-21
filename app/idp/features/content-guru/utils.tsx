"use client"

// Utility wspólne dla ekranu generowania (page.tsx, wszystkie trzy tryby) —
// wydzielone z page.tsx w Round C, bo tryb "Kilka"/"Pakiet"
// (generation-job-card.tsx) potrzebuje DOKŁADNIE tego samego podświetlania,
// co tryb "Pojedyncza" (drugi konsument uzasadnia ekstrakcję,
// architecture_rules.md §3).

import { Badge } from "@cortex/ui"
import { AlertTriangle } from "lucide-react"
import { Fragment, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import type { ContentGuruGenerationStatus } from "./types"

/**
 * Badge statusu generacji (`done`/`done-with-warnings`, D5) — była
 * duplikowana lokalnie w page.tsx i skopiowana jako `ItemStatusBadge` w
 * generation-job-card.tsx (Round C). Round D dodaje TRZECIEGO/CZWARTEGO
 * konsumenta (/content-guru/history i /content-guru/history/[id]) —
 * ekstrakcja tutaj, obok `renderHighlightedContent()`, żeby paleta amber/
 * emerald nie rozjeżdżała się między ekranami tego samego modułu.
 */
export function ContentStatusBadge({ status }: { status: ContentGuruGenerationStatus }) {
  const { t } = useTranslation("content-guru")

  if (status === "done-with-warnings") {
    return (
      <Badge
        variant="outline"
        className="gap-1 border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
      >
        <AlertTriangle className="h-3 w-3" />
        {t("status.withWarnings")}
      </Badge>
    )
  }
  return (
    <Badge
      variant="outline"
      className="border-emerald-300 bg-emerald-100 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
    >
      {t("status.done")}
    </Badge>
  )
}

/**
 * Podświetla dopasowane zakazane frazy w wygenerowanej treści (`<mark>`,
 * case-insensitive) — design doc D5 pkt 2: user MUSI świadomie zobaczyć
 * trafienie, nie dostaje cichego sukcesu. Paleta amber spójna z resztą repo
 * (packages/@cortex/ui/src/components/status-badge.tsx: amber = ostrzeżenie).
 */
export function renderHighlightedContent(
  content: string,
  matchedPhrases: readonly string[],
): ReactNode {
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
