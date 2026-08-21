"use client"

import { GenerationJobCard } from "@/features/content-guru/components/generation-job-card"
import { TopicGeneratorDialog } from "@/features/content-guru/components/topic-generator-dialog"
import {
  createEmptyTopicRow,
  TopicTable,
  type TopicRow,
} from "@/features/content-guru/components/topic-table"
import {
  useContentGuruConfig,
  useCreateGenerationJob,
  useGenerateContent,
  useGenerateKeywordPhrase,
  useGenerateMetaDescriptionMini,
  useGenerationJob,
  useMyClientProfiles,
  useMyMarketProfiles,
  useTemplates,
} from "@/features/content-guru/hooks"
import type {
  ClientProfileDto,
  GenerateContentResponseDto,
  GenerationJobMode,
  MarketProfileDto,
  TemplateDto,
} from "@/features/content-guru/types"
import { ContentStatusBadge, renderHighlightedContent } from "@/features/content-guru/utils"
import { MAX_COMBINATIONS } from "@/lib/content-guru/job-limits"
import { META_DESCRIPTION_MAX_CHARS } from "@/lib/content-guru/mini-generators"
import { toastApiError } from "@cortex/api"
import {
  Button,
  Card,
  CardContent,
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
  Skeleton,
  Tabs,
  TabsList,
  TabsTrigger,
  Textarea,
} from "@cortex/ui"
import { Sparkles } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

// Referencje stabilne między renderami — inaczej `query.data ?? []` tworzyłby
// nową tablicę za każdym razem, unieważniając poniższe useMemo (wzorem
// document-parser/history/page.tsx).
const EMPTY_TEMPLATES: TemplateDto[] = []
const EMPTY_CLIENT_PROFILES: ClientProfileDto[] = []
const EMPTY_MARKET_PROFILES: MarketProfileDto[] = []

const TOPIC_MAX = 500
const AUDIENCE_MAX = 500
const ADDITIONAL_INFO_MAX = 4000

// Radix Select nie pozwala na value="" jako pozycję listy — sentinel
// dla "brak wyboru", nigdy wysyłany na serwer (patrz handleGenerate).
const NO_PROFILE = "__none__"

type GenerationTab = "single" | GenerationJobMode

export default function ContentGuruPage() {
  const { t } = useTranslation("content-guru")
  const configQuery = useContentGuruConfig()
  const templatesQuery = useTemplates()
  const clientProfilesQuery = useMyClientProfiles()
  const marketProfilesQuery = useMyMarketProfiles()
  const generate = useGenerateContent()
  const createJob = useCreateGenerationJob()
  const generateKeywordPhrase = useGenerateKeywordPhrase()
  const generateMetaDescriptionMini = useGenerateMetaDescriptionMini()

  const [activeTab, setActiveTab] = useState<GenerationTab>("single")

  // Szablon — WSPÓLNY między "Pojedyncza" i "Kilka" (oba potrzebują dokładnie
  // jednego szablonu, design doc §4.1: przełączanie trybu nie czyści pracy).
  const [templateCategory, setTemplateCategory] = useState("")
  const [templateId, setTemplateId] = useState("")
  // "Pakiet" — multiselect, niezależny stan (wiele szablonów naraz).
  const [packageTemplateIds, setPackageTemplateIds] = useState<string[]>([])

  const [topic, setTopic] = useState("")
  // Tabela tematów — WSPÓLNA między "Kilka" i "Pakiet" (design doc §4.1: "ta
  // sama tabela tematów co batch").
  const [topicRows, setTopicRows] = useState<TopicRow[]>(() => [createEmptyTopicRow()])

  const [targetAudience, setTargetAudience] = useState("")
  const [additionalInfo, setAdditionalInfo] = useState("")
  const [model, setModel] = useState("")
  const [clientProfileId, setClientProfileId] = useState(NO_PROFILE)
  const [marketProfileId, setMarketProfileId] = useState(NO_PROFILE)
  const [result, setResult] = useState<GenerateContentResponseDto | null>(null)

  // Panel "SEO i metadane" (Round D, D8) — WSPÓLNY między wszystkimi trybami
  // (design doc §4.1: "zostają widoczne niezależnie od wybranego trybu, żeby
  // przełączanie trybu nie czyściło pracy"). Tylko "Pojedyncza" faktycznie
  // wysyła te dwie wartości do /generate (patrz komentarz w
  // handleGenerateSingle) — w "Kilka"/"Pakiet" wartości zostają w UI, ale
  // /jobs ich nie przyjmuje (Round C zostawił je celowo null per pozycję).
  const [keywordPhrase, setKeywordPhrase] = useState("")
  const [metaDescription, setMetaDescription] = useState("")
  const [topicGeneratorOpen, setTopicGeneratorOpen] = useState(false)

  const [activeJobId, setActiveJobId] = useState<string | null>(null)
  const [activeJobMode, setActiveJobMode] = useState<GenerationJobMode | null>(null)
  const jobQuery = useGenerationJob(activeJobId)

  const models = useMemo(() => configQuery.data?.models ?? [], [configQuery.data])
  const templates = templatesQuery.data ?? EMPTY_TEMPLATES
  const clientProfiles = clientProfilesQuery.data ?? EMPTY_CLIENT_PROFILES
  const marketProfiles = marketProfilesQuery.data ?? EMPTY_MARKET_PROFILES

  const templateCategories = useMemo(
    () => Array.from(new Set(templates.map((template) => template.category))).sort(),
    [templates],
  )
  // Select nazwy jest ZALEŻNY od wybranej kategorii (design doc §4.1: "Select
  // kategoria -> Select nazwa, zależne") — dokładnie ten sam wzorzec co
  // legacy content_guru.py.
  const templatesInCategory = useMemo(
    () => templates.filter((template) => template.category === templateCategory),
    [templates, templateCategory],
  )

  useEffect(() => {
    if (!model && models.length > 0) setModel(models[0]!)
  }, [models, model])

  useEffect(() => {
    if (!templateCategory && templateCategories.length > 0)
      setTemplateCategory(templateCategories[0]!)
  }, [templateCategories, templateCategory])

  // Zmiana kategorii czyści wybraną nazwę, jeśli nie należy już do nowej
  // kategorii — inaczej Select nazwy mógłby pokazywać wartość spoza swoich
  // aktualnych opcji.
  useEffect(() => {
    if (templateId && !templatesInCategory.some((template) => template.id === templateId)) {
      setTemplateId("")
    }
  }, [templatesInCategory, templateId])

  const activeTopics = useMemo(
    () =>
      topicRows
        .filter((row) => row.active && row.topic.trim().length > 0)
        .map((row) => row.topic.trim()),
    [topicRows],
  )

  // Źródło tematu dla mini-generatorów frazy/meta (D8): w trybie
  // "Pojedyncza" pole Temat, w "Kilka"/"Pakiet" (brak pojedynczego pola)
  // pierwszy aktywny temat z tabeli — pragmatyczny wybór, bo tylko
  // "Pojedyncza" i tak wysyła wynik dalej (patrz komentarz przy stanie SEO).
  const seoSourceTopic = activeTab === "single" ? topic : (activeTopics[0] ?? "")

  const packageCombinations = activeTopics.length * packageTemplateIds.length
  const packageOverLimit = packageCombinations > MAX_COMBINATIONS

  const canSubmitSingle =
    templateId.length > 0 && topic.trim().length > 0 && model.length > 0 && !generate.isPending
  const canSubmitBatch =
    templateId.length > 0 && activeTopics.length > 0 && model.length > 0 && !createJob.isPending
  const canSubmitPackage =
    packageTemplateIds.length > 0 &&
    activeTopics.length > 0 &&
    model.length > 0 &&
    !packageOverLimit &&
    !createJob.isPending

  function togglePackageTemplate(id: string) {
    setPackageTemplateIds((current) =>
      current.includes(id)
        ? current.filter((templateIdInList) => templateIdInList !== id)
        : [...current, id],
    )
  }

  // Generator tematów (D8) — single: zastępuje pole Temat pierwszym (jedynym,
  // bo dialog w trybie !allowMultiple wymusza pojedynczy wybór) zaznaczonym
  // tematem. batch/pakiet: dokłada każdy zaznaczony temat jako nowy wiersz —
  // jeśli tabela ma tylko jeden, wciąż pusty wiersz startowy, zastępuje go
  // zamiast zostawiać pusty wiersz nad wygenerowanymi tematami.
  function handleInsertGeneratedTopics(insertedTopics: string[]) {
    if (activeTab === "single") {
      const [first] = insertedTopics
      if (first) setTopic(first)
      return
    }
    setTopicRows((current) => {
      const base =
        current.length === 1 && current[0] && current[0].topic.trim() === "" ? [] : current
      const newRows = insertedTopics.map((value) => ({
        id: crypto.randomUUID(),
        topic: value,
        active: true,
      }))
      return [...base, ...newRows]
    })
  }

  async function handleGenerateKeywordPhrase() {
    if (!seoSourceTopic.trim() || !model) return
    try {
      const response = await generateKeywordPhrase.mutateAsync({
        topic: seoSourceTopic.trim(),
        targetAudience: targetAudience.trim(),
        additionalInfo: additionalInfo.trim(),
        model,
      })
      setKeywordPhrase(response.keywordPhrase)
    } catch (error) {
      toastApiError(error, t("generate.errors.keywordPhraseFailed"))
    }
  }

  async function handleGenerateMetaDescription() {
    if (!seoSourceTopic.trim() || !model) return
    try {
      const response = await generateMetaDescriptionMini.mutateAsync({
        topic: seoSourceTopic.trim(),
        targetAudience: targetAudience.trim(),
        additionalInfo: additionalInfo.trim(),
        model,
        ...(keywordPhrase.trim() ? { keywordPhrase: keywordPhrase.trim() } : {}),
      })
      setMetaDescription(response.metaDescription)
    } catch (error) {
      toastApiError(error, t("generate.errors.metaDescriptionFailed"))
    }
  }

  async function handleGenerateSingle() {
    if (!canSubmitSingle) return
    const selectedTemplate = templates.find((template) => template.id === templateId)
    try {
      const response = await generate.mutateAsync({
        // Etykieta kosmetyczna do momentu odpowiedzi serwera — route
        // NADPISUJE ją autorytatywnie na podstawie realnego templateId
        // (app/idp/app/api/content-guru/generate/route.ts), więc rozjazd
        // tutaj nie ma znaczenia.
        contentType: selectedTemplate
          ? `${selectedTemplate.category} — ${selectedTemplate.name}`
          : "",
        topic: topic.trim(),
        targetAudience: targetAudience.trim(),
        additionalInfo: additionalInfo.trim(),
        model,
        templateId,
        // Klucze POMIJANE (nie `undefined`) gdy brak wyboru —
        // exactOptionalPropertyTypes rozróżnia "nieobecny klucz" od "klucz z
        // wartością undefined", a DTO deklaruje tylko to pierwsze.
        ...(clientProfileId !== NO_PROFILE ? { clientProfileId } : {}),
        ...(marketProfileId !== NO_PROFILE ? { marketProfileId } : {}),
        // D8: panel SEO wysyłany tylko w trybie "Pojedyncza" (jedyny tryb,
        // którego /generate w ogóle przyjmuje te dwa pola — patrz komentarz
        // przy stanie keywordPhrase/metaDescription wyżej).
        ...(keywordPhrase.trim() ? { keywordPhrase: keywordPhrase.trim() } : {}),
        ...(metaDescription.trim() ? { metaDescription: metaDescription.trim() } : {}),
      })
      setResult(response)
      if (response.status === "done-with-warnings") {
        toast.warning(t("generate.toasts.doneWithWarnings"))
      } else {
        toast.success(t("generate.toasts.done"))
      }
    } catch (error) {
      toastApiError(error, t("generate.errors.generateFailed"))
    }
  }

  async function handleSubmitJob(mode: GenerationJobMode) {
    const templateIds = mode === "batch" ? [templateId] : packageTemplateIds
    if (mode === "batch" && !canSubmitBatch) return
    if (mode === "package" && !canSubmitPackage) return

    try {
      const response = await createJob.mutateAsync({
        mode,
        topics: activeTopics,
        templateIds,
        targetAudience: targetAudience.trim(),
        additionalInfo: additionalInfo.trim(),
        model,
        ...(clientProfileId !== NO_PROFILE ? { clientProfileId } : {}),
        ...(marketProfileId !== NO_PROFILE ? { marketProfileId } : {}),
      })
      setActiveJobId(response.jobId)
      setActiveJobMode(mode)
      toast.success(t("generate.toasts.jobStarted"))
    } catch (error) {
      toastApiError(error, t("generate.errors.jobStartFailed"))
    }
  }

  const showJobCard = activeJobId !== null && activeJobMode === activeTab

  return (
    <>
      <PageHeader title="Content Guru" description={t("generate.description")} />

      <div className="flex flex-1 flex-col gap-6 px-8 py-6">
        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as GenerationTab)}
          className="w-full"
        >
          <TabsList>
            <TabsTrigger value="single">{t("modes.single")}</TabsTrigger>
            <TabsTrigger value="batch">{t("modes.batch")}</TabsTrigger>
            <TabsTrigger value="package">{t("modes.package")}</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
          <Card>
            <CardContent className="flex flex-col gap-4 pt-6">
              {activeTab === "package" ? (
                <div className="flex flex-col gap-2">
                  <Label>
                    {t("generate.packageTemplatesLabel", { selected: packageTemplateIds.length })}
                  </Label>
                  {templatesQuery.isPending ? (
                    <Skeleton className="h-32 w-full" />
                  ) : (
                    <div className="flex max-h-48 flex-col gap-1 overflow-y-auto rounded-md border border-border p-2">
                      {templates.map((template) => (
                        <label
                          key={template.id}
                          className="flex items-center gap-2 rounded-sm px-1 py-1 text-sm hover:bg-muted/50"
                        >
                          <Checkbox
                            checked={packageTemplateIds.includes(template.id)}
                            onCheckedChange={() => togglePackageTemplate(template.id)}
                          />
                          <span className="truncate">
                            {template.category} — {template.name}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="content-guru-template-category">
                      {t("generate.templateCategoryLabel")}
                    </Label>
                    {templatesQuery.isPending ? (
                      <Skeleton className="h-9 w-full" />
                    ) : (
                      <Select value={templateCategory} onValueChange={setTemplateCategory}>
                        <SelectTrigger id="content-guru-template-category">
                          <SelectValue placeholder={t("generate.templateCategoryPlaceholder")} />
                        </SelectTrigger>
                        <SelectContent>
                          {templateCategories.map((category) => (
                            <SelectItem key={category} value={category}>
                              {category}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="content-guru-template">{t("generate.templateLabel")}</Label>
                    <Select
                      value={templateId}
                      onValueChange={setTemplateId}
                      disabled={!templateCategory}
                    >
                      <SelectTrigger id="content-guru-template">
                        <SelectValue placeholder={t("generate.templatePlaceholder")} />
                      </SelectTrigger>
                      <SelectContent>
                        {templatesInCategory.map((template) => (
                          <SelectItem key={template.id} value={template.id}>
                            {template.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
              {!templatesQuery.isPending && templates.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {t("generate.noTemplatesHint")}{" "}
                  <a href="/content-guru/templates" className="underline underline-offset-2">
                    {t("generate.noTemplatesLink")}
                  </a>
                  .
                </p>
              ) : null}

              {activeTab === "single" ? (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="content-guru-topic">{t("generate.topicLabel")}</Label>
                    <span className="text-xs text-muted-foreground">
                      {topic.length}/{TOPIC_MAX}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      id="content-guru-topic"
                      value={topic}
                      maxLength={TOPIC_MAX}
                      placeholder={t("generate.topicPlaceholder")}
                      onChange={(event) => setTopic(event.target.value)}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setTopicGeneratorOpen(true)}
                      title={t("topicGenerator.title")}
                    >
                      <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                      {t("topicGenerator.title")}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <Label>{t("generate.topicsLabel")}</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setTopicGeneratorOpen(true)}
                      title={t("topicGenerator.title")}
                    >
                      <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                      {t("topicGenerator.title")}
                    </Button>
                  </div>
                  <TopicTable rows={topicRows} onChange={setTopicRows} />
                  {activeTab === "package" ? (
                    <p
                      className={
                        packageOverLimit
                          ? "text-xs font-medium text-destructive"
                          : "text-xs text-muted-foreground"
                      }
                    >
                      {activeTopics.length}{" "}
                      {t(
                        activeTopics.length === 1
                          ? "generate.package.topicOne"
                          : "generate.package.topicMany",
                      )}{" "}
                      × {packageTemplateIds.length}{" "}
                      {t(
                        packageTemplateIds.length === 1
                          ? "generate.package.templateOne"
                          : "generate.package.templateMany",
                      )}{" "}
                      = {packageCombinations}{" "}
                      {t(
                        packageCombinations === 1
                          ? "generate.package.contentOne"
                          : "generate.package.contentMany",
                      )}
                      {packageOverLimit
                        ? ` — ${t("generate.package.overLimit", { max: MAX_COMBINATIONS })}`
                        : ""}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {activeTopics.length}{" "}
                      {t(
                        activeTopics.length === 1
                          ? "generate.batch.activeTopicsOne"
                          : "generate.batch.activeTopicsMany",
                      )}
                    </p>
                  )}
                </div>
              )}

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="content-guru-audience">{t("generate.audienceLabel")}</Label>
                  <span className="text-xs text-muted-foreground">
                    {targetAudience.length}/{AUDIENCE_MAX}
                  </span>
                </div>
                <Input
                  id="content-guru-audience"
                  value={targetAudience}
                  maxLength={AUDIENCE_MAX}
                  placeholder={t("generate.audiencePlaceholder")}
                  onChange={(event) => setTargetAudience(event.target.value)}
                />
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="content-guru-additional">
                    {t("generate.additionalInfoLabel")}
                  </Label>
                  <span className="text-xs text-muted-foreground">
                    {additionalInfo.length}/{ADDITIONAL_INFO_MAX}
                  </span>
                </div>
                <Textarea
                  id="content-guru-additional"
                  value={additionalInfo}
                  maxLength={ADDITIONAL_INFO_MAX}
                  rows={4}
                  placeholder={t("generate.additionalInfoPlaceholder")}
                  onChange={(event) => setAdditionalInfo(event.target.value)}
                />
              </div>

              <div className="flex flex-col gap-3 rounded-md border border-border p-3">
                <Label className="text-xs text-muted-foreground">
                  {t("generate.seo.sectionLabel")}{" "}
                  {activeTab !== "single" ? t("generate.seo.singleOnlyHint") : ""}
                </Label>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="content-guru-keyword">{t("generate.seo.keywordLabel")}</Label>
                  <div className="flex gap-2">
                    <Input
                      id="content-guru-keyword"
                      value={keywordPhrase}
                      maxLength={200}
                      placeholder={t("generate.seo.keywordPlaceholder")}
                      onChange={(event) => setKeywordPhrase(event.target.value)}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={handleGenerateKeywordPhrase}
                      disabled={!seoSourceTopic.trim() || !model || generateKeywordPhrase.isPending}
                      title={t("generate.seo.keywordGenerate")}
                      aria-label={t("generate.seo.keywordGenerate")}
                    >
                      <Sparkles className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="content-guru-meta">{t("generate.seo.metaLabel")}</Label>
                    <span
                      className={
                        metaDescription.length > META_DESCRIPTION_MAX_CHARS
                          ? "text-xs font-medium text-destructive"
                          : "text-xs text-muted-foreground"
                      }
                    >
                      {metaDescription.length}/{META_DESCRIPTION_MAX_CHARS}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Textarea
                      id="content-guru-meta"
                      value={metaDescription}
                      maxLength={META_DESCRIPTION_MAX_CHARS}
                      rows={2}
                      placeholder={t("generate.seo.metaPlaceholder")}
                      onChange={(event) => setMetaDescription(event.target.value)}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={handleGenerateMetaDescription}
                      disabled={
                        !seoSourceTopic.trim() || !model || generateMetaDescriptionMini.isPending
                      }
                      title={t("generate.seo.metaGenerate")}
                      aria-label={t("generate.seo.metaGenerate")}
                    >
                      <Sparkles className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="content-guru-model">{t("generate.modelLabel")}</Label>
                {configQuery.isPending ? (
                  <Skeleton className="h-9 w-full" />
                ) : (
                  <Select value={model} onValueChange={setModel}>
                    <SelectTrigger id="content-guru-model">
                      <SelectValue placeholder={t("generate.modelPlaceholder")} />
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

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="content-guru-client-profile">
                    {t("generate.clientProfileLabel")}
                  </Label>
                  <Select value={clientProfileId} onValueChange={setClientProfileId}>
                    <SelectTrigger id="content-guru-client-profile">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_PROFILE}>{t("generate.noProfileOption")}</SelectItem>
                      {clientProfiles.map((profile) => (
                        <SelectItem key={profile.id} value={profile.id}>
                          {profile.profileName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="content-guru-market-profile">
                    {t("generate.marketProfileLabel")}
                  </Label>
                  <Select value={marketProfileId} onValueChange={setMarketProfileId}>
                    <SelectTrigger id="content-guru-market-profile">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_PROFILE}>{t("generate.noProfileOption")}</SelectItem>
                      {marketProfiles.map((profile) => (
                        <SelectItem key={profile.id} value={profile.id}>
                          {profile.profileName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {activeTab === "single" ? (
                <Button type="button" onClick={handleGenerateSingle} disabled={!canSubmitSingle}>
                  <Sparkles className="mr-2 h-4 w-4" />
                  {generate.isPending
                    ? t("generate.generatingButton")
                    : t("generate.generateButton")}
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={() => handleSubmitJob(activeTab)}
                  disabled={activeTab === "batch" ? !canSubmitBatch : !canSubmitPackage}
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  {createJob.isPending
                    ? t("generate.startingButton")
                    : t("generate.generateButton")}
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-col gap-4 pt-6">
              {activeTab === "single" ? (
                generate.isPending ? (
                  <div className="flex flex-col gap-3">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-40 w-full" />
                  </div>
                ) : !result ? (
                  <EmptyState
                    icon={Sparkles}
                    title={t("generate.empty.title")}
                    description={t("generate.empty.description")}
                  />
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <ContentStatusBadge status={result.status} />
                      <span className="text-xs text-muted-foreground">{result.model}</span>
                    </div>

                    {result.status === "done-with-warnings" ? (
                      <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                        {t("warnings.forbiddenPhrases")}
                      </div>
                    ) : null}

                    <div className="whitespace-pre-wrap rounded-md border border-border bg-muted/30 p-4 text-sm leading-relaxed">
                      {renderHighlightedContent(result.content, result.matchedForbiddenPhrases)}
                    </div>

                    <p className="text-xs text-muted-foreground">{t("generate.savedToArchive")}</p>
                  </>
                )
              ) : showJobCard ? (
                <GenerationJobCard
                  job={jobQuery.data}
                  mode={activeTab}
                  isLoading={jobQuery.isLoading}
                />
              ) : (
                <EmptyState
                  icon={Sparkles}
                  title={t("generate.jobEmpty.title")}
                  description={
                    activeTab === "batch"
                      ? t("generate.jobEmpty.batchDescription")
                      : t("generate.jobEmpty.packageDescription")
                  }
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <TopicGeneratorDialog
        open={topicGeneratorOpen}
        onOpenChange={setTopicGeneratorOpen}
        model={model}
        allowMultiple={activeTab !== "single"}
        onInsert={handleInsertGeneratedTopics}
      />
    </>
  )
}
