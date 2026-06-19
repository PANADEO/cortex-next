"use client"

import { DateRangeFilter } from "@/components/date-range-filter"
import { IdpBasicCsvDownloadButton } from "@/components/idp-basic/csv-download-dialog"
import {
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
import { AlertTriangle, FileCheck2, Search } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"

const PAGE_SIZE = 20

const STATUS_OPTIONS: Array<{ value: IdpBasicPackageStatus | "all"; label: string }> = [
  { value: "all", label: "Wszystkie statusy" },
  { value: "queued", label: "Przetwarzanie" },
  { value: "processing", label: "W toku" },
  { value: "ready", label: "Przetworzone" },
  { value: "needs_review", label: "Do weryfikacji" },
  { value: "failed", label: "Błąd przetwarzania" },
]

const columns: ColumnDef<IdpBasicResultSummary>[] = [
  {
    accessorKey: "reference_number",
    header: "Referencja",
    cell: ({ row }) => (
      <div className="min-w-0">
        <Link
          href={`/idp-basic/results/${row.original.id}`}
          className="font-medium hover:underline"
        >
          {row.original.reference_number ?? "Brak referencji"}
        </Link>
        <p className="truncate text-xs text-muted-foreground">{row.original.subject}</p>
      </div>
    ),
  },
  {
    accessorKey: "document_count",
    header: "Liczba dokumentów",
  },
  {
    accessorKey: "document_types",
    header: "Rozpoznane typy",
    cell: ({ row }) => (
      <div className="flex max-w-[280px] flex-wrap gap-1.5">
        {row.original.document_types.length > 0 ? (
          row.original.document_types.map((type) => (
            <Badge key={type} variant="secondary">
              {getIdpBasicDocumentTypeLabel(type)}
            </Badge>
          ))
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </div>
    ),
  },
  {
    accessorKey: "completeness_status",
    header: "Kompletność",
    cell: ({ row }) => <IdpBasicCompletenessBadge status={row.original.completeness_status} />,
  },
  {
    accessorKey: "received_at",
    header: "Data maila",
    cell: ({ row }) => (row.original.received_at ? formatAbsolute(row.original.received_at) : "—"),
  },
  {
    accessorKey: "sender",
    header: "Nadawca",
    cell: ({ row }) => <span className="break-all">{row.original.sender || "—"}</span>,
  },
  {
    accessorKey: "status",
    header: "Status przetwarzania",
    cell: ({ row }) => <ResultStatusCell result={row.original} />,
  },
]

function ResultStatusCell({ result }: { result: IdpBasicResultSummary }) {
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
            <p className="text-xs font-semibold uppercase text-muted-foreground">Alerty</p>
            <ul className="space-y-1.5">
              {result.alerts.map((alert) => (
                <li key={alert} className="text-sm leading-snug">
                  {alert}
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
  const items = useMemo(() => results.data?.items ?? [], [results.data?.items])
  const total = results.data?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const hasFilters = Boolean(search || status !== "all" || dateFrom || dateTo)

  const resetPage = () => setPage(0)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title="Results"
        description="Rozpoznane referencje z maili i paczek ZIP, bez ręcznej edycji danych."
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
              contextLabel={hasFilters ? "Filtrowane paczki" : "Wszystkie paczki"}
              disabled={results.isPending && items.length === 0}
            />
            <IdpBasicUploadPackageButton redirectToResult />
          </div>
        }
      />

      <div className="flex flex-1 flex-col gap-4 px-8 py-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Szukaj referencji, maila lub pliku..."
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
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.value === "all" ? option.label : getIdpBasicStatusLabel(option.value)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="ml-auto text-xs text-muted-foreground">
            {results.isFetching ? "Refreshing..." : `${total} total`}
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
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
              Reset filters
            </Button>
          ) : null}
        </div>

        <DataTable
          columns={columns}
          data={items}
          isLoading={results.isPending && items.length === 0}
          bordered
          getRowId={(row) => row.id}
          onRowClick={(row) => router.push(`/idp-basic/results/${row.id}`)}
          emptyState={
            <EmptyState
              icon={results.error ? AlertTriangle : FileCheck2}
              title={results.error ? "Failed to load results" : "No results yet"}
              description={
                results.error
                  ? "Refresh the page or check the IDP Basic backend."
                  : "Mailbox imports and ZIP uploads will appear here after processing."
              }
            />
          }
        />

        <Pagination page={page} pageCount={pageCount} onChange={setPage} />
      </div>
    </div>
  )
}
