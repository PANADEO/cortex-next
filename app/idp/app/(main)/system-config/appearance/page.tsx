"use client"

import { useInstanceAppearance, useSetInstanceAppearance } from "@/features/system-config/hooks"
import { PRESETS, isPresetId } from "@/lib/presets/registry"
import { toastApiError } from "@cortex/api"
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  ErrorState,
  Label,
  LoadingState,
  PageHeader,
  RadioGroup,
  RadioGroupItem,
} from "@cortex/ui"
import { useState } from "react"
import { useTranslation } from "react-i18next"

/**
 * „Instancja nie narzuca wyglądu" jako pozycja listy. NIE jest to preset i nie
 * może nim być: znaczy „decyduje użytkownik, a gdy i on nie wybrał —
 * `DEFAULT_PRESET`". Napis zamiast `null`, bo `RadioGroup` operuje na
 * wartościach `string`; mapowanie w obie strony jest tuż niżej i nigdzie
 * indziej.
 */
const NONE = "none"

const NONE_SWATCH = ["#a3a3a3", "#a3a3a3", "#a3a3a3"] as readonly string[]

/** Etykiety presetów przychodzą z rejestru wyglądów i nie należą do tej
 *  przestrzeni; przetłumaczyć trzeba wyłącznie pozycję „bez narzucania”, stąd
 *  lista budowana w renderze, a nie na poziomie modułu (tam nie ma `t`). */
function useAppearanceOptions() {
  const { t } = useTranslation("system-config")
  const { t: tCommon } = useTranslation("common")
  return [
    {
      id: NONE,
      label: t("appearance.noneLabel"),
      description: t("appearance.noneDescription"),
      swatch: NONE_SWATCH,
    },
    ...Object.values(PRESETS).map(({ id, label, descriptionKey, swatch }) => ({
      id,
      label,
      description: tCommon(descriptionKey),
      swatch: swatch as readonly string[],
    })),
  ]
}

export default function SystemConfigAppearancePage() {
  const { t } = useTranslation(["system-config", "common"])
  const options = useAppearanceOptions()
  const appearanceQuery = useInstanceAppearance()
  const setAppearance = useSetInstanceAppearance()
  // `null` dopóki nie znamy zapisanej wartości — inaczej pierwszy render
  // ustawiłby zaznaczenie na „Bez narzucania" i wyglądałby jak odpowiedź.
  const [choice, setChoice] = useState<string | null>(null)

  const saved = appearanceQuery.data?.preset ?? null
  const savedChoice = isPresetId(saved) ? saved : NONE
  const selected = choice ?? savedChoice
  // Wartość w bazie spoza rejestru: preset skasowany z kodu albo ręczna edycja.
  // Aplikacja traktuje ją jak brak ustawienia (resolvePresetId), więc panel
  // pokazuje „Bez narzucania" — ale mówi, dlaczego, zamiast cicho kłamać.
  const unknownStored = saved !== null && !isPresetId(saved)
  // „Bez zmian" liczone z ZAPISANEJ WARTOŚCI, nie z zaznaczenia — a przy
  // nieznanej wartości te dwie rzeczy się rozjeżdżają. `savedChoice` zapada się
  // wtedy do „Bez narzucania", więc predykat `selected === savedChoice`
  // blokował zapis dokładnie w stanie, w którym komunikat obok obiecuje, że
  // zapis wartość nadpisze: admin musiałby najpierw zapisać jakiś preset, a
  // dopiero potem go wyczyścić. Nieznana wartość zawsze jest więc zapisywalna.
  const canSave = unknownStored || selected !== savedChoice

  function save() {
    setAppearance.mutate(selected === NONE ? null : selected, {
      onSuccess: () => {
        // Bez `toast.success` — przeładowanie niżej kasuje go, zanim zdąży się
        // pokazać. Potwierdzeniem jest sam skutek: strona wraca z nowym
        // wyglądem i nowym zaznaczeniem.
        //
        // Twarde przeładowanie, nie `router.refresh()`. Klasa skinu i
        // `data-preset` powstają w layoucie KORZENIA dokumentu, po stronie
        // serwera; odświeżenie drzewa RSC nie przepisuje atrybutów `<html>`,
        // więc administrator zapisałby zmianę i nie zobaczył jej u siebie.
        window.location.reload()
      },
      onError: (error) => toastApiError(error, t("appearance.saveFailed")),
    })
  }

  return (
    <>
      <PageHeader title={t("appearance.title")} description={t("appearance.description")} />

      <div className="flex flex-1 flex-col gap-6 px-8 py-6">
        {appearanceQuery.isLoading ? (
          <LoadingState variant="skeleton" rows={4} />
        ) : appearanceQuery.isError ? (
          <ErrorState
            title={t("appearance.loadFailedTitle")}
            message={t("appearance.loadFailedBody")}
          />
        ) : (
          <>
            {unknownStored ? (
              <Alert>
                <AlertTitle>{t("appearance.unknownPresetTitle")}</AlertTitle>
                <AlertDescription>
                  {t("appearance.unknownPresetBody", { value: saved })}
                </AlertDescription>
              </Alert>
            ) : null}

            <RadioGroup value={selected} onValueChange={setChoice} className="max-w-2xl gap-3">
              {options.map((option) => (
                <Label
                  key={option.id}
                  htmlFor={`preset-${option.id}`}
                  className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-4 font-normal"
                >
                  <RadioGroupItem value={option.id} id={`preset-${option.id}`} className="mt-0.5" />
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="text-sm font-medium">{option.label}</span>
                    <span className="text-xs text-muted-foreground">{option.description}</span>
                  </span>
                  <span aria-hidden className="ml-auto flex shrink-0 gap-1">
                    {option.swatch.map((color, index) => (
                      <span
                        key={`${option.id}-${index}`}
                        className="h-4 w-4 rounded-sm border border-border"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </span>
                </Label>
              ))}
            </RadioGroup>

            <div className="flex items-center gap-3">
              <Button onClick={save} disabled={setAppearance.isPending || !canSave}>
                {t("common:actions.save")}
              </Button>
              {canSave ? null : (
                <span className="text-xs text-muted-foreground">{t("appearance.noChanges")}</span>
              )}
            </div>
          </>
        )}
      </div>
    </>
  )
}
