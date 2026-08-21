"use client"

// Siatka wyników generacji — NOWY komponent, nie import z features/ilustromat
// (design doc sekcja 1.2: strona/hooki Ilustromatu ciasno sprzężone z
// brandingiem/presetami, nie nadają się do reużycia). Klik = podgląd
// powiększony (Dialog), pobierz pojedynczo / wszystkie jako ZIP.

import { Button, Dialog, DialogContent, DialogHeader, DialogTitle } from "@cortex/ui"
import { Download, FolderDown } from "lucide-react"
import { useState } from "react"
import type { GeneratedVariantDto } from "./types"
import { dataUrlToBytes, downloadZip, extensionFromDataUrl } from "./zip"

interface VariantGridProps {
  variants: GeneratedVariantDto[]
  /** Prefiks nazw plików przy pobieraniu — np. id generacji, żeby pliki z
   *  kolejnych generacji się nie nadpisywały na dysku usera. */
  fileNamePrefix: string
}

function downloadDataUrl(dataUrl: string, fileName: string): void {
  const link = document.createElement("a")
  link.href = dataUrl
  link.download = fileName
  link.click()
}

export function VariantGrid({ variants, fileNamePrefix }: VariantGridProps) {
  const [previewIndex, setPreviewIndex] = useState<number | null>(null)
  const previewVariant = variants.find((variant) => variant.variantIndex === previewIndex)

  function handleDownloadAll() {
    downloadZip(
      `${fileNamePrefix}.zip`,
      variants.map((variant) => ({
        name: `${fileNamePrefix}-wariant-${variant.variantIndex + 1}.${extensionFromDataUrl(variant.dataUrl)}`,
        data: dataUrlToBytes(variant.dataUrl),
      })),
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {variants.map((variant) => (
          <button
            key={variant.variantIndex}
            type="button"
            onClick={() => setPreviewIndex(variant.variantIndex)}
            className="overflow-hidden rounded-md ring-1 ring-border transition hover:ring-primary/50"
            aria-label={`Podgląd wariantu ${variant.variantIndex + 1}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={variant.dataUrl}
              alt={`Wariant ${variant.variantIndex + 1}`}
              className="h-auto w-full"
            />
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {variants.map((variant) => (
          <Button
            key={variant.variantIndex}
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              downloadDataUrl(
                variant.dataUrl,
                `${fileNamePrefix}-wariant-${variant.variantIndex + 1}.${extensionFromDataUrl(variant.dataUrl)}`,
              )
            }
          >
            <Download className="mr-2 h-4 w-4" />
            Wariant {variant.variantIndex + 1}
          </Button>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={handleDownloadAll}>
          <FolderDown className="mr-2 h-4 w-4" />
          Pobierz wszystkie (ZIP)
        </Button>
      </div>

      <Dialog open={previewIndex !== null} onOpenChange={(open) => !open && setPreviewIndex(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {previewVariant ? `Wariant ${previewVariant.variantIndex + 1}` : "Podgląd"}
            </DialogTitle>
          </DialogHeader>
          {previewVariant ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewVariant.dataUrl}
              alt={`Wariant ${previewVariant.variantIndex + 1}`}
              className="h-auto w-full rounded-md"
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
