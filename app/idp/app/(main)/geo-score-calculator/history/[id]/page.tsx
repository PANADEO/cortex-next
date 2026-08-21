"use client"

// Szczegóły Historii (design doc §4.3) — TEN SAM layout co tryb wyniku
// Kalkulatora (§4.1, `GeoScoreResultView`), plus pełny `configSnapshot`
// użyty do TEGO wyniku (audytowalność — dane już były zapisywane w Fazie 1,
// ale nigdzie nieeksponowane aż dotąd) i usunięcie z potwierdzeniem,
// przycisk w pozycji breadcrumb-adjacent (PageHeader actions), nie
// zagrzebany pod tabelą jak w legacy Streamlicie.

import { GeoScoreResultView } from "@/features/geo-score-calculator/components/result-view"
import {
  useDeleteGeoScoreCalculation,
  useGeoScoreCalculation,
} from "@/features/geo-score-calculator/hooks"
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
  JsonViewer,
  Label,
  LoadingState,
  PageHeader,
} from "@cortex/ui"
import { formatAbsolute } from "@cortex/utils"
import { ChevronLeft, FileSearch, Trash2 } from "lucide-react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

export default function GeoScoreCalculatorHistoryDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const calculationQuery = useGeoScoreCalculation(params.id ?? null)
  const deleteCalculation = useDeleteGeoScoreCalculation()
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)

  const calculation = calculationQuery.data

  async function handleDelete() {
    if (!calculation) return
    try {
      await deleteCalculation.mutateAsync(calculation.id)
      toast.success("Usunięto analizę z historii")
      router.push("/geo-score-calculator/history")
    } catch (error) {
      toastApiError(error, "Nie udało się usunąć analizy")
    } finally {
      setIsDeleteOpen(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Szczegóły analizy"
        description={
          calculation
            ? `Zapisano ${formatAbsolute(calculation.createdAt)}`
            : "Pełny wynik i konfiguracja użyta do jego policzenia."
        }
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" asChild>
              <Link href="/geo-score-calculator/history">
                <ChevronLeft className="mr-1.5 h-3.5 w-3.5" />
                Historia
              </Link>
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!calculation}
              onClick={() => setIsDeleteOpen(true)}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Usuń
            </Button>
          </div>
        }
      />

      <div className="flex flex-1 flex-col gap-6 px-8 py-6">
        {calculationQuery.isLoading ? (
          <LoadingState label="Wczytywanie analizy…" />
        ) : calculationQuery.isError || !calculation ? (
          <EmptyState
            icon={FileSearch}
            title="Nie znaleziono analizy"
            description="Analiza nie istnieje albo nie masz do niej dostępu."
          />
        ) : (
          <>
            <GeoScoreResultView text={calculation.textContent} result={calculation.result} />

            <Card>
              <CardContent className="flex flex-col gap-2 pt-6">
                <Label>Konfiguracja użyta do tego wyniku</Label>
                <p className="text-xs text-muted-foreground">
                  Migawka wag, benchmarków, progów ocen i list słów obowiązujących w momencie tej
                  analizy — kolejne zmiany w Ustawieniach nie zmieniają już policzonego wyniku.
                </p>
                <JsonViewer data={calculation.configSnapshot} initialDepth={1} />
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Usunąć tę analizę?</AlertDialogTitle>
            <AlertDialogDescription>
              Ta operacja jest nieodwracalna — analiza zniknie z historii na stałe.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleteCalculation.isPending}>
              Usuń
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
