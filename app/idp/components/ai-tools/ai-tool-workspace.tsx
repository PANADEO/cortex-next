"use client"

import { AiToolGate } from "@/components/ai-tools/ai-tool-gate"
import {
  aiToolHistoryQueryKey,
  generateAiToolContent,
  getAiToolHistory,
  type AiToolGenerateResponse,
  type AiToolHistoryItem,
} from "@/lib/ai-tools/api"
import type { AiToolId } from "@/lib/ai-tools/app-codes"
import {
  buildAnalyzePrompt,
  buildHighlightPrompt,
  buildInvoicePrompt,
  buildLinkedinPrompt,
  buildPresentationPrompt,
  buildSummarizePrompt,
  buildTransformPrompt,
  type PromptPair,
} from "@/lib/ai-tools/prompts"
import { getAiToolDefinition, type AiToolDefinition } from "@/lib/ai-tools/registry"
import { useAiToolText } from "@/lib/ai-tools/tool-text"
import i18n from "@/lib/i18n"
import type { Locale } from "@/lib/i18n/config"
import { SOURCE_LOCALE } from "@/lib/i18n/config"
import { formatDayMonthTime, formatNumber } from "@/lib/i18n/formats"
import { useLocaleStore } from "@/lib/i18n/locale-store"
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Checkbox,
  EmptyState,
  Input,
  Label,
  PageHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@cortex/ui"
import { cn } from "@cortex/utils"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowLeft,
  Clipboard,
  Download,
  FileImage,
  Loader2,
  RefreshCcw,
  Send,
  Sparkles,
} from "lucide-react"
import Link from "next/link"
import type { ChangeEvent, ReactNode } from "react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

interface AiToolWorkspaceProps {
  toolId: string
}

interface GenerationOptions {
  image?: {
    dataUrl: string
    mimeType: string
  }
  temperature?: number
}

interface ChatMessage {
  role: "user" | "assistant"
  content: string
}

/**
 * Listy wyboru trzymają w stanie KLUCZ tłumaczenia, nie widoczny napis.
 *
 * Powód jest dwojaki. Po pierwsze, wartość opcji jedzie wprost do promptu
 * (`prompts.ts`), a prompt jest instrukcją dla modelu, nie tekstem interfejsu —
 * przełączenie języka nie ma prawa zmienić treści zapytania. Po drugie, gdyby
 * w stanie siedział przetłumaczony napis, zmiana języka w trakcie sesji
 * zostawiłaby `value`, którego nie ma już wśród opcji, i lista pokazałaby się
 * pusta. Napis do modelu bierze się więc z `useSourceText()`, a napis na ekran
 * ze zwykłego `t()`.
 */
const HIGHLIGHT_TARGETS = [
  "keyConcepts",
  "arguments",
  "risks",
  "datesNumbers",
  "entities",
  "custom",
] as const
const HIGHLIGHT_STYLES = ["listAndMarks", "listOnly", "review"] as const
const TRANSFORMATIONS = [
  "simplify",
  "formalize",
  "business",
  "expert",
  "friendly",
  "shorten",
  "expand",
] as const
const TRANSFORM_AUDIENCES = [
  "businessClient",
  "internalTeam",
  "industryExpert",
  "nonTechnical",
  "board",
  "student",
] as const
const TRANSFORM_COMPLEXITIES = ["verySimple", "simple", "medium", "advanced"] as const
const TRANSFORM_TONES = ["professional", "neutral", "friendly", "assertive", "calm"] as const
const ANALYSIS_AREAS = [
  "sentiment",
  "topics",
  "style",
  "readability",
  "keywords",
  "structure",
] as const
const SUMMARY_TYPES = [
  "executive",
  "keyPoints",
  "faq",
  "oneSentence",
  "nonTechnical",
  "abstract",
] as const
const SUMMARY_LENGTHS = ["veryShort", "short", "medium", "detailed"] as const
const SUMMARY_FOCUSES = ["decisions", "facts", "arguments", "risks", "actions"] as const
const SUMMARY_AUDIENCES = ["manager", "expert", "client", "operations", "child"] as const
const SUMMARY_TONES = ["neutral", "formal", "friendly", "popularScience"] as const
const LINKEDIN_POST_TYPES = [
  "opinion",
  "caseStudy",
  "tips",
  "educational",
  "announcement",
  "question",
] as const
const LINKEDIN_AUDIENCES = ["managers", "founders", "itSpecialists", "hr", "general"] as const
const LINKEDIN_TONES = ["factual", "expert", "friendly", "inspiring", "assertive"] as const
const LINKEDIN_LENGTHS = ["short", "medium", "long"] as const
const PRESENTATION_TYPES = ["business", "educational", "marketing", "technical", "general"] as const
const INVOICE_ANALYSIS_TYPES = [
  "full",
  "basic",
  "lineItems",
  "parties",
  "paymentTerms",
  "taxes",
  "validation",
] as const

const PUBLIC_BASE_PATH = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH)
const PDF_WORKER_SRC = publicAssetPath("/pdfjs/pdf.worker.min.js")
const PDF_CMAP_URL = publicAssetPath("/pdfjs/cmaps/")
const PDF_STANDARD_FONT_URL = publicAssetPath("/pdfjs/standard_fonts/")
const PDF_INVOICE_MAX_PAGES = 4
const PDF_INVOICE_MAX_WIDTH = 1400
const PDF_INVOICE_RENDER_SCALE = 2
const PDF_INVOICE_PAGE_GAP = 28
const PDF_INVOICE_JPEG_QUALITY = 0.86
const AI_TOOL_MAX_DATA_URL_LENGTH = 15_500_000
const FIELD_LABEL_CLASS = "text-[10px] font-medium uppercase tracking-wide text-muted-foreground"

/** Napisy dla funkcji spoza Reacta (render PDF, odczyt pliku) — te wyjątki
 *  rzucane są poza komponentem, a ich treść ląduje w toaście u użytkownika,
 *  więc muszą być przetłumaczone mimo braku dostępu do `useTranslation()`. */
function tOutsideReact(key: string): string {
  return String(i18n.t(key, { ns: "ai-tools" }))
}

export function AiToolWorkspace({ toolId }: AiToolWorkspaceProps) {
  const { t } = useTranslation(["ai-tools", "common"])
  const tool = getAiToolDefinition(toolId)
  const queryClient = useQueryClient()
  const [result, setResult] = useState<AiToolGenerateResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const historyQuery = useQuery({
    enabled: Boolean(tool),
    queryFn: () => {
      if (!tool) throw new Error(t("workspace.unknownTitle"))
      return getAiToolHistory(tool.id)
    },
    queryKey: tool ? aiToolHistoryQueryKey(tool.id) : ["ai-tools", "history", "unknown"],
  })

  if (!tool) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-8">
        <EmptyState
          icon={Sparkles}
          title={t("workspace.unknownTitle")}
          description={t("workspace.unknownBody")}
          action={
            <Button asChild variant="outline" size="sm">
              <Link href="/">{t("common:nav.backToHub")}</Link>
            </Button>
          }
        />
      </div>
    )
  }

  const handleGenerate = async (
    prompts: PromptPair,
    options: GenerationOptions = {},
  ): Promise<AiToolGenerateResponse | null> => {
    setIsGenerating(true)
    setError(null)
    try {
      const request = {
        toolId: tool.id,
        systemPrompt: prompts.systemPrompt,
        userPrompt: prompts.userPrompt,
        ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
        ...(options.image ? { image: options.image } : {}),
      }
      const response = await generateAiToolContent(request)
      setResult(response)
      void queryClient.invalidateQueries({ queryKey: aiToolHistoryQueryKey(tool.id) })
      toast.success(t("shared.generateSuccess"))
      return response
    } catch (generationError) {
      const message =
        generationError instanceof Error ? generationError.message : t("shared.generateFailed")
      setError(message)
      toast.error(t("shared.generateToastError"))
      return null
    } finally {
      setIsGenerating(false)
    }
  }

  const form = renderToolForm(tool.id, {
    isGenerating,
    onGenerate: handleGenerate,
  })

  return (
    <AiToolGate toolId={tool.id}>
      <div className="flex min-h-0 flex-1 flex-col">
        <ToolHeader tool={tool} />

        <div className="mx-auto grid min-h-0 w-full max-w-[1360px] flex-1 gap-4 px-8 py-6 xl:grid-cols-[minmax(420px,0.95fr)_minmax(520px,1.05fr)]">
          <div className="min-w-0 space-y-4">
            {form}
            <HistoryPanel
              error={historyQuery.isError}
              isLoading={historyQuery.isLoading}
              items={historyQuery.data ?? []}
              onRefresh={() => void historyQuery.refetch()}
              onSelect={(item) => {
                setResult({
                  content: item.content,
                  model: item.model,
                  tokensUsed: item.tokensUsed,
                })
                setError(null)
              }}
            />
          </div>
          <ResultPanel
            content={result?.content ?? ""}
            error={error}
            isGenerating={isGenerating}
            model={result?.model}
            tokensUsed={result?.tokensUsed}
            title={t("result.title")}
          />
        </div>
      </div>
    </AiToolGate>
  )
}

/** Nagłówek strony narzędzia. Osobny komponent, bo nazwa i opis idą przez
 *  przestrzeń `tiles` (patrz `lib/ai-tools/tool-text.ts`), a hook nie ma prawa
 *  stać za wczesnym powrotem dla nieznanego `toolId`. */
function ToolHeader({ tool }: { tool: AiToolDefinition }) {
  const { t } = useTranslation("ai-tools")
  const text = useAiToolText(tool)

  return (
    <PageHeader
      title={text.label}
      description={text.description}
      actions={
        <Button asChild variant="outline" size="sm">
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("workspace.backToApps")}
          </Link>
        </Button>
      }
    />
  )
}

interface HistoryPanelProps {
  error: boolean
  isLoading: boolean
  items: AiToolHistoryItem[]
  onRefresh: () => void
  onSelect: (item: AiToolHistoryItem) => void
}

function HistoryPanel({ error, isLoading, items, onRefresh, onSelect }: HistoryPanelProps) {
  const { t } = useTranslation("ai-tools")
  const locale = useLocaleStore((s) => s.locale)

  return (
    <Card className="overflow-hidden rounded-lg shadow-none">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border bg-muted/20 px-4 py-3">
        <CardTitle className="text-sm font-semibold">{t("history.title")}</CardTitle>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8"
          onClick={onRefresh}
          disabled={isLoading}
        >
          <RefreshCcw className={cn("mr-1.5 h-3.5 w-3.5", isLoading && "animate-spin")} />
          {t("history.refresh")}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3 p-4">
        {error ? (
          <Alert variant="destructive" className="rounded-lg">
            <AlertDescription>{t("history.loadFailed")}</AlertDescription>
          </Alert>
        ) : null}
        {isLoading ? (
          <div className="flex min-h-[120px] items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t("history.loading")}
          </div>
        ) : items.length === 0 && !error ? (
          <div className="flex min-h-[120px] items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 text-sm text-muted-foreground">
            {t("history.empty")}
          </div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="rounded-lg border border-border bg-background p-3">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="h-5 text-[10px]">
                  {formatHistoryDate(item.createdAt, locale)}
                </Badge>
                {item.tokensUsed ? (
                  <Badge variant="outline" className="h-5 text-[10px]">
                    {t("shared.tokens", { value: formatNumber(item.tokensUsed, locale) })}
                  </Badge>
                ) : null}
                {item.hasImage ? (
                  <Badge variant="outline" className="h-5 text-[10px]">
                    {t("history.fileBadge")}
                  </Badge>
                ) : null}
              </div>
              <p className="mb-2 line-clamp-2 text-xs text-muted-foreground">
                {createPreview(item.userPrompt)}
              </p>
              <p className="max-h-16 overflow-hidden text-sm leading-5">
                {createPreview(item.content)}
              </p>
              <div className="mt-3 flex justify-end">
                <Button type="button" size="sm" variant="outline" onClick={() => onSelect(item)}>
                  {t("history.show")}
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}

function createPreview(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim()
  if (normalized.length <= 180) return normalized
  return `${normalized.slice(0, 177)}…`
}

/**
 * `locale` parametrem, bo to nie komponent — dokładnie tak, jak `t` w fabrykach
 * kolumn. Osłona przed niepoprawną datą ZOSTAJE tutaj, a nie wędruje do
 * wspólnego modułu: `value` przychodzi z historii zapisanej przez inny serwis,
 * więc to ten wywołujący ma nieufne wejście, nie formatowanie jako takie.
 */
function formatHistoryDate(value: string, locale: Locale): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return formatDayMonthTime(date, locale)
}

interface ToolFormContext {
  isGenerating: boolean
  onGenerate: (
    prompts: PromptPair,
    options?: GenerationOptions,
  ) => Promise<AiToolGenerateResponse | null>
}

function renderToolForm(toolId: AiToolId, context: ToolFormContext) {
  switch (toolId) {
    case "text-highlighter":
      return <HighlighterForm {...context} />
    case "text-transformer":
      return <TransformerForm {...context} />
    case "text-analyzer":
      return <AnalyzerForm {...context} />
    case "ai-summarizer":
      return <SummarizerForm {...context} />
    case "linkedin-generator":
      return <LinkedinForm {...context} />
    case "presentation-generator":
      return <PresentationForm {...context} />
    case "fakturomat":
      return <InvoiceForm {...context} />
    case "ai-daily-assistant":
      return <ChatForm {...context} />
  }
}

function HighlighterForm({ isGenerating, onGenerate }: ToolFormContext) {
  const { t } = useTranslation("ai-tools")
  const src = useSourceText()
  const [text, setText] = useState("")
  const [target, setTarget] = useState<string>("keyConcepts")
  const [style, setStyle] = useState<string>("listAndMarks")
  const [maxHighlights, setMaxHighlights] = useState(8)
  const [contextWords, setContextWords] = useState(4)

  return (
    <ToolFormCard
      title={t("highlighter.title")}
      description={t("highlighter.description")}
      isGenerating={isGenerating}
      canSubmit={text.trim().length > 0}
      onSubmit={() =>
        onGenerate(
          buildHighlightPrompt({
            text,
            target: src(`highlighter.targetOptions.${target}`),
            style: src(`highlighter.styleOptions.${style}`),
            maxHighlights,
            contextWords,
          }),
        )
      }
    >
      <TextAreaField
        label={t("highlighter.textLabel")}
        value={text}
        onChange={setText}
        placeholder={t("highlighter.textPlaceholder")}
        minHeight="min-h-[260px]"
      />
      <SelectField
        label={t("highlighter.targetLabel")}
        value={target}
        onChange={setTarget}
        options={toOptions(t, "highlighter.targetOptions", HIGHLIGHT_TARGETS)}
      />
      <SelectField
        label={t("highlighter.styleLabel")}
        value={style}
        onChange={setStyle}
        options={toOptions(t, "highlighter.styleOptions", HIGHLIGHT_STYLES)}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <NumberField
          label={t("highlighter.maxHighlightsLabel")}
          value={maxHighlights}
          min={1}
          max={20}
          onChange={setMaxHighlights}
        />
        <NumberField
          label={t("highlighter.contextWordsLabel")}
          value={contextWords}
          min={0}
          max={12}
          onChange={setContextWords}
        />
      </div>
    </ToolFormCard>
  )
}

function TransformerForm({ isGenerating, onGenerate }: ToolFormContext) {
  const { t } = useTranslation("ai-tools")
  const src = useSourceText()
  const [text, setText] = useState("")
  const [transformation, setTransformation] = useState<string>("simplify")
  const [audience, setAudience] = useState<string>("businessClient")
  const [complexity, setComplexity] = useState<string>("simple")
  const [tone, setTone] = useState<string>("professional")
  const [preserveMeaning, setPreserveMeaning] = useState(true)
  const [fixGrammar, setFixGrammar] = useState(true)
  const [improveStructure, setImproveStructure] = useState(true)

  return (
    <ToolFormCard
      title={t("transformer.title")}
      description={t("transformer.description")}
      isGenerating={isGenerating}
      canSubmit={text.trim().length > 0}
      onSubmit={() =>
        onGenerate(
          buildTransformPrompt({
            text,
            transformation: src(`transformer.transformationOptions.${transformation}`),
            audience: src(`transformer.audienceOptions.${audience}`),
            complexity: src(`transformer.complexityOptions.${complexity}`),
            tone: src(`transformer.toneOptions.${tone}`),
            preserveMeaning,
            fixGrammar,
            improveStructure,
          }),
        )
      }
    >
      <TextAreaField
        label={t("transformer.textLabel")}
        value={text}
        onChange={setText}
        placeholder={t("transformer.textPlaceholder")}
        minHeight="min-h-[240px]"
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField
          label={t("transformer.transformationLabel")}
          value={transformation}
          onChange={setTransformation}
          options={toOptions(t, "transformer.transformationOptions", TRANSFORMATIONS)}
        />
        <SelectField
          label={t("transformer.audienceLabel")}
          value={audience}
          onChange={setAudience}
          options={toOptions(t, "transformer.audienceOptions", TRANSFORM_AUDIENCES)}
        />
        <SelectField
          label={t("transformer.complexityLabel")}
          value={complexity}
          onChange={setComplexity}
          options={toOptions(t, "transformer.complexityOptions", TRANSFORM_COMPLEXITIES)}
        />
        <SelectField
          label={t("transformer.toneLabel")}
          value={tone}
          onChange={setTone}
          options={toOptions(t, "transformer.toneOptions", TRANSFORM_TONES)}
        />
      </div>
      <CheckboxGrid
        items={[
          {
            id: "preserve",
            label: t("transformer.preserveMeaning"),
            checked: preserveMeaning,
            onChange: setPreserveMeaning,
          },
          {
            id: "grammar",
            label: t("transformer.fixGrammar"),
            checked: fixGrammar,
            onChange: setFixGrammar,
          },
          {
            id: "structure",
            label: t("transformer.improveStructure"),
            checked: improveStructure,
            onChange: setImproveStructure,
          },
        ]}
      />
    </ToolFormCard>
  )
}

function AnalyzerForm({ isGenerating, onGenerate }: ToolFormContext) {
  const { t } = useTranslation("ai-tools")
  const src = useSourceText()
  const [text, setText] = useState("")
  const [areas, setAreas] = useState<readonly string[]>([
    "sentiment",
    "topics",
    "style",
    "readability",
  ])

  const toggleArea = (area: string, checked: boolean) => {
    setAreas((current) => {
      if (checked) return [...current, area]
      const next = current.filter((item) => item !== area)
      return next.length > 0 ? next : current
    })
  }

  return (
    <ToolFormCard
      title={t("analyzer.title")}
      description={t("analyzer.description")}
      isGenerating={isGenerating}
      canSubmit={text.trim().length > 0 && areas.length > 0}
      onSubmit={() =>
        onGenerate(
          buildAnalyzePrompt({
            text,
            areas: areas.map((area) => src(`analyzer.areaOptions.${area}`)),
          }),
        )
      }
    >
      <TextAreaField
        label={t("analyzer.textLabel")}
        value={text}
        onChange={setText}
        placeholder={t("analyzer.textPlaceholder")}
        minHeight="min-h-[260px]"
      />
      <div className="space-y-1.5">
        <Label className={FIELD_LABEL_CLASS}>{t("analyzer.areasLabel")}</Label>
        <div className="grid gap-2 sm:grid-cols-2">
          {ANALYSIS_AREAS.map((area) => (
            <CheckboxRow
              key={area}
              id={`area-${area}`}
              label={t(`analyzer.areaOptions.${area}`)}
              checked={areas.includes(area)}
              onChange={(checked) => toggleArea(area, checked)}
            />
          ))}
        </div>
      </div>
    </ToolFormCard>
  )
}

function SummarizerForm({ isGenerating, onGenerate }: ToolFormContext) {
  const { t } = useTranslation("ai-tools")
  const src = useSourceText()
  const [text, setText] = useState("")
  const [summaryType, setSummaryType] = useState<string>("executive")
  const [length, setLength] = useState<string>("short")
  const [focus, setFocus] = useState<string>("decisions")
  const [audience, setAudience] = useState<string>("manager")
  const [tone, setTone] = useState<string>("neutral")

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setText(await file.text())
  }

  return (
    <ToolFormCard
      title={t("summarizer.title")}
      description={t("summarizer.description")}
      isGenerating={isGenerating}
      canSubmit={text.trim().length > 0}
      onSubmit={() =>
        onGenerate(
          buildSummarizePrompt({
            text,
            summaryType: src(`summarizer.typeOptions.${summaryType}`),
            length: src(`summarizer.lengthOptions.${length}`),
            focus: src(`summarizer.focusOptions.${focus}`),
            audience: src(`summarizer.audienceOptions.${audience}`),
            tone: src(`summarizer.toneOptions.${tone}`),
          }),
        )
      }
    >
      <div className="space-y-1.5">
        <Label htmlFor="summary-file" className={FIELD_LABEL_CLASS}>
          {t("summarizer.fileLabel")}
        </Label>
        <Input
          id="summary-file"
          type="file"
          accept=".txt,.md,text/plain,text/markdown"
          onChange={handleFile}
          className="h-8 text-xs"
        />
      </div>
      <TextAreaField
        label={t("summarizer.textLabel")}
        value={text}
        onChange={setText}
        placeholder={t("summarizer.textPlaceholder")}
        minHeight="min-h-[240px]"
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField
          label={t("summarizer.typeLabel")}
          value={summaryType}
          onChange={setSummaryType}
          options={toOptions(t, "summarizer.typeOptions", SUMMARY_TYPES)}
        />
        <SelectField
          label={t("summarizer.lengthLabel")}
          value={length}
          onChange={setLength}
          options={toOptions(t, "summarizer.lengthOptions", SUMMARY_LENGTHS)}
        />
        <SelectField
          label={t("summarizer.focusLabel")}
          value={focus}
          onChange={setFocus}
          options={toOptions(t, "summarizer.focusOptions", SUMMARY_FOCUSES)}
        />
        <SelectField
          label={t("summarizer.audienceLabel")}
          value={audience}
          onChange={setAudience}
          options={toOptions(t, "summarizer.audienceOptions", SUMMARY_AUDIENCES)}
        />
      </div>
      <SelectField
        label={t("summarizer.toneLabel")}
        value={tone}
        onChange={setTone}
        options={toOptions(t, "summarizer.toneOptions", SUMMARY_TONES)}
      />
    </ToolFormCard>
  )
}

function LinkedinForm({ isGenerating, onGenerate }: ToolFormContext) {
  const { t } = useTranslation("ai-tools")
  const src = useSourceText()
  const [topic, setTopic] = useState("")
  const [postType, setPostType] = useState<string>("opinion")
  const [tone, setTone] = useState<string>("factual")
  const [length, setLength] = useState<string>("medium")
  const [audience, setAudience] = useState<string>("managers")
  const [keywords, setKeywords] = useState("")
  const [context, setContext] = useState("")
  const [includeHashtags, setIncludeHashtags] = useState(true)
  const [includeCta, setIncludeCta] = useState(true)

  return (
    <ToolFormCard
      title={t("linkedin.title")}
      description={t("linkedin.description")}
      isGenerating={isGenerating}
      canSubmit={topic.trim().length > 0}
      onSubmit={() =>
        onGenerate(
          buildLinkedinPrompt({
            topic,
            postType: src(`linkedin.postTypeOptions.${postType}`),
            tone: src(`linkedin.toneOptions.${tone}`),
            length: src(`linkedin.lengthOptions.${length}`),
            audience: src(`linkedin.audienceOptions.${audience}`),
            keywords,
            context,
            includeHashtags,
            includeCta,
          }),
          { temperature: 0.75 },
        )
      }
    >
      <InputField
        label={t("linkedin.topicLabel")}
        value={topic}
        onChange={setTopic}
        placeholder={t("linkedin.topicPlaceholder")}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField
          label={t("linkedin.postTypeLabel")}
          value={postType}
          onChange={setPostType}
          options={toOptions(t, "linkedin.postTypeOptions", LINKEDIN_POST_TYPES)}
        />
        <SelectField
          label={t("linkedin.audienceLabel")}
          value={audience}
          onChange={setAudience}
          options={toOptions(t, "linkedin.audienceOptions", LINKEDIN_AUDIENCES)}
        />
        <SelectField
          label={t("linkedin.toneLabel")}
          value={tone}
          onChange={setTone}
          options={toOptions(t, "linkedin.toneOptions", LINKEDIN_TONES)}
        />
        <SelectField
          label={t("linkedin.lengthLabel")}
          value={length}
          onChange={setLength}
          options={toOptions(t, "linkedin.lengthOptions", LINKEDIN_LENGTHS)}
        />
      </div>
      <InputField
        label={t("linkedin.keywordsLabel")}
        value={keywords}
        onChange={setKeywords}
        placeholder={t("linkedin.keywordsPlaceholder")}
      />
      <TextAreaField
        label={t("linkedin.contextLabel")}
        value={context}
        onChange={setContext}
        placeholder={t("linkedin.contextPlaceholder")}
        minHeight="min-h-[120px]"
      />
      <CheckboxGrid
        items={[
          {
            id: "hashtags",
            label: t("linkedin.includeHashtags"),
            checked: includeHashtags,
            onChange: setIncludeHashtags,
          },
          {
            id: "cta",
            label: t("linkedin.includeCta"),
            checked: includeCta,
            onChange: setIncludeCta,
          },
        ]}
      />
    </ToolFormCard>
  )
}

function PresentationForm({ isGenerating, onGenerate }: ToolFormContext) {
  const { t } = useTranslation("ai-tools")
  const src = useSourceText()
  const [topic, setTopic] = useState("")
  const [sourceText, setSourceText] = useState("")
  const [slideCount, setSlideCount] = useState(8)
  const [presentationType, setPresentationType] = useState<string>("business")
  // Pole swobodne, więc w stanie siedzi gotowy napis, a nie klucz — wartość
  // początkowa jest w języku interfejsu z chwili wejścia na ekran.
  const [visualStyle, setVisualStyle] = useState(() => t("presentation.visualStyleDefault"))
  const [includeCharts, setIncludeCharts] = useState(false)

  return (
    <ToolFormCard
      title={t("presentation.title")}
      description={t("presentation.description")}
      isGenerating={isGenerating}
      canSubmit={topic.trim().length > 0}
      onSubmit={() =>
        onGenerate(
          buildPresentationPrompt({
            topic,
            sourceText,
            slideCount,
            presentationType: src(`presentation.typeOptions.${presentationType}`),
            visualStyle,
            includeCharts,
          }),
        )
      }
    >
      <InputField
        label={t("presentation.topicLabel")}
        value={topic}
        onChange={setTopic}
        placeholder={t("presentation.topicPlaceholder")}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <NumberField
          label={t("presentation.slideCountLabel")}
          value={slideCount}
          min={3}
          max={20}
          onChange={setSlideCount}
        />
        <SelectField
          label={t("presentation.typeLabel")}
          value={presentationType}
          onChange={setPresentationType}
          options={toOptions(t, "presentation.typeOptions", PRESENTATION_TYPES)}
        />
      </div>
      <InputField
        label={t("presentation.visualStyleLabel")}
        value={visualStyle}
        onChange={setVisualStyle}
        placeholder={t("presentation.visualStylePlaceholder")}
      />
      <TextAreaField
        label={t("presentation.sourceLabel")}
        value={sourceText}
        onChange={setSourceText}
        placeholder={t("presentation.sourcePlaceholder")}
        minHeight="min-h-[180px]"
      />
      <CheckboxRow
        id="presentation-charts"
        label={t("presentation.includeCharts")}
        checked={includeCharts}
        onChange={setIncludeCharts}
      />
    </ToolFormCard>
  )
}

function InvoiceForm({ isGenerating, onGenerate }: ToolFormContext) {
  const { t } = useTranslation("ai-tools")
  const src = useSourceText()
  const [fileName, setFileName] = useState("")
  const [image, setImage] = useState<{ dataUrl: string; mimeType: string } | undefined>()
  const [sourceNote, setSourceNote] = useState("")
  const [isPreparingFile, setIsPreparingFile] = useState(false)
  const [analysisType, setAnalysisType] = useState<string>("full")
  const [includeJson, setIncludeJson] = useState(true)
  const [includeRisks, setIncludeRisks] = useState(true)

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setFileName(file.name)
    setImage(undefined)
    setSourceNote("")

    try {
      if (file.type.startsWith("image/")) {
        const dataUrl = await readFileAsDataUrl(file)
        setImage({ dataUrl, mimeType: file.type })
        setSourceNote(t("invoice.sourceImage", { name: file.name }))
        return
      }

      if (isPdfFile(file)) {
        setIsPreparingFile(true)
        const rendered = await renderPdfFileAsInvoiceImage(file)
        setImage({ dataUrl: rendered.dataUrl, mimeType: rendered.mimeType })
        setSourceNote(
          t("invoice.sourcePdf", {
            name: file.name,
            rendered: rendered.renderedPages,
            total: rendered.pageCount,
          }),
        )
        toast.success(t("invoice.pdfReady"))
        return
      }

      toast.error(t("invoice.unsupportedFile"))
    } catch (fileError) {
      const message = fileError instanceof Error ? fileError.message : t("invoice.prepareFailed")
      toast.error(message)
    } finally {
      setIsPreparingFile(false)
    }
  }

  return (
    <ToolFormCard
      title={t("invoice.title")}
      description={t("invoice.description")}
      isGenerating={isGenerating || isPreparingFile}
      canSubmit={Boolean(image) && !isPreparingFile}
      onSubmit={() => {
        const options: GenerationOptions = image ? { image } : {}
        return onGenerate(
          buildInvoicePrompt({
            analysisType: src(`invoice.analysisTypeOptions.${analysisType}`),
            includeJson,
            includeRisks,
            sourceNote,
          }),
          options,
        )
      }}
    >
      <Alert className="rounded-lg border-border bg-muted/20">
        <FileImage className="h-4 w-4" />
        <AlertDescription>{t("invoice.notice")}</AlertDescription>
      </Alert>
      <div className="space-y-1.5">
        <Label htmlFor="invoice-image" className={FIELD_LABEL_CLASS}>
          {t("invoice.fileLabel")}
        </Label>
        <Input
          id="invoice-image"
          type="file"
          accept="application/pdf,image/png,image/jpeg,image/webp,image/bmp,image/tiff"
          onChange={handleFile}
          disabled={isGenerating || isPreparingFile}
          className="h-8 text-xs"
        />
        {fileName ? (
          <p className="text-xs text-muted-foreground">
            {isPreparingFile
              ? t("invoice.preparingFile", { name: fileName })
              : t("invoice.selectedFile", { name: fileName })}
          </p>
        ) : null}
        {sourceNote ? <p className="text-xs text-muted-foreground">{sourceNote}</p> : null}
      </div>
      <SelectField
        label={t("invoice.analysisTypeLabel")}
        value={analysisType}
        onChange={setAnalysisType}
        options={toOptions(t, "invoice.analysisTypeOptions", INVOICE_ANALYSIS_TYPES)}
      />
      <CheckboxGrid
        items={[
          {
            id: "json",
            label: t("invoice.includeJson"),
            checked: includeJson,
            onChange: setIncludeJson,
          },
          {
            id: "risks",
            label: t("invoice.includeRisks"),
            checked: includeRisks,
            onChange: setIncludeRisks,
          },
        ]}
      />
    </ToolFormCard>
  )
}

function ChatForm({ isGenerating, onGenerate }: ToolFormContext) {
  const { t } = useTranslation("ai-tools")
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [prompt, setPrompt] = useState("")

  // Etykiety ról i nagłówki sekcji poniżej są częścią PROMPTU, nie interfejsu —
  // zostają po polsku razem z resztą instrukcji z `lib/ai-tools/prompts.ts`.
  const conversation = useMemo(
    () =>
      messages
        .slice(-8)
        .map(
          (message) => `${message.role === "user" ? "Użytkownik" : "Asystent"}: ${message.content}`,
        )
        .join("\n"),
    [messages],
  )

  const handleSubmit = async () => {
    const trimmed = prompt.trim()
    if (!trimmed) return
    setPrompt("")
    setMessages((current) => [...current, { role: "user", content: trimmed }])
    const prompts: PromptPair = {
      systemPrompt:
        "Jesteś pomocnym asystentem roboczym Cortex360. Odpowiadasz konkretnie po polsku, bez lania wody.",
      userPrompt: `${conversation ? `Kontekst rozmowy:\n${conversation}\n\n` : ""}Nowa wiadomość:\n${trimmed}`,
    }
    const response = await onGenerate(prompts)
    if (response) {
      setMessages((current) => [...current, { role: "assistant", content: response.content }])
    }
  }

  return (
    <Card className="overflow-hidden rounded-lg shadow-none">
      <CardHeader className="border-b border-border bg-muted/20 px-4 py-3">
        <CardTitle className="text-sm font-semibold">{t("chat.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 p-4">
        <div className="min-h-[220px] space-y-3 rounded-lg border border-border bg-muted/20 p-3">
          {messages.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("chat.empty")}</p>
          ) : (
            messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={cn(
                  "rounded-md border px-3 py-2 text-sm",
                  message.role === "user"
                    ? "ml-8 border-cortex/40 bg-cortex text-cortex-foreground"
                    : "mr-8 border-border bg-background text-foreground",
                )}
              >
                {message.content}
              </div>
            ))
          )}
        </div>
        <Textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder={t("chat.placeholder")}
          className="min-h-[130px] text-sm"
        />
        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setMessages([])}
            disabled={messages.length === 0 || isGenerating}
          >
            {t("chat.newConversation")}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSubmit}
            disabled={!prompt.trim() || isGenerating}
          >
            {isGenerating ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="mr-1.5 h-3.5 w-3.5" />
            )}
            {t("chat.send")}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

interface ToolFormCardProps {
  title: string
  description: string
  children: ReactNode
  isGenerating: boolean
  canSubmit: boolean
  onSubmit: () => void
}

function ToolFormCard({
  title,
  description,
  children,
  isGenerating,
  canSubmit,
  onSubmit,
}: ToolFormCardProps) {
  const { t } = useTranslation("ai-tools")

  return (
    <Card className="overflow-hidden rounded-lg shadow-none">
      <CardHeader className="border-b border-border bg-muted/20 px-4 py-3">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        <p className="text-xs leading-5 text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="space-y-4 p-4">{children}</CardContent>
      <div className="flex items-center justify-end border-t border-border bg-muted/20 px-4 py-3">
        <Button type="button" size="sm" onClick={onSubmit} disabled={!canSubmit || isGenerating}>
          {isGenerating ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
          )}
          {t("shared.generate")}
        </Button>
      </div>
    </Card>
  )
}

interface ResultPanelProps {
  content: string
  error: string | null
  isGenerating: boolean
  model: string | undefined
  title: string
  tokensUsed: number | null | undefined
}

function ResultPanel({ content, error, isGenerating, model, title, tokensUsed }: ResultPanelProps) {
  const { t } = useTranslation("ai-tools")
  const locale = useLocaleStore((s) => s.locale)

  const handleCopy = async () => {
    if (!content) return
    await navigator.clipboard.writeText(content)
    toast.success(t("result.copied"))
  }

  const handleDownload = () => {
    if (!content) return
    downloadText("ai-tools-result.md", content)
  }

  return (
    <Card className="min-h-[520px] overflow-hidden rounded-lg shadow-none">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border bg-muted/20 px-4 py-3">
        <div className="space-y-1">
          <CardTitle className="text-sm font-semibold">{title}</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            {model ? (
              <Badge variant="secondary" className="h-5 text-[10px]">
                {model}
              </Badge>
            ) : null}
            {tokensUsed ? (
              <Badge variant="outline" className="h-5 text-[10px]">
                {t("shared.tokens", { value: formatNumber(tokensUsed, locale) })}
              </Badge>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8"
            onClick={handleCopy}
            disabled={!content}
          >
            <Clipboard className="mr-1.5 h-3.5 w-3.5" />
            {t("result.copy")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8"
            onClick={handleDownload}
            disabled={!content}
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            {t("result.download")}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        {error ? (
          <Alert variant="destructive" className="mb-4 rounded-lg">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        {isGenerating ? (
          <div className="flex min-h-[360px] items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t("result.generating")}
          </div>
        ) : content ? (
          <div className="max-h-[70vh] overflow-auto rounded-lg border border-border bg-muted/20 p-4">
            <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-6">
              {content}
            </pre>
          </div>
        ) : (
          <div className="flex min-h-[360px] items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 text-sm text-muted-foreground">
            {t("result.placeholder")}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

interface InputFieldProps {
  label: string
  onChange: (value: string) => void
  placeholder?: string
  value: string
}

function InputField({ label, onChange, placeholder, value }: InputFieldProps) {
  const id = useStableInputId(label)
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className={FIELD_LABEL_CLASS}>
        {label}
      </Label>
      <Input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-8 text-xs"
      />
    </div>
  )
}

interface TextAreaFieldProps extends InputFieldProps {
  minHeight?: string
}

function TextAreaField({
  label,
  minHeight = "min-h-[180px]",
  onChange,
  placeholder,
  value,
}: TextAreaFieldProps) {
  const id = useStableInputId(label)
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className={FIELD_LABEL_CLASS}>
        {label}
      </Label>
      <Textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={cn(minHeight, "resize-y text-sm")}
      />
    </div>
  )
}

interface SelectOption {
  /** Klucz tłumaczenia — stabilny między językami, więc przełączenie języka
   *  nie gubi zaznaczenia. Do promptu idzie przez `useSourceText()`. */
  value: string
  label: string
}

interface SelectFieldProps {
  label: string
  onChange: (value: string) => void
  options: readonly SelectOption[]
  value: string
}

function SelectField({ label, onChange, options, value }: SelectFieldProps) {
  return (
    <div className="space-y-1.5">
      <Label className={FIELD_LABEL_CLASS}>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

/** Opcje listy wyboru z jednej gałęzi przestrzeni `ai-tools`. */
function toOptions(
  t: (key: string) => string,
  prefix: string,
  keys: readonly string[],
): readonly SelectOption[] {
  return keys.map((key) => ({ value: key, label: t(`${prefix}.${key}`) }))
}

/** Napis w języku ŹRÓDŁOWYM — to on jedzie do modelu. Patrz komentarz przy
 *  listach kluczy na górze pliku. */
function useSourceText(): (key: string) => string {
  const { i18n: instance } = useTranslation("ai-tools")
  return useMemo(() => {
    const fixed = instance.getFixedT(SOURCE_LOCALE, "ai-tools")
    return (key: string) => String(fixed(key))
  }, [instance])
}

interface NumberFieldProps {
  label: string
  max: number
  min: number
  onChange: (value: number) => void
  value: number
}

function NumberField({ label, max, min, onChange, value }: NumberFieldProps) {
  const id = useStableInputId(label)
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className={FIELD_LABEL_CLASS}>
        {label}
      </Label>
      <Input
        id={id}
        type="number"
        min={min}
        max={max}
        value={value}
        className="h-8 text-xs"
        onChange={(event) => {
          const next = Number(event.target.value)
          if (Number.isFinite(next)) onChange(Math.max(min, Math.min(max, next)))
        }}
      />
    </div>
  )
}

interface CheckboxGridProps {
  items: readonly {
    id: string
    label: string
    checked: boolean
    onChange: (checked: boolean) => void
  }[]
}

function CheckboxGrid({ items }: CheckboxGridProps) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {items.map((item) => (
        <CheckboxRow key={item.id} {...item} />
      ))}
    </div>
  )
}

interface CheckboxRowProps {
  checked: boolean
  id: string
  label: string
  onChange: (checked: boolean) => void
}

function CheckboxRow({ checked, id, label, onChange }: CheckboxRowProps) {
  return (
    <label
      htmlFor={id}
      className="flex min-h-9 cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-xs transition-colors hover:bg-muted/30"
    >
      <Checkbox id={id} checked={checked} onCheckedChange={(value) => onChange(value === true)} />
      <span>{label}</span>
    </label>
  )
}

function useStableInputId(label: string): string {
  return useMemo(
    () =>
      `ai-tools-${label
        .toLowerCase()
        .replace(/[^a-z0-9ąćęłńóśźż]+/gi, "-")
        .replace(/^-|-$/g, "")}`,
    [label],
  )
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result)
      else reject(new Error(tOutsideReact("errors.readFile")))
    }
    reader.onerror = () => reject(new Error(tOutsideReact("errors.readFile")))
    reader.readAsDataURL(file)
  })
}

function isPdfFile(file: File): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
}

interface RenderedInvoicePdf {
  dataUrl: string
  mimeType: string
  pageCount: number
  renderedPages: number
}

async function renderPdfFileAsInvoiceImage(file: File): Promise<RenderedInvoicePdf> {
  const pdfjs = await import("pdfjs-dist")
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER_SRC
  }

  const loadingTask = pdfjs.getDocument({
    data: await file.arrayBuffer(),
    cMapUrl: PDF_CMAP_URL,
    cMapPacked: true,
    standardFontDataUrl: PDF_STANDARD_FONT_URL,
  })
  const doc = await loadingTask.promise

  try {
    const pageCount = doc.numPages
    const renderedPages = Math.min(pageCount, PDF_INVOICE_MAX_PAGES)
    const canvases: HTMLCanvasElement[] = []

    for (let pageNumber = 1; pageNumber <= renderedPages; pageNumber += 1) {
      const page = await doc.getPage(pageNumber)
      const baseViewport = page.getViewport({ scale: 1 })
      const scale = Math.min(PDF_INVOICE_RENDER_SCALE, PDF_INVOICE_MAX_WIDTH / baseViewport.width)
      const viewport = page.getViewport({ scale })
      const canvas = document.createElement("canvas")
      const ctx = canvas.getContext("2d")
      if (!ctx) throw new Error(tOutsideReact("errors.pdfRender"))

      canvas.width = Math.ceil(viewport.width)
      canvas.height = Math.ceil(viewport.height)
      await page.render({ canvasContext: ctx, viewport }).promise
      canvases.push(canvas)
    }

    const dataUrl = mergeInvoicePdfPages(canvases)
    if (dataUrl.length > AI_TOOL_MAX_DATA_URL_LENGTH) {
      throw new Error(tOutsideReact("errors.pdfTooLarge"))
    }

    return {
      dataUrl,
      mimeType: "image/jpeg",
      pageCount,
      renderedPages,
    }
  } finally {
    await doc.destroy()
  }
}

function mergeInvoicePdfPages(canvases: readonly HTMLCanvasElement[]): string {
  const width = Math.max(...canvases.map((canvas) => canvas.width))
  const height =
    canvases.reduce((total, canvas) => total + canvas.height, 0) +
    Math.max(0, canvases.length - 1) * PDF_INVOICE_PAGE_GAP
  const merged = document.createElement("canvas")
  const ctx = merged.getContext("2d")
  if (!ctx) throw new Error(tOutsideReact("errors.pdfMerge"))

  merged.width = width
  merged.height = height
  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, width, height)

  let y = 0
  canvases.forEach((canvas) => {
    ctx.drawImage(canvas, Math.floor((width - canvas.width) / 2), y)
    y += canvas.height + PDF_INVOICE_PAGE_GAP
  })

  return merged.toDataURL("image/jpeg", PDF_INVOICE_JPEG_QUALITY)
}

function normalizeBasePath(value: string | undefined): string {
  if (!value) return ""
  const trimmed = value.trim()
  if (!trimmed || trimmed === "/") return ""
  return trimmed.startsWith("/") ? trimmed.replace(/\/+$/, "") : `/${trimmed.replace(/\/+$/, "")}`
}

function publicAssetPath(pathname: string): string {
  return `${PUBLIC_BASE_PATH}${pathname}`
}

function downloadText(fileName: string, content: string): void {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}
