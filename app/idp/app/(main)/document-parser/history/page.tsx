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
import { useTranslation } from "react-i18next"

// Etykieta opcji "wszystkie" przechodzi przez `t()`, więc lista powstaje w
// komponencie. Nazwy samych stanów wciąż biorą się ze `status.ts` — ten plik
// nie jest częścią tej migracji (patrz raport).
const STATUS_FILTER_VALUES = ["all", "queued", "processing", "done", "error"] as const

// Referencja stabilna między renderami — inaczej `jobsQuery.data ?? []`
// tworzyłby nową tablicę za każdym razem, unieważniając poniższy useMemo.
const EMPTY_JOBS: DocumentParserJob[] = []

export default function DocumentParserHistoryPage() {
  const { t } = useTranslation("document-parser")
  const router = useRouter()
  const jobsQuery = useMyJobs()
  const [statusFilter, setStatusFilter] = useState<JobStatus | "all">("all")

  const jobs = jobsQuery.data ?? EMPTY_JOBS

  const statusFilterOptions: Array<{ value: JobStatus | "all"; label: string }> = useMemo(
    () =>
      STATUS_FILTER_VALUES.map((value) => ({
        value,
        label: value === "all" ? t("history.filters.allStatuses") : STATUS_LABELS[value],
      })),
    [t],
  )
  const filtered = useMemo(
    () => (statusFilter === "all" ? jobs : jobs.filter((job) => job.status === statusFilter)),
    [jobs, statusFilter],
  )

  const columns: ColumnDef<DocumentParserJob, unknown>[] = useMemo(
    () => [
      { accessorKey: "fileName", header: t("history.columns.fileName"), enableSorting: true },
      {
        accessorKey: "status",
        header: t("history.columns.status"),
        enableSorting: true,
        cell: ({ row }) => (
          <Badge variant={STATUS_BADGE_VARIANT[row.original.status]}>
            {STATUS_LABELS[row.original.status]}
          </Badge>
        ),
      },
      {
        accessorKey: "fileSizeBytes",
        header: t("history.columns.fileSize"),
        enableSorting: true,
        cell: ({ row }) => formatFileSizeBytes(row.original.fileSizeBytes),
      },
      {
        accessorKey: "pageCount",
        header: t("history.columns.pages"),
        enableSorting: true,
        cell: ({ row }) => (row.original.status === "done" ? row.original.pageCount : "—"),
      },
      {
        accessorKey: "elapsedSeconds",
        header: t("history.columns.elapsed"),
        enableSorting: true,
        cell: ({ row }) =>
          row.original.elapsedSeconds != null ? `${row.original.elapsedSeconds.toFixed(1)} s` : "—",
      },
      {
        accessorKey: "createdAt",
        header: t("history.columns.createdAt"),
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
              aria-label={t("history.a11y.viewDetails", { fileName: row.original.fileName })}
              onClick={() => router.push(`/document-parser/history/${row.original.id}`)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        ),
      },
    ],
    [router, t],
  )

  return (
    <>
      <PageHeader title={t("history.title")} description={t("history.description")} />

      <div className="flex flex-1 flex-col gap-4 px-8 py-6">
        <div className="flex items-center gap-2">
          <Label htmlFor="document-parser-status-filter" className="text-xs text-muted-foreground">
            {t("history.filters.statusLabel")}
          </Label>
          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as JobStatus | "all")}
          >
            <SelectTrigger id="document-parser-status-filter" className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statusFilterOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {jobsQuery.isLoading ? (
          <LoadingState label={t("history.loading")} />
        ) : (
          <CortexDataGrid
            columns={columns}
            data={filtered}
            bordered
            searchable
            searchPlaceholder={t("history.searchPlaceholder")}
            getRowId={(row) => row.id}
            emptyState={
              <EmptyState
                icon={FileSearch}
                title={t("history.empty.title")}
                description={t("history.empty.description")}
              />
            }
          />
        )}
      </div>
    </>
  )
}
