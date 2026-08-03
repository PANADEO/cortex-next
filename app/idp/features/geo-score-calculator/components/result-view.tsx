"use client"

// Tryb wyniku, wspólny dla Kalkulatora (świeżo policzony wynik) i szczegółów
// Historii (wynik odczytany z zapisanego rekordu) — design doc §4.3: "Ten
// sam layout co tryb wyniku kalkulatora (4.1) — spójność, nie dwa różne
// sposoby prezentacji tego samego kształtu danych". Wyekstrahowane z
// app/(main)/geo-score-calculator/page.tsx (Faza 1) przy budowie ekranu
// szczegółów (Faza 2) — czysta prezentacja: `text`+`result` w, JSX bez
// stanu specyficznego dla żadnego z dwóch wywołujących. Interaktywność
// specyficzna dla Kalkulatora (przycisk "Edytuj ponownie", plakietka delty
// w sesji) wchodzi przez propsy (`delta`, `headerActions`), nie żyje tutaj.

import { Badge, Card, CardContent, Label, Progress } from "@cortex/ui"
import { cn } from "@cortex/utils"
import { TrendingDown, TrendingUp } from "lucide-react"
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { buildHighlightRanges, extractQuotedWord, toTextSegments } from "../highlight"
import type { AnalyzeGeoScoreResponseDto, GeoScoreGrade } from "../types"

const DIMENSION_LABELS = [
  { key: "statistics", label: "Statystyki i dane" },
  { key: "actionVerbs", label: "Czasowniki akcji" },
  { key: "structure", label: "Struktura tekstu" },
  { key: "objectivity", label: "Obiektywność" },
] as const

const GRADE_TONE: Record<GeoScoreGrade, { text: string; border: string; bg: string }> = {
  A: { text: "text-success", border: "border-success/40", bg: "bg-success/10" },
  B: { text: "text-success", border: "border-success/40", bg: "bg-success/10" },
  C: { text: "text-warning", border: "border-warning/40", bg: "bg-warning/10" },
  D: { text: "text-warning", border: "border-warning/40", bg: "bg-warning/10" },
  F: { text: "text-destructive", border: "border-destructive/40", bg: "bg-destructive/10" },
}

export interface GeoScoreResultViewProps {
  /** Tekst, na którym liczono wynik — świeżo wpisany (Kalkulator) albo
   *  zapisany `textContent` z historii. */
  text: string
  result: AnalyzeGeoScoreResponseDto
  /** Zmiana względem poprzedniej próby w TEJ SAMEJ sesji (Kalkulator, design
   *  doc §4.1) — `null`/pominięte na ekranie szczegółów Historii, gdzie nie
   *  ma pojęcia "poprzednia próba". */
  delta?: number | null
  /** Akcja przy hero score (np. "Edytuj ponownie" na Kalkulatorze) — pusta
   *  na ekranie szczegółów, gdzie edycja zapisanego wyniku nie ma sensu. */
  headerActions?: ReactNode
}

export function GeoScoreResultView({ text, result, delta = null, headerActions }: GeoScoreResultViewProps) {
  const [activeHighlightStart, setActiveHighlightStart] = useState<number | null>(null)
  const highlightRefs = useRef(new Map<number, HTMLElement>())

  const segments = useMemo(() => {
    const ranges = buildHighlightRanges(text, result)
    return toTextSegments(text, ranges)
  }, [text, result])

  useEffect(() => {
    if (activeHighlightStart === null) return
    const node = highlightRefs.current.get(activeHighlightStart)
    node?.scrollIntoView({ behavior: "smooth", block: "center" })
  }, [activeHighlightStart])

  function handleRecommendationClick(recommendation: string) {
    const word = extractQuotedWord(recommendation)
    if (!word) return
    const match = result.objectivity.foundWords.find(
      (found) => found.value.toLowerCase() === word.toLowerCase(),
    )
    if (match) setActiveHighlightStart(match.position)
  }

  return (
    <>
      <Card>
        <CardContent className="flex flex-wrap items-center gap-6 pt-6">
          <div
            className={cn(
              "flex flex-col items-center justify-center rounded-lg border px-6 py-4",
              GRADE_TONE[result.grade].border,
              GRADE_TONE[result.grade].bg,
            )}
          >
            <span className={cn("text-4xl font-bold tabular-nums", GRADE_TONE[result.grade].text)}>
              {result.totalScore.toFixed(1)}
            </span>
            <span className={cn("text-sm font-medium", GRADE_TONE[result.grade].text)}>
              Ocena {result.grade}
            </span>
          </div>

          {delta !== null ? (
            <Badge
              variant="outline"
              className={cn(
                "gap-1 text-sm",
                delta >= 0
                  ? "border-success/40 bg-success/10 text-success"
                  : "border-destructive/40 bg-destructive/10 text-destructive",
              )}
            >
              {delta >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
              {delta >= 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1)} od poprzedniej analizy
            </Badge>
          ) : null}

          <span className="text-sm text-muted-foreground">{result.wordCount} słów w tekście</span>

          {headerActions ? <div className="ml-auto">{headerActions}</div> : null}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
        <Card>
          <CardContent className="pt-6">
            <p className="mb-3 text-xs text-muted-foreground">
              Podświetlone fragmenty: dane liczbowe, słowa subiektywne. Kliknij rekomendację obok, żeby
              przejść do powiązanego fragmentu.
            </p>
            <div className="whitespace-pre-wrap text-sm leading-relaxed">
              {segments.map((segment) =>
                segment.highlighted ? (
                  <mark
                    key={segment.key}
                    ref={(node) => {
                      if (node) highlightRefs.current.set(segment.start, node)
                      else highlightRefs.current.delete(segment.start)
                    }}
                    className={cn(
                      "rounded px-0.5 text-inherit transition-shadow",
                      segment.kind === "stat" ? "bg-primary/20" : "bg-warning/30",
                      activeHighlightStart === segment.start && "ring-2 ring-primary",
                    )}
                  >
                    {segment.text}
                  </mark>
                ) : (
                  <span key={segment.key}>{segment.text}</span>
                ),
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardContent className="flex flex-col gap-4 pt-6">
              {DIMENSION_LABELS.map(({ key, label }) => {
                const score = result[key].score
                return (
                  <div key={key} className="flex flex-col gap-1.5">
                    <div className="flex items-baseline justify-between text-sm">
                      <span>{label}</span>
                      <span className="tabular-nums text-muted-foreground">{score.toFixed(1)}/100</span>
                    </div>
                    <Progress
                      value={score}
                      indicatorClassName={
                        score >= 75 ? "bg-success" : score >= 40 ? "bg-warning" : "bg-destructive"
                      }
                    />
                  </div>
                )
              })}

              {result.actionVerbs.foundVerbs.length > 0 ? (
                <div className="flex flex-col gap-1.5 border-t border-border pt-3">
                  <span className="text-xs text-muted-foreground">
                    Wykryte czasowniki akcji (metoda: {result.actionVerbs.method === "spacy" ? "spaCy" : "heurystyka"})
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {result.actionVerbs.foundVerbs.map((verb) => (
                      <Badge key={verb} variant="secondary" className="font-normal">
                        {verb}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          {result.recommendations.length > 0 ? (
            <Card>
              <CardContent className="flex flex-col gap-2 pt-6">
                <Label>Rekomendacje</Label>
                <ul className="flex flex-col gap-1.5">
                  {result.recommendations.map((recommendation, index) => {
                    const clickable = extractQuotedWord(recommendation) !== null
                    return (
                      <li key={index}>
                        {clickable ? (
                          <button
                            type="button"
                            onClick={() => handleRecommendationClick(recommendation)}
                            className="text-left text-sm text-foreground underline decoration-dotted underline-offset-2 hover:text-primary"
                          >
                            {recommendation}
                          </button>
                        ) : (
                          <p className="text-sm text-muted-foreground">{recommendation}</p>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  )
}
