"use client"

import { toastApiError } from "@cortex/api"
import {
  Badge,
  Button,
  Card,
  CardContent,
  EmptyState,
  Input,
  Label,
  PageHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Tabs,
  TabsList,
  TabsTrigger,
  Textarea,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@cortex/ui"
import { AlertTriangle, Sparkles } from "lucide-react"
import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react"
import { toast } from "sonner"
import { useContentGuruConfig, useGenerateContent } from "@/features/content-guru/hooks"
import type { GenerateContentResponseDto } from "@/features/content-guru/types"

const CONTENT_TYPE_MAX = 200
const TOPIC_MAX = 500
const AUDIENCE_MAX = 500
const ADDITIONAL_INFO_MAX = 4000

/**
 * Podświetla dopasowane zakazane frazy w wygenerowanej treści (`<mark>`,
 * case-insensitive) — design doc D5 pkt 2: user MUSI świadomie zobaczyć
 * trafienie, nie dostaje cichego sukcesu. Konwencja wizualna własna tego
 * modułu (GEO Score Calculator buduje swój highlighting równolegle w tej
 * samej sesji, w innych plikach — nie ma stąd czego jeszcze zaimportować),
 * paleta amber spójna z resztą repo (packages/@cortex/ui/src/components/
 * status-badge.tsx: amber = ostrzeżenie).
 */
function renderHighlightedContent(content: string, matchedPhrases: readonly string[]): ReactNode {
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

function StatusBadge({ status }: { status: GenerateContentResponseDto["status"] }) {
  if (status === "done-with-warnings") {
    return (
      <Badge
        variant="outline"
        className="gap-1 border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
      >
        <AlertTriangle className="h-3 w-3" />
        Zawiera zakazane frazy
      </Badge>
    )
  }
  return (
    <Badge
      variant="outline"
      className="border-emerald-300 bg-emerald-100 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
    >
      Gotowe
    </Badge>
  )
}

export default function ContentGuruPage() {
  const configQuery = useContentGuruConfig()
  const generate = useGenerateContent()

  const [contentType, setContentType] = useState("")
  const [topic, setTopic] = useState("")
  const [targetAudience, setTargetAudience] = useState("")
  const [additionalInfo, setAdditionalInfo] = useState("")
  const [model, setModel] = useState("")
  const [result, setResult] = useState<GenerateContentResponseDto | null>(null)

  const models = useMemo(() => configQuery.data?.models ?? [], [configQuery.data])

  useEffect(() => {
    if (!model && models.length > 0) setModel(models[0]!)
  }, [models, model])

  const canSubmit =
    contentType.trim().length > 0 && topic.trim().length > 0 && model.length > 0 && !generate.isPending

  async function handleGenerate() {
    if (!canSubmit) return
    try {
      const response = await generate.mutateAsync({
        contentType: contentType.trim(),
        topic: topic.trim(),
        targetAudience: targetAudience.trim(),
        additionalInfo: additionalInfo.trim(),
        model,
      })
      setResult(response)
      if (response.status === "done-with-warnings") {
        toast.warning("Treść wygenerowana — zawiera zakazane frazy, sprawdź podświetlenia")
      } else {
        toast.success("Treść wygenerowana i zapisana w archiwum")
      }
    } catch (error) {
      toastApiError(error, "Nie udało się wygenerować treści")
    }
  }

  return (
    <>
      <PageHeader
        title="Content Guru"
        description="Generowanie roboczych treści marketingowych, produktowych i rekrutacyjnych — z realną walidacją zakazanych fraz."
      />

      <div className="flex flex-1 flex-col gap-6 px-8 py-6">
        <TooltipProvider delayDuration={200}>
          <Tabs value="single" className="w-full">
            <TabsList>
              <TabsTrigger value="single">Pojedyncza</TabsTrigger>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span tabIndex={0} className="inline-flex">
                    <TabsTrigger value="batch" disabled className="gap-2">
                      Kilka
                      <Badge variant="secondary" className="text-[10px] font-normal">
                        Wkrótce
                      </Badge>
                    </TabsTrigger>
                  </span>
                </TooltipTrigger>
                <TooltipContent>Wiele tematów jednym szablonem naraz — w budowie.</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span tabIndex={0} className="inline-flex">
                    <TabsTrigger value="package" disabled className="gap-2">
                      Pakiet
                      <Badge variant="secondary" className="text-[10px] font-normal">
                        Wkrótce
                      </Badge>
                    </TabsTrigger>
                  </span>
                </TooltipTrigger>
                <TooltipContent>Wiele szablonów i tematów naraz — w budowie.</TooltipContent>
              </Tooltip>
            </TabsList>
          </Tabs>
        </TooltipProvider>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
          <Card>
            <CardContent className="flex flex-col gap-4 pt-6">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="content-guru-type">Typ treści</Label>
                  <span className="text-xs text-muted-foreground">
                    {contentType.length}/{CONTENT_TYPE_MAX}
                  </span>
                </div>
                <Input
                  id="content-guru-type"
                  value={contentType}
                  maxLength={CONTENT_TYPE_MAX}
                  placeholder="Np. post rekrutacyjny na LinkedIn"
                  onChange={(event) => setContentType(event.target.value)}
                />
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="content-guru-topic">Temat</Label>
                  <span className="text-xs text-muted-foreground">
                    {topic.length}/{TOPIC_MAX}
                  </span>
                </div>
                <Input
                  id="content-guru-topic"
                  value={topic}
                  maxLength={TOPIC_MAX}
                  placeholder="Np. otwieramy rekrutację na stanowisko Senior .NET Developer"
                  onChange={(event) => setTopic(event.target.value)}
                />
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="content-guru-audience">Grupa docelowa</Label>
                  <span className="text-xs text-muted-foreground">
                    {targetAudience.length}/{AUDIENCE_MAX}
                  </span>
                </div>
                <Input
                  id="content-guru-audience"
                  value={targetAudience}
                  maxLength={AUDIENCE_MAX}
                  placeholder="Np. kandydaci z doświadczeniem w fintech"
                  onChange={(event) => setTargetAudience(event.target.value)}
                />
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="content-guru-additional">Dodatkowe informacje</Label>
                  <span className="text-xs text-muted-foreground">
                    {additionalInfo.length}/{ADDITIONAL_INFO_MAX}
                  </span>
                </div>
                <Textarea
                  id="content-guru-additional"
                  value={additionalInfo}
                  maxLength={ADDITIONAL_INFO_MAX}
                  rows={4}
                  placeholder="Kontekst, który model powinien uwzględnić"
                  onChange={(event) => setAdditionalInfo(event.target.value)}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="content-guru-model">Model</Label>
                {configQuery.isPending ? (
                  <Skeleton className="h-9 w-full" />
                ) : (
                  <Select value={model} onValueChange={setModel}>
                    <SelectTrigger id="content-guru-model">
                      <SelectValue placeholder="Wybierz model" />
                    </SelectTrigger>
                    <SelectContent>
                      {models.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <Button type="button" onClick={handleGenerate} disabled={!canSubmit}>
                <Sparkles className="mr-2 h-4 w-4" />
                {generate.isPending ? "Generowanie..." : "Generuj"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-col gap-4 pt-6">
              {generate.isPending ? (
                <div className="flex flex-col gap-3">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-40 w-full" />
                </div>
              ) : !result ? (
                <EmptyState
                  icon={Sparkles}
                  title="Brak wygenerowanej treści"
                  description="Wypełnij typ treści i temat, następnie kliknij Generuj."
                />
              ) : (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <StatusBadge status={result.status} />
                    <span className="text-xs text-muted-foreground">{result.model}</span>
                  </div>

                  {result.status === "done-with-warnings" ? (
                    <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                      Treść zawiera frazy z Twojej listy zakazanych fraz mimo automatycznej próby
                      poprawy — zaznaczone poniżej. Popraw ręcznie przed użyciem.
                    </div>
                  ) : null}

                  <div className="whitespace-pre-wrap rounded-md border border-border bg-muted/30 p-4 text-sm leading-relaxed">
                    {renderHighlightedContent(result.content, result.matchedForbiddenPhrases)}
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Zapisano w archiwum Content Guru.
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
