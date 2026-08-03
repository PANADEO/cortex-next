"use client"

import { toastApiError } from "@cortex/api"
import { Button, Card, CardContent, Label, PageHeader, Textarea } from "@cortex/ui"
import { ArrowLeft, Sparkles } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { GeoScoreResultView } from "@/features/geo-score-calculator/components/result-view"
import { useAnalyzeGeoScore } from "@/features/geo-score-calculator/hooks"
import type { AnalyzeGeoScoreResponseDto } from "@/features/geo-score-calculator/types"
import { EXAMPLE_TEXT } from "@/lib/geo-score-calculator/example-text"
import { TEXT_MAX_CHARS } from "@/lib/geo-score-calculator/limits"

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
  const analyze = useAnalyzeGeoScore()

  const wordCount = countWords(text)

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
          <GeoScoreResultView
            text={analyzedText}
            result={result}
            delta={delta}
            headerActions={
              <Button type="button" variant="outline" onClick={handleEditAgain}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Edytuj ponownie
              </Button>
            }
          />
        )}
      </div>
    </>
  )
}
