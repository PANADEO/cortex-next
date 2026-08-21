"use client"

import { GeoScoreResultView } from "@/features/geo-score-calculator/components/result-view"
import { useAnalyzeGeoScore } from "@/features/geo-score-calculator/hooks"
import type { AnalyzeGeoScoreResponseDto } from "@/features/geo-score-calculator/types"
import { EXAMPLE_TEXT } from "@/lib/geo-score-calculator/example-text"
import { TEXT_MAX_CHARS } from "@/lib/geo-score-calculator/limits"
import { toastApiError } from "@cortex/api"
import { Button, Card, CardContent, Label, PageHeader, Textarea } from "@cortex/ui"
import { ArrowLeft, Sparkles } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

function countWords(text: string): number {
  const trimmed = text.trim()
  return trimmed ? trimmed.split(/\s+/).length : 0
}

export default function GeoScoreCalculatorPage() {
  const { t } = useTranslation("geo-score-calculator")
  const [text, setText] = useState("")
  const [analyzedText, setAnalyzedText] = useState("")
  const [result, setResult] = useState<AnalyzeGeoScoreResponseDto | null>(null)
  const [previousScore, setPreviousScore] = useState<number | null>(null)
  const [delta, setDelta] = useState<number | null>(null)
  const analyze = useAnalyzeGeoScore()

  const wordCount = countWords(text)

  async function handleAnalyze() {
    if (!text.trim()) {
      toast.error(t("calculator.errors.emptyText"))
      return
    }

    try {
      const response = await analyze.mutateAsync({ text })
      setDelta(
        previousScore === null ? null : Number((response.totalScore - previousScore).toFixed(1)),
      )
      setPreviousScore(response.totalScore)
      setAnalyzedText(text)
      setResult(response)
    } catch (error) {
      toastApiError(error, t("calculator.errors.analyzeFailed"))
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
      <PageHeader title={t("calculator.title")} description={t("calculator.description")} />

      <div className="flex flex-1 flex-col gap-6 px-8 py-6">
        {!result ? (
          <Card>
            <CardContent className="flex flex-col gap-4 pt-6">
              <div className="flex items-center justify-between">
                <Label htmlFor="geo-score-text">{t("calculator.textLabel")}</Label>
                <span className="text-xs text-muted-foreground">
                  {wordCount} {t("calculator.words", { count: wordCount })} · {text.length}/
                  {TEXT_MAX_CHARS} {t("calculator.charsSuffix")}
                </span>
              </div>
              <Textarea
                id="geo-score-text"
                rows={18}
                value={text}
                maxLength={TEXT_MAX_CHARS}
                placeholder={t("calculator.textPlaceholder")}
                onChange={(event) => setText(event.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={handleAnalyze}
                  disabled={analyze.isPending || !text.trim()}
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  {analyze.isPending ? t("calculator.analyzing") : t("calculator.analyze")}
                </Button>
                {!text.trim() ? (
                  <Button type="button" variant="outline" onClick={loadExample}>
                    {t("calculator.loadExample")}
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
                {t("calculator.editAgain")}
              </Button>
            }
          />
        )}
      </div>
    </>
  )
}
