"use client"

// Modal "Generator tematów" (design doc D8, §1.4/§4.1) — legacy uruchamiał
// go z `@st.dialog("Generator tematów")`, tu Dialog z @cortex/ui, ten sam
// koncept ("legacy miało tu dobry instynkt"). Ma WŁASNĄ transkrypcję —
// świadomie NIE dzieli pola z resztą ekranu generowania (Round A/B/C nie
// mają wspólnego pola "transkrypcja", tylko temat/grupa docelowa/dodatkowe
// informacje) — to jest standalone narzędzie pomocnicze, nie kolejny krok
// tego samego formularza.
//
// `allowMultiple` różnicuje zachowanie zaznaczania (design doc: "wstawiana
// do pola tematu (single) albo tabeli tematów (batch/pakiet)"):
//  - false (tryb "Pojedyncza"): zaznaczenie nowego tematu odznacza
//    poprzedni — pole Temat przyjmuje dokładnie jedną wartość.
//  - true (tryb "Kilka"/"Pakiet"): wielokrotny wybór, każdy zaznaczony
//    temat dochodzi jako osobny wiersz do tabeli tematów.

import {
  TOPIC_COUNT_DEFAULT,
  TOPIC_COUNT_MAX,
  TOPIC_COUNT_MIN,
} from "@/lib/content-guru/mini-generators"
import { toastApiError } from "@cortex/api"
import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  Skeleton,
  Slider,
  Textarea,
} from "@cortex/ui"
import { Sparkles } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useGenerateTopics } from "../hooks"

const TRANSCRIPT_MAX = 20000

interface TopicGeneratorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  model: string
  allowMultiple: boolean
  onInsert: (topics: string[]) => void
}

export function TopicGeneratorDialog({
  open,
  onOpenChange,
  model,
  allowMultiple,
  onInsert,
}: TopicGeneratorDialogProps) {
  const { t } = useTranslation(["content-guru", "common"])
  const [transcript, setTranscript] = useState("")
  const [topicCount, setTopicCount] = useState(TOPIC_COUNT_DEFAULT)
  const [candidates, setCandidates] = useState<string[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const generateTopics = useGenerateTopics()

  function reset() {
    setTranscript("")
    setTopicCount(TOPIC_COUNT_DEFAULT)
    setCandidates([])
    setSelected(new Set())
    generateTopics.reset()
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset()
    onOpenChange(next)
  }

  async function handleGenerate() {
    if (!transcript.trim() || !model) return
    try {
      const response = await generateTopics.mutateAsync({
        transcript: transcript.trim(),
        topicCount,
        model,
      })
      setCandidates(response.topics)
      setSelected(new Set())
    } catch (error) {
      toastApiError(error, t("topicGenerator.errors.generateFailed"))
    }
  }

  function toggle(candidateTopic: string) {
    setSelected((current) => {
      if (!allowMultiple) {
        return current.has(candidateTopic) ? new Set() : new Set([candidateTopic])
      }
      const next = new Set(current)
      if (next.has(candidateTopic)) next.delete(candidateTopic)
      else next.add(candidateTopic)
      return next
    })
  }

  function handleInsert() {
    if (selected.size === 0) return
    onInsert(Array.from(selected))
    handleOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("topicGenerator.title")}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="topic-generator-transcript">
              {t("topicGenerator.transcriptLabel")}
            </Label>
            <Textarea
              id="topic-generator-transcript"
              rows={8}
              maxLength={TRANSCRIPT_MAX}
              placeholder={t("topicGenerator.transcriptPlaceholder")}
              value={transcript}
              onChange={(event) => setTranscript(event.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="topic-generator-count">{t("topicGenerator.countLabel")}</Label>
              <span className="text-xs text-muted-foreground">{topicCount}</span>
            </div>
            <Slider
              id="topic-generator-count"
              min={TOPIC_COUNT_MIN}
              max={TOPIC_COUNT_MAX}
              step={1}
              value={[topicCount]}
              onValueChange={(value) => setTopicCount(value[0] ?? TOPIC_COUNT_DEFAULT)}
            />
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={handleGenerate}
            disabled={!transcript.trim() || !model || generateTopics.isPending}
          >
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            {generateTopics.isPending
              ? t("topicGenerator.generating")
              : t("topicGenerator.generateButton")}
          </Button>

          {generateTopics.isPending ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : candidates.length > 0 ? (
            <div className="flex max-h-64 flex-col gap-1 overflow-y-auto rounded-md border border-border p-2">
              {candidates.map((candidateTopic, index) => (
                <label
                  key={`${candidateTopic}-${index}`}
                  className="flex items-center gap-2 rounded-sm px-1 py-1.5 text-sm hover:bg-muted/50"
                >
                  <Checkbox
                    checked={selected.has(candidateTopic)}
                    onCheckedChange={() => toggle(candidateTopic)}
                  />
                  <span>{candidateTopic}</span>
                </label>
              ))}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            {t("common:actions.cancel")}
          </Button>
          <Button onClick={handleInsert} disabled={selected.size === 0}>
            {t("topicGenerator.insertButton", { selected: selected.size })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
