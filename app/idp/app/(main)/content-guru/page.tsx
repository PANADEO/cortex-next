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
      toastApiError(error, "Nie udało się wygenerować frazy kluczowej")
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
      toastApiError(error, "Nie udało się wygenerować meta description")
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
        toast.warning("Treść wygenerowana — zawiera zakazane frazy, sprawdź podświetlenia")
      } else {
        toast.success("Treść wygenerowana i zapisana w archiwum")
      }
    } catch (error) {
      toastApiError(error, "Nie udało się wygenerować treści")
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
      toast.success("Generowanie uruchomione — postęp pojawi się poniżej.")
    } catch (error) {
      toastApiError(error, "Nie udało się uruchomić generowania")
    }
  }

  const showJobCard = activeJobId !== null && activeJobMode === activeTab

  return (
    <>
      <PageHeader
        title="Content Guru"
        description="Generowanie roboczych treści marketingowych, produktowych i rekrutacyjnych — z realną walidacją zakazanych fraz."
      />

      <div className="flex flex-1 flex-col gap-6 px-8 py-6">
        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as GenerationTab)}
          className="w-full"
        >
          <TabsList>
            <TabsTrigger value="single">Pojedyncza</TabsTrigger>
            <TabsTrigger value="batch">Kilka</TabsTrigger>
            <TabsTrigger value="package">Pakiet</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
          <Card>
            <CardContent className="flex flex-col gap-4 pt-6">
              {activeTab === "package" ? (
                <div className="flex flex-col gap-2">
                  <Label>Szablony ({packageTemplateIds.length} wybrane)</Label>
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
                    <Label htmlFor="content-guru-template-category">Kategoria szablonu</Label>
                    {templatesQuery.isPending ? (
                      <Skeleton className="h-9 w-full" />
                    ) : (
                      <Select value={templateCategory} onValueChange={setTemplateCategory}>
                        <SelectTrigger id="content-guru-template-category">
                          <SelectValue placeholder="Wybierz kategorię" />
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
                    <Label htmlFor="content-guru-template">Szablon</Label>
                    <Select
                      value={templateId}
                      onValueChange={setTemplateId}
                      disabled={!templateCategory}
                    >
                      <SelectTrigger id="content-guru-template">
                        <SelectValue placeholder="Wybierz szablon" />
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
                  Brak szablonów — dodaj pierwszy na ekranie{" "}
                  <a href="/content-guru/templates" className="underline underline-offset-2">
                    Szablony
                  </a>
                  .
                </p>
              ) : null}

              {activeTab === "single" ? (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="content-guru-topic">Temat</Label>
                    <span className="text-xs text-muted-foreground">
                      {topic.length}/{TOPIC_MAX}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      id="content-guru-topic"
                      value={topic}
                      maxLength={TOPIC_MAX}
                      placeholder="Np. otwieramy rekrutację na stanowisko Senior .NET Developer"
                      onChange={(event) => setTopic(event.target.value)}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setTopicGeneratorOpen(true)}
                      title="Generator tematów"
                    >
                      <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                      Generator tematów
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <Label>Tematy</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setTopicGeneratorOpen(true)}
                      title="Generator tematów"
                    >
                      <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                      Generator tematów
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
                      {activeTopics.length} {activeTopics.length === 1 ? "temat" : "tematy"} ×{" "}
                      {packageTemplateIds.length}{" "}
                      {packageTemplateIds.length === 1 ? "szablon" : "szablony"} ={" "}
                      {packageCombinations} {packageCombinations === 1 ? "treść" : "treści"}
                      {packageOverLimit
                        ? ` — przekroczono limit ${MAX_COMBINATIONS} kombinacji. Zmniejsz liczbę tematów lub szablonów.`
                        : ""}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {activeTopics.length}{" "}
                      {activeTopics.length === 1 ? "aktywny temat" : "aktywnych tematów"}
                    </p>
                  )}
                </div>
              )}

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

              <div className="flex flex-col gap-3 rounded-md border border-border p-3">
                <Label className="text-xs text-muted-foreground">
                  SEO i metadane {activeTab !== "single" ? "(używane w trybie Pojedyncza)" : ""}
                </Label>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="content-guru-keyword">Fraza kluczowa SEO</Label>
                  <div className="flex gap-2">
                    <Input
                      id="content-guru-keyword"
                      value={keywordPhrase}
                      maxLength={200}
                      placeholder="Np. automatyzacja procesów finansowych"
                      onChange={(event) => setKeywordPhrase(event.target.value)}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={handleGenerateKeywordPhrase}
                      disabled={!seoSourceTopic.trim() || !model || generateKeywordPhrase.isPending}
                      title="Generuj frazę kluczową"
                      aria-label="Generuj frazę kluczową"
                    >
                      <Sparkles className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="content-guru-meta">Meta description</Label>
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
                      placeholder="Krótki opis zachęcający do kliknięcia"
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
                      title="Generuj meta description"
                      aria-label="Generuj meta description"
                    >
                      <Sparkles className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
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

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="content-guru-client-profile">Profil klienta (opcjonalnie)</Label>
                  <Select value={clientProfileId} onValueChange={setClientProfileId}>
                    <SelectTrigger id="content-guru-client-profile">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_PROFILE}>Brak profilu</SelectItem>
                      {clientProfiles.map((profile) => (
                        <SelectItem key={profile.id} value={profile.id}>
                          {profile.profileName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="content-guru-market-profile">Profil rynku (opcjonalnie)</Label>
                  <Select value={marketProfileId} onValueChange={setMarketProfileId}>
                    <SelectTrigger id="content-guru-market-profile">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_PROFILE}>Brak profilu</SelectItem>
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
                  {generate.isPending ? "Generowanie..." : "Generuj"}
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={() => handleSubmitJob(activeTab)}
                  disabled={activeTab === "batch" ? !canSubmitBatch : !canSubmitPackage}
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  {createJob.isPending ? "Uruchamianie..." : "Generuj"}
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
                    title="Brak wygenerowanej treści"
                    description="Wybierz szablon i wypełnij temat, następnie kliknij Generuj."
                  />
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <ContentStatusBadge status={result.status} />
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
                  title="Brak uruchomionego zadania"
                  description={
                    activeTab === "batch"
                      ? "Wybierz szablon, dodaj tematy i kliknij Generuj."
                      : "Wybierz szablony, dodaj tematy i kliknij Generuj."
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
