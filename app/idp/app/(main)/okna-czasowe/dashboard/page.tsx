"use client"

import { buildDashboardSummary, formatDateTime } from "@/features/okna-czasowe/helpers"
import { useFilms } from "@/features/okna-czasowe/hooks/use-films"
import { useRunScan } from "@/features/okna-czasowe/hooks/use-scan"
import { useSnapshots } from "@/features/okna-czasowe/hooks/use-snapshots"
import { toastApiError } from "@cortex/api"
import { Button, DataCard, DataTable, EmptyState, PageHeader } from "@cortex/ui"
import { Clapperboard, Film as FilmIcon, Loader2, RefreshCw, ScanSearch } from "lucide-react"
import { toast } from "sonner"
import { dashboardColumns } from "./columns"

export default function OknaCzasoweDashboardPage() {
  const filmsQuery = useFilms()
  const snapshotsQuery = useSnapshots()
  const runScan = useRunScan()

  const summary = buildDashboardSummary(filmsQuery.data ?? [], snapshotsQuery.data ?? [])
  const isLoading = filmsQuery.isLoading || snapshotsQuery.isLoading

  async function handleScan() {
    try {
      const result = await runScan.mutateAsync()
      toast.success(
        `Skan zakończony: ${result.log.filmsScanned} filmów, ${result.log.newAvailabilities} nowych dostępności.`,
      )
    } catch (error) {
      toastApiError(error, "Skan nie powiódł się")
    }
  }

  return (
    <>
      <PageHeader
        title="Okna czasowe — Dashboard"
        description="Śledzenie od kiedy filmy pojawiają się na Rakuten TV PL, na podstawie codziennych skanów JustWatch."
        actions={
          <Button size="sm" onClick={handleScan} disabled={runScan.isPending}>
            {runScan.isPending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <ScanSearch className="mr-1.5 h-3.5 w-3.5" />
            )}
            Skanuj teraz
          </Button>
        }
      />

      <div className="flex flex-1 flex-col gap-6 px-8 py-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <DataCard
            label="Filmy śledzone"
            value={summary.totalFilms}
            icon={FilmIcon}
            isLoading={isLoading}
          />
          <DataCard
            label="Dostępne teraz (Rakuten PL)"
            value={summary.availableNow}
            icon={Clapperboard}
            tone={summary.availableNow > 0 ? "success" : "default"}
            isLoading={isLoading}
          />
          <DataCard
            label="Ostatni skan"
            value={formatDateTime(summary.lastScanAt)}
            icon={RefreshCw}
            isLoading={isLoading}
          />
        </div>

        {!isLoading && summary.rows.length === 0 ? (
          <EmptyState
            title="Brak filmów w bazie"
            description="Dodaj pierwsze filmy w zakładce Filmy, żeby zacząć śledzenie."
          />
        ) : (
          <DataTable
            columns={dashboardColumns}
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
