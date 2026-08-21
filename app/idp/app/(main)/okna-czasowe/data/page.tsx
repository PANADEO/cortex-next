"use client"

import { downloadCsv, snapshotsToCsv } from "@/features/okna-czasowe/helpers"
import { useFilms } from "@/features/okna-czasowe/hooks/use-films"
import { useSnapshots } from "@/features/okna-czasowe/hooks/use-snapshots"
import { Button, DataTable, EmptyState, PageHeader } from "@cortex/ui"
import { Database, FileDown } from "lucide-react"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { buildSnapshotColumns, type SnapshotRow } from "./columns"

export default function OknaCzasoweDataPage() {
  const { t } = useTranslation("okna-czasowe")
  const filmsQuery = useFilms()
  const snapshotsQuery = useSnapshots()

  const films = filmsQuery.data
  const snapshots = snapshotsQuery.data
  const isLoading = filmsQuery.isLoading || snapshotsQuery.isLoading
  const columns = useMemo(() => buildSnapshotColumns(t), [t])

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
        title={t("data.title")}
        description={t("data.description")}
        actions={
          <Button size="sm" variant="outline" onClick={handleExport} disabled={rows.length === 0}>
            <FileDown className="mr-1.5 h-3.5 w-3.5" />
            {t("data.exportCsv")}
          </Button>
        }
      />

      <div className="flex flex-1 flex-col gap-6 px-8 py-6">
        {!isLoading && rows.length === 0 ? (
          <EmptyState
            icon={Database}
            title={t("data.emptyTitle")}
            description={t("data.emptyDescription")}
          />
        ) : (
          <DataTable
            columns={columns}
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
