"use client"

import { DateRangeFilter } from "@/components/date-range-filter"
import { IdpBasicCsvDownloadButton } from "@/components/idp-basic/csv-download-dialog"
import {
  formatIdpBasicDisplayText,
  getIdpBasicDocumentTypeLabel,
  getIdpBasicStatusLabel,
  IdpBasicCompletenessBadge,
  IdpBasicStatusBadge,
} from "@/components/idp-basic/status"
import { IdpBasicUploadPackageButton } from "@/components/idp-basic/upload-package-button"
import { useIdpBasicResults } from "@/lib/idp-basic/hooks"
import type { IdpBasicPackageStatus, IdpBasicResultSummary } from "@/lib/idp-basic/types"
import {
  Badge,
  Button,
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@cortex/ui"
import { formatAbsolute } from "@cortex/utils"
import type { ColumnDef } from "@tanstack/react-table"
import type { TFunction } from "i18next"
import { AlertTriangle, FileCheck2, Search } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

const PAGE_SIZE = 20

const STATUS_OPTIONS: Array<IdpBasicPackageStatus | "all"> = [
  "all",
  "queued",
  "processing",
  "ready",
  "needs_review",
  "failed",
]

function buildResultColumns(t: TFunction<"idp-basic">): ColumnDef<IdpBasicResultSummary>[] {
  return [
    {
      accessorKey: "reference_number",
      header: t("results.columnReference"),
      size: 340,
      cell: ({ row }) => (
        <div className="min-w-0">
          <Link
            href={`/idp-basic/results/${row.original.id}`}
            className="block truncate font-medium hover:underline"
          >
            {row.original.reference_number ?? t("results.noReference")}
          </Link>
          <p className="truncate text-xs text-muted-foreground">{row.original.subject}</p>
        </div>
      ),
    },
    {
      accessorKey: "document_count",
      header: t("results.columnDocuments"),
      size: 100,
      cell: ({ row }) => <span className="whitespace-nowrap">{row.original.document_count}</span>,
    },
    {
      accessorKey: "document_types",
      header: t("results.columnDetectedTypes"),
      size: 230,
      cell: ({ row }) => {
        const [primaryType, ...additionalTypes] = row.original.document_types
        return (
          <div className="flex max-w-full flex-nowrap gap-1.5 overflow-hidden">
            {primaryType ? (
              <>
                <Badge variant="secondary" className="whitespace-nowrap">
                  {getIdpBasicDocumentTypeLabel(t, primaryType)}
                </Badge>
                {additionalTypes.length > 0 ? (
                  <Badge variant="outline" className="whitespace-nowrap">
                    +{additionalTypes.length}
                  </Badge>
                ) : null}
              </>
            ) : (
              <span className="text-xs text-muted-foreground">—</span>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: "completeness_status",
      header: t("results.columnCompleteness"),
      size: 150,
      cell: ({ row }) => <IdpBasicCompletenessBadge status={row.original.completeness_status} />,
    },
    {
      accessorKey: "received_at",
      header: t("results.columnMailDate"),
      size: 170,
      cell: ({ row }) => (
        <span className="whitespace-nowrap">
          {row.original.received_at ? formatAbsolute(row.original.received_at) : "—"}
        </span>
      ),
    },
    {
      accessorKey: "sender",
      header: t("results.columnSender"),
      size: 170,
      cell: ({ row }) => (
        <span className="block max-w-[160px] truncate whitespace-nowrap">
          {row.original.sender || "—"}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: t("results.columnProcessing"),
      size: 150,
      cell: ({ row }) => <ResultStatusCell result={row.original} />,
    },
  ]
}

function ResultStatusCell({ result }: { result: IdpBasicResultSummary }) {
  const { t } = useTranslation("idp-basic")
  if (result.status !== "needs_review" || result.alerts.length === 0) {
    return <IdpBasicStatusBadge status={result.status} />
  }

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex cursor-help" tabIndex={0}>
            <IdpBasicStatusBadge status={result.status} />
          </span>
        </TooltipTrigger>
        <TooltipContent
          side="left"
          align="center"
          className="max-w-80 border bg-popover p-3 text-popover-foreground shadow-lg"
        >
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              {t("results.alerts")}
            </p>
            <ul className="space-y-1.5">
              {result.alerts.map((alert) => (
                <li key={alert} className="text-sm leading-snug">
                  {formatIdpBasicDisplayText(t, alert)}
                </li>
              ))}
            </ul>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export default function IdpBasicResultsPage() {
  const { t } = useTranslation("idp-basic")
  const router = useRouter()
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState<IdpBasicPackageStatus | "all">("all")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const results = useIdpBasicResults({
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
    status,
    search,
    date_from: dateFrom,
    date_to: dateTo,
  })
  const columns = useMemo(() => buildResultColumns(t), [t])
  const items = useMemo(() => results.data?.items ?? [], [results.data?.items])
  const total = results.data?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const hasFilters = Boolean(search || status !== "all" || dateFrom || dateTo)

  const resetPage = () => setPage(0)

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <PageHeader
        title={t("results.title")}
        description={t("results.description")}
        actions={
          <div className="flex items-center gap-2">
            <IdpBasicCsvDownloadButton
              source="packages"
              filters={{
                status,
                search,
                date_from: dateFrom,
                date_to: dateTo,
              }}
              contextLabel={hasFilters ? t("packages.scopeFiltered") : t("packages.scopeAll")}
              disabled={results.isPending && items.length === 0}
            />
            <IdpBasicUploadPackageButton />
          </div>
        }
      />

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-8 py-6">
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t("results.searchPlaceholder")}
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
              setStatus(value as IdpBasicPackageStatus | "all")
            }}
          >
            <SelectTrigger className="h-9 w-[210px]">
              <SelectValue placeholder={t("filters.status")} />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option === "all" ? t("status.all") : getIdpBasicStatusLabel(t, option)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="ml-auto text-xs text-muted-foreground">
            {results.isFetching ? t("state.refreshing") : t("state.total", { total })}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-end gap-3">
          <DateRangeFilter
            idPrefix="idp-basic-results-date"
            from={dateFrom}
            to={dateTo}
            onChange={({ from, to }) => {
              resetPage()
              setDateFrom(from)
              setDateTo(to)
            }}
          />
          {hasFilters ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-9"
              onClick={() => {
                resetPage()
                setSearch("")
                setStatus("all")
                setDateFrom("")
                setDateTo("")
              }}
            >
              {t("actions.resetFilters")}
            </Button>
          ) : null}
        </div>

        <DataTable
          columns={columns}
          data={items}
          isLoading={results.isPending && items.length === 0}
          bordered
          className="min-h-0 flex-1 overflow-auto"
          stickyHeader
          tableClassName="min-w-[1310px] table-fixed"
          getRowId={(row) => row.id}
          onRowClick={(row) => router.push(`/idp-basic/results/${row.id}`)}
          emptyState={
            <EmptyState
              icon={results.error ? AlertTriangle : FileCheck2}
              title={t(results.error ? "results.errorTitle" : "results.emptyTitle")}
              description={t(
                results.error ? "results.errorDescription" : "results.emptyDescription",
              )}
            />
          }
        />

        <Pagination page={page} pageCount={pageCount} onChange={setPage} className="shrink-0" />
      </div>
    </div>
  )
}
