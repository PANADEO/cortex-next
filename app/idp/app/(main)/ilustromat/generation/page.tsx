"use client"

import {
  useAssistText,
  useCompose,
  useFrameTemplates,
  useGenerate,
} from "@/features/ilustromat/hooks"
import type {
  AssistFieldDto,
  AssistModeDto,
  GeneratedVariantDto,
  SessionHistoryEntry,
} from "@/features/ilustromat/types"
import { toPngDataUrl, useObjectUrl } from "@/features/ilustromat/use-object-url"
import { apiErrorMessage } from "@/lib/i18n/api-error"
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
import type { LucideIcon } from "lucide-react"
import {
  Download,
  History,
  Image as ImageIcon,
  Lightbulb,
  Shuffle,
  Sparkles,
  Undo2,
  Wand2,
} from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

/** Rekompozycja jest tania (bez AI), ale nie darmowa — debounce trzyma ją
 *  poza ścieżką każdego pojedynczego naciśnięcia klawisza. */
const RECOMPOSE_DEBOUNCE_MS = 400

/** Per pole: jeden krok wstecz dla "Cofnij" i wersje już pokazane userowi.
 *  Te drugie lecą do modelu jako "nie proponuj tego znowu" — bez nich kolejne
 *  kliknięcie "Inna wersja" wraca do tego samego sformułowania. */
interface FieldAssist {
  undo: string | null
  seen: string[]
}
type AssistState = Record<AssistFieldDto, FieldAssist>

const EMPTY_ASSIST_STATE: AssistState = {
  title: { undo: null, seen: [] },
  subtitle: { undo: null, seen: [] },
  idea: { undo: null, seen: [] },
}

function AssistButton({
  label,
  icon: Icon,
  help,
  disabled,
  pending,
  onClick,
}: {
  label: string
  icon: LucideIcon
  help: string
  disabled: boolean
  pending: boolean
  onClick: () => void
}) {
  const { t } = useTranslation("ilustromat")

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      title={help}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon className="mr-2 h-4 w-4" />
      {pending ? t("assist.pending") : label}
    </Button>
  )
}

function UndoButton({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
  const { t } = useTranslation("ilustromat")

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      title={t("assist.undoHelp")}
      disabled={disabled}
      onClick={onClick}
    >
      <Undo2 className="mr-2 h-4 w-4" />
      {t("assist.undo")}
    </Button>
  )
}

export default function GenerationPage() {
  const { t } = useTranslation("ilustromat")
  const templatesQuery = useFrameTemplates(true)
  const generate = useGenerate()
  const compose = useCompose()
  const assist = useAssistText()

  const [title, setTitle] = useState("")
  const [subtitle, setSubtitle] = useState("")
  const [idea, setIdea] = useState("")
  const [assistState, setAssistState] = useState<AssistState>(EMPTY_ASSIST_STATE)
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
  const previewUrl =
    recomposedUrl ?? (selectedVariant ? toPngDataUrl(selectedVariant.composed) : null)

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
        // apiErrorMessage, a nie toastApiError: rekompozycja pada na
        // konkretnym szablonie (brak szablonu, niekompletny font), a te
        // odpowiedzi niosą KLUCZ komunikatu — ogólny zapas nie powiedziałby,
        // CO jest nie tak.
        .catch((error) => toast.error(apiErrorMessage(t, error, t("toasts.recomposeFailed"))))
    }, RECOMPOSE_DEBOUNCE_MS)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, subtitle, selectedIndex, result])

  async function handleGenerate() {
    if (!title.trim()) {
      toast.error(t("toasts.titleRequired"))
      return
    }
    if (!templateId) {
      toast.error(t("toasts.templateRequired"))
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
      toast.error(apiErrorMessage(t, error, t("toasts.generateFailed")))
    }
  }

  const fieldValue: Record<AssistFieldDto, string> = { title, subtitle, idea }
  const setFieldValue: Record<AssistFieldDto, (value: string) => void> = {
    title: setTitle,
    subtitle: setSubtitle,
    idea: setIdea,
  }

  async function runAssist(field: AssistFieldDto, mode: AssistModeDto) {
    const current = fieldValue[field]
    if (mode === "propose" ? !title.trim() : !current.trim()) {
      toast.error(mode === "propose" ? t("toasts.needTitleFirst") : t("toasts.needTextFirst"))
      return
    }
    // "Dopracuj" ma dać tę samą, najlepszą wersję za każdym razem, więc listy
    // odrzuconych nie dostaje — inaczej drugie kliknięcie musiałoby na siłę
    // uciekać od poprawnego wyniku pierwszego.
    const avoid = mode === "polish" ? [] : assistState[field].seen

    try {
      const { text } = await assist.mutateAsync({
        field,
        mode,
        text: current,
        context: { title, subtitle },
        avoid,
      })
      setFieldValue[field](text)
      setAssistState((state) => ({
        ...state,
        [field]: {
          undo: current,
          // Zarówno tekst zastępowany, jak i nowy trafiają do "już widzianych":
          // kolejne kliknięcie ma uciec od obu, nie zawrócić do punktu wyjścia.
          seen: [...new Set([...avoid, current, text].filter((item) => item.trim()))],
        },
      }))
    } catch (error) {
      toast.error(apiErrorMessage(t, error, t("toasts.assistFailed")))
    }
  }

  function undoAssist(field: AssistFieldDto) {
    const previous = assistState[field].undo
    if (previous === null) return
    setFieldValue[field](previous)
    setAssistState((state) => ({ ...state, [field]: { ...state[field], undo: null } }))
  }

  function isAssistPending(field: AssistFieldDto, mode: AssistModeDto): boolean {
    return assist.isPending && assist.variables?.field === field && assist.variables?.mode === mode
  }

  function restore(entry: SessionHistoryEntry) {
    setTitle(entry.title)
    setSubtitle(entry.subtitle)
    setIdea(entry.idea)
    // Undo i lista odrzuconych dotyczyły poprzedniego tekstu — po przywróceniu
    // wpisu z historii cofanie "do czegoś sprzed" nie ma już sensu.
    setAssistState(EMPTY_ASSIST_STATE)
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
      <PageHeader title="Ilustromat" description={t("generation.description")} />

      <div className="flex flex-1 flex-col gap-6 px-8 py-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
          <Card>
            <CardContent className="flex flex-col gap-4 pt-6">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="ilustromat-title">{t("generation.titleLabel")}</Label>
                  <span className="text-xs text-muted-foreground">
                    {title.length}/{TITLE_MAX_CHARS}
                  </span>
                </div>
                <Input
                  id="ilustromat-title"
                  value={title}
                  maxLength={TITLE_MAX_CHARS}
                  placeholder={t("generation.titlePlaceholder")}
                  onChange={(event) => setTitle(event.target.value)}
                />
                <div className="flex flex-wrap gap-2">
                  <AssistButton
                    label={t("assist.polish")}
                    icon={Wand2}
                    help={t("assist.helpPolish")}
                    disabled={!title.trim() || assist.isPending}
                    pending={isAssistPending("title", "polish")}
                    onClick={() => runAssist("title", "polish")}
                  />
                  <AssistButton
                    label={t("assist.rephrase")}
                    icon={Shuffle}
                    help={t("assist.helpRephrase")}
                    disabled={!title.trim() || assist.isPending}
                    pending={isAssistPending("title", "rephrase")}
                    onClick={() => runAssist("title", "rephrase")}
                  />
                  {assistState.title.undo !== null ? (
                    <UndoButton disabled={assist.isPending} onClick={() => undoAssist("title")} />
                  ) : null}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="ilustromat-subtitle">{t("generation.subtitleLabel")}</Label>
                  <span className="text-xs text-muted-foreground">
                    {subtitle.length}/{SUBTITLE_MAX_CHARS}
                  </span>
                </div>
                <Input
                  id="ilustromat-subtitle"
                  value={subtitle}
                  maxLength={SUBTITLE_MAX_CHARS}
                  placeholder={t("generation.subtitlePlaceholder")}
                  onChange={(event) => setSubtitle(event.target.value)}
                />
                {/* Podtytuł jest opcjonalny i najczęściej startuje pusty — wtedy
                    jedyna sensowna akcja to napisanie go od zera z tytułu. */}
                <div className="flex flex-wrap gap-2">
                  {subtitle.trim() ? (
                    <>
                      <AssistButton
                        label={t("assist.polish")}
                        icon={Wand2}
                        help={t("assist.helpPolish")}
                        disabled={assist.isPending}
                        pending={isAssistPending("subtitle", "polish")}
                        onClick={() => runAssist("subtitle", "polish")}
                      />
                      <AssistButton
                        label={t("assist.rephrase")}
                        icon={Shuffle}
                        help={t("assist.helpRephrase")}
                        disabled={assist.isPending}
                        pending={isAssistPending("subtitle", "rephrase")}
                        onClick={() => runAssist("subtitle", "rephrase")}
                      />
                    </>
                  ) : (
                    <AssistButton
                      label={t("assist.propose")}
                      icon={Lightbulb}
                      help={t("assist.helpProposeSubtitle")}
                      disabled={!title.trim() || assist.isPending}
                      pending={isAssistPending("subtitle", "propose")}
                      onClick={() => runAssist("subtitle", "propose")}
                    />
                  )}
                  {assistState.subtitle.undo !== null ? (
                    <UndoButton
                      disabled={assist.isPending}
                      onClick={() => undoAssist("subtitle")}
                    />
                  ) : null}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="ilustromat-idea">{t("generation.ideaLabel")}</Label>
                <Textarea
                  id="ilustromat-idea"
                  value={idea}
                  rows={3}
                  placeholder={t("generation.ideaPlaceholder")}
                  onChange={(event) => setIdea(event.target.value)}
                />
                <div className="flex flex-wrap gap-2">
                  <AssistButton
                    label={t("assist.propose")}
                    icon={Lightbulb}
                    help={t("assist.helpProposeIdea")}
                    disabled={!title.trim() || assist.isPending}
                    pending={isAssistPending("idea", "propose")}
                    onClick={() => runAssist("idea", "propose")}
                  />
                  {assistState.idea.undo !== null ? (
                    <UndoButton disabled={assist.isPending} onClick={() => undoAssist("idea")} />
                  ) : null}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="ilustromat-style">{t("generation.styleLabel")}</Label>
                <Select value={styleKey} onValueChange={setStyleKey}>
                  <SelectTrigger id="ilustromat-style">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STYLES.map((style) => (
                      <SelectItem key={style.key} value={style.key}>
                        {t(`options.style.${style.key}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="ilustromat-format">{t("generation.formatLabel")}</Label>
                <Select value={formatKey} onValueChange={setFormatKey}>
                  <SelectTrigger id="ilustromat-format">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FORMATS.map((format) => (
                      <SelectItem key={format.key} value={format.key}>
                        {t(`options.format.${format.key}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formatChanged ? (
                  <p className="text-xs text-muted-foreground">{t("generation.formatFrozen")}</p>
                ) : null}
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="ilustromat-template">{t("generation.templateLabel")}</Label>
                <Select value={templateId} onValueChange={setTemplateId}>
                  <SelectTrigger id="ilustromat-template">
                    <SelectValue placeholder={t("generation.templatePlaceholder")} />
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
                <Label>{t("generation.variantsLabel")}</Label>
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
                {generate.isPending ? t("generation.generating") : t("generation.generate")}
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
                  title={t("result.emptyTitle")}
                  description={t("result.emptyDescription")}
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
                        aria-label={t("result.variantAlt", { index: index + 1 })}
                        aria-pressed={index === selectedIndex}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={toPngDataUrl(variant.composed)}
                          alt={t("result.variantAlt", { index: index + 1 })}
                          className="h-auto w-full"
                        />
                      </button>
                    ))}
                  </div>

                  {previewUrl ? (
                    <div className="flex flex-col gap-3">
                      <Label>{t("result.selected")}</Label>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={previewUrl}
                        alt={t("result.selected")}
                        className="h-auto w-full rounded-md border border-border"
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" onClick={download}>
                          <Download className="mr-2 h-4 w-4" />
                          {t("result.download")}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleGenerate}
                          disabled={generate.isPending}
                        >
                          {t("result.regenerate")}
                        </Button>
                      </div>
                      <dl className="grid gap-1 text-xs text-muted-foreground">
                        <div className="flex gap-2">
                          <dt className="font-medium">{t("result.model")}</dt>
                          <dd>{result.model}</dd>
                        </div>
                        <div className="flex gap-2">
                          <dt className="font-medium">{t("result.format")}</dt>
                          <dd>{frozenFormatKey}</dd>
                        </div>
                        <div className="flex gap-2">
                          <dt className="font-medium">{t("result.template")}</dt>
                          <dd>{result.templateId}</dd>
                        </div>
                        <div className="flex flex-col gap-1">
                          <dt className="font-medium">{t("result.prompt")}</dt>
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
                <Label>{t("history.title")}</Label>
              </div>
              <p className="text-xs text-muted-foreground">{t("history.note")}</p>
              <ul className="flex flex-col gap-2">
                {history.map((entry) => (
                  <li key={entry.id} className="flex items-center justify-between gap-4">
                    <span className="truncate text-sm">{entry.title}</span>
                    <Button type="button" variant="ghost" size="sm" onClick={() => restore(entry)}>
                      {t("history.restore")}
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
