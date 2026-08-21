"use client"

// Formularz Ustawień (design doc §4.4). Kluczowe elementy specyfikacji:
// - 4 suwaki wag z ŻYWYM paskiem sumy (kolor zielony=100%, czerwony≠100%,
//   aktualizowany na KAŻDĄ zmianę przez `form.watch()`, nie dopiero przy
//   Zapisz) — `.superRefine()` (config-schema.ts) i tak blokuje submit na
//   niewłaściwej sumie, ale przycisk Zapisz jest DODATKOWO disabled od razu,
//   żeby użytkownik nie musiał w ogóle klikać, żeby dowiedzieć się, że suma
//   jest zła.
// - Benchmarki/progi ocen: proste pola liczbowe.
// - Listy słów (czasowniki akcji, słowa subiektywne): `ChipInput` z
//   @cortex/ui — nowy, generyczny prymityw (patrz jego własny plik), nie
//   coś specyficznego dla tego kafelka.
// - Wzorce bulletów I wyjątki false-positive: sekcja `Collapsible`,
//   zwinięta domyślnie — power-user config, z dala od głównego widoku.
// - "Przywróć domyślne": `AlertDialog` — to WSPÓLNA, instancyjna
//   konfiguracja (RBAC D5 §7 pkt 3: jeden poziom dostępu, bez osobnego
//   scope'u), więc przypadkowy reset dotyka wszystkich userów, nie tylko
//   klikającego admina.

import { toastApiError } from "@cortex/api"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ChipInput,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Input,
  Label,
  Slider,
} from "@cortex/ui"
import { cn, formatAbsolute } from "@cortex/utils"
import { zodResolver } from "@hookform/resolvers/zod"
import { ChevronDown, RotateCcw, Save } from "lucide-react"
import { useState } from "react"
import { Controller, useForm, type UseFormReturn } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import {
  configDtoToFormValues,
  formValuesToUpdateRequest,
  geoScoreSettingsSchema,
  type GeoScoreSettingsFormValues,
} from "../config-schema"
import { useResetGeoScoreConfig, useUpdateGeoScoreConfig } from "../hooks"
import type { GeoScoreConfigDto } from "../types"

// Te same cztery napisy opisują wymiary na ekranie wyniku (result-view.tsx),
// więc mieszkają pod wspólnym `dimensions.*`, a nie osobno pod `settings.*`.
const WEIGHT_FIELDS = [
  { key: "weightStatistics", labelKey: "dimensions.statistics" },
  { key: "weightActionVerbs", labelKey: "dimensions.actionVerbs" },
  { key: "weightStructure", labelKey: "dimensions.structure" },
  { key: "weightObjectivity", labelKey: "dimensions.objectivity" },
] as const satisfies ReadonlyArray<{ key: keyof GeoScoreSettingsFormValues; labelKey: string }>

export function GeoScoreSettingsForm({ config }: { config: GeoScoreConfigDto }) {
  const { t } = useTranslation(["geo-score-calculator", "common"])
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const updateConfig = useUpdateGeoScoreConfig()
  const resetConfig = useResetGeoScoreConfig()

  const form = useForm<GeoScoreSettingsFormValues>({
    resolver: zodResolver(geoScoreSettingsSchema),
    defaultValues: configDtoToFormValues(config),
  })

  const watchedWeights = form.watch([
    "weightStatistics",
    "weightActionVerbs",
    "weightStructure",
    "weightObjectivity",
  ])
  const weightSum = watchedWeights.reduce((sum, value) => sum + (value || 0), 0)
  const sumOk = weightSum === 100

  async function handleSave(values: GeoScoreSettingsFormValues) {
    try {
      const saved = await updateConfig.mutateAsync(formValuesToUpdateRequest(values))
      form.reset(configDtoToFormValues(saved))
      toast.success(t("settings.saved"))
    } catch (error) {
      toastApiError(error, t("settings.errors.saveFailed"))
    }
  }

  async function handleReset() {
    try {
      const reset = await resetConfig.mutateAsync()
      form.reset(configDtoToFormValues(reset))
      toast.success(t("settings.resetDone"))
    } catch (error) {
      toastApiError(error, t("settings.errors.resetFailed"))
    }
  }

  return (
    <form onSubmit={form.handleSubmit(handleSave)} className="flex flex-col gap-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="text-base">{t("settings.weightsTitle")}</CardTitle>
            <CardDescription>{t("settings.weightsDescription")}</CardDescription>
          </div>
          <Badge
            variant="outline"
            className={cn(
              "shrink-0 text-sm tabular-nums",
              sumOk
                ? "border-success/40 bg-success/10 text-success"
                : "border-destructive/40 bg-destructive/10 text-destructive",
            )}
          >
            {t("settings.weightSum", { sum: weightSum })}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-5">
          {WEIGHT_FIELDS.map(({ key, labelKey }) => (
            <div key={key} className="space-y-1.5">
              <div className="flex items-baseline justify-between text-sm">
                <Label htmlFor={`geo-score-${key}`}>{t(labelKey)}</Label>
                <span className="tabular-nums text-muted-foreground">{form.watch(key)}%</span>
              </div>
              <Controller
                control={form.control}
                name={key}
                render={({ field }) => (
                  <Slider
                    id={`geo-score-${key}`}
                    min={0}
                    max={100}
                    step={1}
                    value={[field.value]}
                    onValueChange={([next]) => field.onChange(next)}
                  />
                )}
              />
            </div>
          ))}
          {form.formState.errors.weightStatistics ? (
            <p className="text-xs text-destructive">
              {form.formState.errors.weightStatistics.message}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("settings.benchmarksTitle")}</CardTitle>
          <CardDescription>{t("settings.benchmarksDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <NumberField
            form={form}
            name="benchmarkStats"
            label={t("settings.fields.benchmarkStats")}
            step={0.1}
          />
          <NumberField
            form={form}
            name="benchmarkVerbs"
            label={t("settings.fields.benchmarkVerbs")}
            step={0.01}
          />
          <NumberField
            form={form}
            name="benchmarkStructure"
            label={t("settings.fields.benchmarkStructure")}
            step={0.1}
          />
          <NumberField
            form={form}
            name="benchmarkObjectivity"
            label={t("settings.fields.benchmarkObjectivity")}
            step={0.01}
          />
          <NumberField
            form={form}
            name="gradeAMin"
            label={t("settings.fields.gradeAMin")}
            step={1}
          />
          <NumberField
            form={form}
            name="gradeBMin"
            label={t("settings.fields.gradeBMin")}
            step={1}
          />
          <NumberField
            form={form}
            name="gradeCMin"
            label={t("settings.fields.gradeCMin")}
            step={1}
          />
          <NumberField
            form={form}
            name="gradeDMin"
            label={t("settings.fields.gradeDMin")}
            step={1}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("settings.wordListsTitle")}</CardTitle>
          <CardDescription>{t("settings.wordListsDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label id="geo-score-action-verbs-label">{t("settings.actionVerbsLabel")}</Label>
            <Controller
              control={form.control}
              name="actionVerbs"
              render={({ field }) => (
                <ChipInput
                  value={field.value}
                  onChange={field.onChange}
                  aria-labelledby="geo-score-action-verbs-label"
                  placeholder={t("settings.actionVerbsPlaceholder")}
                />
              )}
            />
            {form.formState.errors.actionVerbs ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.actionVerbs.message as string}
              </p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label id="geo-score-subjective-words-label">
              {t("settings.subjectiveWordsLabel")}
            </Label>
            <Controller
              control={form.control}
              name="subjectiveWords"
              render={({ field }) => (
                <ChipInput
                  value={field.value}
                  onChange={field.onChange}
                  aria-labelledby="geo-score-subjective-words-label"
                  placeholder={t("settings.subjectiveWordsPlaceholder")}
                />
              )}
            />
            {form.formState.errors.subjectiveWords ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.subjectiveWords.message as string}
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen} asChild>
        <Card>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center justify-between p-6 text-left"
            >
              <div>
                <p className="text-base font-semibold leading-none tracking-tight">
                  {t("settings.advancedTitle")}
                </p>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  {t("settings.advancedDescription")}
                </p>
              </div>
              <ChevronDown
                className={cn(
                  "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                  advancedOpen && "rotate-180",
                )}
              />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="grid gap-6 border-t border-border pt-6 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label id="geo-score-bullet-patterns-label">
                  {t("settings.bulletPatternsLabel")}
                </Label>
                <Controller
                  control={form.control}
                  name="bulletPatterns"
                  render={({ field }) => (
                    <ChipInput
                      value={field.value}
                      onChange={field.onChange}
                      aria-labelledby="geo-score-bullet-patterns-label"
                      placeholder={t("settings.bulletPatternsPlaceholder")}
                    />
                  )}
                />
                {form.formState.errors.bulletPatterns ? (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.bulletPatterns.message as string}
                  </p>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <Label id="geo-score-false-positives-label">
                  {t("settings.falsePositivesLabel")}
                </Label>
                <Controller
                  control={form.control}
                  name="falsePositives"
                  render={({ field }) => (
                    <ChipInput
                      value={field.value}
                      onChange={field.onChange}
                      aria-labelledby="geo-score-false-positives-label"
                      placeholder={t("settings.falsePositivesPlaceholder")}
                    />
                  )}
                />
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {t("settings.lastChange", {
            date: formatAbsolute(config.updatedAt),
            user: config.updatedBy,
          })}
        </p>
        <div className="flex gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="outline" disabled={resetConfig.isPending}>
                <RotateCcw className="mr-2 h-4 w-4" />
                {t("settings.restoreDefaults")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("settings.resetConfirmTitle")}</AlertDialogTitle>
                <AlertDialogDescription>{t("settings.resetConfirmBody")}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("common:actions.cancel")}</AlertDialogCancel>
                <AlertDialogAction onClick={handleReset}>
                  {t("settings.restoreDefaults")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button type="submit" disabled={!sumOk || updateConfig.isPending}>
            <Save className="mr-2 h-4 w-4" />
            {updateConfig.isPending ? t("settings.saving") : t("common:actions.save")}
          </Button>
        </div>
      </div>
    </form>
  )
}

function NumberField({
  form,
  name,
  label,
  step,
}: {
  form: UseFormReturn<GeoScoreSettingsFormValues>
  name:
    | "benchmarkStats"
    | "benchmarkVerbs"
    | "benchmarkStructure"
    | "benchmarkObjectivity"
    | "gradeAMin"
    | "gradeBMin"
    | "gradeCMin"
    | "gradeDMin"
  label: string
  step: number
}) {
  const error = form.formState.errors[name]
  return (
    <div className="space-y-1.5">
      <Label htmlFor={`geo-score-${name}`}>{label}</Label>
      <Input
        id={`geo-score-${name}`}
        type="number"
        step={step}
        {...form.register(name, { valueAsNumber: true })}
      />
      {error ? <p className="text-xs text-destructive">{error.message}</p> : null}
    </div>
  )
}
