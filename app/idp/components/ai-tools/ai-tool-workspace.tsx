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
  buildContentPrompt,
  buildHighlightPrompt,
  buildInvoicePrompt,
  buildLinkedinPrompt,
  buildPresentationPrompt,
  buildSummarizePrompt,
  buildTransformPrompt,
  type PromptPair,
} from "@/lib/ai-tools/prompts"
import { getAiToolDefinition } from "@/lib/ai-tools/registry"
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

const ANALYSIS_AREAS = [
  "sentyment",
  "tematy",
  "styl",
  "czytelność",
  "słowa kluczowe",
  "struktura",
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

export function AiToolWorkspace({ toolId }: AiToolWorkspaceProps) {
  const tool = getAiToolDefinition(toolId)
  const queryClient = useQueryClient()
  const [result, setResult] = useState<AiToolGenerateResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const historyQuery = useQuery({
    enabled: Boolean(tool),
    queryFn: () => {
      if (!tool) throw new Error("Nieznane narzędzie")
      return getAiToolHistory(tool.id)
    },
    queryKey: tool ? aiToolHistoryQueryKey(tool.id) : ["ai-tools", "history", "unknown"],
  })

  if (!tool) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-8">
        <EmptyState
          icon={Sparkles}
          title="Nieznane narzędzie"
          description="Ten adres nie odpowiada żadnej aplikacji AI Tools."
          action={
            <Button asChild variant="outline" size="sm">
              <Link href="/">Wróć do huba</Link>
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
      toast.success("Wynik wygenerowany")
      return response
    } catch (generationError) {
      const message =
        generationError instanceof Error
          ? generationError.message
          : "Nie udało się wygenerować wyniku"
      setError(message)
      toast.error("Generowanie nie powiodło się")
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
        <PageHeader
          title={tool.label}
          description={tool.description}
          actions={
            <Button asChild variant="outline" size="sm">
              <Link href="/">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Aplikacje
              </Link>
            </Button>
          }
        />

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
            title="Wynik"
          />
        </div>
      </div>
    </AiToolGate>
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
  return (
    <Card className="overflow-hidden rounded-lg shadow-none">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border bg-muted/20 px-4 py-3">
        <CardTitle className="text-sm font-semibold">Historia</CardTitle>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8"
          onClick={onRefresh}
          disabled={isLoading}
        >
          <RefreshCcw className={cn("mr-1.5 h-3.5 w-3.5", isLoading && "animate-spin")} />
          Odśwież
        </Button>
      </CardHeader>
      <CardContent className="space-y-3 p-4">
        {error ? (
          <Alert variant="destructive" className="rounded-lg">
            <AlertDescription>Nie udało się pobrać historii.</AlertDescription>
          </Alert>
        ) : null}
        {isLoading ? (
          <div className="flex min-h-[120px] items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Wczytywanie historii…
          </div>
        ) : items.length === 0 && !error ? (
          <div className="flex min-h-[120px] items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 text-sm text-muted-foreground">
            Brak historii dla tej aplikacji.
          </div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="rounded-lg border border-border bg-background p-3">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="h-5 text-[10px]">
                  {formatHistoryDate(item.createdAt)}
                </Badge>
                {item.tokensUsed ? (
                  <Badge variant="outline" className="h-5 text-[10px]">
                    ~{item.tokensUsed.toLocaleString()} tokenów
                  </Badge>
                ) : null}
                {item.hasImage ? (
                  <Badge variant="outline" className="h-5 text-[10px]">
                    plik
                  </Badge>
                ) : null}
              </div>
              <p className="mb-2 line-clamp-2 text-xs text-muted-foreground">
                {createPreview(item.userPrompt)}
              </p>
              <p className="max-h-16 overflow-hidden text-sm leading-5">{createPreview(item.content)}</p>
              <div className="mt-3 flex justify-end">
                <Button type="button" size="sm" variant="outline" onClick={() => onSelect(item)}>
                  Pokaż
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

function formatHistoryDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString("pl-PL", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
  })
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
    case "content-guru":
      return <ContentForm {...context} />
    case "linkedin-generator":
      return <LinkedinForm {...context} />
    case "visual-guru":
      return <PresentationForm {...context} />
    case "fakturomat":
      return <InvoiceForm {...context} />
    case "ai-daily-assistant":
      return <ChatForm {...context} />
  }
}

function HighlighterForm({ isGenerating, onGenerate }: ToolFormContext) {
  const [text, setText] = useState("")
  const [target, setTarget] = useState("Kluczowe pojęcia i decyzje")
  const [style, setStyle] = useState("lista + oznaczenia w tekście")
  const [maxHighlights, setMaxHighlights] = useState(8)
  const [contextWords, setContextWords] = useState(4)

  return (
    <ToolFormCard
      title="Analiza fragmentów"
      description="Najlepsze do ofert, notatek, regulaminów i długich maili."
      isGenerating={isGenerating}
      canSubmit={text.trim().length > 0}
      onSubmit={() =>
        onGenerate(
          buildHighlightPrompt({
            text,
            target,
            style,
            maxHighlights,
            contextWords,
          }),
        )
      }
    >
      <TextAreaField
        label="Tekst do analizy"
        value={text}
        onChange={setText}
        placeholder="Wklej tekst, w którym mam znaleźć najważniejsze fragmenty…"
        minHeight="min-h-[260px]"
      />
      <SelectField
        label="Cel analizy"
        value={target}
        onChange={setTarget}
        options={[
          "Kluczowe pojęcia i decyzje",
          "Argumenty i dowody",
          "Ryzyka i niepewności",
          "Daty, liczby i zobowiązania",
          "Nazwy własne i podmioty",
          "Własne kryterium z tekstu",
        ]}
      />
      <SelectField
        label="Format wyniku"
        value={style}
        onChange={setStyle}
        options={["lista + oznaczenia w tekście", "tylko lista fragmentów", "wersja do review"]}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <NumberField
          label="Maks. fragmentów"
          value={maxHighlights}
          min={1}
          max={20}
          onChange={setMaxHighlights}
        />
        <NumberField
          label="Słów kontekstu"
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
  const [text, setText] = useState("")
  const [transformation, setTransformation] = useState("Uproszczenie języka")
  const [audience, setAudience] = useState("Klient biznesowy")
  const [complexity, setComplexity] = useState("Prosty")
  const [tone, setTone] = useState("Profesjonalny")
  const [preserveMeaning, setPreserveMeaning] = useState(true)
  const [fixGrammar, setFixGrammar] = useState(true)
  const [improveStructure, setImproveStructure] = useState(true)

  return (
    <ToolFormCard
      title="Przepisanie tekstu"
      description="Zachowuje sens, ale dopasowuje język do odbiorcy i zastosowania."
      isGenerating={isGenerating}
      canSubmit={text.trim().length > 0}
      onSubmit={() =>
        onGenerate(
          buildTransformPrompt({
            text,
            transformation,
            audience,
            complexity,
            tone,
            preserveMeaning,
            fixGrammar,
            improveStructure,
          }),
        )
      }
    >
      <TextAreaField
        label="Tekst źródłowy"
        value={text}
        onChange={setText}
        placeholder="Wklej tekst do przepisania…"
        minHeight="min-h-[240px]"
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField
          label="Transformacja"
          value={transformation}
          onChange={setTransformation}
          options={[
            "Uproszczenie języka",
            "Formalizacja",
            "Styl biznesowy",
            "Styl ekspercki",
            "Styl przyjazny",
            "Skrócenie",
            "Rozwinięcie",
          ]}
        />
        <SelectField
          label="Odbiorca"
          value={audience}
          onChange={setAudience}
          options={[
            "Klient biznesowy",
            "Zespół wewnętrzny",
            "Ekspert branżowy",
            "Osoba nietechniczna",
            "Zarząd",
            "Student",
          ]}
        />
        <SelectField
          label="Poziom języka"
          value={complexity}
          onChange={setComplexity}
          options={["Bardzo prosty", "Prosty", "Średni", "Zaawansowany"]}
        />
        <SelectField
          label="Ton"
          value={tone}
          onChange={setTone}
          options={["Profesjonalny", "Neutralny", "Przyjazny", "Stanowczy", "Spokojny"]}
        />
      </div>
      <CheckboxGrid
        items={[
          {
            id: "preserve",
            label: "Zachowaj dokładne znaczenie",
            checked: preserveMeaning,
            onChange: setPreserveMeaning,
          },
          {
            id: "grammar",
            label: "Popraw gramatykę",
            checked: fixGrammar,
            onChange: setFixGrammar,
          },
          {
            id: "structure",
            label: "Popraw strukturę",
            checked: improveStructure,
            onChange: setImproveStructure,
          },
        ]}
      />
    </ToolFormCard>
  )
}

function AnalyzerForm({ isGenerating, onGenerate }: ToolFormContext) {
  const [text, setText] = useState("")
  const [areas, setAreas] = useState<readonly string[]>([
    "sentyment",
    "tematy",
    "styl",
    "czytelność",
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
      title="Diagnoza tekstu"
      description="Zwraca ocenę jakościową, dowody z tekstu i rekomendacje poprawek."
      isGenerating={isGenerating}
      canSubmit={text.trim().length > 0 && areas.length > 0}
      onSubmit={() => onGenerate(buildAnalyzePrompt({ text, areas }))}
    >
      <TextAreaField
        label="Tekst do analizy"
        value={text}
        onChange={setText}
        placeholder="Wklej artykuł, ofertę, email albo notatkę…"
        minHeight="min-h-[260px]"
      />
      <div className="space-y-1.5">
        <Label className={FIELD_LABEL_CLASS}>Zakres analizy</Label>
        <div className="grid gap-2 sm:grid-cols-2">
          {ANALYSIS_AREAS.map((area) => (
            <CheckboxRow
              key={area}
              id={`area-${area}`}
              label={area}
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
  const [text, setText] = useState("")
  const [summaryType, setSummaryType] = useState("Streszczenie wykonawcze")
  const [length, setLength] = useState("Krótko, 120-200 słów")
  const [focus, setFocus] = useState("Decyzje i rekomendacje")
  const [audience, setAudience] = useState("Menedżer")
  const [tone, setTone] = useState("Neutralny")

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setText(await file.text())
  }

  return (
    <ToolFormCard
      title="Streszczenie"
      description="Stawia na decyzje, nie tylko krótszą wersję źródła."
      isGenerating={isGenerating}
      canSubmit={text.trim().length > 0}
      onSubmit={() =>
        onGenerate(buildSummarizePrompt({ text, summaryType, length, focus, audience, tone }))
      }
    >
      <div className="space-y-1.5">
        <Label htmlFor="summary-file" className={FIELD_LABEL_CLASS}>
          Plik tekstowy
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
        label="Tekst"
        value={text}
        onChange={setText}
        placeholder="Wklej tekst albo wgraj plik .txt/.md…"
        minHeight="min-h-[240px]"
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField
          label="Typ"
          value={summaryType}
          onChange={setSummaryType}
          options={[
            "Streszczenie wykonawcze",
            "Kluczowe punkty",
            "FAQ",
            "Jednozdaniowe",
            "Dla osoby nietechnicznej",
            "Abstrakt",
          ]}
        />
        <SelectField
          label="Długość"
          value={length}
          onChange={setLength}
          options={[
            "Bardzo krótko, 50-100 słów",
            "Krótko, 120-200 słów",
            "Średnio, 250-400 słów",
            "Szczegółowo, 500-700 słów",
          ]}
        />
        <SelectField
          label="Priorytet"
          value={focus}
          onChange={setFocus}
          options={[
            "Decyzje i rekomendacje",
            "Fakty i dane",
            "Argumenty",
            "Ryzyka",
            "Działania do wykonania",
          ]}
        />
        <SelectField
          label="Odbiorca"
          value={audience}
          onChange={setAudience}
          options={["Menedżer", "Ekspert", "Klient", "Zespół operacyjny", "Dziecko"]}
        />
      </div>
      <SelectField
        label="Ton"
        value={tone}
        onChange={setTone}
        options={["Neutralny", "Formalny", "Przyjazny", "Popularnonaukowy"]}
      />
    </ToolFormCard>
  )
}

function ContentForm({ isGenerating, onGenerate }: ToolFormContext) {
  const [contentType, setContentType] = useState("Artykuł blogowy")
  const [topic, setTopic] = useState("")
  const [audience, setAudience] = useState("")
  const [tone, setTone] = useState("Profesjonalny")
  const [language, setLanguage] = useState("Polski")
  const [details, setDetails] = useState("")

  return (
    <ToolFormCard
      title="Brief treści"
      description="Wymusza strukturę i informacje wejściowe, żeby wynik był mniej generyczny."
      isGenerating={isGenerating}
      canSubmit={topic.trim().length > 0}
      onSubmit={() =>
        onGenerate(buildContentPrompt({ contentType, topic, audience, tone, language, details }), {
          temperature: 0.8,
        })
      }
    >
      <SelectField
        label="Typ treści"
        value={contentType}
        onChange={setContentType}
        options={[
          "Artykuł blogowy",
          "Post na media społecznościowe",
          "Email marketingowy",
          "Opis produktu",
          "Ogłoszenie o pracę",
          "Recenzja",
          "Instrukcja",
          "Komunikat prasowy",
        ]}
      />
      <InputField
        label="Temat"
        value={topic}
        onChange={setTopic}
        placeholder="np. Automatyzacja obsługi dokumentów w firmie logistycznej"
      />
      <InputField
        label="Odbiorca"
        value={audience}
        onChange={setAudience}
        placeholder="np. dyrektor operacyjny, zespół sprzedaży, kandydaci IT"
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField
          label="Ton"
          value={tone}
          onChange={setTone}
          options={["Profesjonalny", "Ekspercki", "Przyjazny", "Inspirujący", "Konkretny"]}
        />
        <SelectField
          label="Język"
          value={language}
          onChange={setLanguage}
          options={["Polski", "Angielski", "Niemiecki", "Francuski"]}
        />
      </div>
      <TextAreaField
        label="Szczegóły i ograniczenia"
        value={details}
        onChange={setDetails}
        placeholder="Dodaj informacje o produkcie, ofercie, przykładach, słowach kluczowych, zakazanych sformułowaniach…"
        minHeight="min-h-[140px]"
      />
    </ToolFormCard>
  )
}

function LinkedinForm({ isGenerating, onGenerate }: ToolFormContext) {
  const [topic, setTopic] = useState("")
  const [postType, setPostType] = useState("Profesjonalna opinia")
  const [tone, setTone] = useState("Rzeczowy")
  const [length, setLength] = useState("Średni")
  const [audience, setAudience] = useState("Menedżerowie")
  const [keywords, setKeywords] = useState("")
  const [context, setContext] = useState("")
  const [includeHashtags, setIncludeHashtags] = useState(true)
  const [includeCta, setIncludeCta] = useState(true)

  return (
    <ToolFormCard
      title="Post LinkedIn"
      description="Daje gotowy draft oraz alternatywne hooki zamiast jednego sztywnego posta."
      isGenerating={isGenerating}
      canSubmit={topic.trim().length > 0}
      onSubmit={() =>
        onGenerate(
          buildLinkedinPrompt({
            topic,
            postType,
            tone,
            length,
            audience,
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
        label="Temat"
        value={topic}
        onChange={setTopic}
        placeholder="np. Dlaczego AI w firmie powinno zaczynać się od procesów"
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField
          label="Typ posta"
          value={postType}
          onChange={setPostType}
          options={[
            "Profesjonalna opinia",
            "Case study",
            "Porady i wskazówki",
            "Edukacyjny",
            "Ogłoszenie",
            "Pytanie do społeczności",
          ]}
        />
        <SelectField
          label="Odbiorcy"
          value={audience}
          onChange={setAudience}
          options={["Menedżerowie", "Przedsiębiorcy", "Specjaliści IT", "HR", "Ogólna"]}
        />
        <SelectField
          label="Ton"
          value={tone}
          onChange={setTone}
          options={["Rzeczowy", "Ekspercki", "Przyjazny", "Inspirujący", "Stanowczy"]}
        />
        <SelectField
          label="Długość"
          value={length}
          onChange={setLength}
          options={["Krótki", "Średni", "Długi"]}
        />
      </div>
      <InputField
        label="Słowa kluczowe"
        value={keywords}
        onChange={setKeywords}
        placeholder="AI, automatyzacja, compliance…"
      />
      <TextAreaField
        label="Kontekst"
        value={context}
        onChange={setContext}
        placeholder="Dodaj własny przykład, obserwację albo dane…"
        minHeight="min-h-[120px]"
      />
      <CheckboxGrid
        items={[
          {
            id: "hashtags",
            label: "Dodaj hashtagi",
            checked: includeHashtags,
            onChange: setIncludeHashtags,
          },
          {
            id: "cta",
            label: "Dodaj CTA",
            checked: includeCta,
            onChange: setIncludeCta,
          },
        ]}
      />
    </ToolFormCard>
  )
}

function PresentationForm({ isGenerating, onGenerate }: ToolFormContext) {
  const [topic, setTopic] = useState("")
  const [sourceText, setSourceText] = useState("")
  const [slideCount, setSlideCount] = useState(8)
  const [presentationType, setPresentationType] = useState("Biznesowa")
  const [visualStyle, setVisualStyle] = useState("Nowoczesny, oszczędny, czytelny")
  const [includeCharts, setIncludeCharts] = useState(false)

  return (
    <ToolFormCard
      title="Plan prezentacji"
      description="Tworzy strukturę, cel każdego slajdu i eksportowy szkielet HTML."
      isGenerating={isGenerating}
      canSubmit={topic.trim().length > 0}
      onSubmit={() =>
        onGenerate(
          buildPresentationPrompt({
            topic,
            sourceText,
            slideCount,
            presentationType,
            visualStyle,
            includeCharts,
          }),
        )
      }
    >
      <InputField
        label="Temat"
        value={topic}
        onChange={setTopic}
        placeholder="np. Automatyzacja faktur w operacjach międzynarodowych"
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <NumberField
          label="Liczba slajdów"
          value={slideCount}
          min={3}
          max={20}
          onChange={setSlideCount}
        />
        <SelectField
          label="Typ"
          value={presentationType}
          onChange={setPresentationType}
          options={["Biznesowa", "Edukacyjna", "Marketingowa", "Techniczna", "Ogólna"]}
        />
      </div>
      <InputField
        label="Styl wizualny"
        value={visualStyle}
        onChange={setVisualStyle}
        placeholder="np. korporacyjny, techniczny, minimalistyczny"
      />
      <TextAreaField
        label="Materiał źródłowy"
        value={sourceText}
        onChange={setSourceText}
        placeholder="Opcjonalnie wklej notatki, brief lub artykuł…"
        minHeight="min-h-[180px]"
      />
      <CheckboxRow
        id="presentation-charts"
        label="Zaproponuj wykresy tam, gdzie mają sens"
        checked={includeCharts}
        onChange={setIncludeCharts}
      />
    </ToolFormCard>
  )
}

function InvoiceForm({ isGenerating, onGenerate }: ToolFormContext) {
  const [fileName, setFileName] = useState("")
  const [image, setImage] = useState<{ dataUrl: string; mimeType: string } | undefined>()
  const [sourceNote, setSourceNote] = useState("")
  const [isPreparingFile, setIsPreparingFile] = useState(false)
  const [analysisType, setAnalysisType] = useState("Pełna analiza faktury")
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
        setSourceNote(`plik graficzny ${file.name}`)
        return
      }

      if (isPdfFile(file)) {
        setIsPreparingFile(true)
        const rendered = await renderPdfFileAsInvoiceImage(file)
        setImage({ dataUrl: rendered.dataUrl, mimeType: rendered.mimeType })
        setSourceNote(
          `PDF ${file.name}, wyrenderowano ${rendered.renderedPages} z ${rendered.pageCount} stron do jednego obrazu`,
        )
        toast.success("PDF przygotowany do analizy")
        return
      }

      toast.error("Wgraj obraz albo PDF faktury")
    } catch (fileError) {
      const message =
        fileError instanceof Error ? fileError.message : "Nie udało się przygotować pliku"
      toast.error(message)
    } finally {
      setIsPreparingFile(false)
    }
  }

  return (
    <ToolFormCard
      title="Analiza faktury"
      description="Zwraca dane faktury, niepewności OCR/vision i kontrolę formalną."
      isGenerating={isGenerating || isPreparingFile}
      canSubmit={Boolean(image) && !isPreparingFile}
      onSubmit={() => {
        const options: GenerationOptions = image ? { image } : {}
        return onGenerate(
          buildInvoicePrompt({ analysisType, includeJson, includeRisks, sourceNote }),
          options,
        )
      }}
    >
      <Alert className="rounded-lg border-border bg-muted/20">
        <FileImage className="h-4 w-4" />
        <AlertDescription>
          Obrazy trafiają bezpośrednio do analizy. PDF jest renderowany lokalnie do obrazu przed
          wysłaniem przez Cortex Proxy.
        </AlertDescription>
      </Alert>
      <div className="space-y-1.5">
        <Label htmlFor="invoice-image" className={FIELD_LABEL_CLASS}>
          Plik faktury
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
            {isPreparingFile ? "Przygotowuję: " : "Wybrano: "}
            {fileName}
          </p>
        ) : null}
        {sourceNote ? <p className="text-xs text-muted-foreground">{sourceNote}</p> : null}
      </div>
      <SelectField
        label="Typ analizy"
        value={analysisType}
        onChange={setAnalysisType}
        options={[
          "Pełna analiza faktury",
          "Podstawowe dane faktury",
          "Pozycje i kwoty",
          "Dane kontrahentów",
          "Terminy płatności",
          "Podatki i VAT",
          "Sprawdzenie poprawności",
        ]}
      />
      <CheckboxGrid
        items={[
          {
            id: "json",
            label: "Dołącz dane JSON",
            checked: includeJson,
            onChange: setIncludeJson,
          },
          {
            id: "risks",
            label: "Dołącz kontrolę ryzyk",
            checked: includeRisks,
            onChange: setIncludeRisks,
          },
        ]}
      />
    </ToolFormCard>
  )
}

function ChatForm({ isGenerating, onGenerate }: ToolFormContext) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [prompt, setPrompt] = useState("")

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
        <CardTitle className="text-sm font-semibold">Rozmowa</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 p-4">
        <div className="min-h-[220px] space-y-3 rounded-lg border border-border bg-muted/20 p-3">
          {messages.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Zadaj pytanie lub wklej tekst do przeredagowania.
            </p>
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
          placeholder="Napisz wiadomość…"
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
            Nowa rozmowa
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
            Wyślij
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
          Generuj
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
  const handleCopy = async () => {
    if (!content) return
    await navigator.clipboard.writeText(content)
    toast.success("Skopiowano wynik")
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
                ~{tokensUsed.toLocaleString()} tokenów
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
            Kopiuj
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
            Pobierz
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
            Generowanie wyniku przez Cortex Proxy…
          </div>
        ) : content ? (
          <div className="max-h-[70vh] overflow-auto rounded-lg border border-border bg-muted/20 p-4">
            <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-6">
              {content}
            </pre>
          </div>
        ) : (
          <div className="flex min-h-[360px] items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 text-sm text-muted-foreground">
            Wynik pojawi się tutaj po wygenerowaniu.
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

interface SelectFieldProps {
  label: string
  onChange: (value: string) => void
  options: readonly string[]
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
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
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
      else reject(new Error("Nie udało się odczytać pliku"))
    }
    reader.onerror = () => reject(new Error("Nie udało się odczytać pliku"))
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
      if (!ctx) throw new Error("Nie udało się przygotować obrazu PDF")

      canvas.width = Math.ceil(viewport.width)
      canvas.height = Math.ceil(viewport.height)
      await page.render({ canvasContext: ctx, viewport }).promise
      canvases.push(canvas)
    }

    const dataUrl = mergeInvoicePdfPages(canvases)
    if (dataUrl.length > AI_TOOL_MAX_DATA_URL_LENGTH) {
      throw new Error("PDF jest zbyt duży do jednorazowej analizy. Spróbuj krótszego pliku.")
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
  if (!ctx) throw new Error("Nie udało się połączyć stron PDF")

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
