"use client"

import { IntrastatDeleteBatchButton } from "@/components/intrastat/delete-batch-button"
import { IntrastatExportButtons } from "@/components/intrastat/export-buttons"
import {
  IntrastatKindBadge,
  IntrastatStatusBadge,
  getIntrastatStatusLabel,
} from "@/components/intrastat/status"
import { IntrastatUploadBatchButton } from "@/components/intrastat/upload-batch-button"
import { useIntrastatBatchFilterOptions, useIntrastatBatches } from "@/lib/intrastat/hooks"
import type {
  IntrastatBatchStatus,
  IntrastatBatchSummary,
  IntrastatTransactionKind,
} from "@/lib/intrastat/types"
import {
  Button,
  Checkbox,
  DataTable,
  EmptyState,
  Input,
  PageHeader,
  Pagination,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@cortex/ui"
import { formatAbsolute } from "@cortex/utils"
import type { ColumnDef } from "@tanstack/react-table"
import type { TFunction } from "i18next"
import { Database, FileSpreadsheet, Search } from "lucide-react"
import Link from "next/link"
import { useCallback, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

const PAGE_SIZE = 20
// Same wartości: etykiety statusów biorą się z `getIntrastatStatusLabel`, więc
// trzymanie ich drugi raz tutaj rozjeżdżałoby się przy pierwszej zmianie.
const STATUS_OPTIONS: Array<IntrastatBatchStatus | "all"> = [
  "all",
  "queued",
  "processing",
  "ready",
  "needs_review",
  "failed",
]
const KIND_OPTIONS: Array<IntrastatTransactionKind | "all"> = ["all", "WNT", "WDT"]

interface BatchColumnsOptions {
  t: TFunction<["intrastat", "common"]>
  selection: {
    selected: Set<string>
    allSelectedOnPage: boolean
    partiallySelectedOnPage: boolean
    toggleRow: (id: string) => void
    toggleAll: () => void
  }
}

function batchColumns(options: BatchColumnsOptions): ColumnDef<IntrastatBatchSummary>[] {
  const { t, selection } = options

  return [
    {
      id: "__select__",
      size: 36,
      header: () => (
        <Checkbox
          checked={
            selection.allSelectedOnPage
              ? true
              : selection.partiallySelectedOnPage
                ? "indeterminate"
                : false
          }
          onCheckedChange={() => selection.toggleAll()}
          aria-label={t("batches.selectVisible")}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={selection.selected.has(row.original.id)}
          onCheckedChange={() => selection.toggleRow(row.original.id)}
          onClick={(event) => event.stopPropagation()}
          aria-label={t("batches.selectRow", { name: row.original.name })}
        />
      ),
    },
    {
      accessorKey: "name",
      header: t("batches.columnBatch"),
      size: 320,
      cell: ({ row }) => (
        <div className="min-w-0">
          <Link
            href={`/intrastat/review?batch=${row.original.id}`}
            className="block truncate font-medium hover:underline"
          >
            {row.original.name}
          </Link>
          <p className="truncate text-xs text-muted-foreground">{row.original.source_type}</p>
        </div>
      ),
    },
    {
      accessorKey: "client_name",
      header: t("batches.columnClient"),
      size: 180,
      cell: ({ row }) => (
        <span className="block max-w-[180px] truncate text-muted-foreground">
          {row.original.client_name ?? t("batches.noClient")}
        </span>
      ),
    },
    {
      accessorKey: "transaction_kind",
      header: t("batches.columnType"),
      size: 90,
      cell: ({ row }) => <IntrastatKindBadge kind={row.original.transaction_kind} />,
    },
    {
      accessorKey: "line_count",
      header: t("batches.columnLines"),
      size: 90,
      cell: ({ row }) => <span className="whitespace-nowrap">{row.original.line_count}</span>,
    },
    {
      accessorKey: "alert_count",
      header: t("batches.columnAlerts"),
      size: 90,
      cell: ({ row }) => <span className="whitespace-nowrap">{row.original.alert_count}</span>,
    },
    {
      accessorKey: "status",
      header: t("batches.columnStatus"),
      size: 150,
      cell: ({ row }) => <IntrastatStatusBadge status={row.original.status} />,
    },
    {
      accessorKey: "updated_at",
      header: t("batches.columnUpdated"),
      size: 170,
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-muted-foreground">
          {formatAbsolute(row.original.updated_at)}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      size: 290,
      cell: ({ row }) => (
        <div
          className="flex items-center justify-end gap-2"
          onClick={(event) => event.stopPropagation()}
        >
          <Button asChild size="sm" variant="outline">
            <Link href={`/intrastat/review?batch=${row.original.id}`}>
              {t("batches.reviewAction")}
            </Link>
          </Button>
          <IntrastatExportButtons batchId={row.original.id} />
          <IntrastatDeleteBatchButton
            batchId={row.original.id}
            batchName={row.original.name}
            compact
            disabled={row.original.status === "processing"}
          />
        </div>
      ),
    },
  ]
}

export default function IntrastatBatchesPage() {
  const { t } = useTranslation(["intrastat", "common"])
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState<IntrastatBatchStatus | "all">("all")
  const [kind, setKind] = useState<IntrastatTransactionKind | "all">("all")
  const [clientName, setClientName] = useState<string | "all">("all")
  const [periodMonth, setPeriodMonth] = useState<string | "all">("all")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const filterOptions = useIntrastatBatchFilterOptions()
  const batches = useIntrastatBatches({
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
    status,
    transaction_kind: kind,
    client_name: clientName,
    period_month: periodMonth,
    search,
  })
  const items = useMemo(() => batches.data?.items ?? [], [batches.data?.items])
  const total = batches.data?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const visibleIds = useMemo(() => items.map((item) => item.id), [items])
  const selectedOnPageCount = visibleIds.filter((id) => selectedIds.has(id)).length
  const allSelectedOnPage = visibleIds.length > 0 && selectedOnPageCount === visibleIds.length
  const partiallySelectedOnPage = selectedOnPageCount > 0 && !allSelectedOnPage
  const selectedBatchIds = useMemo(() => [...selectedIds], [selectedIds])
  const selectionCount = selectedIds.size

  const resetPage = () => setPage(0)
  const clearSelection = useCallback(() => setSelectedIds(new Set()), [])

  const toggleRow = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleAll = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allSelectedOnPage) {
        for (const id of visibleIds) next.delete(id)
      } else {
        for (const id of visibleIds) next.add(id)
      }
      return next
    })
  }, [allSelectedOnPage, visibleIds])

  const columns = useMemo(
    () =>
      batchColumns({
        t,
        selection: {
          selected: selectedIds,
          allSelectedOnPage,
          partiallySelectedOnPage,
          toggleRow,
          toggleAll,
        },
      }),
    [t, selectedIds, allSelectedOnPage, partiallySelectedOnPage, toggleRow, toggleAll],
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <PageHeader
        title={t("batches.title")}
        description={t("batches.description")}
        actions={
          <>
            <Button asChild size="sm" variant="outline">
              <Link href="/intrastat/resources">
                <Database className="mr-2 h-4 w-4" />
                {t("batches.cnDatabase")}
              </Link>
            </Button>
            <IntrastatUploadBatchButton />
          </>
        }
      />

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-8 py-6">
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t("batches.searchPlaceholder")}
              value={search}
              onChange={(event) => {
                resetPage()
                setSearch(event.target.value)
              }}
              className="h-9 w-80 pl-9"
            />
          </div>
          <Select
            value={status}
            onValueChange={(value) => {
              resetPage()
              setStatus(value as IntrastatBatchStatus | "all")
            }}
          >
            <SelectTrigger className="h-9 w-[190px]">
              <SelectValue placeholder={t("batches.statusPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option === "all" ? t("batches.allStatuses") : getIntrastatStatusLabel(t, option)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={kind}
            onValueChange={(value) => {
              resetPage()
              setKind(value as IntrastatTransactionKind | "all")
            }}
          >
            <SelectTrigger className="h-9 w-[160px]">
              <SelectValue placeholder={t("batches.kindPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {KIND_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option === "all" ? t("batches.kindAll") : option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={clientName}
            onValueChange={(value) => {
              resetPage()
              setClientName(value)
            }}
          >
            <SelectTrigger className="h-9 w-[190px]">
              <SelectValue placeholder={t("batches.clientPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("batches.allClients")}</SelectItem>
              {(filterOptions.data?.clients ?? []).map((client) => (
                <SelectItem key={client} value={client}>
                  {client}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={periodMonth}
            onValueChange={(value) => {
              resetPage()
              setPeriodMonth(value)
            }}
          >
            <SelectTrigger className="h-9 w-[190px]">
              <SelectValue placeholder={t("batches.monthPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("batches.allMonths")}</SelectItem>
              {(filterOptions.data?.months ?? []).map((month) => (
                <SelectItem key={month} value={month}>
                  {month}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="ml-auto text-xs text-muted-foreground">
            {batches.isFetching ? t("batches.refreshing") : t("batches.total", { count: total })}
          </div>
        </div>

        {selectionCount > 0 ? (
          <div className="flex items-center justify-between rounded-md border border-border bg-muted/50 px-3 py-2 text-sm">
            <span>{t("batches.selectedCount", { count: selectionCount })}</span>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={clearSelection}>
                {t("batches.clearSelection")}
              </Button>
              <IntrastatExportButtons
                batchIds={selectedBatchIds}
                exportLabel={t("exports.exportSelected")}
                auditLabel={t("exports.auditSelected")}
              />
            </div>
          </div>
        ) : null}

        <DataTable
          columns={columns}
          data={items}
          isLoading={batches.isPending && items.length === 0}
          getRowId={(row) => row.id}
          stickyHeader
          bordered
          emptyState={
            <EmptyState
              icon={FileSpreadsheet}
              title={t("batches.emptyTitle")}
              description={t("batches.emptyDescription")}
            />
          }
        />

        <Pagination page={page} pageCount={pageCount} onChange={setPage} />
      </div>
    </div>
  )
}
