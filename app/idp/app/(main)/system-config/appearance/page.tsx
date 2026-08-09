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

/**
 * „Instancja nie narzuca wyglądu" jako pozycja listy. NIE jest to preset i nie
 * może nim być: znaczy „decyduje użytkownik, a gdy i on nie wybrał —
 * `DEFAULT_PRESET`". Napis zamiast `null`, bo `RadioGroup` operuje na
 * wartościach `string`; mapowanie w obie strony jest tuż niżej i nigdzie
 * indziej.
 */
const NONE = "none"

const NONE_OPTION = {
  id: NONE,
  label: "Bez narzucania",
  description: "Każdy użytkownik zostaje przy swoim wyborze; nowi widzą wygląd domyślny.",
  swatch: ["#a3a3a3", "#a3a3a3", "#a3a3a3"] as readonly string[],
}

const OPTIONS = [
  NONE_OPTION,
  ...Object.values(PRESETS).map(({ id, label, description, swatch }) => ({
    id,
    label,
    description,
    swatch: swatch as readonly string[],
  })),
]

export default function SystemConfigAppearancePage() {
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
      onError: (error) => toastApiError(error, "Nie udało się zapisać wyglądu instancji"),
    })
  }

  return (
    <>
      <PageHeader
        title="Wygląd"
        description="Domyślny wygląd tej instancji. Użytkownik może go nadpisać własnym wyborem w nagłówku."
      />

      <div className="flex flex-1 flex-col gap-6 px-8 py-6">
        {appearanceQuery.isLoading ? (
          <LoadingState variant="skeleton" rows={4} />
        ) : appearanceQuery.isError ? (
          <ErrorState
            title="Nie udało się wczytać ustawienia"
            message="Spróbuj odświeżyć stronę. Jeśli problem się powtarza, skontaktuj się z administratorem."
          />
        ) : (
          <>
            {unknownStored ? (
              <Alert>
                <AlertTitle>Nieznany preset w bazie</AlertTitle>
                <AlertDescription>
                  Zapisana wartość „{saved}” nie odpowiada żadnemu presetowi w tej wersji aplikacji.
                  Instancja zachowuje się jak bez ustawienia. Zapisanie czegokolwiek poniżej ją
                  nadpisze.
                </AlertDescription>
              </Alert>
            ) : null}

            <RadioGroup value={selected} onValueChange={setChoice} className="max-w-2xl gap-3">
              {OPTIONS.map((option) => (
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
                Zapisz
              </Button>
              {canSave ? null : (
                <span className="text-xs text-muted-foreground">Brak zmian do zapisania.</span>
              )}
            </div>
          </>
        )}
      </div>
    </>
  )
}
