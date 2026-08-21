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
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

export default function GeoScoreCalculatorHistoryDetailPage() {
  const { t } = useTranslation(["geo-score-calculator", "common"])
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
      toast.success(t("detail.deleted"))
      router.push("/geo-score-calculator/history")
    } catch (error) {
      toastApiError(error, t("detail.errors.deleteFailed"))
    } finally {
      setIsDeleteOpen(false)
    }
  }

  return (
    <>
      <PageHeader
        title={t("detail.title")}
        description={
          calculation
            ? t("detail.savedAt", { date: formatAbsolute(calculation.createdAt) })
            : t("detail.description")
        }
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" asChild>
              <Link href="/geo-score-calculator/history">
                <ChevronLeft className="mr-1.5 h-3.5 w-3.5" />
                {t("detail.backToHistory")}
              </Link>
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!calculation}
              onClick={() => setIsDeleteOpen(true)}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              {t("common:actions.delete")}
            </Button>
          </div>
        }
      />

      <div className="flex flex-1 flex-col gap-6 px-8 py-6">
        {calculationQuery.isLoading ? (
          <LoadingState label={t("detail.loading")} />
        ) : calculationQuery.isError || !calculation ? (
          <EmptyState
            icon={FileSearch}
            title={t("detail.notFoundTitle")}
            description={t("detail.notFoundDescription")}
          />
        ) : (
          <>
            <GeoScoreResultView text={calculation.textContent} result={calculation.result} />

            <Card>
              <CardContent className="flex flex-col gap-2 pt-6">
                <Label>{t("detail.configLabel")}</Label>
                <p className="text-xs text-muted-foreground">{t("detail.configHint")}</p>
                <JsonViewer data={calculation.configSnapshot} initialDepth={1} />
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("detail.deleteConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("detail.deleteConfirmBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common:actions.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleteCalculation.isPending}>
              {t("common:actions.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
