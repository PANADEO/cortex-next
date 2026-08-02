"use client"

import { useCompose, useEnhanceText, useFrameTemplates, useGenerate } from "@/features/ilustromat/hooks"
import type { GeneratedVariantDto, SessionHistoryEntry } from "@/features/ilustromat/types"
import { toPngDataUrl, useObjectUrl } from "@/features/ilustromat/use-object-url"
import {
  DEFAULT_FORMAT,
  DEFAULT_STYLE,
  DEFAULT_VARIANTS,
  FORMATS,
  MAX_VARIANTS,
  MIN_VARIANTS,
  STYLES,
  SUBTITLE_MAX_CHARS,
  TITLE_MAX_CHARS,
} from "@/lib/ilustromat/presets"
import { toastApiError } from "@cortex/api"
import {
  Button,
  Card,
  CardContent,
  EmptyState,
  Input,
  Label,
  PageHeader,
  RadioGroup,
  RadioGroupItem,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Textarea,
} from "@cortex/ui"
import { Download, History, Image as ImageIcon, Sparkles, Wand2 } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

/** Rekompozycja jest tania (bez AI), ale nie darmowa — debounce trzyma ją
 *  poza ścieżką każdego pojedynczego naciśnięcia klawisza. */
const RECOMPOSE_DEBOUNCE_MS = 400

export default function GenerationPage() {
  const templatesQuery = useFrameTemplates(true)
  const generate = useGenerate()
  const compose = useCompose()
  const enhance = useEnhanceText()

  const [title, setTitle] = useState("")
  const [subtitle, setSubtitle] = useState("")
  const [idea, setIdea] = useState("")
  const [styleKey, setStyleKey] = useState(DEFAULT_STYLE.key)
  const [formatKey, setFormatKey] = useState(DEFAULT_FORMAT.key)
  const [templateId, setTemplateId] = useState<string>("")
  const [variants, setVariants] = useState(DEFAULT_VARIANTS)

  const [result, setResult] = useState<SessionHistoryEntry | null>(null)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [recomposed, setRecomposed] = useState<Blob | null>(null)
  const [history, setHistory] = useState<SessionHistoryEntry[]>([])

  const templates = useMemo(() => templatesQuery.data ?? [], [templatesQuery.data])

  useEffect(() => {
    if (!templateId && templates.length > 0) setTemplateId(templates[0]!.id)
  }, [templates, templateId])

  const recomposedUrl = useObjectUrl(recomposed)
  const selectedVariant: GeneratedVariantDto | undefined = result?.variants[selectedIndex]
  const previewUrl = recomposedUrl ?? (selectedVariant ? toPngDataUrl(selectedVariant.composed) : null)

  // Format jest "zamrożony" na czas życia bieżących teł: przycięcie kwadratu
  // do 1.91:1 wygląda źle, więc zmiana formatu czeka na kolejne "Generuj"
  // (dokładnie jak active_format_key w PoC).
  const frozenFormatKey = result?.formatKey ?? formatKey
  const formatChanged = Boolean(result) && formatKey !== result?.formatKey

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastComposedRef = useRef<string>("")

  // Rekompozycja po zmianie tekstu — NIGDY nowa generacja AI (REQ-08).
  useEffect(() => {
    if (!result || !selectedVariant) return

    const signature = `${title}|${subtitle}|${selectedIndex}|${result.id}`
    if (signature === lastComposedRef.current) return

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      lastComposedRef.current = signature
      compose
        .mutateAsync({
          templateId: result.templateId,
          formatKey: result.formatKey,
          title,
          subtitle,
          background: selectedVariant.background,
        })
        .then(setRecomposed)
        .catch((error) => toastApiError(error, "Nie udało się przeliczyć kafelka"))
    }, RECOMPOSE_DEBOUNCE_MS)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, subtitle, selectedIndex, result])

  async function handleGenerate() {
    if (!title.trim()) {
      toast.error("Tytuł jest wymagany")
      return
    }
    if (!templateId) {
      toast.error("Wybierz szablon marki")
      return
    }

    try {
      const response = await generate.mutateAsync({
        templateId,
        formatKey,
        styleKey,
        title,
        subtitle,
        idea,
        variants,
      })

      const entry: SessionHistoryEntry = {
        id: `${Date.now()}`,
        createdAt: Date.now(),
        title,
        subtitle,
        idea,
        styleKey,
        formatKey: response.formatKey,
        templateId: response.templateId,
        prompt: response.prompt,
        model: response.model,
        variants: response.variants,
        selectedIndex: 0,
      }

      setResult(entry)
      setSelectedIndex(0)
      setRecomposed(null)
      lastComposedRef.current = `${title}|${subtitle}|0|${entry.id}`
      setHistory((current) => [entry, ...current].slice(0, 10))
    } catch (error) {
      toastApiError(error, "Nie udało się wygenerować wariantów")
    }
  }

  async function handleEnhance(field: "title" | "subtitle") {
    const text = field === "title" ? title : subtitle
    if (!text.trim()) {
      toast.error("Najpierw wpisz tekst do poprawy")
      return
    }
    try {
      const { text: improved } = await enhance.mutateAsync({ field, text })
      if (field === "title") setTitle(improved)
      else setSubtitle(improved)
      toast.success("Tekst poprawiony")
    } catch (error) {
      toastApiError(error, "Nie udało się poprawić tekstu")
    }
  }

  function restore(entry: SessionHistoryEntry) {
    setTitle(entry.title)
    setSubtitle(entry.subtitle)
    setIdea(entry.idea)
    setStyleKey(entry.styleKey)
    setFormatKey(entry.formatKey)
    setResult(entry)
    setSelectedIndex(entry.selectedIndex)
    setRecomposed(null)
    lastComposedRef.current = `${entry.title}|${entry.subtitle}|${entry.selectedIndex}|${entry.id}`
  }

  function download() {
    if (!previewUrl) return
    const link = document.createElement("a")
    link.href = previewUrl
    link.download = `ilustromat-${result?.formatKey ?? "kafelek"}-${Date.now()}.png`
    link.click()
  }

  return (
    <>
      <PageHeader
        title="Ilustromat"
        description="Brandowana ilustracja do posta LinkedIn. Tekst i ramka nakładane są deterministycznie, więc poprawka tytułu nie wymaga nowej generacji."
      />

      <div className="flex flex-1 flex-col gap-6 px-8 py-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
          <Card>
            <CardContent className="flex flex-col gap-4 pt-6">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="ilustromat-title">Tytuł</Label>
                  <span className="text-xs text-muted-foreground">
                    {title.length}/{TITLE_MAX_CHARS}
                  </span>
                </div>
                <Input
                  id="ilustromat-title"
                  value={title}
                  maxLength={TITLE_MAX_CHARS}
                  placeholder="Zmiany w cenach transferowych 2027"
                  onChange={(event) => setTitle(event.target.value)}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="self-start"
                  disabled={enhance.isPending}
                  onClick={() => handleEnhance("title")}
                >
                  <Wand2 className="mr-2 h-4 w-4" />
                  Popraw (AI)
                </Button>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="ilustromat-subtitle">Podtytuł</Label>
                  <span className="text-xs text-muted-foreground">
                    {subtitle.length}/{SUBTITLE_MAX_CHARS}
                  </span>
                </div>
                <Input
                  id="ilustromat-subtitle"
                  value={subtitle}
                  maxLength={SUBTITLE_MAX_CHARS}
                  placeholder="Co musisz wiedzieć zanim przepisy wejdą w życie"
                  onChange={(event) => setSubtitle(event.target.value)}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="self-start"
                  disabled={enhance.isPending}
                  onClick={() => handleEnhance("subtitle")}
                >
                  <Wand2 className="mr-2 h-4 w-4" />
                  Popraw (AI)
                </Button>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="ilustromat-idea">Pomysł na ilustrację (opcjonalnie)</Label>
                <Textarea
                  id="ilustromat-idea"
                  value={idea}
                  rows={3}
                  placeholder="Np. most łączący dwa brzegi jako metafora porozumienia"
                  onChange={(event) => setIdea(event.target.value)}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="ilustromat-style">Styl</Label>
                <Select value={styleKey} onValueChange={setStyleKey}>
                  <SelectTrigger id="ilustromat-style">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STYLES.map((style) => (
                      <SelectItem key={style.key} value={style.key}>
                        {style.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="ilustromat-format">Format</Label>
                <Select value={formatKey} onValueChange={setFormatKey}>
                  <SelectTrigger id="ilustromat-format">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FORMATS.map((format) => (
                      <SelectItem key={format.key} value={format.key}>
                        {format.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formatChanged ? (
                  <p className="text-xs text-muted-foreground">
                    Nowy format zostanie użyty przy kolejnej generacji — bieżące tła mają inne proporcje.
                  </p>
                ) : null}
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="ilustromat-template">Szablon marki</Label>
                <Select value={templateId} onValueChange={setTemplateId}>
                  <SelectTrigger id="ilustromat-template">
                    <SelectValue placeholder="Wybierz szablon" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <Label>Liczba wariantów</Label>
                <RadioGroup
                  className="flex gap-4"
                  value={String(variants)}
                  onValueChange={(value) => setVariants(Number(value))}
                >
                  {[MIN_VARIANTS, MAX_VARIANTS].map((count) => (
                    <div key={count} className="flex items-center gap-2">
                      <RadioGroupItem id={`ilustromat-variants-${count}`} value={String(count)} />
                      <Label htmlFor={`ilustromat-variants-${count}`} className="font-normal">
                        {count}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              <Button
                type="button"
                onClick={handleGenerate}
                disabled={generate.isPending || templates.length === 0}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                {generate.isPending ? "Generowanie..." : "Generuj"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-col gap-4 pt-6">
              {generate.isPending ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {Array.from({ length: variants }, (_, index) => (
                    <Skeleton key={index} className="aspect-square w-full" />
                  ))}
                </div>
              ) : !result ? (
                <EmptyState
                  icon={ImageIcon}
                  title="Brak wygenerowanych kafelków"
                  description="Wypełnij tytuł i kliknij Generuj. Warianty pojawią się już z nałożoną ramką marki."
                />
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {result.variants.map((variant, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => {
                          setSelectedIndex(index)
                          setRecomposed(null)
                        }}
                        className={
                          index === selectedIndex
                            ? "overflow-hidden rounded-md ring-2 ring-primary"
                            : "overflow-hidden rounded-md ring-1 ring-border hover:ring-primary/50"
                        }
                        aria-label={`Wariant ${index + 1}`}
                        aria-pressed={index === selectedIndex}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={toPngDataUrl(variant.composed)}
                          alt={`Wariant ${index + 1}`}
                          className="h-auto w-full"
                        />
                      </button>
                    ))}
                  </div>

                  {previewUrl ? (
                    <div className="flex flex-col gap-3">
                      <Label>Wybrany kafelek</Label>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={previewUrl}
                        alt="Wybrany kafelek"
                        className="h-auto w-full rounded-md border border-border"
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" onClick={download}>
                          <Download className="mr-2 h-4 w-4" />
                          Pobierz PNG
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleGenerate}
                          disabled={generate.isPending}
                        >
                          Wygeneruj ponownie
                        </Button>
                      </div>
                      <dl className="grid gap-1 text-xs text-muted-foreground">
                        <div className="flex gap-2">
                          <dt className="font-medium">Model:</dt>
                          <dd>{result.model}</dd>
                        </div>
                        <div className="flex gap-2">
                          <dt className="font-medium">Format:</dt>
                          <dd>{frozenFormatKey}</dd>
                        </div>
                        <div className="flex gap-2">
                          <dt className="font-medium">Szablon:</dt>
                          <dd>{result.templateId}</dd>
                        </div>
                        <div className="flex flex-col gap-1">
                          <dt className="font-medium">Prompt:</dt>
                          <dd className="break-words">{result.prompt}</dd>
                        </div>
                      </dl>
                    </div>
                  ) : null}
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {history.length > 0 ? (
          <Card>
            <CardContent className="flex flex-col gap-3 pt-6">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-muted-foreground" />
                <Label>Historia tej sesji</Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Historia żyje wyłącznie w tej karcie przeglądarki — odświeżenie strony ją czyści.
              </p>
              <ul className="flex flex-col gap-2">
                {history.map((entry) => (
                  <li key={entry.id} className="flex items-center justify-between gap-4">
                    <span className="truncate text-sm">{entry.title}</span>
                    <Button type="button" variant="ghost" size="sm" onClick={() => restore(entry)}>
                      Przywróć
                    </Button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </>
  )
}
