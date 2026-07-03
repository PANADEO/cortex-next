"use client"

import { downloadCsv, snapshotsToCsv } from "@/features/okna-czasowe/helpers"
import { useFilms } from "@/features/okna-czasowe/hooks/use-films"
import { useSnapshots } from "@/features/okna-czasowe/hooks/use-snapshots"
import { Button, DataTable, EmptyState, PageHeader } from "@cortex/ui"
import { Database, FileDown } from "lucide-react"
import { useMemo } from "react"
import { snapshotColumns, type SnapshotRow } from "./columns"

export default function OknaCzasoweDataPage() {
  const filmsQuery = useFilms()
  const snapshotsQuery = useSnapshots()

  const films = filmsQuery.data
  const snapshots = snapshotsQuery.data
  const isLoading = filmsQuery.isLoading || snapshotsQuery.isLoading

  const rows: SnapshotRow[] = useMemo(() => {
    const filmList = films ?? []
    const snapshotList = snapshots ?? []
    const filmById = new Map(filmList.map((f) => [f.id, f]))
    return [...snapshotList]
      .sort((a, b) => b.scannedAt.localeCompare(a.scannedAt))
      .map((snapshot) => ({ snapshot, film: filmById.get(snapshot.filmId) }))
  }, [films, snapshots])

  function handleExport() {
    const csv = snapshotsToCsv(snapshots ?? [], films ?? [])
    downloadCsv(`okna-czasowe-snapshots-${new Date().toISOString().slice(0, 10)}.csv`, csv)
  }

  return (
    <>
      <PageHeader
        title="Dane"
        description="Pełna historia skanów — każdy wiersz to jeden film w jednym dniu skanowania."
        actions={
          <Button size="sm" variant="outline" onClick={handleExport} disabled={rows.length === 0}>
            <FileDown className="mr-1.5 h-3.5 w-3.5" />
            Eksportuj CSV
          </Button>
        }
      />

      <div className="flex flex-1 flex-col gap-6 px-8 py-6">
        {!isLoading && rows.length === 0 ? (
          <EmptyState
            icon={Database}
            title="Brak danych"
            description="Uruchom pierwszy skan z poziomu Dashboardu, żeby zebrać dane historyczne."
          />
        ) : (
          <DataTable
            columns={snapshotColumns}
            data={rows}
            isLoading={isLoading}
            bordered
            stickyHeader
            getRowId={(row) => row.snapshot.id}
          />
        )}
      </div>
    </>
  )
}
