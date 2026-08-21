"use client"

// Generator Visual Guru — design doc sekcja 6.1. NIE jest portem UI
// Streamlita: prompt swobodny (bez pól tytuł/podtytuł jak w Ilustromacie),
// bez kroku "N opisów kandydatów" legacy (D3). Każde "Generuj" auto-loguje
// się do archiwum — brak osobnego przycisku "zapisz" (wzorem GEO Score).

import {
  DEFAULT_FIDELITY,
  DEFAULT_VARIANT_COUNT,
  FIDELITY_OPTIONS,
  MAX_REFERENCE_IMAGES,
  VARIANT_COUNTS,
} from "@/features/visual-guru/constants"
import { readFilesAsDataUrls } from "@/features/visual-guru/files"
import { useGenerate } from "@/features/visual-guru/hooks"
import type { FidelityKey, GenerateResponseDto } from "@/features/visual-guru/types"
import { useObjectUrls } from "@/features/visual-guru/use-object-url"
import { VariantGrid } from "@/features/visual-guru/variant-grid"
import { toastApiError } from "@cortex/api"
import {
  Button,
  Card,
  CardContent,
  EmptyState,
  FileUploader,
  Label,
  PageHeader,
  RadioGroup,
  RadioGroupItem,
  Skeleton,
  Textarea,
} from "@cortex/ui"
import { Image as ImageIcon, Sparkles } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

export default function VisualGuruGenerationPage() {
  const generate = useGenerate()

  const [prompt, setPrompt] = useState("")
  const [additionalContext, setAdditionalContext] = useState("")
  const [referenceFiles, setReferenceFiles] = useState<File[]>([])
  const [fidelity, setFidelity] = useState<FidelityKey>(DEFAULT_FIDELITY)
  const [variantCount, setVariantCount] =
    useState<(typeof VARIANT_COUNTS)[number]>(DEFAULT_VARIANT_COUNT)
  const [result, setResult] = useState<GenerateResponseDto | null>(null)

  const hasReferenceImages = referenceFiles.length > 0
  // FileUploader nie renderuje podglądu obrazu, tylko generyczną ikonę pliku
  // — te miniatury dokładają brakujący podgląd (features/visual-guru/use-object-url.ts).
  const thumbnails = useObjectUrls(referenceFiles)

  function handleReferenceFilesChange(files: File[]) {
    if (files.length > MAX_REFERENCE_IMAGES) {
      toast.error(`Maksymalnie ${MAX_REFERENCE_IMAGES} obrazy referencyjne`)
      setReferenceFiles(files.slice(0, MAX_REFERENCE_IMAGES))
      return
    }
    setReferenceFiles(files)
  }

  async function handleGenerate() {
    if (!prompt.trim()) {
      toast.error("Opis obrazu jest wymagany")
      return
    }

    try {
      const referenceImages = await readFilesAsDataUrls(referenceFiles)
      const response = await generate.mutateAsync({
        prompt,
        additionalContext: additionalContext.trim() || undefined,
        referenceImages,
        fidelity: hasReferenceImages ? fidelity : undefined,
        variantCount,
      })
      setResult(response)
    } catch (error) {
      toastApiError(error, "Nie udało się wygenerować obrazów")
    }
  }

  return (
    <>
      <PageHeader
        title="Visual Guru"
        description="Generator obrazów AI — swobodny prompt, opcjonalny obraz referencyjny. Surowy wynik modelu, bez brandingu."
      />

      <div className="flex flex-1 flex-col gap-6 px-8 py-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
          <Card>
            <CardContent className="flex flex-col gap-4 pt-6">
              <div className="flex flex-col gap-2">
                <Label htmlFor="visual-guru-prompt">Opis obrazu</Label>
                <Textarea
                  id="visual-guru-prompt"
                  rows={5}
                  value={prompt}
                  placeholder="Np. minimalistyczna ilustracja lisa na tle gór, płaski styl wektorowy"
                  onChange={(event) => setPrompt(event.target.value)}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="visual-guru-context">Dodatkowy kontekst (opcjonalnie)</Label>
                <Textarea
                  id="visual-guru-context"
                  rows={3}
                  value={additionalContext}
                  placeholder="Styl, paleta kolorów, ograniczenia kompozycji..."
                  onChange={(event) => setAdditionalContext(event.target.value)}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label>Obrazy referencyjne (opcjonalnie, maks. {MAX_REFERENCE_IMAGES})</Label>
                <FileUploader
                  value={referenceFiles}
                  onChange={handleReferenceFilesChange}
                  accept="image/png,image/jpeg,image/webp"
                  multiple
                  description="PNG, JPEG lub WebP"
                />
                {thumbnails.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {thumbnails.map((url, index) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={url}
                        src={url}
                        alt={`Podgląd obrazu referencyjnego ${index + 1}`}
                        className="h-16 w-16 rounded-md object-cover ring-1 ring-border"
                      />
                    ))}
                  </div>
                ) : null}
              </div>

              {hasReferenceImages ? (
                <div className="flex flex-col gap-2">
                  <Label>Wierność względem obrazu referencyjnego</Label>
                  <RadioGroup
                    className="flex gap-4"
                    value={fidelity}
                    onValueChange={(value) => setFidelity(value as FidelityKey)}
                  >
                    {FIDELITY_OPTIONS.map((option) => (
                      <div key={option.key} className="flex items-center gap-2">
                        <RadioGroupItem
                          id={`visual-guru-fidelity-${option.key}`}
                          value={option.key}
                        />
                        <Label
                          htmlFor={`visual-guru-fidelity-${option.key}`}
                          className="font-normal"
                          title={option.description}
                        >
                          {option.label}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                  <p className="text-xs text-muted-foreground">
                    Wierność steruje TREŚCIĄ promptu wysyłanego do modelu, nie osobnym parametrem
                    API.
                  </p>
                </div>
              ) : null}

              <div className="flex flex-col gap-2">
                <Label>Liczba wariantów</Label>
                <RadioGroup
                  className="flex gap-4"
                  value={String(variantCount)}
                  onValueChange={(value) =>
                    setVariantCount(Number(value) as (typeof VARIANT_COUNTS)[number])
                  }
                >
                  {VARIANT_COUNTS.map((count) => (
                    <div key={count} className="flex items-center gap-2">
                      <RadioGroupItem id={`visual-guru-variants-${count}`} value={String(count)} />
                      <Label htmlFor={`visual-guru-variants-${count}`} className="font-normal">
                        {count}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              <Button type="button" onClick={handleGenerate} disabled={generate.isPending}>
                <Sparkles className="mr-2 h-4 w-4" />
                {generate.isPending ? "Generowanie..." : "Generuj"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-col gap-4 pt-6">
              {generate.isPending ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {Array.from({ length: variantCount }, (_, index) => (
                    <Skeleton key={index} className="aspect-square w-full" />
                  ))}
                </div>
              ) : !result ? (
                <EmptyState
                  icon={ImageIcon}
                  title="Brak wygenerowanych obrazów"
                  description="Wpisz opis i kliknij Generuj. Każda generacja trafia automatycznie do archiwum."
                />
              ) : (
                <VariantGrid
                  variants={result.variants}
                  fileNamePrefix={`visual-guru-${result.id}`}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
