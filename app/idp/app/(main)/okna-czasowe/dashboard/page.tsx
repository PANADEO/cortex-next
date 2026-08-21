"use client"

import { buildDashboardSummary, formatDateTime } from "@/features/okna-czasowe/helpers"
import { useFilms } from "@/features/okna-czasowe/hooks/use-films"
import { useRunScan } from "@/features/okna-czasowe/hooks/use-scan"
import { useSnapshots } from "@/features/okna-czasowe/hooks/use-snapshots"
import { toastApiError } from "@cortex/api"
import { Button, DataCard, DataTable, EmptyState, PageHeader } from "@cortex/ui"
import { Clapperboard, Film as FilmIcon, Loader2, RefreshCw, ScanSearch } from "lucide-react"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { buildDashboardColumns } from "./columns"

export default function OknaCzasoweDashboardPage() {
  const { t } = useTranslation("okna-czasowe")
  const filmsQuery = useFilms()
  const snapshotsQuery = useSnapshots()
  const runScan = useRunScan()

  const summary = buildDashboardSummary(filmsQuery.data ?? [], snapshotsQuery.data ?? [])
  const isLoading = filmsQuery.isLoading || snapshotsQuery.isLoading
  const columns = useMemo(() => buildDashboardColumns(t), [t])

  async function handleScan() {
    try {
      const result = await runScan.mutateAsync()
      toast.success(
        // Dwie liczby w jednym zdaniu, a i18next umie odmienić tylko jedną:
        // `count` odmienia człon o filmach, drugi człon przychodzi gotowy
        // z osobnego klucza mnogiego i wchodzi w {{availabilities}}.
        t("scan.success", {
          count: result.log.filmsScanned,
          availabilities: t("scan.newAvailabilities", {
            count: result.log.newAvailabilities,
          }),
        }),
      )
    } catch (error) {
      toastApiError(error, t("scan.failed"))
    }
  }

  return (
    <>
      <PageHeader
        title={t("dashboard.title")}
        description={t("dashboard.description")}
        actions={
          <Button size="sm" onClick={handleScan} disabled={runScan.isPending}>
            {runScan.isPending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <ScanSearch className="mr-1.5 h-3.5 w-3.5" />
            )}
            {t("scan.run")}
          </Button>
        }
      />

      <div className="flex flex-1 flex-col gap-6 px-8 py-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <DataCard
            label={t("dashboard.cardTrackedFilms")}
            value={summary.totalFilms}
            icon={FilmIcon}
            isLoading={isLoading}
          />
          <DataCard
            label={t("dashboard.cardAvailableNow")}
            value={summary.availableNow}
            icon={Clapperboard}
            tone={summary.availableNow > 0 ? "success" : "default"}
            isLoading={isLoading}
          />
          <DataCard
            label={t("dashboard.cardLastScan")}
            value={formatDateTime(summary.lastScanAt)}
            icon={RefreshCw}
            isLoading={isLoading}
          />
        </div>

        {!isLoading && summary.rows.length === 0 ? (
          <EmptyState
            title={t("dashboard.emptyTitle")}
            description={t("dashboard.emptyDescription")}
          />
        ) : (
          <DataTable
            columns={columns}
            data={summary.rows}
            isLoading={isLoading}
            bordered
            getRowId={(row) => row.film.id}
          />
        )}
      </div>
    </>
  )
}
