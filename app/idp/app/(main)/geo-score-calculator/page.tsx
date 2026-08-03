"use client"

import { toastApiError } from "@cortex/api"
import { Badge, Button, Card, CardContent, Label, PageHeader, Progress, Textarea } from "@cortex/ui"
import { cn } from "@cortex/utils"
import { ArrowLeft, Sparkles, TrendingDown, TrendingUp } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { useAnalyzeGeoScore } from "@/features/geo-score-calculator/hooks"
import { buildHighlightRanges, extractQuotedWord, toTextSegments } from "@/features/geo-score-calculator/highlight"
import type { AnalyzeGeoScoreResponseDto, GeoScoreGrade } from "@/features/geo-score-calculator/types"
import { EXAMPLE_TEXT } from "@/lib/geo-score-calculator/example-text"
import { TEXT_MAX_CHARS } from "@/lib/geo-score-calculator/limits"

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

function countWords(text: string): number {
  const trimmed = text.trim()
  return trimmed ? trimmed.split(/\s+/).length : 0
}

function wordLabel(count: number): string {
  if (count === 1) return "słowo"
  const lastDigit = count % 10
  const lastTwo = count % 100
  if (lastDigit >= 2 && lastDigit <= 4 && !(lastTwo >= 12 && lastTwo <= 14)) return "słowa"
  return "słów"
}

export default function GeoScoreCalculatorPage() {
  const [text, setText] = useState("")
  const [analyzedText, setAnalyzedText] = useState("")
  const [result, setResult] = useState<AnalyzeGeoScoreResponseDto | null>(null)
  const [previousScore, setPreviousScore] = useState<number | null>(null)
  const [delta, setDelta] = useState<number | null>(null)
  const [activeHighlightStart, setActiveHighlightStart] = useState<number | null>(null)
  const highlightRefs = useRef(new Map<number, HTMLElement>())
  const analyze = useAnalyzeGeoScore()

  const wordCount = countWords(text)

  const segments = useMemo(() => {
    if (!result) return []
    const ranges = buildHighlightRanges(analyzedText, result)
    return toTextSegments(analyzedText, ranges)
  }, [analyzedText, result])

  useEffect(() => {
    if (activeHighlightStart === null) return
    const node = highlightRefs.current.get(activeHighlightStart)
    node?.scrollIntoView({ behavior: "smooth", block: "center" })
  }, [activeHighlightStart])

  async function handleAnalyze() {
    if (!text.trim()) {
      toast.error("Wpisz tekst do analizy")
      return
    }

    try {
      const response = await analyze.mutateAsync({ text })
      setDelta(previousScore === null ? null : Number((response.totalScore - previousScore).toFixed(1)))
      setPreviousScore(response.totalScore)
      setAnalyzedText(text)
      setActiveHighlightStart(null)
      highlightRefs.current.clear()
      setResult(response)
    } catch (error) {
      toastApiError(error, "Nie udało się przeanalizować tekstu")
    }
  }

  function handleEditAgain() {
    setResult(null)
  }

  function loadExample() {
    setText(EXAMPLE_TEXT)
  }

  function handleRecommendationClick(recommendation: string) {
    if (!result) return
    const word = extractQuotedWord(recommendation)
    if (!word) return
    const match = result.objectivity.foundWords.find(
      (found) => found.value.toLowerCase() === word.toLowerCase(),
    )
    if (match) setActiveHighlightStart(match.position)
  }

  return (
    <>
      <PageHeader
        title="Kalkulator GEO Score"
        description="Ocenia teksty prasowe pod kątem optymalizacji dla generatywnych silników AI — cztery ważone wymiary: dane liczbowe, czasowniki akcji, struktura, obiektywność."
      />

      <div className="flex flex-1 flex-col gap-6 px-8 py-6">
        {!result ? (
          <Card>
            <CardContent className="flex flex-col gap-4 pt-6">
              <div className="flex items-center justify-between">
                <Label htmlFor="geo-score-text">Tekst do analizy</Label>
                <span className="text-xs text-muted-foreground">
                  {wordCount} {wordLabel(wordCount)} · {text.length}/{TEXT_MAX_CHARS} znaków
                </span>
              </div>
              <Textarea
                id="geo-score-text"
                rows={18}
                value={text}
                maxLength={TEXT_MAX_CHARS}
                placeholder="Wklej treść artykułu prasowego do oceny pod kątem optymalizacji dla generatywnych silników AI…"
                onChange={(event) => setText(event.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={handleAnalyze} disabled={analyze.isPending || !text.trim()}>
                  <Sparkles className="mr-2 h-4 w-4" />
                  {analyze.isPending ? "Analizuję…" : "Analizuj"}
                </Button>
                {!text.trim() ? (
                  <Button type="button" variant="outline" onClick={loadExample}>
                    Wczytaj przykład
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>
        ) : (
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
                      delta >= 0 ? "border-success/40 bg-success/10 text-success" : "border-destructive/40 bg-destructive/10 text-destructive",
                    )}
                  >
                    {delta >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                    {delta >= 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1)} od poprzedniej analizy
                  </Badge>
                ) : null}

                <span className="text-sm text-muted-foreground">{result.wordCount} słów w tekście</span>

                <Button type="button" variant="outline" className="ml-auto" onClick={handleEditAgain}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Edytuj ponownie
                </Button>
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
        )}
      </div>
    </>
  )
}
