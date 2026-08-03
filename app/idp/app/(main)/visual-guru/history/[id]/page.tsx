"use client"

// Szczegóły generacji Visual Guru — design doc §6.3. Pełny prompt + kontekst,
// ślad obrazu referencyjnego (WYŁĄCZNIE nazwa pliku, jeśli był użyty — D5:
// same bajty nigdy nie trafiają do Postgresa, więc nie ma ich skąd pokazać),
// wszystkie warianty w tym samym VariantGrid co ekran generatora (§6.1),
// usuń z potwierdzeniem AlertDialog (nieodwracalne, mimo że rekord "mój").

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
  Button,
  Card,
  CardContent,
  EmptyState,
  Label,
  LoadingState,
  PageHeader,
} from "@cortex/ui"
import { formatAbsolute } from "@cortex/utils"
import { ChevronLeft, ImageOff, Trash2 } from "lucide-react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { useDeleteGeneration, useGenerationDetail } from "@/features/visual-guru/hooks"
import { VariantGrid } from "@/features/visual-guru/variant-grid"

export default function VisualGuruHistoryDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const id = params.id ?? null
  const detailQuery = useGenerationDetail(id)
  const deleteGeneration = useDeleteGeneration()
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)

  const generation = detailQuery.data

  async function handleDelete() {
    if (!id) return
    try {
      await deleteGeneration.mutateAsync(id)
      toast.success("Usunięto generację")
      router.push("/visual-guru/history")
    } catch (error) {
      toastApiError(error, "Nie udało się usunąć generacji")
    } finally {
      setIsDeleteOpen(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Szczegóły generacji"
        description="Pełny prompt, kontekst i wszystkie warianty tej generacji."
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" asChild>
              <Link href="/visual-guru/history">
                <ChevronLeft className="mr-1.5 h-3.5 w-3.5" />
                Archiwum
              </Link>
            </Button>
            {generation ? (
              <Button size="sm" variant="outline" onClick={() => setIsDeleteOpen(true)}>
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Usuń
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="flex flex-1 flex-col gap-6 px-8 py-6">
        {detailQuery.isLoading ? (
          <LoadingState label="Wczytywanie generacji…" />
        ) : detailQuery.isError || !generation ? (
          <EmptyState
            icon={ImageOff}
            title="Nie znaleziono generacji"
            description="Generacja nie istnieje albo nie masz do niej dostępu."
          />
        ) : (
          <>
            <Card>
              <CardContent className="flex flex-col gap-4 pt-6">
                <div className="flex flex-col gap-1">
                  <Label>Prompt</Label>
                  <p className="whitespace-pre-wrap text-sm">{generation.prompt}</p>
                </div>

                {generation.additionalContext ? (
                  <div className="flex flex-col gap-1">
                    <Label>Dodatkowy kontekst</Label>
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                      {generation.additionalContext}
                    </p>
                  </div>
                ) : null}

                <div className="flex flex-col gap-1">
                  <Label>Obraz referencyjny</Label>
                  {generation.hadReferenceImage ? (
                    <p className="text-sm text-muted-foreground">
                      Ta generacja użyła obrazu referencyjnego
                      {generation.referenceImageFileName ? (
                        <>
                          {": "}
                          <span className="font-medium text-foreground">
                            {generation.referenceImageFileName}
                          </span>
                        </>
                      ) : null}
                      . Sam plik nie jest przechowywany — trafił wyłącznie do żądania wysłanego do
                      modelu.
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">Brak — generacja z samego promptu.</p>
                  )}
                </div>

                <dl className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-3">
                  <div>
                    <dt className="font-medium text-foreground">Model</dt>
                    <dd>{generation.model}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-foreground">Warianty</dt>
                    <dd>{generation.variantCount}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-foreground">Wygenerowano</dt>
                    <dd>{formatAbsolute(generation.createdAt)}</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <VariantGrid variants={generation.variants} fileNamePrefix={`visual-guru-${generation.id}`} />
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Usunąć tę generację?</AlertDialogTitle>
            <AlertDialogDescription>
              Razem z generacją znikną wszystkie jej warianty. Tej operacji nie da się cofnąć.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleteGeneration.isPending}>
              Usuń
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
