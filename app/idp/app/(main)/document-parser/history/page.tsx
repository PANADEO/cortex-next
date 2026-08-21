"use client"

import { useMyJobs } from "@/features/document-parser/hooks"
import { STATUS_BADGE_VARIANT, STATUS_LABELS } from "@/features/document-parser/status"
import type { DocumentParserJob, JobStatus } from "@/features/document-parser/types"
import {
  Badge,
  Button,
  CortexDataGrid,
  EmptyState,
  Label,
  LoadingState,
  PageHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@cortex/ui"
import { formatAbsolute, formatFileSizeBytes } from "@cortex/utils"
import type { ColumnDef } from "@tanstack/react-table"
import { ChevronRight, FileSearch } from "lucide-react"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"

const STATUS_FILTER_OPTIONS: Array<{ value: JobStatus | "all"; label: string }> = [
  { value: "all", label: "Wszystkie statusy" },
  { value: "queued", label: STATUS_LABELS.queued },
  { value: "processing", label: STATUS_LABELS.processing },
  { value: "done", label: STATUS_LABELS.done },
  { value: "error", label: STATUS_LABELS.error },
]

// Referencja stabilna między renderami — inaczej `jobsQuery.data ?? []`
// tworzyłby nową tablicę za każdym razem, unieważniając poniższy useMemo.
const EMPTY_JOBS: DocumentParserJob[] = []

export default function DocumentParserHistoryPage() {
  const router = useRouter()
  const jobsQuery = useMyJobs()
  const [statusFilter, setStatusFilter] = useState<JobStatus | "all">("all")

  const jobs = jobsQuery.data ?? EMPTY_JOBS
  const filtered = useMemo(
    () => (statusFilter === "all" ? jobs : jobs.filter((job) => job.status === statusFilter)),
    [jobs, statusFilter],
  )

  const columns: ColumnDef<DocumentParserJob, unknown>[] = useMemo(
    () => [
      { accessorKey: "fileName", header: "Plik", enableSorting: true },
      {
        accessorKey: "status",
        header: "Status",
        enableSorting: true,
        cell: ({ row }) => (
          <Badge variant={STATUS_BADGE_VARIANT[row.original.status]}>
            {STATUS_LABELS[row.original.status]}
          </Badge>
        ),
      },
      {
        accessorKey: "fileSizeBytes",
        header: "Rozmiar",
        enableSorting: true,
        cell: ({ row }) => formatFileSizeBytes(row.original.fileSizeBytes),
      },
      {
        accessorKey: "pageCount",
        header: "Strony",
        enableSorting: true,
        cell: ({ row }) => (row.original.status === "done" ? row.original.pageCount : "—"),
      },
      {
        accessorKey: "elapsedSeconds",
        header: "Czas przetwarzania",
        enableSorting: true,
        cell: ({ row }) =>
          row.original.elapsedSeconds != null ? `${row.original.elapsedSeconds.toFixed(1)} s` : "—",
      },
      {
        accessorKey: "createdAt",
        header: "Data",
        enableSorting: true,
        cell: ({ row }) => formatAbsolute(row.original.createdAt),
      },
      {
        id: "actions",
        header: () => null,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Button
              size="icon"
              variant="ghost"
              aria-label={`Zobacz szczegóły: ${row.original.fileName}`}
              onClick={() => router.push(`/document-parser/history/${row.original.id}`)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        ),
      },
    ],
    [router],
  )

  return (
    <>
      <PageHeader
        title="Historia"
        description="Zadania ekstrakcji dokumentów, które wgrałeś — status, metadane i wynik."
      />

      <div className="flex flex-1 flex-col gap-4 px-8 py-6">
        <div className="flex items-center gap-2">
          <Label htmlFor="document-parser-status-filter" className="text-xs text-muted-foreground">
            Status
          </Label>
          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as JobStatus | "all")}
          >
            <SelectTrigger id="document-parser-status-filter" className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_FILTER_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {jobsQuery.isLoading ? (
          <LoadingState label="Wczytywanie historii…" />
        ) : (
          <CortexDataGrid
            columns={columns}
            data={filtered}
            bordered
            searchable
            searchPlaceholder="Szukaj po nazwie pliku…"
            getRowId={(row) => row.id}
            emptyState={
              <EmptyState
                icon={FileSearch}
                title="Brak zadań"
                description="Wgraj pierwszy dokument na ekranie uploadu — pojawi się tutaj po zakończeniu przetwarzania."
              />
            }
          />
        )}
      </div>
    </>
  )
}
